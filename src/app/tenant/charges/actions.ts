"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listTenantPropertyIds } from "@/lib/propertyTenants";
import { isTenantFacingCharge } from "@/lib/chargeVisibility";

export async function archiveTenantCharge(chargeId: string) {
    const { user } = await requireRole("TENANT");
    const admin = createSupabaseAdminClient();
    const propertyIds = await listTenantPropertyIds(user.id);
    if (propertyIds.length === 0) return { ok: false, error: "Nincs elérhető ingatlan ehhez a bérlőhöz." };

    const { data: charge, error: chargeErr } = await admin
        .from("charges")
        .select("status,property_id,tenant_id,type")
        .eq("id", chargeId)
        .in("property_id", propertyIds)
        .single();

    if (chargeErr || !charge) return { ok: false, error: "A díj nem található." };
    if (!isTenantFacingCharge(charge)) return { ok: false, error: "Ez a tétel nem bérlői díj." };
    if (charge.status !== "PAID") return { ok: false, error: "Csak fizetett díj archiválható." };

    const { error } = await admin
        .from("charges")
        .update({ status: "ARCHIVED" })
        .eq("id", chargeId)
        .in("property_id", propertyIds);

    if (error) return { ok: false, error: error.message };
    revalidatePath("/tenant/charges");
    revalidatePath(`/tenant/charges/${chargeId}`);
    return { ok: true };
}
