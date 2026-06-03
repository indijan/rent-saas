import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { renderMissingInvoiceSuggestionsEmail, renderOwnerOverdueCheckEmail, renderReminderEmail } from "@/lib/email/templates";
import { createEmailActionToken } from "@/lib/emailActionTokens";
import { listPropertyTenants } from "@/lib/propertyTenants";
import { buildMissingInvoiceSuggestions } from "@/lib/invoiceSuggestions";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://rentapp.hu";
const APP_TIMEZONE = process.env.APP_TIMEZONE || "Europe/Budapest";
const MISSING_INVOICE_EMAIL_COOLDOWN_DAYS = 14;

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

type ExpenseHistoryRow = {
    id: string;
    owner_id: string;
    property_id: string;
    tenant_id: string | null;
    title: string;
    type: "UTILITY" | "INSURANCE" | "COMMON_COST" | "RENOVATION" | "TAX" | "OTHER" | "RENT";
    due_date: string;
    status: string;
    properties?: { name: string | null }[] | { name: string | null } | null;
};

function formatDateInTimeZone(date: Date) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: APP_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);
}

function addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function describeUpcomingReminder(todayDate: string, dueDate: string) {
    const today = new Date(`${todayDate}T00:00:00`);
    const due = new Date(`${dueDate}T00:00:00`);
    const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return "Az alábbi díj ma esedékes.";
    if (diffDays === 1) return "Az alábbi díj holnap esedékes.";
    return `Az alábbi díj ${diffDays} nap múlva esedékes.`;
}

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
    const now = new Date();
    const todayDate = formatDateInTimeZone(now);
    const reminderWindowEnd = formatDateInTimeZone(addDays(now, 2));
    const expenseHistoryFrom = formatDateInTimeZone(addDays(now, -400));

    const { data: dueSoonCharges, error } = await admin
        .from("charges")
        .select("id,title,amount,currency,due_date,owner_id,tenant_id,property_id,properties(name)")
        .eq("status", "UNPAID")
        .gte("due_date", todayDate)
        .lte("due_date", reminderWindowEnd)
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

    const { data: expenseHistoryRows, error: expenseHistoryError } = await admin
        .from("charges")
        .select("id,owner_id,property_id,tenant_id,title,type,due_date,status,properties(name)")
        .is("tenant_id", null)
        .neq("type", "RENT")
        .gte("due_date", expenseHistoryFrom);

    if (expenseHistoryError) {
        return new Response(expenseHistoryError.message, { status: 500 });
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
        new Set([
            ...((overdueCharges ?? []) as ReminderChargeRow[]).map((charge) => charge.owner_id),
            ...((expenseHistoryRows ?? []) as ExpenseHistoryRow[]).map((charge) => charge.owner_id),
        ].filter(Boolean))
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
    const reminderErrors: string[] = [];
    for (const charge of (dueSoonCharges ?? []) as ReminderChargeRow[]) {
        const recipients = recipientsByCharge.get(charge.id)
            ?? (charge.tenant_id ? [emailByTenant.get(charge.tenant_id)].filter(Boolean) as Array<{ email: string; full_name: string | null }> : []);
        const validRecipients = recipients.filter((recipient) => Boolean(recipient.email));
        if (validRecipients.length === 0) continue;

        const propertyName = Array.isArray(charge.properties)
            ? charge.properties[0]?.name ?? null
            : charge.properties?.name ?? null;
        let deliveredAll = true;
        for (const recipient of validRecipients) {
            const payload = renderReminderEmail({
                tenantEmail: recipient.email as string,
                title: charge.title,
                amount: Number(charge.amount),
                currency: charge.currency,
                dueDate: charge.due_date,
                propertyName,
                reminderLabel: describeUpcomingReminder(todayDate, charge.due_date),
            });
            const emailResult = await sendEmail(payload);
            if (!emailResult.ok) {
                reminderErrors.push(emailResult.error ?? `Reminder delivery failed for charge ${charge.id}.`);
                deliveredAll = false;
                continue;
            }
        }
        if (deliveredAll) reminderIds.push(charge.id);
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
        const emailResult = await sendEmail(payload);
        if (!emailResult.ok) {
            reminderErrors.push(emailResult.error ?? `Owner overdue email failed for charge ${charge.id}.`);
            continue;
        }
        overdueCheckIds.push(charge.id);
    }

    const invoiceSuggestions = buildMissingInvoiceSuggestions(
        (expenseHistoryRows ?? []) as ExpenseHistoryRow[],
        todayDate,
    );
    const invoiceSuggestionsByOwner = new Map<string, typeof invoiceSuggestions>();
    invoiceSuggestions.forEach((suggestion) => {
        const current = invoiceSuggestionsByOwner.get(suggestion.ownerId) ?? [];
        current.push(suggestion);
        invoiceSuggestionsByOwner.set(suggestion.ownerId, current);
    });

    const notificationOwnerIds = Array.from(invoiceSuggestionsByOwner.keys());
    const { data: priorNotifications, error: priorNotificationsError } = notificationOwnerIds.length === 0
        ? { data: [] as Array<{ owner_id: string; suggestion_key: string; last_sent_at: string }> , error: null }
        : await admin
            .from("owner_invoice_suggestion_notifications")
            .select("owner_id,suggestion_key,last_sent_at")
            .in("owner_id", notificationOwnerIds);

    if (priorNotificationsError) {
        return new Response(priorNotificationsError.message, { status: 500 });
    }

    const notificationByKey = new Map<string, string>();
    (priorNotifications ?? []).forEach((row) => {
        notificationByKey.set(`${row.owner_id}:${row.suggestion_key}`, row.last_sent_at);
    });

    const suggestionNotificationRows: Array<{ owner_id: string; suggestion_key: string; last_sent_at: string }> = [];
    let missingInvoiceSent = 0;
    const cooldownThreshold = addDays(now, -MISSING_INVOICE_EMAIL_COOLDOWN_DAYS).toISOString();

    for (const [ownerId, suggestions] of invoiceSuggestionsByOwner.entries()) {
        const ownerProfile = emailByOwner.get(ownerId);
        if (!ownerProfile?.email) continue;

        const dueSuggestions = suggestions.filter((suggestion) => {
            const lastSentAt = notificationByKey.get(`${ownerId}:${suggestion.suggestionKey}`);
            return !lastSentAt || lastSentAt < cooldownThreshold;
        });

        if (dueSuggestions.length === 0) continue;

        const emailPayload = renderMissingInvoiceSuggestionsEmail({
            ownerEmail: ownerProfile.email,
            ownerName: ownerProfile.full_name,
            openUrl: `${SITE_URL}/owner/todo`,
            suggestions: dueSuggestions,
        });
        const emailResult = await sendEmail(emailPayload);
        if (!emailResult.ok) {
            reminderErrors.push(emailResult.error ?? `Missing invoice suggestion email failed for owner ${ownerId}.`);
            continue;
        }

        const sentAt = new Date().toISOString();
        dueSuggestions.forEach((suggestion) => {
            suggestionNotificationRows.push({
                owner_id: ownerId,
                suggestion_key: suggestion.suggestionKey,
                last_sent_at: sentAt,
            });
        });
        missingInvoiceSent += 1;
    }

    if (reminderIds.length > 0) {
        await admin
            .from("charges")
            .update({ reminder_sent_at: new Date().toISOString() })
            .in("id", Array.from(new Set(reminderIds)));
    }

    if (overdueCheckIds.length > 0) {
        await admin
            .from("charges")
            .update({ overdue_check_sent_at: new Date().toISOString() })
            .in("id", overdueCheckIds);
    }

    if (suggestionNotificationRows.length > 0) {
        const { error: notificationError } = await admin
            .from("owner_invoice_suggestion_notifications")
            .upsert(suggestionNotificationRows, { onConflict: "owner_id,suggestion_key" });

        if (notificationError) {
            return new Response(notificationError.message, { status: 500 });
        }
    }

    return new Response(JSON.stringify({
        ok: reminderErrors.length === 0,
        dueSoonSent: Array.from(new Set(reminderIds)).length,
        overdueCheckSent: overdueCheckIds.length,
        missingInvoiceOwnerEmailsSent: missingInvoiceSent,
        errors: reminderErrors,
    }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}
