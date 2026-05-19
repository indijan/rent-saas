export function maskAddress(address: string | null | undefined) {
    if (!address) return "";

    const trimmed = address.trim();
    if (!trimmed) return "";

    const withoutPostcode = trimmed.replace(/^\d{4}\s+/, "");
    const parts = withoutPostcode.split(",").map((part) => part.trim()).filter(Boolean);

    if (parts.length >= 2) {
        const city = parts[0];
        const street = parts[1]
            .replace(/\s+\d+[A-Za-z/-]*\.?$/u, "")
            .trim();
        return `${city}, ${street}`;
    }

    return withoutPostcode.replace(/\s+\d+[A-Za-z/-]*\.?$/u, "").trim();
}
