import OpenAI from "openai";
import { CHARGE_TYPES, type ChargeType } from "@/lib/chargeTypes";
import { extractInvoiceAmountFromText } from "@/lib/invoiceAmountExtraction";
import type { SupplierExtractionProfile } from "@/lib/supplierProfiles";

const allowedTypes = CHARGE_TYPES;
export type InvoiceExtract = {
    amount: number | null;
    currency: string | null;
    due_date: string | null;
    name: string | null;
    type: ChargeType | null;
};

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const providerHints: { match: RegExp; name: string; type: ChargeType }[] = [
    { match: /\bM\s*V\s*M\b|Magyar\s+Villamos\s+M[uű]vek/i, name: "MVM", type: "UTILITY" },
    { match: /\bTelekom\b|Magyar\s+Telekom/i, name: "Magyar Telekom", type: "UTILITY" },
    { match: /\bMIH[ŐO]\b|Miskolci\s+h[őo]szolg[aá]ltat[oó]/i, name: "MIHŐ", type: "UTILITY" },
];

function applyProviderHints(text: string) {
    for (const hint of providerHints) {
        if (hint.match.test(text)) {
            return { name: hint.name, type: hint.type };
        }
    }
    return null;
}

function stripDiacritics(text: string) {
    return text.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function decodeShiftedText(text: string) {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i += 1) {
        bytes[i] = (text.charCodeAt(i) + 29) & 0xff;
    }
    try {
        return new TextDecoder("windows-1250").decode(bytes);
    } catch {
        return String.fromCharCode(...bytes);
    }
}

function normalizeForLabelSearch(text: string) {
    const decoded = decodeShiftedText(text);
    const withMapped = decoded
        .replace(/[†]/g, "a")
        .replace(/[Ť]/g, "e")
        .replace(/[™]/g, "o")
        .replace(/[–=]/g, "o")
        .replace(/(?<=[A-Za-z])5(?=[A-Za-z])/g, "o");
    return stripDiacritics(withMapped)
        .replace(/\u00a0/g, " ")
        .replace(/[^a-zA-Z0-9 .,/\\-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function normalizeStandard(text: string) {
    return stripDiacritics(text)
        .replace(/\u00a0/g, " ")
        .replace(/[^a-zA-Z0-9 .,/\\-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function isReasonableYear(dateStr: string | null) {
    if (!dateStr || dateStr.length < 4) return false;
    const year = Number(dateStr.slice(0, 4));
    if (!Number.isFinite(year)) return false;
    const now = new Date().getFullYear();
    return year >= now - 1 && year <= now + 2;
}

function normalizeLineForLabels(line: string) {
    return normalizeForLabelSearch(line);
}

function findValueNearLabel(lines: string[], labelRe: RegExp, valueRe: RegExp, maxLookahead = 2) {
    for (let i = 0; i < lines.length; i += 1) {
        const norm = normalizeLineForLabels(lines[i]);
        if (!labelRe.test(norm)) continue;
        for (let j = i; j <= Math.min(lines.length - 1, i + maxLookahead); j += 1) {
            const match = lines[j].match(valueRe);
            if (match?.[1]) return match[1].trim();
        }
    }
    return null;
}

function parseHungarianAmount(raw: string | null) {
    if (!raw) return null;
    const cleaned = raw.replace(/Ft|HUF/gi, "").replace(/\s/g, "");
    const digits = cleaned.replace(/[^\d,.-]/g, "");
    let normalized = digits;
    if (digits.includes(",")) {
        normalized = digits.replace(/\./g, "").replace(",", ".");
    } else if (/^\d{1,3}(?:\.\d{3})+$/.test(digits)) {
        normalized = digits.replace(/\./g, "");
    }
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
}

function extractCurrencyFromAmount(raw: string | null) {
    if (!raw) return null;
    return /Ft|HUF/i.test(raw) ? "HUF" : null;
}

function normalizeDate(input: string | null) {
    if (!input) return null;
    const raw = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const dotMatch = raw.match(/^(\d{4})[.](\d{1,2})[.](\d{1,2})$/);
    if (dotMatch) return `${dotMatch[1]}-${dotMatch[2].padStart(2, "0")}-${dotMatch[3].padStart(2, "0")}`;

    const dmyMatch = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, "0")}-${dmyMatch[1].padStart(2, "0")}`;

    const mdyMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdyMatch) {
        const m = mdyMatch[1].padStart(2, "0");
        const d = mdyMatch[2].padStart(2, "0");
        return `${mdyMatch[3]}-${m}-${d}`;
    }

    return null;
}

function isValidIsoDate(value: string | null): value is string {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function getLearnedLabels(profile: SupplierExtractionProfile | null | undefined, field: "amount" | "due_date") {
    const rules = profile?.field_rules_json;
    const labels = rules?.learned_labels;
    if (!labels || typeof labels !== "object") return [];
    const values = (labels as Record<string, unknown>)[field];
    return Array.isArray(values)
        ? values.filter((value): value is string => typeof value === "string" && value.trim().length >= 4)
        : [];
}

const invoiceDatePattern = /\b(?:\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/g;

function learnedValueLines(text: string, labels: string[]) {
    if (labels.length === 0) return [];
    const lines = text.split(/\r?\n/);
    const normalizedLabels = labels.map(normalizeStandard).filter(Boolean);
    const matchedIndexes = lines.flatMap((line, index) => {
        const normalizedLine = normalizeStandard(line);
        return normalizedLabels.some((label) => normalizedLine.includes(label)) ? [index] : [];
    });
    const indexes = new Set<number>();
    const orderedIndexes: number[] = [];
    for (const index of matchedIndexes) {
        for (const offset of [0, 1, -1, 2]) {
            const candidate = index + offset;
            if (candidate >= 0 && candidate < lines.length && !indexes.has(candidate)) {
                indexes.add(candidate);
                orderedIndexes.push(candidate);
            }
        }
    }
    return orderedIndexes.map((index) => lines[index]);
}

function extractLearnedAmount(text: string, profile: SupplierExtractionProfile | null | undefined) {
    const lines = learnedValueLines(text, getLearnedLabels(profile, "amount"));
    const amountPattern = /-?\d[\d .\u00a0]*(?:,\d{1,2})?/g;
    for (const line of lines) {
        const withoutDates = line.replace(invoiceDatePattern, " ");
        const matches = withoutDates.match(amountPattern) ?? [];
        for (const raw of matches) {
            const amount = parseHungarianAmount(raw);
            if (amount !== null && amount > 0) return amount;
        }
    }
    return null;
}

function extractDates(text: string) {
    const matches = text.match(invoiceDatePattern) ?? [];
    return matches.map(normalizeDate).filter(isValidIsoDate);
}

function extractLearnedDueDate(text: string, profile: SupplierExtractionProfile | null | undefined) {
    const lines = learnedValueLines(text, getLearnedLabels(profile, "due_date"));
    for (const line of lines) {
        const dueDate = extractDates(line)[0];
        if (dueDate) return dueDate;
    }
    return null;
}

function extractLabeledDueDate(text: string) {
    const lines = text.split(/\r?\n/);
    const dueLabel = /(?:fizetesi\s+hatarido|esedekesseg|hatarido|payment\s+due|due\s+date)/;
    for (let index = 0; index < lines.length; index += 1) {
        if (!dueLabel.test(normalizeStandard(lines[index]))) continue;
        for (let offset = 0; offset <= 2; offset += 1) {
            const date = extractDates(lines[index + offset] ?? "")[0];
            if (date) return date;
        }
    }
    return null;
}

function extractExplicitCurrency(text: string) {
    const match = text.match(/\b(HUF|EUR|USD|GBP|CHF|PLN|CZK|AUD|NZD|CAD)\b|\bFt\b/i);
    if (!match) return null;
    return /^ft$/i.test(match[0]) ? "HUF" : match[0].toUpperCase();
}

function extractLocalSupplierFields(text: string, profile: SupplierExtractionProfile | null | undefined) {
    const provider = applyProviderHints(text);
    const amount = extractLearnedAmount(text, profile) ?? extractInvoiceAmountFromText(text);
    const dueDate = extractLearnedDueDate(text, profile) ?? extractLabeledDueDate(text);
    const name = profile?.issuer_name ?? provider?.name ?? null;
    const currency = profile?.currency_hint?.toUpperCase() ?? extractExplicitCurrency(text);
    const type = profile?.default_charge_type ?? provider?.type ?? null;

    if (!amount || amount <= 0 || !isValidIsoDate(dueDate) || !name || !currency) return null;
    return { amount, currency, due_date: dueDate, name, type } satisfies InvoiceExtract;
}

export async function extractInvoiceFields(text: string, supplierProfile?: SupplierExtractionProfile | null) {
    const localExtraction = extractLocalSupplierFields(text, supplierProfile);
    if (localExtraction) return { ok: true as const, data: localExtraction };

    if (!process.env.OPENAI_API_KEY) {
        return { ok: false, error: "OPENAI_API_KEY nincs beállítva." as const };
    }

    const trimmed = text.slice(0, 15000);
    const schema = {
        name: "invoice_extract",
        schema: {
            type: "object",
            additionalProperties: false,
            properties: {
                amount: { anyOf: [{ type: "number" }, { type: "null" }] },
                currency: { anyOf: [{ type: "string" }, { type: "null" }] },
                due_date: { anyOf: [{ type: "string" }, { type: "null" }] },
                name: { anyOf: [{ type: "string" }, { type: "null" }] },
                type: { anyOf: [{ type: "string" }, { type: "null" }] },
            },
            required: ["amount", "currency", "due_date", "name", "type"],
        },
    } as const;

    const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_schema", json_schema: schema },
        messages: [
            {
                role: "system",
                content:
                    "Te egy magyar számlaadat-kinyerő asszisztens vagy. Csak olyan adatot adj vissza, ami a szövegben explicit módon szerepel (kulcsszóval vagy egyértelmű címkével). Ha nem biztos, null. Ne találj ki értéket. A type mező legyen RENT, UTILITY, INSURANCE, COMMON_COST, RENOVATION vagy OTHER. A due_date ISO (YYYY-MM-DD). A currency legyen 3 betűs kód (pl. HUF, EUR, USD). Figyelj a magyar kulcsszavakra: fizetési határidő/esedékesség, összeg/fizetendő. Az összeget magyar formátumból is értelmezd (pl. 1 234,56 HUF). A name legyen a szolgáltató/kibocsátó neve, ne a vevő/számlázási cím.",
            },
            {
                role: "user",
                content: `Számla szöveg:\n${trimmed}`,
            },
        ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: InvoiceExtract;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { ok: false, error: "Nem sikerült feldolgozni az AI választ." as const };
    }

    const hints = applyProviderHints(text);

    const decodedRaw = decodeShiftedText(text);
    const variants = [
        normalizeStandard(text),
        normalizeForLabelSearch(text),
    ];

    let labeledName: string | null = null;
    let labeledAmount: string | null = null;
    let labeledDue: string | null = null;
    let labeledCurrency: string | null = null;
    const rawLines = text.split(/\r?\n/);

    for (const compact of variants) {
        if (!labeledName) {
            const match = compact.match(/szolgaltato\s+neve\s+([a-z0-9 .-]{3,80})/i);
            labeledName = match?.[1]?.trim() || null;
        }
        if (!labeledAmount) {
            const match = compact.match(/fizetendo\s*osszeg\s*([0-9 .,-]+(?:ft|huf)?)/i);
            labeledAmount = match?.[1]?.trim() || null;
            if (labeledAmount) {
                labeledCurrency = extractCurrencyFromAmount(labeledAmount);
            }
        }
        if (!labeledDue) {
            const match = compact.match(/fizetesi\s*hatarido\s*([0-9 ./-]+)/i);
            labeledDue = match?.[1]?.replace(/\s/g, "").trim() || null;
        }
    }

    if (!labeledAmount || !labeledDue || !labeledName) {
        const decodedCompact = normalizeStandard(decodedRaw);
        if (!labeledName) {
            const match = decodedCompact.match(/szolgaltato\s+neve\s+([a-z0-9 .-]{3,80})/i);
            labeledName = match?.[1]?.trim() || null;
        }
        if (!labeledAmount) {
            const match = decodedCompact.match(/fizetend\w*\s*osszeg\s*([0-9 .,-]+(?:ft|huf)?)/i);
            labeledAmount = match?.[1]?.trim() || null;
            if (labeledAmount) {
                labeledCurrency = extractCurrencyFromAmount(labeledAmount);
            }
        }
        if (!labeledDue) {
            const match = decodedCompact.match(/fizetes\w*\s*hatarido\s*([0-9./-]+)/i);
            labeledDue = match?.[1]?.replace(/\s/g, "").trim() || null;
        }
    }

    if (!labeledAmount) {
        labeledAmount = findValueNearLabel(
            rawLines,
            /fizetendo.*osszeg/i,
            /([0-9][0-9 .,-]+(?:ft|huf)?)/i
        );
        if (labeledAmount) {
            labeledCurrency = extractCurrencyFromAmount(labeledAmount);
        }
    }

    if (!labeledDue) {
        labeledDue = findValueNearLabel(
            rawLines,
            /fizetesi.*hatarido/i,
            /([0-9]{4}[./-][0-9]{2}[./-][0-9]{2})/
        );
    }

    const asciiText = text.replace(/[^\x20-\x7E]/g, " ");
    if (!labeledAmount) {
        const encodedAmountMatch = asciiText.match(/\)L\]HW[^\n\r]{0,60}?VV\]HJ[:\s]*([0-9][0-9.\s]+)/);
        labeledAmount = encodedAmountMatch?.[1]?.trim() || null;
        if (labeledAmount) {
            labeledCurrency = "HUF";
        }
    }

    if (!labeledDue) {
        const encodedDueMatch = asciiText.match(/\)L\]HWpVL[^\n\r]{0,60}?KDWiULG[:\s]*([0-9]{4}[./-][0-9]{2}[./-][0-9]{2})/);
        labeledDue = encodedDueMatch?.[1]?.trim() || null;
    }

    if (!labeledAmount) {
        const encodedAmountRaw = text.match(/\)L\]HWHN[\s\S]{0,80}?[: ]+([0-9][0-9.]+)/);
        labeledAmount = encodedAmountRaw?.[1]?.trim() || null;
        if (labeledAmount) {
            labeledCurrency = "HUF";
        }
    }

    if (!labeledDue) {
        const encodedDueRaw = text.match(/\)L\]HWpVL[\s\S]{0,80}?[: ]+([0-9]{4}[./-][0-9]{2}[./-][0-9]{2})/);
        labeledDue = encodedDueRaw?.[1]?.trim() || null;
    }

    const currency = parsed.currency ? String(parsed.currency).trim().toUpperCase() : null;
    const amount = Number.isFinite(parsed.amount ?? NaN) ? Number(parsed.amount) : null;
    const dueDate = normalizeDate(parsed.due_date ?? null);
    const name = parsed.name ? String(parsed.name).trim() : null;
    const type = parsed.type && allowedTypes.includes(parsed.type as ChargeType)
        ? (parsed.type as ChargeType)
        : null;

    const labeledAmountParsedRaw = parseHungarianAmount(labeledAmount);
    const labeledAmountParsed = labeledAmountParsedRaw && labeledAmountParsedRaw > 0 ? labeledAmountParsedRaw : null;
    const robustAmount = extractInvoiceAmountFromText(text);
    const labeledDueDate = normalizeDate(labeledDue);

    const safeAmount = amount !== null && amount > 0 && currency ? amount : null;
    const safeName = name && name.length >= 3 && /\b(kft|zrt|nyrt|rt|bt|szolg[aá]ltat[oó])\b/i.test(name)
        ? name
        : null;
    const safeType = (hints || labeledName) ? "UTILITY" : type;
    const safeDueDate = labeledDueDate ?? (isReasonableYear(dueDate) ? dueDate : null);

    const learnedAmount = extractLearnedAmount(text, supplierProfile);
    const learnedDueDate = extractLearnedDueDate(text, supplierProfile);
    return {
        ok: true,
        data: {
            amount: learnedAmount ?? robustAmount ?? labeledAmountParsed ?? safeAmount,
            currency: supplierProfile?.currency_hint?.toUpperCase()
                ?? (labeledAmount ? (labeledCurrency ?? "HUF") : currency),
            due_date: learnedDueDate ?? safeDueDate,
            name: supplierProfile?.issuer_name ?? labeledName ?? hints?.name ?? safeName,
            type: supplierProfile?.default_charge_type ?? hints?.type ?? safeType,
        },
    };
}
