import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { renderOwnerOverdueCheckEmail, renderReminderEmail } from "@/lib/email/templates";
import { createEmailActionToken } from "@/lib/emailActionTokens";
import { listPropertyTenants } from "@/lib/propertyTenants";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://rentapp.hu";

type ReminderChargeRow = {
    id: string;
    title: string;
    amount: number | string;
    currency: string;
    due_date: string;
    owner_id: string;
    tenant_id: string | null;
    property_id: string;
    properties?: { name: string | null }[] | { name: string | null } | null;
};

type TenantProfileRow = {
    id: string;
    email: string | null;
    full_name: string | null;
};

export async function POST(request: Request) {
    const secret = process.env.CRON_SECRET;
    const auth = request.headers.get("authorization");
    const vercelCron = request.headers.get("x-vercel-cron");
    const isVercelCron = vercelCron === "1";
    const hasValidSecret = secret && auth === `Bearer ${secret}`;

    if (!isVercelCron && !hasValidSecret) {
        return new Response("Unauthorized", { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const target = new Date();
    target.setDate(target.getDate() + 2);
    const targetDate = target.toISOString().slice(0, 10);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDate = today.toISOString().slice(0, 10);

    const { data: dueSoonCharges, error } = await admin
        .from("charges")
        .select("id,title,amount,currency,due_date,owner_id,tenant_id,property_id,properties(name)")
        .eq("status", "UNPAID")
        .eq("due_date", targetDate)
        .is("reminder_sent_at", null)

    if (error) {
        return new Response(error.message, { status: 500 });
    }

    const { data: overdueCharges, error: overdueError } = await admin
        .from("charges")
        .select("id,title,amount,currency,due_date,owner_id,tenant_id,property_id,properties(name)")
        .eq("status", "UNPAID")
        .lt("due_date", todayDate)
        .is("overdue_check_sent_at", null)

    if (overdueError) {
        return new Response(overdueError.message, { status: 500 });
    }

    const allCharges = ([...(dueSoonCharges ?? []), ...(overdueCharges ?? [])] as ReminderChargeRow[]);
    const recipientsByCharge = new Map<string, TenantProfileRow[]>();

    const fallbackTenantIds = new Set<string>();
    for (const charge of allCharges) {
        const propertyTenants = await listPropertyTenants(charge.property_id);
        if (propertyTenants.length > 0) {
            recipientsByCharge.set(charge.id, propertyTenants);
            continue;
        }
        if (charge.tenant_id) fallbackTenantIds.add(charge.tenant_id);
    }

    const { data: profiles } = fallbackTenantIds.size === 0
        ? { data: [] as TenantProfileRow[] }
        : await admin
            .from("profiles")
            .select("id,email,full_name")
            .in("id", Array.from(fallbackTenantIds));

    const emailByTenant = new Map<string, { email: string; full_name: string | null }>();
    (profiles ?? [] as TenantProfileRow[]).forEach((p) => {
        if (p.email) emailByTenant.set(p.id, { email: p.email, full_name: p.full_name ?? null });
    });

    const ownerIds = Array.from(
        new Set((overdueCharges ?? [] as ReminderChargeRow[]).map((charge) => charge.owner_id).filter(Boolean))
    );
    const { data: ownerProfiles } = ownerIds.length > 0
        ? await admin.from("profiles").select("id,email,full_name").in("id", ownerIds)
        : { data: [] as TenantProfileRow[] };
    const emailByOwner = new Map<string, { email: string; full_name: string | null }>();
    (ownerProfiles ?? [] as TenantProfileRow[]).forEach((p) => {
        if (p.email) emailByOwner.set(p.id, { email: p.email, full_name: p.full_name ?? null });
    });

    const reminderIds: string[] = [];
    const overdueCheckIds: string[] = [];
    for (const charge of (dueSoonCharges ?? []) as ReminderChargeRow[]) {
        const recipients = recipientsByCharge.get(charge.id)
            ?? (charge.tenant_id ? [emailByTenant.get(charge.tenant_id)].filter(Boolean) as Array<{ email: string; full_name: string | null }> : []);
        const validRecipients = recipients.filter((recipient) => Boolean(recipient.email));
        if (validRecipients.length === 0) continue;

        const propertyName = Array.isArray(charge.properties)
            ? charge.properties[0]?.name ?? null
            : charge.properties?.name ?? null;
        for (const recipient of validRecipients) {
            const payload = renderReminderEmail({
                tenantEmail: recipient.email as string,
                title: charge.title,
                amount: Number(charge.amount),
                currency: charge.currency,
                dueDate: charge.due_date,
                propertyName,
            });
            await sendEmail(payload);
        }
        reminderIds.push(charge.id);
    }

    for (const charge of (overdueCharges ?? []) as ReminderChargeRow[]) {
        const ownerProfile = emailByOwner.get(charge.owner_id);
        if (!ownerProfile) continue;
        const propertyRecipients = recipientsByCharge.get(charge.id) ?? [];
        const tenantNames = propertyRecipients
            .map((recipient) => recipient.full_name || recipient.email)
            .filter(Boolean)
            .join(", ");
        const tenantProfile = charge.tenant_id ? emailByTenant.get(charge.tenant_id) : undefined;

        const propertyName = Array.isArray(charge.properties)
            ? charge.properties[0]?.name ?? null
            : charge.properties?.name ?? null;
        const payload = renderOwnerOverdueCheckEmail({
            ownerEmail: ownerProfile.email,
            ownerName: ownerProfile.full_name,
            tenantName: tenantNames || (tenantProfile?.full_name ?? null),
            title: charge.title,
            amount: Number(charge.amount),
            currency: charge.currency,
            dueDate: charge.due_date,
            propertyName,
            markPaidUrl: `${SITE_URL}/email-action?token=${encodeURIComponent(createEmailActionToken("charge_mark_paid", charge.id))}`,
            sendReminderUrl: `${SITE_URL}/email-action?token=${encodeURIComponent(createEmailActionToken("charge_send_reminder", charge.id))}`,
            openUrl: `${SITE_URL}/owner/todo`,
        });
        await sendEmail(payload);
        overdueCheckIds.push(charge.id);
    }

    if (reminderIds.length > 0) {
        await admin
            .from("charges")
            .update({ reminder_sent_at: new Date().toISOString() })
            .in("id", reminderIds);
    }

    if (overdueCheckIds.length > 0) {
        await admin
            .from("charges")
            .update({ overdue_check_sent_at: new Date().toISOString() })
            .in("id", overdueCheckIds);
    }

    return new Response(JSON.stringify({ ok: true, dueSoonSent: reminderIds.length, overdueCheckSent: overdueCheckIds.length }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}
