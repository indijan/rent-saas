"use server";

import { requireRole } from "@/lib/auth/requireRole";

export async function createProperty(formData: FormData) {
    const { supabase, user } = await requireRole("OWNER");

    const name = String(formData.get("name") || "").trim();
    const address = String(formData.get("address") || "").trim();

    if (!name || !address) {
        return { ok: false, error: "Név és cím kötelező." };
    }

    const { data: existingProperty, error: existingError } = await supabase
        .from("properties")
        .select("id")
        .eq("owner_id", user.id)
        .eq("name", name)
        .eq("address", address)
        .maybeSingle();

    if (existingError) {
        return { ok: false, error: existingError.message };
    }

    if (existingProperty) {
        return { ok: true, duplicate: true };
    }

    const { error } = await supabase.from("properties").insert({
        owner_id: user.id,
        tenant_id: null,
        name,
        address,
        status: "ACTIVE",
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
}
