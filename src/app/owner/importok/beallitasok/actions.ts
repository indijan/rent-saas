"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { normalizeSearchText } from "@/lib/propertyMatching";

export async function addPropertyImportAlias(formData: FormData) {
    const { supabase, user } = await requireRole("OWNER");

    const propertyId = String(formData.get("property_id") || "").trim();
    const aliasText = String(formData.get("alias_text") || "").trim();

    if (!propertyId || !aliasText) {
        return { ok: false, error: "Az ingatlan és az alias megadása kötelező." };
    }

    const normalizedAlias = normalizeSearchText(aliasText);
    if (!normalizedAlias || normalizedAlias.length < 3) {
        return { ok: false, error: "Adj meg legalább egy értelmezhető alias kifejezést." };
    }

    const { data: property, error: propertyError } = await supabase
        .from("properties")
        .select("id")
        .eq("id", propertyId)
        .eq("owner_id", user.id)
        .single();

    if (propertyError || !property) {
        return { ok: false, error: "Az ingatlan nem található." };
    }

    const { error } = await supabase
        .from("property_import_aliases")
        .insert({
            owner_id: user.id,
            property_id: propertyId,
            alias_text: aliasText,
            normalized_alias: normalizedAlias,
        });

    if (error?.code === "23505") {
        return { ok: false, error: "Ez az alias már hozzá van rendelve valamelyik ingatlanhoz." };
    }
    if (error) {
        return { ok: false, error: error.message };
    }

    revalidatePath("/owner/importok/beallitasok");
    return { ok: true };
}

export async function deletePropertyImportAlias(aliasId: string) {
    const { supabase, user } = await requireRole("OWNER");

    const { error } = await supabase
        .from("property_import_aliases")
        .delete()
        .eq("id", aliasId)
        .eq("owner_id", user.id);

    if (error) {
        return { ok: false, error: error.message };
    }

    revalidatePath("/owner/importok/beallitasok");
    return { ok: true };
}
