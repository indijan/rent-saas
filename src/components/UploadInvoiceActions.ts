"use server";

import { requireRole } from "@/lib/auth/requireRole";

export async function createInvoiceDocument(chargeId: string, bucketPath: string) {
    const { supabase, user } = await requireRole("OWNER");

    const { data: charge, error: chargeErr } = await supabase
        .from("charges")
        .select("owner_id,tenant_id,property_id,status")
        .eq("id", chargeId)
        .eq("owner_id", user.id)
        .single();

    if (chargeErr || !charge) {
        return { ok: false, error: "Díj nem található." };
    }
    if (charge.status === "PAID" || charge.status === "ARCHIVED" || charge.status === "CANCELLED") {
        return { ok: false, error: "Ehhez a státuszú díjhoz már nem tölthető fel dokumentum." };
    }

    const { error } = await supabase.from("documents").insert({
        owner_id: charge.owner_id,
        tenant_id: charge.tenant_id,
        property_id: charge.property_id,
        charge_id: chargeId,
        bucket_path: bucketPath,
        type: "INVOICE",
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
}
