"use server";

import { requireRole } from "@/lib/auth/requireRole";

export async function createProperty(formData: FormData) {
    const { supabase, user } = await requireRole("OWNER");

    const name = String(formData.get("name") || "").trim();
    const address = String(formData.get("address") || "").trim();

    if (!name || !address) {
        return { ok: false, error: "Név és cím kötelező." };
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