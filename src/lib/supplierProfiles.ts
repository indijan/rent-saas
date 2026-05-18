import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export function issuerFingerprint(value: string) {
    return value
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/\s+/g, " ");
}

type SupplierProfileRow = {
    id: string;
    owner_id: string;
    issuer_name: string;
    issuer_fingerprint: string;
    default_property_id: string | null;
    default_charge_type: "RENT" | "UTILITY" | "COMMON_COST" | "OTHER" | null;
    currency_hint: string | null;
    field_rules_json: Record<string, unknown> | null;
    is_global: boolean;
};

export async function findOwnerSupplierProfile(ownerId: string, issuerName: string) {
    const admin = createSupabaseAdminClient();
    const fingerprint = issuerFingerprint(issuerName);
    const { data, error } = await admin
        .from("supplier_profiles")
        .select("id,owner_id,issuer_name,issuer_fingerprint,default_property_id,default_charge_type,currency_hint,field_rules_json,is_global")
        .eq("owner_id", ownerId)
        .eq("issuer_fingerprint", fingerprint)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data as SupplierProfileRow | null;
}
