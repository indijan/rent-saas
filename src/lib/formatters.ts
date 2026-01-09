function groupWithSpaces(value: number) {
    const rounded = Math.round(value);
    const str = String(Math.abs(rounded));
    const withSpaces = str.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return rounded < 0 ? `-${withSpaces}` : withSpaces;
}

export function formatCurrency(value: number, currency: string, locale = "hu-HU") {
    if (!Number.isFinite(value)) return "";
    try {
        const upper = currency.toUpperCase();
        if (upper === "HUF") {
            return `${groupWithSpaces(value)} Ft`;
        }
        const fractionDigits = 2;
        return new Intl.NumberFormat(locale, {
            style: "currency",
            currency,
            currencyDisplay: "narrowSymbol",
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits,
        }).format(value);
    } catch {
        return `${value} ${currency}`;
    }
}
