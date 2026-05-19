import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyEmailActionToken } from "@/lib/emailActionTokens";
import { renderFriendlyArrearsReminderEmail, renderNewChargeEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/resend";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://rentapp.hu";

function redirectWithMessage(path: string, status: "success" | "error", message: string) {
    redirect(`${SITE_URL}${path}${path.includes("?") ? "&" : "?"}status=${status}&message=${encodeURIComponent(message)}`);
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const token = String(url.searchParams.get("token") || "").trim();
    const payload = verifyEmailActionToken(token);

    if (!payload) {
        redirectWithMessage("/login", "error", "Az e-mailes műveleti link érvénytelen vagy lejárt.");
        return;
    }

    const admin = createSupabaseAdminClient();
    const { data: charge, error } = await admin
        .from("charges")
        .select("id,owner_id,tenant_id,property_id,status,title,amount,currency,due_date,properties(name)")
        .eq("id", payload.chargeId)
        .single();

    if (error || !charge) {
        redirectWithMessage("/login", "error", "A díj nem található.");
        return;
    }

    if (payload.action === "charge_mark_paid") {
        if (charge.status === "UNPAID") {
            await admin
                .from("charges")
                .update({ status: "PAID", paid_at: new Date().toISOString() })
                .eq("id", charge.id);
        }
        redirectWithMessage("/owner/todo", "success", "A díj fizetettre lett állítva.");
    }

    if (payload.action === "charge_send_reminder") {
        if (!charge.tenant_id) {
            redirectWithMessage("/owner/todo", "error", "Ehhez a díjhoz nincs bérlő hozzárendelve.");
        }

        const { data: tenantProfile } = await admin
            .from("profiles")
            .select("email,full_name")
            .eq("id", charge.tenant_id)
            .single();

        if (!tenantProfile?.email) {
            redirectWithMessage("/owner/todo", "error", "A bérlő e-mail-címe nem érhető el.");
            return;
        }

        const propertyValue = (charge as { properties?: { name: string | null }[] | { name: string | null } | null }).properties;
        const property = Array.isArray(propertyValue) ? propertyValue[0] : propertyValue;
        const emailResult = await sendEmail(renderFriendlyArrearsReminderEmail({
            tenantEmail: tenantProfile.email,
            tenantName: tenantProfile.full_name ?? null,
            title: charge.title,
            amount: Number(charge.amount),
            currency: String(charge.currency || "HUF"),
            dueDate: String(charge.due_date),
            propertyName: property?.name ?? null,
        }));

        if (!emailResult.ok) {
            redirectWithMessage("/owner/todo", "error", emailResult.error ?? "Az emlékeztető nem küldhető ki.");
        }

        await admin
            .from("charges")
            .update({ manual_reminder_sent_at: new Date().toISOString() })
            .eq("id", charge.id);

        redirectWithMessage("/owner/todo", "success", "A baráti emlékeztető elküldve.");
    }

    if (payload.action === "charge_publish") {
        if (charge.status === "IMPORT_DRAFT") {
            await admin
                .from("charges")
                .update({ status: "UNPAID" })
                .eq("id", charge.id);

            if (charge.tenant_id) {
                const { data: tenantProfile } = await admin
                    .from("profiles")
                    .select("email")
                    .eq("id", charge.tenant_id)
                    .single();

                if (tenantProfile?.email) {
                    const propertyValue = (charge as { properties?: { name: string | null }[] | { name: string | null } | null }).properties;
                    const property = Array.isArray(propertyValue) ? propertyValue[0] : propertyValue;
                    await sendEmail(renderNewChargeEmail({
                        tenantEmail: tenantProfile.email,
                        title: charge.title,
                        amount: Number(charge.amount),
                        currency: String(charge.currency || "HUF"),
                        dueDate: String(charge.due_date),
                        propertyName: property?.name ?? null,
                        count: 1,
                    }));
                }
            }
        }

        redirectWithMessage("/owner/importok", "success", "A draft díj publikálva lett.");
    }

    redirectWithMessage("/login", "error", "Ismeretlen e-mailes művelet.");
}
