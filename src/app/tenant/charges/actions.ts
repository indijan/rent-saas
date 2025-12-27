"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";

export async function archiveTenantCharge(chargeId: string) {
    const { supabase, user } = await requireRole("TENANT");

    const { data: charge, error: chargeErr } = await supabase
        .from("charges")
        .select("status")
        .eq("id", chargeId)
        .eq("tenant_id", user.id)
        .single();

    if (chargeErr || !charge) return { ok: false, error: "Charge nem található." };
    if (charge.status !== "PAID") return { ok: false, error: "Csak PAID díj archiválható." };

    const { error } = await supabase
        .from("charges")
        .update({ status: "ARCHIVED" })
        .eq("id", chargeId)
        .eq("tenant_id", user.id);

    if (error) return { ok: false, error: error.message };
    revalidatePath("/tenant/charges");
    return { ok: true };
}
