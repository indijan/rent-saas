"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { isTenantOwnedByOwner } from "@/lib/tenantOwnership";
import { removeDocumentObjects } from "@/lib/documentStorage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensurePropertyPrimaryTenant, syncOwnerTenantMembership } from "@/lib/propertyTenants";

type DocumentPathRow = {
    bucket_path: string | null;
};

export async function assignTenantToProperty(propertyId: string, formData: FormData) {
    const { supabase, user } = await requireRole("OWNER");
    const admin = createSupabaseAdminClient();

    const tenantId = String(formData.get("tenant_id") || "").trim();
    if (!tenantId) return { ok: false, error: "Válassz ki egy bérlőt." };
    const isOwned = await isTenantOwnedByOwner(user.id, tenantId);
    if (!isOwned) return { ok: false, error: "Ezt a bérlőt nem rendelheted az ingatlanhoz." };

    const { data: property, error: propertyError } = await supabase
        .from("properties")
        .select("id,tenant_id")
        .eq("id", propertyId)
        .eq("owner_id", user.id)
        .single();

    if (propertyError || !property) return { ok: false, error: "Az ingatlan nem található." };

    const { error: membershipError } = await admin
        .from("property_tenants")
        .upsert({
            property_id: propertyId,
            tenant_id: tenantId,
            owner_id: user.id,
        }, { onConflict: "property_id,tenant_id" });

    if (membershipError) return { ok: false, error: membershipError.message };

    const { error: ownerTenantError } = await admin
        .from("tenant_memberships")
        .upsert({ user_id: tenantId, owner_id: user.id }, { onConflict: "user_id,owner_id" });

    if (ownerTenantError) return { ok: false, error: ownerTenantError.message };

    if (!property.tenant_id) {
        const { error: propErr } = await supabase
            .from("properties")
            .update({ tenant_id: tenantId })
            .eq("id", propertyId)
            .eq("owner_id", user.id);
        if (propErr) return { ok: false, error: propErr.message };

        const { error: chErr } = await supabase
            .from("charges")
            .update({ tenant_id: tenantId })
            .eq("property_id", propertyId)
            .eq("owner_id", user.id)
            .is("tenant_id", null);
        if (chErr) return { ok: false, error: chErr.message };
    }

    revalidatePath(`/owner/properties/${propertyId}`);
    revalidatePath("/owner/properties");
    revalidatePath("/owner/tenants");
    return { ok: true };
}

export async function removeTenantFromProperty(propertyId: string, tenantId: string) {
    const { user } = await requireRole("OWNER");
    const admin = createSupabaseAdminClient();

    const isOwned = await isTenantOwnedByOwner(user.id, tenantId);
    if (!isOwned) return { ok: false, error: "Ezt a bérlőt nem kezelheted." };

    const { error } = await admin
        .from("property_tenants")
        .delete()
        .eq("property_id", propertyId)
        .eq("tenant_id", tenantId)
        .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };

    await ensurePropertyPrimaryTenant(propertyId);
    await syncOwnerTenantMembership(user.id, tenantId);

    revalidatePath(`/owner/properties/${propertyId}`);
    revalidatePath("/owner/properties");
    revalidatePath("/owner/tenants");
    return { ok: true };
}

export async function updateProperty(propertyId: string, formData: FormData) {
    const { supabase, user } = await requireRole("OWNER");

    const name = String(formData.get("name") || "").trim();
    const address = String(formData.get("address") || "").trim();
    const addressSelected = String(formData.get("address_selected") || "0") === "1";
    const addressManualOverride = String(formData.get("address_manual_override") || "0") === "1";
    const status = String(formData.get("status") || "ACTIVE");

    if (!name || !address) {
        return { ok: false, error: "Név és cím kötelező." };
    }
    if (process.env.GEOAPIFY_API_KEY && !addressSelected && !addressManualOverride) {
        return { ok: false, error: "Válassz ki egy pontos címet a listából." };
    }

    const { error } = await supabase
        .from("properties")
        .update({ name, address, status })
        .eq("id", propertyId)
        .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };

    revalidatePath(`/owner/properties/${propertyId}`);
    revalidatePath("/owner/properties");
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

    const paths = ((docs ?? []) as DocumentPathRow[])
        .map((doc) => doc.bucket_path)
        .filter((path): path is string => Boolean(path));
    if (paths.length > 0) {
        try {
            await removeDocumentObjects(paths);
        } catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : "A dokumentumok törlése nem sikerült." };
        }
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

    revalidatePath("/owner/properties");
    revalidatePath("/owner/todo");
    return { ok: true };
}
