import Link from "next/link";
import { requireRole } from "@/lib/auth/requireRole";
import { formatCurrency } from "@/lib/formatters";
import AppHeader from "@/components/AppHeader";

type SearchParams = {
    from?: string;
    to?: string;
};

type ChargeSummaryRow = {
    amount: number | string;
    status: "UNPAID" | "PAID" | "ARCHIVED" | "CANCELLED" | "IMPORT_DRAFT";
    due_date: string;
    property_id: string;
    properties?: { name: string | null } | { name: string | null }[] | null;
};

type PropertyRow = {
    id: string;
    name: string;
    status: string;
};

function firstProperty(value: ChargeSummaryRow["properties"]) {
    return Array.isArray(value) ? value[0] : value;
}

function getDayDiff(dateValue: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(`${dateValue}T00:00:00`);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

type Props = {
    searchParams?: Promise<SearchParams> | SearchParams;
};

export default async function OwnerSummaryPage({ searchParams }: Props) {
    const { supabase, user, profile } = await requireRole("OWNER");
    const sp = (searchParams instanceof Promise) ? await searchParams : (searchParams ?? {});

    const currentYear = new Date().getFullYear();
    const from = sp.from ? String(sp.from) : `${currentYear}-01-01`;
    const to = sp.to ? String(sp.to) : `${currentYear}-12-31`;

    const [{ data: charges, error: chargeError }, { data: properties, error: propertyError }] = await Promise.all([
        supabase
            .from("charges")
            .select("amount,status,due_date,property_id,properties(name)")
            .eq("owner_id", user.id)
            .gte("due_date", from)
            .lte("due_date", to),
        supabase
            .from("properties")
            .select("id,name,status")
            .eq("owner_id", user.id)
            .order("name"),
    ]);

    if (chargeError || propertyError) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <div className="card">
                    <h1>Összesítő</h1>
                    <p className="text-red-600">Hiba: {chargeError?.message || propertyError?.message}</p>
                </div>
            </main>
        );
    }

    const chargeRows = (charges ?? []) as ChargeSummaryRow[];
    const propertyRows = (properties ?? []) as PropertyRow[];

    const summary = chargeRows.reduce(
        (acc, row) => {
            const amount = Number(row.amount) || 0;
            if (row.status !== "CANCELLED") acc.total += amount;
            if (row.status === "UNPAID") acc.unpaid += amount;
            if (row.status === "PAID" || row.status === "ARCHIVED") acc.paid += amount;
            if (row.status === "IMPORT_DRAFT") acc.drafts += 1;
            if (row.status === "UNPAID" && getDayDiff(row.due_date) < 0) acc.overdue += amount;
            return acc;
        },
        { total: 0, unpaid: 0, paid: 0, overdue: 0, drafts: 0 }
    );

    const byProperty = propertyRows.map((property) => {
        const rows = chargeRows.filter((charge) => charge.property_id === property.id);
        const total = rows.reduce((sum, row) => sum + (row.status !== "CANCELLED" ? Number(row.amount) || 0 : 0), 0);
        const unpaid = rows.reduce((sum, row) => sum + (row.status === "UNPAID" ? Number(row.amount) || 0 : 0), 0);
        const paid = rows.reduce((sum, row) => sum + (row.status === "PAID" || row.status === "ARCHIVED" ? Number(row.amount) || 0 : 0), 0);
        const drafts = rows.filter((row) => row.status === "IMPORT_DRAFT").length;
        return { property, total, unpaid, paid, drafts };
    });

    const recentAttention = chargeRows
        .filter((row) => row.status === "UNPAID" && getDayDiff(row.due_date) < 0)
        .slice(0, 6);

    return (
        <main className="app-shell page-enter space-y-4">
            <AppHeader profile={profile} />

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Tulajdonosi összesítő</div>
                        <h1>Összes pénzügyi áttekintés</h1>
                        <p>Ha több ingatlanod van, itt látod őket egyben, nem csak külön oldalakra bontva.</p>
                    </div>
                    <div className="info-strip">
                        <span>Időszak: {from} - {to}</span>
                        <span>Ingatlanok száma: {propertyRows.length}</span>
                    </div>
                </div>

                <form method="GET" className="section-stack">
                    <div className="filter-grid">
                        <label className="field-stack">
                            <span className="field-label">Dátumtól</span>
                            <input name="from" type="date" defaultValue={from} className="input input-date" />
                        </label>
                        <label className="field-stack">
                            <span className="field-label">Dátumig</span>
                            <input name="to" type="date" defaultValue={to} className="input input-date" />
                        </label>
                    </div>
                    <div className="charge-actions">
                        <button className="btn btn-primary" type="submit">Időszak frissítése</button>
                        <Link className="btn btn-secondary" href="/owner/osszefoglalo">
                            Szűrők törlése
                        </Link>
                    </div>
                </form>

                <div className="kpi-grid stagger">
                    <div className="kpi-card">
                        <div className="kpi-label">Összes terhelés</div>
                        <div className="kpi-value">{formatCurrency(summary.total, "HUF")}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Nyitott követelés</div>
                        <div className="kpi-value">{formatCurrency(summary.unpaid, "HUF")}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Beérkezett összeg</div>
                        <div className="kpi-value">{formatCurrency(summary.paid, "HUF")}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Lejárt nyitott összeg</div>
                        <div className="kpi-value">{formatCurrency(summary.overdue, "HUF")}</div>
                        <div className="muted-note">{summary.drafts} import piszkozat</div>
                    </div>
                </div>
            </section>

            <section className="grid">
                <article className="card section-stack">
                    <div className="card-title">Ingatlanonkénti bontás</div>
                    <div className="feature-list">
                        {byProperty.map(({ property, total, unpaid, paid, drafts }) => (
                            <Link key={property.id} className="feature-item" href={`/owner/properties/${property.id}`}>
                                {property.name} · összesen {formatCurrency(total, "HUF")} · nyitott {formatCurrency(unpaid, "HUF")} · fizetett {formatCurrency(paid, "HUF")} · piszkozat {drafts}
                            </Link>
                        ))}
                    </div>
                </article>

                <article className="card section-stack">
                    <div className="card-title">Azonnali figyelmet igényel</div>
                    {recentAttention.length === 0 ? (
                        <p className="muted-note">Nincs lejárt, nyitott tétel.</p>
                    ) : (
                        <div className="feature-list">
                            {recentAttention.map((charge) => {
                                const property = firstProperty(charge.properties);
                                return (
                                    <Link key={`${charge.property_id}-${charge.due_date}-${charge.amount}`} className="feature-item" href={`/owner/properties/${charge.property_id}/charges`}>
                                        {property?.name ?? "Ingatlan"} · {charge.due_date} · {formatCurrency(Number(charge.amount), "HUF")}
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </article>
            </section>
        </main>
    );
}
