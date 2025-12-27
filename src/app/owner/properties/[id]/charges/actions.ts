"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { renderNewChargeEmail } from "@/lib/email/templates";

function daysInMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate();
}

function addMonths(dateStr: string, offset: number) {
    const [yearStr, monthStr, dayStr] = dateStr.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (!year || !month || !day) return dateStr;

    const total = year * 12 + (month - 1) + offset;
    const nextYear = Math.floor(total / 12);
    const nextMonth = (total % 12) + 1;
    const nextDay = Math.min(day, daysInMonth(nextYear, nextMonth));

    const pad = (n: number) => String(n).padStart(2, "0");
    return `${nextYear}-${pad(nextMonth)}-${pad(nextDay)}`;
}

export async function createCharge(propertyId: string, formData: FormData) {
    const { supabase, user } = await requireRole("OWNER");

    const title = String(formData.get("title") || "").trim();
    const amountRaw = String(formData.get("amount") || "").trim().replace(",", ".");
    const amount = Number(amountRaw);
    const due_date = String(formData.get("due_date") || "").trim();
    const type = String(formData.get("type") || "RENT");
    const isRecurring = String(formData.get("recurring") || "") === "on";

    if (!title || !due_date || !Number.isFinite(amount)) {
        return { ok: false, error: "Title, amount, due date kötelező." };
    }

    const { data: property, error: propErr } = await supabase
        .from("properties")
        .select("id,tenant_id,name")
        .eq("id", propertyId)
        .single();

    if (propErr || !property) return { ok: false, error: "Property nem található." };

    const recurringCount = isRecurring ? 12 : 1;
    const recurringGroup = isRecurring ? randomUUID() : null;
    const rows = Array.from({ length: recurringCount }, (_, i) => ({
        property_id: propertyId,
        owner_id: user.id,
        tenant_id: property.tenant_id, // ha van tenant, automatikusan kapja
        type,
        title,
        amount,
        currency: "HUF",
        due_date: addMonths(due_date, i),
        status: "UNPAID",
        recurring_group: recurringGroup,
        recurring_index: isRecurring ? i + 1 : null,
        recurring_count: isRecurring ? recurringCount : null,
    }));

    const { error } = await supabase.from("charges").insert(rows);

    if (error) return { ok: false, error: error.message };
    if (property.tenant_id) {
        const admin = createSupabaseAdminClient();
        const { data: tenantProfile } = await admin
            .from("profiles")
            .select("email")
            .eq("id", property.tenant_id)
            .single();

        if (tenantProfile?.email) {
            const emailPayload = renderNewChargeEmail({
                tenantEmail: tenantProfile.email,
                title,
                amount,
                currency: "HUF",
                dueDate: due_date,
                propertyName: property.name,
                count: recurringCount,
            });
            await sendEmail(emailPayload);
        }
    }
    revalidatePath(`/owner/properties/${propertyId}/charges`);
    return { ok: true };
}

export async function markChargePaid(chargeId: string) {
    const { supabase, user } = await requireRole("OWNER");

    const { data: charge, error: chargeErr } = await supabase
        .from("charges")
        .select("property_id")
        .eq("id", chargeId)
        .single();

    if (chargeErr || !charge) return { ok: false, error: "Charge nem található." };

    const { error } = await supabase
        .from("charges")
        .update({
            status: "PAID",
            paid_at: new Date().toISOString(),
        })
        .eq("id", chargeId)
        .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };
    revalidatePath(`/owner/properties/${charge.property_id}/charges`);
    return { ok: true };
}

export async function cancelCharge(chargeId: string) {
    const { supabase, user } = await requireRole("OWNER");

    const { data: charge, error: chargeErr } = await supabase
        .from("charges")
        .select("property_id,status")
        .eq("id", chargeId)
        .single();

    if (chargeErr || !charge) return { ok: false, error: "Charge nem található." };
    if (charge.status === "PAID") return { ok: false, error: "Fizetett díj nem cancel-elhető." };

    const { error } = await supabase
        .from("charges")
        .update({
            status: "CANCELLED",
        })
        .eq("id", chargeId)
        .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };
    revalidatePath(`/owner/properties/${charge.property_id}/charges`);
    return { ok: true };
}

export async function deleteCharge(chargeId: string) {
    const { supabase, user } = await requireRole("OWNER");

    const { data: charge, error: chargeErr } = await supabase
        .from("charges")
        .select("property_id")
        .eq("id", chargeId)
        .single();

    if (chargeErr || !charge) return { ok: false, error: "Charge nem található." };

    const { data: docs, error: docsErr } = await supabase
        .from("documents")
        .select("bucket_path")
        .eq("charge_id", chargeId);

    if (docsErr) return { ok: false, error: docsErr.message };

    const paths = (docs ?? []).map((d: any) => d.bucket_path).filter(Boolean);
    if (paths.length > 0) {
        const { error: storageErr } = await supabase.storage
            .from("documents")
            .remove(paths);
        if (storageErr) return { ok: false, error: storageErr.message };
    }

    const { error: docErr } = await supabase
        .from("documents")
        .delete()
        .eq("charge_id", chargeId);

    if (docErr) return { ok: false, error: docErr.message };

    const { error } = await supabase
        .from("charges")
        .delete()
        .eq("id", chargeId)
        .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };
    revalidatePath(`/owner/properties/${charge.property_id}/charges`);
    return { ok: true };
}
