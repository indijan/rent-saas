import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type OwnerPropertyRow = {
    id: string;
    name: string;
    address: string;
    tenant_id: string | null;
    owner_id?: string;
};

type PropertyAliasRow = {
    property_id: string;
    alias_text: string;
    normalized_alias: string;
};

type PropertyMatchResult =
    | { property: OwnerPropertyRow; reason: string; confidence: number }
    | null;

export function normalizeDiacritics(value: string) {
    return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function normalizeSearchText(value: string) {
    return normalizeDiacritics(value)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function tokenize(value: string) {
    return normalizeSearchText(value)
        .split(" ")
        .filter((token) => token.length >= 4 || /\d/.test(token));
}

function scoreMatch(haystack: string, property: OwnerPropertyRow, aliases: PropertyAliasRow[]) {
    const normalizedName = normalizeSearchText(property.name);
    const normalizedAddress = normalizeSearchText(property.address);
    const nameTokens = tokenize(property.name);
    const addressTokens = tokenize(property.address);

    let score = 0;
    const reasons: string[] = [];

    if (normalizedName && haystack.includes(normalizedName)) {
        score += 8;
        reasons.push("megnevezés");
    }

    if (normalizedAddress && haystack.includes(normalizedAddress)) {
        score += 10;
        reasons.push("teljes cím");
    }

    for (const alias of aliases) {
        if (!alias.normalized_alias) continue;
        if (haystack.includes(alias.normalized_alias)) {
            score += 12;
            reasons.push(`alias:${alias.alias_text}`);
        }
    }

    for (const token of nameTokens) {
        if (haystack.includes(token)) {
            score += /\d/.test(token) ? 3 : 2;
            reasons.push(`névtoken:${token}`);
        }
    }

    for (const token of addressTokens) {
        if (haystack.includes(token)) {
            score += /\d/.test(token) ? 4 : 2;
            reasons.push(`címtoken:${token}`);
        }
    }

    return {
        score,
        reason: Array.from(new Set(reasons)).join(", "),
    };
}

export async function suggestOwnerPropertyForIngestion(input: {
    ownerId: string;
    attachmentName?: string | null;
    sourceEmailSubject?: string | null;
    sourceEmailFrom?: string | null;
    propertyHint?: string | null;
    documentText?: string | null;
}) : Promise<PropertyMatchResult> {
    const admin = createSupabaseAdminClient();
    const [{ data: properties, error }, { data: aliases, error: aliasError }] = await Promise.all([
        admin
            .from("properties")
            .select("id,name,address,tenant_id")
            .eq("owner_id", input.ownerId)
            .order("created_at", { ascending: false }),
        admin
            .from("property_import_aliases")
            .select("property_id,alias_text,normalized_alias")
            .eq("owner_id", input.ownerId),
    ]);

    if (error || aliasError || !properties || properties.length === 0) {
        return null;
    }

    const propertyRows = properties as OwnerPropertyRow[];
    const aliasRows = (aliases ?? []) as PropertyAliasRow[];
    const aliasesByProperty = new Map<string, PropertyAliasRow[]>();
    for (const alias of aliasRows) {
        const items = aliasesByProperty.get(alias.property_id) ?? [];
        items.push(alias);
        aliasesByProperty.set(alias.property_id, items);
    }

    if (propertyRows.length === 1) {
        return {
            property: propertyRows[0],
            reason: "egyetlen ingatlan",
            confidence: 0.94,
        };
    }

    const haystack = normalizeSearchText([
        input.attachmentName ?? "",
        input.sourceEmailSubject ?? "",
        input.sourceEmailFrom ?? "",
        input.propertyHint ?? "",
        input.documentText ?? "",
    ].join(" "));

    if (!haystack) {
        return null;
    }

    const ranked = propertyRows
        .map((property) => ({
            property,
            ...scoreMatch(haystack, property, aliasesByProperty.get(property.id) ?? []),
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);

    if (ranked.length === 0) {
        return null;
    }

    const [first, second] = ranked;
    if (first.score < 4) {
        return null;
    }
    if (second && first.score - second.score < 3) {
        return null;
    }

    return {
        property: first.property,
        reason: first.reason || "szöveges egyezés",
        confidence: Math.min(0.92, 0.45 + first.score / 20),
    };
}

export async function suggestPropertyAcrossOwnersForIngestion(input: {
    attachmentName?: string | null;
    sourceEmailSubject?: string | null;
    sourceEmailFrom?: string | null;
    propertyHint?: string | null;
    documentText?: string | null;
}): Promise<(PropertyMatchResult & { ownerId: string }) | null> {
    const admin = createSupabaseAdminClient();
    const [{ data: properties, error }, { data: aliases, error: aliasError }] = await Promise.all([
        admin
            .from("properties")
            .select("id,name,address,tenant_id,owner_id")
            .order("created_at", { ascending: false }),
        admin
            .from("property_import_aliases")
            .select("property_id,alias_text,normalized_alias"),
    ]);

    if (error || aliasError || !properties || properties.length === 0) {
        return null;
    }

    const haystack = normalizeSearchText([
        input.attachmentName ?? "",
        input.sourceEmailSubject ?? "",
        input.sourceEmailFrom ?? "",
        input.propertyHint ?? "",
        input.documentText ?? "",
    ].join(" "));

    if (!haystack) return null;

    const aliasRows = (aliases ?? []) as PropertyAliasRow[];
    const aliasesByProperty = new Map<string, PropertyAliasRow[]>();
    for (const alias of aliasRows) {
        const items = aliasesByProperty.get(alias.property_id) ?? [];
        items.push(alias);
        aliasesByProperty.set(alias.property_id, items);
    }

    const ranked = (properties as OwnerPropertyRow[])
        .map((property) => ({
            property,
            ...scoreMatch(haystack, property, aliasesByProperty.get(property.id) ?? []),
        }))
        .filter((item) => item.score > 0 && item.property.owner_id)
        .sort((a, b) => b.score - a.score);

    if (ranked.length === 0) return null;
    const [first, second] = ranked;
    if (first.score < 4) return null;
    if (second && first.score - second.score < 3) return null;

    return {
        property: first.property,
        ownerId: first.property.owner_id as string,
        reason: first.reason || "szöveges egyezés",
        confidence: Math.min(0.92, 0.45 + first.score / 20),
    };
}
