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

export async function deleteProperty(propertyId: string) {
    const { supabase, user } = await requireRole("OWNER");

    const { data: property, error: propErr } = await supabase
        .from("properties")
        .select("id")
        .eq("id", propertyId)
        .eq("owner_id", user.id)
        .single();

    if (propErr || !property) return { ok: false, error: "Ingatlan nem található." };

    const { data: docs, error: docsErr } = await supabase
        .from("documents")
        .select("bucket_path")
        .eq("property_id", propertyId);

    if (docsErr) return { ok: false, error: docsErr.message };

    const paths = (docs ?? []).map((d: any) => d.bucket_path).filter(Boolean);
    if (paths.length > 0) {
        const { error: storageErr } = await supabase.storage
            .from("documents")
            .remove(paths);
        if (storageErr) return { ok: false, error: storageErr.message };
    }

    const { error: docDeleteErr } = await supabase
        .from("documents")
        .delete()
        .eq("property_id", propertyId);

    if (docDeleteErr) return { ok: false, error: docDeleteErr.message };

    const { error: chargeErr } = await supabase
        .from("charges")
        .delete()
        .eq("property_id", propertyId)
        .eq("owner_id", user.id);

    if (chargeErr) return { ok: false, error: chargeErr.message };

    const { error } = await supabase
        .from("properties")
        .delete()
        .eq("id", propertyId)
        .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
}
