"use server";

import { requireUser } from "@/lib/auth/requireUser";

export async function createInvoiceDocument(chargeId: string, bucketPath: string) {
    const { supabase } = await requireUser();

    const { data: charge, error: chargeErr } = await supabase
        .from("charges")
        .select("owner_id,tenant_id,property_id")
        .eq("id", chargeId)
        .single();

    if (chargeErr || !charge) {
        return { ok: false, error: "Díj nem található." };
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
