import OpenAI from "openai";

const allowedTypes = ["RENT", "UTILITY", "COMMON_COST", "OTHER"] as const;
export type InvoiceExtract = {
    amount: number | null;
    currency: string | null;
    due_date: string | null;
    name: string | null;
    type: (typeof allowedTypes)[number] | null;
};

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const providerHints: { match: RegExp; name: string; type: (typeof allowedTypes)[number] }[] = [
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

function pickLabeledValue(text: string, label: RegExp) {
    const match = text.match(label);
    if (!match) return null;
    return (match[1] || "").trim() || null;
}

function normalizeWhitespace(text: string) {
    return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
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

    const dotMatch = raw.match(/^(\d{4})[.](\d{2})[.](\d{2})$/);
    if (dotMatch) return `${dotMatch[1]}-${dotMatch[2]}-${dotMatch[3]}`;

    const dmyMatch = raw.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
    if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;

    const mdyMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdyMatch) {
        const m = mdyMatch[1].padStart(2, "0");
        const d = mdyMatch[2].padStart(2, "0");
        return `${mdyMatch[3]}-${m}-${d}`;
    }

    return null;
}

export async function extractInvoiceFields(text: string) {
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
                    "Te egy magyar számlaadat-kinyerő asszisztens vagy. Csak olyan adatot adj vissza, ami a szövegben explicit módon szerepel (kulcsszóval vagy egyértelmű címkével). Ha nem biztos, null. Ne találj ki értéket. A type mező legyen RENT, UTILITY, COMMON_COST vagy OTHER. A due_date ISO (YYYY-MM-DD). A currency legyen 3 betűs kód (pl. HUF, EUR, USD). Figyelj a magyar kulcsszavakra: fizetési határidő/esedékesség, összeg/fizetendő. Az összeget magyar formátumból is értelmezd (pl. 1 234,56 HUF). A name legyen a szolgáltató/kibocsátó neve, ne a vevő/számlázási cím.",
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
    const type = parsed.type && allowedTypes.includes(parsed.type as (typeof allowedTypes)[number])
        ? (parsed.type as (typeof allowedTypes)[number])
        : null;

    const labeledAmountParsedRaw = parseHungarianAmount(labeledAmount);
    const labeledAmountParsed = labeledAmountParsedRaw && labeledAmountParsedRaw > 0 ? labeledAmountParsedRaw : null;
    const labeledDueDate = normalizeDate(labeledDue);

    const safeAmount = amount !== null && amount > 0 && currency ? amount : null;
    const safeName = name && name.length >= 3 && /\b(kft|zrt|nyrt|rt|bt|szolg[aá]ltat[oó])\b/i.test(name)
        ? name
        : null;
    const safeType = (hints || labeledName) ? "UTILITY" : type;
    const safeDueDate = labeledDueDate ?? (isReasonableYear(dueDate) ? dueDate : null);

    return {
        ok: true,
        data: {
            amount: labeledAmountParsed ?? safeAmount,
            currency: labeledAmount ? (labeledCurrency ?? "HUF") : currency,
            due_date: safeDueDate,
            name: labeledName ?? hints?.name ?? safeName,
            type: hints?.type ?? safeType,
        },
    };
}
