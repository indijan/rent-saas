import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type EmailLogStatus =
    | "ACCEPTED"
    | "DELIVERED"
    | "DELIVERY_DELAY"
    | "BOUNCED"
    | "COMPLAINED"
    | "REJECTED"
    | "FAILED";

export type EmailLogRecipientRole = "TENANT" | "OWNER" | "ADMIN" | "SYSTEM";

export type EmailLogContext = {
    ownerId: string;
    tenantId?: string | null;
    propertyId?: string | null;
    chargeId?: string | null;
    category: string;
    templateKey?: string | null;
    recipientRole?: EmailLogRecipientRole;
    meta?: Record<string, unknown>;
};

type CreateEmailDeliveryLogsInput = {
    recipients: string[];
    subject: string;
    context: EmailLogContext;
    status: EmailLogStatus;
    providerMessageId?: string | null;
    errorMessage?: string | null;
    occurredAt?: string;
};

type UpdateEmailDeliveryStatusInput = {
    providerMessageId: string;
    status: EmailLogStatus;
    eventAt?: string;
    errorMessage?: string | null;
};

export type EmailLogRow = {
    id: string;
    category: string;
    template_key: string | null;
    recipient_role: string;
    recipient_email: string;
    subject: string;
    provider: string;
    provider_message_id: string | null;
    status: EmailLogStatus;
    property_id: string | null;
    charge_id: string | null;
    accepted_at: string | null;
    delivered_at: string | null;
    failed_at: string | null;
    last_event_at: string;
    error_message: string | null;
    meta: Record<string, unknown> | null;
    created_at: string;
};

function toIsoString(value?: string) {
    return value || new Date().toISOString();
}

function failureTimestamp(status: EmailLogStatus, eventAt: string) {
    return status === "BOUNCED" || status === "COMPLAINED" || status === "REJECTED" || status === "FAILED"
        ? eventAt
        : null;
}

function deliveredTimestamp(status: EmailLogStatus, eventAt: string) {
    return status === "DELIVERED" ? eventAt : null;
}

export async function createEmailDeliveryLogs(input: CreateEmailDeliveryLogsInput) {
    if (input.recipients.length === 0) return;

    const admin = createSupabaseAdminClient();
    const eventAt = toIsoString(input.occurredAt);
    const rows = input.recipients.map((recipientEmail) => ({
        owner_id: input.context.ownerId,
        tenant_id: input.context.tenantId ?? null,
        property_id: input.context.propertyId ?? null,
        charge_id: input.context.chargeId ?? null,
        category: input.context.category,
        template_key: input.context.templateKey ?? null,
        recipient_role: input.context.recipientRole ?? "TENANT",
        recipient_email: recipientEmail,
        subject: input.subject,
        provider: "AWS_SES",
        provider_message_id: input.providerMessageId ?? null,
        status: input.status,
        accepted_at: input.status === "ACCEPTED" ? eventAt : null,
        delivered_at: deliveredTimestamp(input.status, eventAt),
        failed_at: failureTimestamp(input.status, eventAt),
        last_event_at: eventAt,
        error_message: input.errorMessage ?? null,
        meta: input.context.meta ?? {},
    }));

    const { error } = await admin
        .from("email_delivery_logs")
        .insert(rows);

    if (error) {
        console.error("Email log insert failed", error.message);
    }
}

export async function updateEmailDeliveryStatusByMessageId(input: UpdateEmailDeliveryStatusInput) {
    if (!input.providerMessageId) return;

    const admin = createSupabaseAdminClient();
    const eventAt = toIsoString(input.eventAt);
    const patch: Record<string, string | null> = {
        status: input.status,
        last_event_at: eventAt,
        error_message: input.errorMessage ?? null,
    };

    if (input.status === "DELIVERED") {
        patch.delivered_at = eventAt;
    }
    if (input.status === "BOUNCED" || input.status === "COMPLAINED" || input.status === "REJECTED" || input.status === "FAILED") {
        patch.failed_at = eventAt;
    }

    const { error } = await admin
        .from("email_delivery_logs")
        .update(patch)
        .eq("provider_message_id", input.providerMessageId);

    if (error) {
        console.error("Email log update failed", error.message);
    }
}

export async function listOwnerEmailLogsLast30Days(ownerId: string) {
    const admin = createSupabaseAdminClient();
    const since = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString();

    const { data, error } = await admin
        .from("email_delivery_logs")
        .select("id,category,template_key,recipient_role,recipient_email,subject,provider,provider_message_id,status,property_id,charge_id,accepted_at,delivered_at,failed_at,last_event_at,error_message,meta,created_at")
        .eq("owner_id", ownerId)
        .eq("recipient_role", "TENANT")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);

    if (error) {
        throw new Error(error.message);
    }

    return (data ?? []) as EmailLogRow[];
}

export function getEmailLogStatusLabel(status: EmailLogStatus) {
    switch (status) {
        case "ACCEPTED":
            return "SES elfogadta";
        case "DELIVERED":
            return "Kézbesítve";
        case "DELIVERY_DELAY":
            return "Késleltetve";
        case "BOUNCED":
            return "Visszapattant";
        case "COMPLAINED":
            return "Spam panasz";
        case "REJECTED":
            return "Elutasítva";
        case "FAILED":
            return "Sikertelen";
    }
}

export function getEmailLogStatusTone(status: EmailLogStatus) {
    switch (status) {
        case "DELIVERED":
            return "dashboard-inline-badge-green";
        case "DELIVERY_DELAY":
        case "ACCEPTED":
            return "dashboard-inline-badge-amber";
        case "BOUNCED":
        case "COMPLAINED":
        case "REJECTED":
        case "FAILED":
            return "dashboard-inline-badge-red";
    }
}

export function getEmailLogCategoryLabel(category: string) {
    switch (category) {
        case "NEW_CHARGE":
            return "Új tétel";
        case "DUE_SOON_REMINDER":
            return "Automata lejárati értesítő";
        case "MANUAL_ARREARS_REMINDER":
            return "Kézi emlékeztető";
        case "CHARGE_UPDATED":
            return "Tétel módosítva";
        case "TENANT_INVITE":
            return "Bérlő meghívás";
        case "TENANT_EXIT_APPROVED":
            return "Kilépés jóváhagyva";
        case "TENANT_EXIT_REJECTED":
            return "Kilépés elutasítva";
        default:
            return category;
    }
}
