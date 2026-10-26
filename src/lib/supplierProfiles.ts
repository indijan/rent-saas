import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ChargeType } from "@/lib/chargeTypes";
import { parseHungarianAmount } from "@/lib/invoiceAmountExtraction";

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
    default_charge_type: ChargeType | null;
    currency_hint: string | null;
    field_rules_json: Record<string, unknown> | null;
    is_global: boolean;
};

export type SupplierExtractionProfile = Pick<
    SupplierProfileRow,
    "issuer_name" | "default_charge_type" | "currency_hint" | "field_rules_json"
>;

type CorrectionSnapshot = {
    issuer_name: string | null;
    due_date: string | null;
    gross_amount: number | null;
    currency: string | null;
    charge_type: string | null;
    property_id: string | null;
};

function normalizeRuleLabel(value: string) {
    return value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function labelNearValue(text: string, field: "amount" | "due_date", expected: string | number) {
    const lines = text.split(/\r?\n/).map((line) => line.trim());
    const datePattern = /\b(?:\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/g;
    const amountPattern = /\b\d[\d .\u00a0]*(?:,\d{1,2})?\b/g;
    const labelWords = /\b(?:osszeg|fizetendo|vegosszeg|brutto|hatarido|esedekesseg|fizetesi|amount|total|due|payment)\b/;
    const matchesExpected = (line: string) => {
        if (field === "due_date") {
            const dates = line.match(datePattern) ?? [];
            return dates.some((raw) => {
                const parts = raw.match(/\d+/g) ?? [];
                if (parts.length !== 3) return false;
                const iso = parts[0].length === 4
                    ? `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`
                    : `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
                return iso === String(expected);
            });
        }
        const amounts = line.match(amountPattern) ?? [];
        return amounts.some((raw) => {
            const parsed = parseHungarianAmount(raw);
            return parsed !== null && Math.abs(parsed - Number(expected)) < 0.01;
        });
    };

    for (let index = 0; index < lines.length; index += 1) {
        if (!matchesExpected(lines[index])) continue;
        const current = lines[index];
        const valuePattern = field === "due_date" ? datePattern : amountPattern;
        valuePattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = valuePattern.exec(current))) {
            const isExpected = field === "due_date"
                ? (() => {
                    const parts = match?.[0].match(/\d+/g) ?? [];
                    if (parts.length !== 3) return false;
                    const iso = parts[0].length === 4
                        ? `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`
                        : `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
                    return iso === String(expected);
                })()
                : Math.abs((parseHungarianAmount(match[0]) ?? NaN) - Number(expected)) < 0.01;
            if (!isExpected) continue;

            const before = normalizeRuleLabel(current.slice(0, match.index)).slice(-60);
            const after = normalizeRuleLabel(current.slice(match.index + match[0].length)).slice(0, 60);
            const adjacentBefore = normalizeRuleLabel(lines[index - 1] || "").slice(-60);
            const adjacentAfter = normalizeRuleLabel(lines[index + 1] || "").slice(0, 60);
            const label = [before, after, adjacentBefore, adjacentAfter].find((candidate) =>
                candidate.length >= 4 && candidate.length <= 60 && labelWords.test(candidate)
            );
            if (label) return label;
        }
    }
    return null;
}

function appendLearnedLabel(rules: Record<string, unknown>, field: "amount" | "due_date", label: string | null) {
    if (!label) return rules;
    const learnedLabels = (rules.learned_labels && typeof rules.learned_labels === "object"
        ? rules.learned_labels
        : {}) as Record<string, unknown>;
    const current = Array.isArray(learnedLabels[field])
        ? learnedLabels[field].filter((value): value is string => typeof value === "string")
        : [];
    const next = [label, ...current.filter((value) => value !== label)].slice(0, 5);
    return { ...rules, learned_labels: { ...learnedLabels, [field]: next } };
}

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

export async function findOwnerSupplierProfileForText(ownerId: string, text: string) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
        .from("supplier_profiles")
        .select("id,owner_id,issuer_name,issuer_fingerprint,default_property_id,default_charge_type,currency_hint,field_rules_json,is_global")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(100);

    if (error) throw error;
    const normalizeForMatch = (value: string) => issuerFingerprint(value)
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const normalizedText = normalizeForMatch(text);
    const profiles = (data ?? []) as SupplierProfileRow[];
    return profiles
        .map((profile) => ({ profile, match: normalizeForMatch(profile.issuer_name) }))
        .filter(({ match }) => match.length >= 3 && normalizedText.includes(match))
        .sort((left, right) => right.match.length - left.match.length)[0]?.profile ?? null;
}

export async function learnSupplierCorrection(input: {
    ownerId: string;
    text: string;
    raw: Record<string, unknown> | null;
    final: CorrectionSnapshot;
}) {
    const issuerName = input.final.issuer_name?.trim();
    if (!issuerName) return;

    const admin = createSupabaseAdminClient();
    const fingerprint = issuerFingerprint(issuerName);
    if (!fingerprint) return;

    const existing = await findOwnerSupplierProfile(input.ownerId, issuerName);
    let rules = { ...(existing?.field_rules_json ?? {}) } as Record<string, unknown>;
    const rawAmount = Number(input.raw?.amount);
    const finalAmount = input.final.gross_amount;
    if (finalAmount !== null && (!Number.isFinite(rawAmount) || Math.abs(rawAmount - finalAmount) >= 0.01)) {
        rules = appendLearnedLabel(rules, "amount", labelNearValue(input.text, "amount", finalAmount));
    }

    const rawDueDate = typeof input.raw?.due_date === "string" ? input.raw.due_date : null;
    if (input.final.due_date && rawDueDate !== input.final.due_date) {
        rules = appendLearnedLabel(rules, "due_date", labelNearValue(input.text, "due_date", input.final.due_date));
    }

    rules.review_count = Number(rules.review_count ?? 0) + 1;
    rules.last_reviewed_at = new Date().toISOString();

    const { error } = await admin
        .from("supplier_profiles")
        .upsert({
            owner_id: input.ownerId,
            issuer_name: issuerName,
            issuer_fingerprint: fingerprint,
            default_property_id: existing?.default_property_id ?? input.final.property_id,
            default_charge_type: input.final.charge_type,
            currency_hint: input.final.currency,
            field_rules_json: rules,
            is_global: false,
        }, { onConflict: "owner_id,issuer_fingerprint" });

    if (error) throw error;
}
