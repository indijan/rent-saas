import Link from "next/link";
import { requireRole } from "@/lib/auth/requireRole";
import { formatCurrency } from "@/lib/formatters";
import AppHeader from "@/components/AppHeader";
import DesignIcon from "@/components/dashboard/DesignIcon";
import InteractiveTrendChart from "@/components/dashboard/InteractiveTrendChart";
import type { ChargeType } from "@/lib/chargeTypes";
import { getOwnerImportOverview } from "@/lib/importOverview";
import { buildRecentTrendSeries, isExpenseCharge, summarizeFinanceRows } from "@/lib/ownerFinance";
import FinanceChargeComposer from "@/app/owner/charges/FinanceChargeComposer";

type SearchParams = {
    from?: string;
    to?: string;
    property?: string;
};

type ChargeStatus = "UNPAID" | "PAID" | "ARCHIVED" | "CANCELLED" | "IMPORT_DRAFT";

type ChargeRow = {
    id: string;
    amount: number | string;
    status: ChargeStatus;
    due_date: string;
    property_id: string;
    tenant_id: string | null;
    type: ChargeType;
    title: string;
    properties?: { name: string | null } | { name: string | null }[] | null;
};

type PropertyRow = {
    id: string;
    name: string;
    address: string | null;
    status: string;
    tenant_id: string | null;
};

type PropertyTenantRow = {
    property_id: string | null;
    tenant_id: string | null;
};

type ExitRequestRow = {
    id: string;
    property_id: string | null;
    properties?: { name: string | null } | { name: string | null }[] | null;
};

type Props = {
    searchParams?: Promise<SearchParams> | SearchParams;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
    return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function toDateInputValue(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function startOfCurrentYear() {
    const now = new Date();
    return `${now.getFullYear()}-01-01`;
}

function endOfCurrentMonth() {
    const now = new Date();
    return toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

function daysUntil(dateValue: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(`${dateValue}T00:00:00`);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatMonthLabel(dateValue: string) {
    return new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "long" }).format(new Date(`${dateValue}T00:00:00`));
}

function buildTrendScale(values: number[]) {
    const max = Math.max(...values, 0);
    const min = Math.min(...values, 0);
    const top = max === min ? max + 1 : max;
    return [top, top - ((top - min) / 3), top - ((top - min) * 2 / 3), min];
}

export default async function OwnerSummaryPage({ searchParams }: Props) {
    const { supabase, user, profile } = await requireRole("OWNER");
    const sp = (searchParams instanceof Promise) ? await searchParams : (searchParams ?? {});

    const from = sp.from ? String(sp.from) : startOfCurrentYear();
    const to = sp.to ? String(sp.to) : endOfCurrentMonth();
    const selectedPropertyId = sp.property ? String(sp.property) : null;
    const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

    const [
        { data: charges, error: chargeError },
        { data: breakdownCharges, error: breakdownChargeError },
        { data: properties, error: propertyError },
        { data: propertyTenants, error: propertyTenantError },
        importOverview,
        { data: exitRequests, error: exitRequestError },
    ] = await Promise.all([
        supabase
            .from("charges")
            .select("id,amount,status,due_date,property_id,tenant_id,type,title,properties(name)")
            .eq("owner_id", user.id)
            .gte("due_date", from)
            .lte("due_date", to),
        supabase
            .from("charges")
            .select("id,amount,status,due_date,property_id,tenant_id,type,title,properties(name)")
            .eq("owner_id", user.id)
            .lte("due_date", endOfCurrentMonth()),
        supabase
            .from("properties")
            .select("id,name,address,status,tenant_id")
            .eq("owner_id", user.id)
            .neq("status", "ARCHIVED")
            .order("name"),
        supabase
            .from("property_tenants")
            .select("property_id,tenant_id")
            .eq("owner_id", user.id),
        getOwnerImportOverview(user.id, { propertyId: selectedPropertyId, limit: 50 }),
        supabase
            .from("tenant_exit_requests")
            .select("id,property_id,properties(name)")
            .eq("owner_id", user.id)
            .eq("status", "PENDING")
            .order("created_at", { ascending: false })
            .limit(20),
    ]);

    if (chargeError || breakdownChargeError || propertyError || propertyTenantError || exitRequestError) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <section className="card">
                    <h1>Áttekintés</h1>
                    <p className="text-red-600">
                        Hiba: {chargeError?.message || breakdownChargeError?.message || propertyError?.message || propertyTenantError?.message || exitRequestError?.message}
                    </p>
                </section>
            </main>
        );
    }

    const chargeRows = (charges ?? []) as ChargeRow[];
    const breakdownChargeRows = (breakdownCharges ?? []) as ChargeRow[];
    const propertyRows = (properties ?? []) as PropertyRow[];
    const propertyTenantRows = (propertyTenants ?? []) as PropertyTenantRow[];
    const pendingExitRequests = (exitRequests ?? []) as ExitRequestRow[];

    const selectedProperty = selectedPropertyId
        ? propertyRows.find((property) => property.id === selectedPropertyId) ?? null
        : null;

    const filteredProperties = selectedPropertyId
        ? propertyRows.filter((property) => property.id === selectedPropertyId)
        : propertyRows;
    const filteredPropertyTenants = selectedPropertyId
        ? propertyTenantRows.filter((row) => row.property_id === selectedPropertyId)
        : propertyTenantRows;
    const filteredCharges = selectedPropertyId
        ? chargeRows.filter((charge) => charge.property_id === selectedPropertyId)
        : chargeRows;
    const filteredBreakdownCharges = selectedPropertyId
        ? breakdownChargeRows.filter((charge) => charge.property_id === selectedPropertyId)
        : breakdownChargeRows;

    const reviewRows = importOverview.actionRows;

    const overdueCharges = filteredCharges.filter((charge) => !isExpenseCharge(charge) && charge.status === "UNPAID" && daysUntil(charge.due_date) < 0);
    const upcomingCharges = filteredCharges
        .filter((charge) => charge.status === "UNPAID" && daysUntil(charge.due_date) >= 0 && daysUntil(charge.due_date) <= 10)
        .sort((a, b) => a.due_date.localeCompare(b.due_date))
        .slice(0, 4);

    const assignedPropertyIds = new Set(
        filteredPropertyTenants.map((row) => row.property_id).filter((value): value is string => Boolean(value))
    );

    const unassignedActiveProperties = filteredProperties.filter((property) => property.status === "ACTIVE" && !property.tenant_id && !assignedPropertyIds.has(property.id));

    const uniqueTenantCount = new Set(
        [
            ...filteredProperties.map((property) => property.tenant_id),
            ...filteredPropertyTenants.map((row) => row.tenant_id),
        ].filter((value): value is string => Boolean(value))
    ).size;

    const currentMonthRows = filteredCharges.filter((charge) => charge.due_date.startsWith(currentMonthKey));
    const currentMonthSummary = summarizeFinanceRows(currentMonthRows);
    const overallSummary = summarizeFinanceRows(filteredCharges);
    const monthlyRevenue = currentMonthSummary.revenue;
    const overdueReceivables = overallSummary.overdueReceivables;
    const monthlySeries = buildRecentTrendSeries(filteredCharges, endOfCurrentMonth());

    const propertyBreakdown = filteredProperties.map((property) => {
        const rows = filteredBreakdownCharges.filter((charge) => charge.property_id === property.id);
        const financeSummary = summarizeFinanceRows(rows);
        const drafts = rows.filter((charge) => charge.status === "IMPORT_DRAFT").length;
        return {
            property,
            netResult: financeSummary.profit,
            openReceivables: financeSummary.openReceivables,
            paidRevenue: financeSummary.revenue,
            expenses: financeSummary.expense,
            drafts,
        };
    }).sort((a, b) => b.netResult - a.netResult).slice(0, 4);

    const trendScale = buildTrendScale(monthlySeries.map((item) => item.net));
    const periodLabel = formatMonthLabel(to);

    return (
        <main className="app-shell page-enter">
            <AppHeader
                profile={profile}
                dashboardContext={{
                    label: "Ingatlan",
                    items: propertyRows.map((property) => ({ id: property.id, label: property.name })),
                    value: selectedPropertyId ?? "__all__",
                    baseHref: "/owner/osszefoglalo",
                    query: {
                        from: sp.from ? String(sp.from) : undefined,
                        to: sp.to ? String(sp.to) : undefined,
                    },
                }}
            />

            <div className="dashboard-overview-grid">
                <section className="dashboard-page-header">
                    <div>
                        <h1>Áttekintés</h1>
                        <p>
                            {selectedProperty ? `${selectedProperty.name} - pénzügyi és működési áttekintés` : "Összes ingatlan - összesített áttekintés"}
                        </p>
                    </div>
                    <div className="dashboard-period-chip">
                        <strong>{periodLabel}</strong>
                        <span>{selectedProperty ? `Szűrve: ${selectedProperty.name}` : "Aktuális állapot"}</span>
                    </div>
                </section>

                <section className="card dashboard-summary-strip">
                    <article className="dashboard-summary-card">
                        <DesignIcon name="lejart_dij" alt="Lejárt díj" tone="design-icon-badge-danger" />
                        <div className="dashboard-summary-copy">
                            <div className="dashboard-summary-value">{overdueCharges.length}</div>
                            <div className="dashboard-summary-title">Lejárt díj</div>
                        </div>
                    </article>
                    <article className="dashboard-summary-card">
                        <DesignIcon name="Berlo_nelkuli_ingatlan" alt="Bérlő nélküli ingatlan" tone="design-icon-badge-amber" />
                        <div className="dashboard-summary-copy">
                            <div className="dashboard-summary-value">{unassignedActiveProperties.length}</div>
                            <div className="dashboard-summary-title">Bérlő nélküli ingatlan</div>
                        </div>
                    </article>
                    <Link className="dashboard-summary-card dashboard-summary-card-link" href="/owner/importok">
                        <DesignIcon name="import_review_var" alt="Import review vár" tone="design-icon-badge-purple" />
                        <div className="dashboard-summary-copy">
                            <div className="dashboard-summary-value">{reviewRows.length}</div>
                            <div className="dashboard-summary-title">Import review vár</div>
                        </div>
                    </Link>
                    <article className="dashboard-summary-card">
                        <DesignIcon name="kintlevoseg" alt="Kintlévőség" tone="design-icon-badge-danger" />
                        <div className="dashboard-summary-copy">
                            <div className="dashboard-summary-value dashboard-kpi-value-currency">{formatCurrency(overdueReceivables, "HUF")}</div>
                            <div className="dashboard-summary-title">Kintlévőség</div>
                        </div>
                    </article>
                </section>

                <section className="dashboard-kpi-grid">
                    <article className="card dashboard-kpi-card">
                        <DesignIcon name="ingatlanok" alt="Ingatlanok" />
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Ingatlanok</div>
                            <div className="dashboard-kpi-value">{filteredProperties.length}</div>
                            <div className="muted-note">{filteredProperties.filter((property) => property.status === "ACTIVE").length} aktív ingatlan</div>
                        </div>
                    </article>
                    <article className="card dashboard-kpi-card">
                        <DesignIcon name="Berlok" alt="Bérlők" tone="design-icon-badge-purple" />
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Bérlők</div>
                            <div className="dashboard-kpi-value">{uniqueTenantCount}</div>
                            <div className="muted-note">{uniqueTenantCount} aktív bérlő</div>
                        </div>
                    </article>
                    <article className="card dashboard-kpi-card">
                        <DesignIcon name="havi_bevetel" alt="Havi bevétel" tone="design-icon-badge-green" />
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Havi bevétel</div>
                            <div className="dashboard-kpi-value dashboard-kpi-value-currency">{formatCurrency(monthlyRevenue, "HUF")}</div>
                            <div className="dashboard-kpi-note">Aktuális havi snapshot</div>
                        </div>
                    </article>
                    <article className="card dashboard-kpi-card">
                        <DesignIcon name="kintlevoseg" alt="Kintlévőség" tone="design-icon-badge-danger" />
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Kintlévőség</div>
                            <div className="dashboard-kpi-value dashboard-kpi-value-currency">{formatCurrency(overdueReceivables, "HUF")}</div>
                            <div className="muted-note">{overdueCharges.length} lejárt tétel</div>
                        </div>
                    </article>
                </section>

                <section className="dashboard-main-grid">
                    <article className="card chart-panel">
                        <div className="chart-panel-header">
                            <div>
                                <div className="card-title">Nettó eredmény alakulása</div>
                                <p className="muted-note">Az elmúlt hónapok bevétel-költség különbsége.</p>
                            </div>
                            <div className="chart-total">{formatCurrency(monthlySeries.reduce((sum, item) => sum + item.net, 0), "HUF")}</div>
                        </div>
                        <div className="trend-chart-shell">
                            <div className="trend-chart-frame">
                                <div className="trend-chart-y-axis">
                                    {trendScale.map((value, index) => (
                                        <span key={`${value}-${index}`}>{formatCurrency(value, "HUF")}</span>
                                    ))}
                                </div>
                                <div className="trend-chart-canvas">
                                    <InteractiveTrendChart
                                        gradientId="overviewTrendGradient"
                                        points={monthlySeries.map((item) => ({
                                            key: item.key,
                                            label: item.label,
                                            value: item.net,
                                        }))}
                                    />
                                </div>
                            </div>
                        </div>
                    </article>

                    <article className="card">
                        <div className="card-title">Következő események</div>
                        <div className="dashboard-event-list">
                            {upcomingCharges.map((charge) => (
                                <Link key={charge.id} className="dashboard-event-item" href={`/owner/charges?property=${encodeURIComponent(charge.property_id)}`}>
                                    <div className="dashboard-event-main">
                                        <DesignIcon name="kozelgo_feladatok" alt="Esedékes díj" />
                                        <div className="dashboard-event-copy">
                                            <strong>{firstRelation(charge.properties)?.name ?? charge.title}</strong>
                                            <span>{charge.title} · {charge.due_date}</span>
                                        </div>
                                    </div>
                                    <span className="metric-chip metric-chip-blue">{formatCurrency(Number(charge.amount), "HUF")}</span>
                                </Link>
                            ))}
                            {reviewRows.slice(0, 2).map((row) => (
                                <Link key={row.ingestionId} className="dashboard-event-item" href={row.reviewHref}>
                                    <div className="dashboard-event-main">
                                        <DesignIcon name="import_review_var" alt="Import review" tone="design-icon-badge-purple" />
                                        <div className="dashboard-event-copy">
                                            <strong>{row.state === "draft" ? "Import piszkozat publikálásra vár" : "Import review vár"}</strong>
                                            <span>{row.sourceAttachmentName || row.chargeTitle || "Név nélküli dokumentum"}</span>
                                        </div>
                                    </div>
                                    <span className="metric-chip metric-chip-amber">{row.state === "draft" ? "Piszkozat" : "Review"}</span>
                                </Link>
                            ))}
                            {pendingExitRequests.slice(0, 2).map((request) => (
                                <Link key={request.id} className="dashboard-event-item" href="/owner/tenants">
                                    <div className="dashboard-event-main">
                                        <DesignIcon name="kilepesi_kerelem_folyamatban" alt="Kilépési kérelem" tone="design-icon-badge-amber" />
                                        <div className="dashboard-event-copy">
                                            <strong>Kilépési kérelem</strong>
                                            <span>{firstRelation(request.properties)?.name ?? "Bérleti egység"}</span>
                                        </div>
                                    </div>
                                    <span className="metric-chip metric-chip-red">Folyamatban</span>
                                </Link>
                            ))}
                            {upcomingCharges.length === 0 && reviewRows.length === 0 && pendingExitRequests.length === 0 ? (
                                <p className="dashboard-empty-note">Most nincs olyan tétel, ami emberi döntést kérne.</p>
                            ) : null}
                        </div>
                    </article>
                </section>

                <section className="dashboard-lower-grid">
                    <article className="card">
                        <div className="card-title">Azonnali figyelmet igényel</div>
                        <div className="attention-list">
                            <Link href="/owner/todo" className="attention-row">
                                <div className="attention-main">
                                    <DesignIcon name="lejart_dij" alt="Lejárt díjak" tone="design-icon-badge-danger" />
                                    <div className="attention-copy">
                                        <strong>Lejárt díjak</strong>
                                        <span>Nyitott, fizetetlen és lejárt tételek</span>
                                    </div>
                                </div>
                                <span className="metric-chip metric-chip-red">{overdueCharges.length} tétel</span>
                            </Link>
                            <Link href="/owner/importok" className="attention-row">
                                <div className="attention-main">
                                    <DesignIcon name="import_review_var" alt="Import review vár" tone="design-icon-badge-purple" />
                                    <div className="attention-copy">
                                        <strong>Import review vár</strong>
                                        <span>Ellenőrzésre vagy publikálásra váró importok</span>
                                    </div>
                                </div>
                                <span className="metric-chip metric-chip-amber">{reviewRows.length} tétel</span>
                            </Link>
                            <Link href="/owner/todo" className="attention-row">
                                <div className="attention-main">
                                    <DesignIcon name="Berlo_nelkuli_ingatlan" alt="Bérlő nélküli ingatlan" tone="design-icon-badge-amber" />
                                    <div className="attention-copy">
                                        <strong>Bérlő nélküli ingatlan</strong>
                                        <span>Aktív portfólió, hozzárendelés nélkül</span>
                                    </div>
                                </div>
                                <span className="metric-chip metric-chip-amber">{unassignedActiveProperties.length} ingatlan</span>
                            </Link>
                            <Link href="/owner/tenants" className="attention-row">
                                <div className="attention-main">
                                    <DesignIcon name="kilepesi_kerelem_folyamatban" alt="Kilépési kérelem" tone="design-icon-badge-amber" />
                                    <div className="attention-copy">
                                        <strong>Kilépési kérelem vár jóváhagyásra</strong>
                                        <span>Bérlői kezdeményezések</span>
                                    </div>
                                </div>
                                <span className="metric-chip metric-chip-red">{pendingExitRequests.length} kérelem</span>
                            </Link>
                        </div>
                    </article>

                    <article className="card">
                        <div className="card-title">Gyors műveletek</div>
                        <div className="quick-action-grid quick-action-grid-quad">
                            <Link href="/owner/properties" className="quick-action-card">
                                <DesignIcon name="ingatlanok" alt="Új ingatlan" tone="design-icon-badge-blue" />
                                <strong>Új ingatlan</strong>
                            </Link>
                            <Link href="/owner/tenants" className="quick-action-card">
                                <DesignIcon name="Berlok" alt="Új bérlő" tone="design-icon-badge-purple" />
                                <strong>Új bérlő</strong>
                            </Link>
                            <FinanceChargeComposer
                                properties={propertyRows.map((property) => ({
                                    id: property.id,
                                    name: property.name,
                                    address: property.address || "",
                                }))}
                                selectedPropertyId={selectedPropertyId ?? ""}
                                triggerVariant="card"
                                triggerLabel="Új díj rögzítése"
                                defaultMode="manual"
                            />
                            <FinanceChargeComposer
                                properties={propertyRows.map((property) => ({
                                    id: property.id,
                                    name: property.name,
                                    address: property.address || "",
                                }))}
                                selectedPropertyId={selectedPropertyId ?? ""}
                                triggerVariant="card"
                                triggerLabel="Számla feltöltése"
                                defaultMode="upload"
                            />
                        </div>
                    </article>
                </section>

                <section className="card">
                    <div className="card-title">Pénzügyi bontás ingatlanonként</div>
                    <div className="ops-list">
                        {propertyBreakdown.map(({ property, netResult, openReceivables, paidRevenue, expenses, drafts }) => (
                            <Link key={property.id} className="ops-list-item" href={`/owner/charges?property=${encodeURIComponent(property.id)}`}>
                                <div className="ops-list-copy">
                                    <strong>{property.name}</strong>
                                    <span>{property.status === "ACTIVE" ? "Aktív ingatlan" : property.status}</span>
                                </div>
                                <div className="property-breakdown-grid">
                                    <div className="property-breakdown-metric">
                                        <span>Nettó eredmény</span>
                                        <strong>{formatCurrency(netResult, "HUF")}</strong>
                                    </div>
                                    <div className="property-breakdown-metric property-breakdown-metric-blue">
                                        <span>Nyitott bérlői díj</span>
                                        <strong>{formatCurrency(openReceivables, "HUF")}</strong>
                                    </div>
                                    <div className="property-breakdown-metric property-breakdown-metric-green">
                                        <span>Rögzített bevétel</span>
                                        <strong>{formatCurrency(paidRevenue, "HUF")}</strong>
                                    </div>
                                    <div className="property-breakdown-metric property-breakdown-metric-red">
                                        <span>Összes költség</span>
                                        <strong>{formatCurrency(expenses, "HUF")}</strong>
                                    </div>
                                    <div className="property-breakdown-metric property-breakdown-metric-amber">
                                        <span>Piszkozat</span>
                                        <strong>{drafts}</strong>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            </div>
        </main>
    );
}
