function stripDiacritics(text: string) {
    return text.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function normalizeForSearch(text: string) {
    return stripDiacritics(text)
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

export function parseHungarianAmount(raw: string | null) {
    if (!raw) return null;
    const cleaned = raw.replace(/Ft|HUF/gi, "").replace(/\s/g, "");
    const digits = cleaned.replace(/[^\d,.-]/g, "");
    let normalized = digits;
    if (digits.includes(",")) {
        normalized = digits.replace(/\./g, "").replace(",", ".");
    } else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(digits)) {
        normalized = digits.replace(/\./g, "");
    }
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
}

const AMOUNT_TOKEN = "(-?\\d{1,3}(?:[ .]\\d{3})*(?:,\\d{1,2})?(?:\\s*(?:ft|huf))?|-?\\d+(?:,\\d{1,2})?(?:\\s*(?:ft|huf))?)";

const LABEL_PATTERNS = [
    { key: "fizetendo_osszeg_osszesen", score: 120, regex: new RegExp(`fizetendo\\s*osszeg\\s*osszesen(?:\\s*\\((?:ft|huf)\\))?\\s*:?\\s*${AMOUNT_TOKEN}(?=$|[^\\d])`, "i") },
    { key: "brutto_szamlaertek_osszesen", score: 110, regex: new RegExp(`brutto\\s*szamlaertek\\s*osszesen(?:\\s*\\((?:ft|huf)\\))?\\s*:?\\s*${AMOUNT_TOKEN}(?=$|[^\\d])`, "i") },
    { key: "fizetendo_osszeg", score: 100, regex: new RegExp(`fizetendo\\s*osszeg(?:\\s*\\((?:ft|huf)\\))?\\s*:?\\s*${AMOUNT_TOKEN}(?=$|[^\\d])`, "i") },
    { key: "brutto_vegosszeg", score: 90, regex: new RegExp(`brutto\\s*vegosszeg(?:\\s*\\((?:ft|huf)\\))?\\s*:?\\s*${AMOUNT_TOKEN}(?=$|[^\\d])`, "i") },
    { key: "vegosszeg", score: 80, regex: new RegExp(`vegosszeg(?:\\s*\\((?:ft|huf)\\))?\\s*:?\\s*${AMOUNT_TOKEN}(?=$|[^\\d])`, "i") },
] as const;

type ScoredAmount = {
    amount: number;
    score: number;
};

function findAmountsInSegment(segment: string) {
    const normalized = normalizeForSearch(segment);
    const scored: ScoredAmount[] = [];

    for (const pattern of LABEL_PATTERNS) {
        const match = normalized.match(pattern.regex);
        if (!match?.[1]) continue;
        const amount = parseHungarianAmount(match[1]);
        if (amount === null || amount <= 0) continue;
        scored.push({ amount, score: pattern.score });
    }

    return scored;
}

export function extractInvoiceAmountFromText(text: string) {
    if (!text.trim()) return null;

    const rawLines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    const matches: ScoredAmount[] = [];

    for (let i = 0; i < rawLines.length; i += 1) {
        const windows = [
            rawLines[i],
            [rawLines[i], rawLines[i + 1]].filter(Boolean).join(" "),
            [rawLines[i], rawLines[i + 1], rawLines[i + 2]].filter(Boolean).join(" "),
        ];

        for (const segment of windows) {
            const segmentMatches = findAmountsInSegment(segment);
            for (const match of segmentMatches) {
                matches.push(match);
            }
        }
    }

    for (const match of findAmountsInSegment(text)) {
        matches.push(match);
    }

    if (matches.length === 0) return null;

    const grouped = new Map<number, { count: number; bestScore: number }>();
    for (const match of matches) {
        const current = grouped.get(match.amount);
        if (!current) {
            grouped.set(match.amount, { count: 1, bestScore: match.score });
            continue;
        }
        current.count += 1;
        current.bestScore = Math.max(current.bestScore, match.score);
    }

    const ranked = Array.from(grouped.entries()).sort((a, b) => {
        const aScore = a[1].bestScore + a[1].count * 5;
        const bScore = b[1].bestScore + b[1].count * 5;
        if (bScore !== aScore) return bScore - aScore;
        return b[0] - a[0];
    });

    return ranked[0]?.[0] ?? null;
}
