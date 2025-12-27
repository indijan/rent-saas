import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { renderReminderEmail } from "@/lib/email/templates";

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

    const { data: charges, error } = await admin
        .from("charges")
        .select("id,title,amount,currency,due_date,tenant_id,properties(name)")
        .eq("status", "UNPAID")
        .eq("due_date", targetDate)
        .is("reminder_sent_at", null)
        .not("tenant_id", "is", null);

    if (error) {
        return new Response(error.message, { status: 500 });
    }

    const tenantIds = Array.from(
        new Set((charges ?? []).map((c: any) => c.tenant_id).filter(Boolean))
    );
    const { data: profiles } = await admin
        .from("profiles")
        .select("id,email")
        .in("id", tenantIds);

    const emailByTenant = new Map<string, string>();
    (profiles ?? []).forEach((p: any) => {
        if (p.email) emailByTenant.set(p.id, p.email);
    });

    const chargeIds: string[] = [];
    for (const charge of charges ?? []) {
        const tenantEmail = emailByTenant.get(charge.tenant_id);
        if (!tenantEmail) continue;

        const propertyName = Array.isArray(charge.properties)
            ? charge.properties[0]?.name ?? null
            : charge.properties?.name ?? null;
        const payload = renderReminderEmail({
            tenantEmail,
            title: charge.title,
            amount: Number(charge.amount),
            currency: charge.currency,
            dueDate: charge.due_date,
            propertyName,
        });
        await sendEmail(payload);
        chargeIds.push(charge.id);
    }

    if (chargeIds.length > 0) {
        await admin
            .from("charges")
            .update({ reminder_sent_at: new Date().toISOString() })
            .in("id", chargeIds);
    }

    return new Response(JSON.stringify({ ok: true, sent: chargeIds.length }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}
