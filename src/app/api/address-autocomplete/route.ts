import { NextResponse } from "next/server";

type GeoapifyResult = {
    formatted?: string;
    city?: string;
    street?: string;
    housenumber?: string;
};

export async function GET(request: Request) {
    const apiKey = process.env.GEOAPIFY_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ ok: false, error: "A címkereső nincs beállítva." }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const query = String(searchParams.get("q") || "").trim();

    if (query.length < 3) {
        return NextResponse.json({ ok: true, results: [] });
    }

    const geoapifyUrl = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
    geoapifyUrl.searchParams.set("text", query);
    geoapifyUrl.searchParams.set("filter", "countrycode:hu");
    geoapifyUrl.searchParams.set("format", "json");
    geoapifyUrl.searchParams.set("limit", "5");
    geoapifyUrl.searchParams.set("apiKey", apiKey);

    const response = await fetch(geoapifyUrl.toString(), {
        headers: {
            Accept: "application/json",
        },
        cache: "no-store",
    });

    if (!response.ok) {
        return NextResponse.json({ ok: false, error: "A címkereső nem válaszol." }, { status: 502 });
    }

    const json = await response.json();
    const results = Array.isArray(json?.results) ? json.results as GeoapifyResult[] : [];

    return NextResponse.json({
        ok: true,
        results: results
            .map((item) => ({
                formatted: item.formatted || "",
                city: item.city || "",
                street: item.street || "",
                housenumber: item.housenumber || "",
            }))
            .filter((item) => item.formatted),
    });
}
