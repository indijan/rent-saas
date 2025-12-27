"use server";

import { requireRole } from "@/lib/auth/requireRole";

export async function assignTenantToProperty(propertyId: string, formData: FormData) {
    const { supabase, user } = await requireRole("OWNER");

    const tenantId = String(formData.get("tenant_id") || "").trim();
    if (!tenantId) return { ok: false, error: "Válassz ki egy tenantot." };

    // Property tenant_id beállítás (csak a saját ingatlanodra)
    const { error: propErr } = await supabase
        .from("properties")
        .update({ tenant_id: tenantId })
        .eq("id", propertyId)
        .eq("owner_id", user.id);

    if (propErr) return { ok: false, error: propErr.message };

    // Régi díjakra is ráírjuk, ahol még nincs tenant_id
    const { error: chErr } = await supabase
        .from("charges")
        .update({ tenant_id: tenantId })
        .eq("property_id", propertyId)
        .eq("owner_id", user.id)
        .is("tenant_id", null);

    if (chErr) return { ok: false, error: chErr.message };

    return { ok: true };
}

export async function updateProperty(propertyId: string, formData: FormData) {
    const { supabase, user } = await requireRole("OWNER");

    const name = String(formData.get("name") || "").trim();
    const address = String(formData.get("address") || "").trim();
    const status = String(formData.get("status") || "ACTIVE");

    if (!name || !address) {
        return { ok: false, error: "Név és cím kötelező." };
    }

    const { error } = await supabase
        .from("properties")
        .update({ name, address, status })
        .eq("id", propertyId)
        .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
}
