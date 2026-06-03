import type { ChargeType } from "@/lib/chargeTypes";

type SuggestionChargeRow = {
    id: string;
    owner_id: string;
    property_id: string;
    tenant_id: string | null;
    title: string;
    type: ChargeType;
    due_date: string;
    status: string;
    properties?: { name: string | null } | { name: string | null }[] | null;
};

export type MissingInvoiceSuggestion = {
    suggestionKey: string;
    ownerId: string;
    propertyId: string;
    propertyName: string | null;
    title: string;
    type: ChargeType;
    fingerprint: string;
    lastSeenDate: string;
    expectedDate: string;
    daysLate: number;
    cadenceDays: number;
    occurrenceCount: number;
    confidence: "high" | "medium";
};

type GroupedCharge = {
    ownerId: string;
    propertyId: string;
    propertyName: string | null;
    title: string;
    type: ChargeType;
    fingerprint: string;
    dueDates: string[];
};

const GENERIC_TOKENS = new Set([
    "szamla",
    "dij",
    "dijbekero",
    "fizetesi",
    "hatarido",
    "hataridore",
    "esedekes",
    "ingatlan",
    "berbeado",
    "berlo",
    "berleti",
    "koltseg",
    "kozmu",
    "egyeb",
    "szolgaltatas",
    "szolgaltato",
    "honap",
    "hav",
    "ev",
    "forint",
    "ft",
    "huf",
    "pdf",
    "masolat",
]);

const MONTH_TOKENS = new Set([
    "januar",
    "februar",
    "marcius",
    "aprilis",
    "majus",
    "junius",
    "julius",
    "augusztus",
    "szeptember",
    "oktober",
    "november",
    "december",
    "jan",
    "feb",
    "mar",
    "apr",
    "maj",
    "jun",
    "jul",
    "aug",
    "szept",
    "okt",
    "nov",
    "dec",
]);

const RECURRING_KEYWORDS = [
    "villany",
    "aram",
    "gaz",
    "viz",
    "csatorna",
    "futes",
    "kozos",
    "biztositas",
    "internet",
    "telefon",
    "tv",
    "szemet",
    "hulladek",
    "ado",
];

function normalizeToken(value: string) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function tokenizeTitle(title: string) {
    return normalizeToken(title)
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter(Boolean)
        .filter((token) => token.length >= 3)
        .filter((token) => !/^\d+$/.test(token))
        .filter((token) => !GENERIC_TOKENS.has(token))
        .filter((token) => !MONTH_TOKENS.has(token));
}

function buildFingerprint(title: string) {
    const tokens = Array.from(new Set(tokenizeTitle(title)));
    if (tokens.length === 0) {
        return normalizeToken(title).replace(/[^a-z]+/g, " ").trim().slice(0, 24) || "ismeretlen";
    }

    const priority = RECURRING_KEYWORDS.filter((token) => tokens.includes(token));
    const secondary = tokens
        .filter((token) => !priority.includes(token))
        .sort((left, right) => left.localeCompare(right, "hu"));

    return [...priority.slice(0, 2), ...secondary.slice(0, 2)].slice(0, 3).join(" ");
}

function firstPropertyName(value: SuggestionChargeRow["properties"]) {
    if (Array.isArray(value)) return value[0]?.name ?? null;
    return value?.name ?? null;
}

function toDate(dateValue: string) {
    return new Date(`${dateValue}T00:00:00Z`);
}

function addDays(dateValue: string, days: number) {
    const next = toDate(dateValue);
    next.setUTCDate(next.getUTCDate() + days);
    return next.toISOString().slice(0, 10);
}

function dayDiff(fromDate: string, toDateValue: string) {
    const diff = toDate(toDateValue).getTime() - toDate(fromDate).getTime();
    return Math.round(diff / (1000 * 60 * 60 * 24));
}

function median(values: number[]) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
        : sorted[middle];
}

function isOwnExpenseCharge(row: SuggestionChargeRow) {
    return !row.tenant_id && row.type !== "RENT";
}

export function buildMissingInvoiceSuggestions(
    charges: SuggestionChargeRow[],
    todayDate: string,
) {
    const groups = new Map<string, GroupedCharge>();

    for (const charge of charges) {
        if (!isOwnExpenseCharge(charge)) continue;
        if (charge.status === "CANCELLED" || charge.status === "IMPORT_DRAFT") continue;

        const fingerprint = buildFingerprint(charge.title);
        const key = `${charge.owner_id}:${charge.property_id}:${charge.type}:${fingerprint}`;
        const existing = groups.get(key);

        if (!existing) {
            groups.set(key, {
                ownerId: charge.owner_id,
                propertyId: charge.property_id,
                propertyName: firstPropertyName(charge.properties),
                title: charge.title,
                type: charge.type,
                fingerprint,
                dueDates: [charge.due_date],
            });
            continue;
        }

        existing.dueDates.push(charge.due_date);
        if (charge.due_date > existing.dueDates[existing.dueDates.length - 1]) {
            existing.title = charge.title;
            existing.propertyName = firstPropertyName(charge.properties) ?? existing.propertyName;
        }
    }

    const suggestions: MissingInvoiceSuggestion[] = [];

    for (const group of groups.values()) {
        const dueDates = Array.from(new Set(group.dueDates)).sort((left, right) => left.localeCompare(right));
        if (dueDates.length < 2) continue;

        const intervals = dueDates
            .slice(1)
            .map((dateValue, index) => dayDiff(dueDates[index], dateValue))
            .filter((value) => value >= 14 && value <= 90);

        if (intervals.length === 0) continue;

        const cadenceDays = median(intervals);
        if (cadenceDays < 14 || cadenceDays > 90) continue;

        const lastSeenDate = dueDates[dueDates.length - 1];
        const expectedDate = addDays(lastSeenDate, cadenceDays);
        const toleranceDays = Math.max(
            4,
            Math.min(
                12,
                Math.round(cadenceDays * 0.25) + Math.round((Math.max(...intervals) - Math.min(...intervals)) / 2),
            ),
        );
        const alertDate = addDays(expectedDate, toleranceDays);
        const daysLate = dayDiff(alertDate, todayDate);

        if (daysLate < 0) continue;

        suggestions.push({
            suggestionKey: `${group.propertyId}:${group.type}:${group.fingerprint}`,
            ownerId: group.ownerId,
            propertyId: group.propertyId,
            propertyName: group.propertyName,
            title: group.title,
            type: group.type,
            fingerprint: group.fingerprint,
            lastSeenDate,
            expectedDate,
            daysLate: daysLate + 1,
            cadenceDays,
            occurrenceCount: dueDates.length,
            confidence: dueDates.length >= 4 && intervals.length >= 2 ? "high" : "medium",
        });
    }

    return suggestions.sort((left, right) => {
        if (right.daysLate !== left.daysLate) return right.daysLate - left.daysLate;
        return left.expectedDate.localeCompare(right.expectedDate);
    });
}
