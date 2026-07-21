import Link from "next/link";
import { requireRole } from "@/lib/auth/requireRole";
import AppHeader from "@/components/AppHeader";
import DesignIcon from "@/components/dashboard/DesignIcon";
import InteractiveTrendChart from "@/components/dashboard/InteractiveTrendChart";
import UploadInvoice from "@/components/UploadInvoice";
import ConfirmActionForm from "@/app/owner/properties/[id]/charges/ConfirmActionForm";
import { buildDocumentOpenHref } from "@/lib/documentStorage";
import { formatCurrency } from "@/lib/formatters";
import { archiveCharge, cancelCharge, deleteCharge, markChargePaid, publishCharge, restoreCharge, undoChargePaid } from "@/app/owner/properties/[id]/charges/actions";
import FinanceChargeComposer from "./FinanceChargeComposer";
import FinanceChargeEditor from "./FinanceChargeEditor";
import FinancePeriodFilter from "./FinancePeriodFilter";
import { ALL_CHARGE_TYPE_OPTIONS, getChargeTypeLabel, type ChargeType } from "@/lib/chargeTypes";
import { buildCustomTrendSeries, buildExpenseCategoryTotals, buildRecentTrendSeries, buildRecentTrendWindow, isExpenseCharge, summarizeFinanceRows } from "@/lib/ownerFinance";

type SearchParams = {
    preset?: string;
    from?: string;
    to?: string;
    property?: string;
    status?: string;
    type?: string;
    billing?: string;
    sort?: string;
    q?: string;
    page?: string;
    compose?: string;
};

type ChargeStatus = "UNPAID" | "PAID" | "ARCHIVED" | "CANCELLED" | "IMPORT_DRAFT";

type ChargeRow = {
    id: string;
    property_id: string;
    tenant_id: string | null;
    title: string;
    notes: string | null;
    type: ChargeType;
    amount: number | string;
    currency: string | null;
    due_date: string;
    status: ChargeStatus;
    paid_at: string | null;
    recurring_group?: string | null;
    recurring_index?: number | null;
};

type PropertyRow = {
    id: string;
    name: string;
    address: string;
    status: string;
};

type DocumentRow = {
    id: string;
    charge_id: string;
    bucket_path: string;
};

type ProfileRow = {
    id: string;
    full_name: string | null;
    email: string;
};

type Props = {
    searchParams?: Promise<SearchParams> | SearchParams;
};

type PeriodPreset = "CURRENT_MONTH" | "NEXT_3_MONTHS" | "LAST_30_DAYS" | "LAST_3_MONTHS" | "LAST_6_MONTHS" | "LAST_12_MONTHS" | "MAX" | "CUSTOM";

function toDateInputValue(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function startOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

function shiftMonths(base: Date, months: number) {
    const next = new Date(base);
    next.setMonth(next.getMonth() + months);
    return next;
}

function startOfCurrentMonth() {
    const now = new Date();
    return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
}

function endOfCurrentMonth() {
    const now = new Date();
    return toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

function previousMonthRange() {
    const now = new Date();
    return {
        from: toDateInputValue(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
}

function formatDisplayDate(dateValue: string) {
    return new Intl.DateTimeFormat("hu-HU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date(`${dateValue}T00:00:00`));
}

function statusLabel(charge: Pick<ChargeRow, "status" | "due_date" | "tenant_id" | "type">) {
    if (isExpenseCharge(charge)) {
        if (charge.status === "CANCELLED") return "Sztornó";
        if (charge.status === "ARCHIVED") return "Archivált";
        return "Rögzítve";
    }
    if (charge.status === "UNPAID" && new Date(`${charge.due_date}T00:00:00`).getTime() < startOfToday().getTime()) {
        return "Lejárt";
    }
    switch (charge.status) {
        case "UNPAID":
            return "Aktív";
        case "PAID":
            return "Fizetett";
        case "ARCHIVED":
            return "Archivált";
        case "IMPORT_DRAFT":
            return "Piszkozat";
        case "CANCELLED":
            return "Sztornó";
        default:
            return charge.status;
    }
}

function buildExpenseSegments(items: Array<{ value: number; color: string }>) {
    const total = items.reduce((sum, item) => sum + item.value, 0);
    if (total <= 0) return "conic-gradient(#dbe4f4 0deg 360deg)";

    let cursor = 0;
    const parts = items.map((item) => {
        const start = cursor;
        const size = (item.value / total) * 360;
        cursor += size;
        return `${item.color} ${start}deg ${cursor}deg`;
    });
    return `conic-gradient(${parts.join(", ")})`;
}

function buildTrendScale(values: number[]) {
    const max = Math.max(...values, 0);
    const min = Math.min(...values, 0);
    const top = max === min ? max + 1 : max;
    return [top, top - ((top - min) / 3), top - ((top - min) * 2 / 3), min];
}

function monthStart(dateValue: string) {
    const date = new Date(`${dateValue}T00:00:00`);
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthEnd(dateValue: string) {
    const date = new Date(`${dateValue}T00:00:00`);
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function buildQuery(input: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    Object.entries(input).forEach(([key, value]) => {
        if (value) params.set(key, value);
    });
    const query = params.toString();
    return query ? `?${query}` : "";
}

function normalizeSearchText(value: string | null | undefined) {
    return String(value || "")
        .toLocaleLowerCase("hu-HU")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizePeriodPreset(value: string | undefined): PeriodPreset {
    const preset = String(value || "CURRENT_MONTH").trim().toUpperCase();
    if (["CURRENT_MONTH", "NEXT_3_MONTHS", "LAST_30_DAYS", "LAST_3_MONTHS", "LAST_6_MONTHS", "LAST_12_MONTHS", "MAX", "CUSTOM"].includes(preset)) {
        return preset as PeriodPreset;
    }
    return "CURRENT_MONTH";
}

function normalizeSortOrder(value: string | undefined) {
    return value === "due_asc" ? "due_asc" : "due_desc";
}

function resolvePeriodRange(preset: PeriodPreset, requestedFrom?: string, requestedTo?: string) {
    const today = startOfToday();
    const monthEndValue = endOfCurrentMonth();
    const currentMonthRange = {
        from: startOfCurrentMonth(),
        to: endOfCurrentMonth(),
        label: "Aktuális hónap",
    };

    switch (preset) {
        case "NEXT_3_MONTHS":
            {
                const now = new Date();
                return {
                    from: toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 1)),
                    to: toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 4, 0)),
                    label: "Következő 3 hónap",
                };
            }
        case "LAST_30_DAYS":
            {
                const previousMonth = previousMonthRange();
                return {
                    from: previousMonth.from,
                    to: previousMonth.to,
                    label: "Elmúlt hónap",
                };
            }
        case "LAST_3_MONTHS":
            return {
                from: toDateInputValue(shiftMonths(today, -3)),
                to: monthEndValue,
                label: "Elmúlt 3 hónap",
            };
        case "LAST_6_MONTHS":
            return {
                from: toDateInputValue(shiftMonths(today, -6)),
                to: monthEndValue,
                label: "Elmúlt fél év",
            };
        case "LAST_12_MONTHS":
            return {
                from: toDateInputValue(shiftMonths(today, -12)),
                to: monthEndValue,
                label: "Elmúlt 1 év",
            };
        case "MAX":
            return {
                from: "2000-01-01",
                to: "2100-12-31",
                label: "Minden időszak",
            };
        case "CUSTOM":
            return {
                from: requestedFrom || startOfCurrentMonth(),
                to: requestedTo || endOfCurrentMonth(),
                label: "Egyedi időszak",
            };
        default:
            return currentMonthRange;
    }
}

function CheckIcon() {
    return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 4.2 4.2L19 6.5" />
        </svg>
    );
}

function PublishIcon() {
    return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 17V7.5" />
            <path d="m8.5 11 3.5-3.5 3.5 3.5" />
            <path d="M5.5 18.5h13" />
            <path d="M7.5 21h9" />
        </svg>
    );
}

function CancelIcon() {
    return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="m8.5 15.5 7-7" />
        </svg>
    );
}

function ArchiveIcon() {
    return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8.5h16" />
            <path d="M6 6h12l1 2.5v9A1.5 1.5 0 0 1 17.5 19h-11A1.5 1.5 0 0 1 5 17.5v-9L6 6Z" />
            <path d="M10 12h4" />
        </svg>
    );
}

function RestoreIcon() {
    return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.708" />
            <path d="M3 4v5h5" />
        </svg>
    );
}

function DeleteIcon() {
    return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 7h14" />
            <path d="M9 7V4.75A.75.75 0 0 1 9.75 4h4.5a.75.75 0 0 1 .75.75V7" />
            <path d="M7 7.5V18a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7.5" />
            <path d="M10 11v5" />
            <path d="M14 11v5" />
        </svg>
    );
}

function UndoPaidIcon() {
    return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 8H4v5" />
            <path d="M4 13a8 8 0 1 0 2.4-5.7L4 9.5" />
        </svg>
    );
}

function PdfIcon() {
    return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3.5h6l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V5A1.5 1.5 0 0 1 7.5 3.5Z" />
            <path d="M14 3.5V8h4" />
            <path d="M8.5 16.5h7" />
        </svg>
    );
}

function typeTone(type: ChargeType, tenantId: string | null) {
    if (!tenantId && type === "OTHER") return "dashboard-inline-badge-red";
    switch (type) {
        case "RENT":
            return "dashboard-inline-badge-green";
        case "UTILITY":
            return "dashboard-inline-badge-blue";
        case "INSURANCE":
            return "dashboard-inline-badge-blue";
        case "COMMON_COST":
            return "dashboard-inline-badge-amber";
        case "RENOVATION":
            return "dashboard-inline-badge-green";
        case "TAX":
            return "dashboard-inline-badge-red";
        default:
            return "dashboard-inline-badge-purple";
    }
}

function statusTone(status: string) {
    if (status === "Fizetett") return "dashboard-inline-badge-green";
    if (status === "Rögzítve") return "dashboard-inline-badge-green";
    if (status === "Lejárt") return "dashboard-inline-badge-red";
    if (status === "Aktív") return "dashboard-inline-badge-blue";
    if (status === "Piszkozat") return "dashboard-inline-badge-amber";
    return "dashboard-inline-badge-purple";
}

export default async function OwnerChargesOverviewPage({ searchParams }: Props) {
    const { supabase, profile, user } = await requireRole("OWNER");
    const sp = searchParams instanceof Promise ? await searchParams : (searchParams ?? {});

    const preset = normalizePeriodPreset(sp.preset ? String(sp.preset) : undefined);
    const periodRange = resolvePeriodRange(preset, sp.from ? String(sp.from) : undefined, sp.to ? String(sp.to) : undefined);
    const from = periodRange.from;
    const to = periodRange.to;
    const selectedPropertyId = sp.property ? String(sp.property) : "";
    const statusFilter = sp.status ? String(sp.status) : "";
    const typeFilter = sp.type ? String(sp.type) : "";
    const billingFilter = sp.billing ? String(sp.billing).toUpperCase() : "";
    const sortFilter = normalizeSortOrder(sp.sort ? String(sp.sort) : undefined);
    const keywordFilter = String(sp.q || "").trim();
    const page = Math.max(1, Number(sp.page || 1) || 1);
    const pageSize = 10;
    const composeMode = sp.compose === "upload" ? "upload" : sp.compose === "manual" ? "manual" : null;
    const trendWindow = preset === "CUSTOM"
        ? { from: toDateInputValue(monthStart(from)), to: toDateInputValue(monthEnd(to)) }
        : buildRecentTrendWindow(to);
    const composerCloseHref = `/owner/charges${buildQuery({
        property: selectedPropertyId || undefined,
        preset,
        from: preset === "CUSTOM" ? from : undefined,
        to: preset === "CUSTOM" ? to : undefined,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        billing: billingFilter || undefined,
        sort: sortFilter,
        q: keywordFilter || undefined,
        page: page > 1 ? String(page) : undefined,
    })}`;

    const [
        { data: properties, error: propertyError },
        { data: summaryRows, error: chargeError },
        { data: trendRows, error: trendError },
    ] = await Promise.all([
        supabase
            .from("properties")
            .select("id,name,address,status")
            .eq("owner_id", user.id)
            .neq("status", "ARCHIVED")
            .order("name"),
        supabase
            .from("charges")
            .select("id,property_id,tenant_id,title,notes,type,amount,currency,due_date,status,paid_at,recurring_group,recurring_index")
            .eq("owner_id", user.id)
            .gte("due_date", from)
            .lte("due_date", to),
        supabase
            .from("charges")
            .select("id,property_id,tenant_id,title,notes,type,amount,currency,due_date,status,paid_at,recurring_group,recurring_index")
            .eq("owner_id", user.id)
            .gte("due_date", trendWindow.from)
            .lte("due_date", trendWindow.to),
    ]);

    if (propertyError || chargeError || trendError) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <section className="card">
                    <h1>Pénzügyek</h1>
                    <p className="text-red-600">Hiba: {propertyError?.message || chargeError?.message || trendError?.message}</p>
                </section>
            </main>
        );
    }

    const propertyRows = (properties ?? []) as PropertyRow[];
    const propertyById = new Map(propertyRows.map((property) => [property.id, property]));
    const allRows = (summaryRows ?? []) as ChargeRow[];
    const allTrendRows = (trendRows ?? []) as ChargeRow[];

    const matchesFilters = (charge: ChargeRow) => {
        if (selectedPropertyId && charge.property_id !== selectedPropertyId) return false;
        if (statusFilter === "OVERDUE") {
            const overdue = !isExpenseCharge(charge) && charge.status === "UNPAID" && new Date(`${charge.due_date}T00:00:00`).getTime() < startOfToday().getTime();
            if (!overdue) return false;
        } else if (statusFilter && charge.status !== statusFilter) {
            return false;
        }
        if (typeFilter && charge.type !== typeFilter) return false;
        if (billingFilter === "OWN" && !isExpenseCharge(charge)) return false;
        if (billingFilter === "TENANT" && isExpenseCharge(charge)) return false;
        if (keywordFilter) {
            const property = propertyById.get(charge.property_id);
            const haystack = normalizeSearchText([
                charge.title,
                charge.notes,
                property?.name,
                property?.address,
                getChargeTypeLabel(charge.type, charge.tenant_id),
            ].join(" "));
            if (!haystack.includes(normalizeSearchText(keywordFilter))) return false;
        }
        return true;
    };

    const filteredRows = allRows.filter(matchesFilters);
    const filteredTrendRows = allTrendRows.filter(matchesFilters);

    const summary = summarizeFinanceRows(filteredRows);
    const revenue = summary.revenue;
    const expense = summary.expense;
    const profit = summary.profit;
    const receivables = summary.overdueReceivables;

    const monthlySeries = preset === "CUSTOM"
        ? buildCustomTrendSeries(filteredTrendRows, from, to)
        : buildRecentTrendSeries(filteredTrendRows, trendWindow.to);

    const categoryTotals = buildExpenseCategoryTotals(filteredRows);
    const categoryLegendRows = categoryTotals.filter((item) => item.value > 0);

    const paginatedRows = filteredRows
        .slice()
        .sort((a, b) => sortFilter === "due_asc"
            ? a.due_date.localeCompare(b.due_date)
            : b.due_date.localeCompare(a.due_date))
        .slice((page - 1) * pageSize, page * pageSize);

    const chargeIds = paginatedRows.map((row) => row.id);
    const tenantIds = Array.from(new Set(paginatedRows.map((row) => row.tenant_id).filter((value): value is string => Boolean(value))));

    const [{ data: documents }, { data: tenantProfiles }] = await Promise.all([
        chargeIds.length
            ? supabase.from("documents").select("id,charge_id,bucket_path").eq("owner_id", user.id).in("charge_id", chargeIds)
            : Promise.resolve({ data: [] as DocumentRow[] }),
        tenantIds.length
            ? supabase.from("profiles").select("id,full_name,email").in("id", tenantIds)
            : Promise.resolve({ data: [] as ProfileRow[] }),
    ]);

    const documentByCharge = new Map<string, string>();
    for (const doc of ((documents ?? []) as DocumentRow[])) {
        if (documentByCharge.has(doc.charge_id)) continue;
        documentByCharge.set(doc.charge_id, buildDocumentOpenHref(doc.id));
    }

    const tenantById = new Map(((tenantProfiles ?? []) as ProfileRow[]).map((tenant) => [tenant.id, tenant]));
    const selectedProperty = selectedPropertyId ? propertyById.get(selectedPropertyId) ?? null : null;
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    const periodLabel = preset === "CUSTOM"
        ? `${formatDisplayDate(from)} - ${formatDisplayDate(to)}`
        : periodRange.label;
    const donutBackground = buildExpenseSegments(categoryTotals.filter((item) => item.value > 0));
    const trendScale = buildTrendScale(monthlySeries.map((item) => item.net));

    return (
        <main className="app-shell page-enter">
            <AppHeader
                profile={profile}
                dashboardContext={{
                    label: "Ingatlan",
                    items: propertyRows.map((property) => ({ id: property.id, label: property.name })),
                    value: selectedPropertyId || "__all__",
                    baseHref: "/owner/charges",
                    query: {
                        preset,
                        from,
                        to,
                        status: statusFilter || undefined,
                        type: typeFilter || undefined,
                        billing: billingFilter || undefined,
                        sort: sortFilter,
                        q: keywordFilter || undefined,
                    },
                }}
            />

            <div className="finance-page-grid">
                <section className="dashboard-page-header">
                    <div>
                        <h1>Pénzügyek</h1>
                        <p>{selectedProperty ? `Pénzügyi áttekintés és kezelése - ${selectedProperty.name}` : "Pénzügyi áttekintés és kezelése - Összes ingatlan"}</p>
                    </div>
                    <FinancePeriodFilter
                        property={selectedPropertyId || undefined}
                        status={statusFilter || undefined}
                        type={typeFilter || undefined}
                        billing={billingFilter || undefined}
                        sort={sortFilter}
                        q={keywordFilter || undefined}
                        preset={preset}
                        from={from}
                        to={to}
                        propertyLabel={selectedProperty ? selectedProperty.name : "Összes ingatlan"}
                    />
                </section>

                <section className="finance-kpi-grid">
                    <article className="card finance-kpi-card">
                        <DesignIcon name="bevetel" alt="Bevétel" tone="design-icon-badge-green" />
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Bevétel</div>
                            <div className="dashboard-kpi-value dashboard-kpi-value-currency">{formatCurrency(revenue, "HUF")}</div>
                            <div className="dashboard-kpi-note">Fizetett és archivált tételek</div>
                        </div>
                    </article>
                    <article className="card finance-kpi-card">
                        <DesignIcon name="kiadas" alt="Kiadás" tone="design-icon-badge-danger" />
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Kiadás</div>
                            <div className="dashboard-kpi-value dashboard-kpi-value-currency">{formatCurrency(expense, "HUF")}</div>
                            <div className="muted-note">Minden költség jellegű tétel</div>
                        </div>
                    </article>
                    <article className="card finance-kpi-card">
                        <DesignIcon name="profit" alt="Profit" />
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Profit</div>
                            <div className="dashboard-kpi-value dashboard-kpi-value-currency">{formatCurrency(profit, "HUF")}</div>
                            <div className="dashboard-kpi-note">Bevétel - Kiadás</div>
                        </div>
                    </article>
                    <article className="card finance-kpi-card">
                        <DesignIcon name="kintlevoseg" alt="Kintlévőség" tone="design-icon-badge-amber" />
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Kintlévőség</div>
                            <div className="dashboard-kpi-value dashboard-kpi-value-currency">{formatCurrency(receivables, "HUF")}</div>
                            <div className="muted-note">{summary.overdueCount} lejárt tétel</div>
                        </div>
                    </article>
                </section>

                <section className="finance-analytics-grid">
                    <article className="card chart-panel">
                        <div className="chart-panel-header">
                            <div>
                                <div className="card-title">Nettó eredmény alakulása</div>
                                <p className="muted-note">A megadott időszak nettó pénzügyi trendje.</p>
                            </div>
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
                                        gradientId="financeTrendGradient"
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
                        <div className="card-title">Kiadás kategóriák szerint</div>
                        {expense <= 0 ? (
                            <div className="finance-empty-chart">
                                <div className="donut-chart donut-chart-empty" style={{ background: donutBackground }}>
                                    <div className="donut-center">
                                        <strong>0 Ft</strong>
                                        <span>Nincs költség</span>
                                    </div>
                                </div>
                                <p className="dashboard-empty-note">Ebben az időszakban még nincs költségként elszámolt tétel, ezért a megoszlásdiagram üres.</p>
                            </div>
                        ) : (
                            <div className="donut-shell">
                                <div className="donut-chart" style={{ background: donutBackground }}>
                                    <div className="donut-center">
                                        <strong>{formatCurrency(expense, "HUF")}</strong>
                                        <span>Összesen</span>
                                    </div>
                                </div>
                                <div className="donut-legend">
                                    {categoryLegendRows.map((item) => (
                                        <div key={item.label} className="donut-legend-row">
                                            <span className="donut-dot" style={{ backgroundColor: item.color }} />
                                            <span className="donut-legend-label">{item.label}</span>
                                            <div className="donut-legend-meta">
                                                <strong>{formatCurrency(item.value, "HUF")}</strong>
                                                <span>{expense > 0 ? `${Math.round((item.value / expense) * 100)}%` : "0%"}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </article>
                </section>

                <section className="card finance-filter-shell">
                    <div>
                        <div className="card-title">Szűrők</div>
                        <p className="muted-note">A lista a megadott szűrőknek megfelelő tételeket mutatja.</p>
                    </div>
                    <div className="finance-filter-period-note">
                        <span className="field-label">Aktív időszak</span>
                        <strong>{periodLabel}</strong>
                        <span>{selectedProperty ? selectedProperty.name : "Összes ingatlan"}</span>
                    </div>
                    <form method="GET" className="finance-filter-form">
                        {selectedPropertyId ? <input type="hidden" name="property" value={selectedPropertyId} /> : null}
                        <input type="hidden" name="preset" value={preset} />
                        {preset === "CUSTOM" ? <input type="hidden" name="from" value={from} /> : null}
                        {preset === "CUSTOM" ? <input type="hidden" name="to" value={to} /> : null}
                        <div className="finance-filter-grid">
                            <label className="field-stack finance-composer-field-wide">
                                <span className="field-label">Kulcsszó</span>
                                <input name="q" className="input" type="search" defaultValue={keywordFilter} placeholder="Megnevezés, megjegyzés vagy típus" />
                            </label>
                            <label className="field-stack">
                                <span className="field-label">Nézet</span>
                                <select name="billing" className="select" defaultValue={billingFilter}>
                                    <option value="">Saját és bérlői</option>
                                    <option value="OWN">Saját</option>
                                    <option value="TENANT">Bérlő</option>
                                </select>
                            </label>
                            <label className="field-stack">
                                <span className="field-label">Rendezés</span>
                                <select name="sort" className="select" defaultValue={sortFilter}>
                                    <option value="due_desc">Lejárat: újabb elöl</option>
                                    <option value="due_asc">Lejárat: régebbi elöl</option>
                                </select>
                            </label>
                            <label className="field-stack">
                                <span className="field-label">Státusz</span>
                                <select name="status" className="select" defaultValue={statusFilter}>
                                    <option value="">Minden státusz</option>
                                    <option value="UNPAID">Aktív</option>
                                    <option value="OVERDUE">Lejárt</option>
                                    <option value="PAID">Fizetett</option>
                                    <option value="ARCHIVED">Archivált</option>
                                    <option value="IMPORT_DRAFT">Piszkozat</option>
                                    <option value="CANCELLED">Sztornó</option>
                                </select>
                            </label>
                            <label className="field-stack">
                                <span className="field-label">Típus</span>
                                <select name="type" className="select" defaultValue={typeFilter}>
                                    <option value="">Minden típus</option>
                                    {ALL_CHARGE_TYPE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <div className="finance-filter-actions">
                            <div className="charge-actions">
                                <button className="btn btn-primary" type="submit">Szűrés frissítése</button>
                                <Link
                                    className="btn btn-secondary"
                                    href={`/owner/charges${buildQuery({
                                        preset,
                                        property: selectedPropertyId || undefined,
                                        from: preset === "CUSTOM" ? from : undefined,
                                        to: preset === "CUSTOM" ? to : undefined,
                                        sort: sortFilter,
                                    })}`}
                                >
                                    Szűrők törlése
                                </Link>
                                <a
                                    className="btn btn-secondary"
                                    href={`/owner/charges/export${buildQuery({
                                        preset,
                                        property: selectedPropertyId || undefined,
                                        from,
                                        to,
                                        status: statusFilter || undefined,
                                        type: typeFilter || undefined,
                                        billing: billingFilter || undefined,
                                        sort: sortFilter,
                                        q: keywordFilter || undefined,
                                    })}`}
                                >
                                    Export Excelbe
                                </a>
                            </div>
                        </div>
                    </form>
                    <div className="finance-filter-toolbar">
                        <FinanceChargeComposer
                            key={`finance-composer-${composeMode ?? "closed"}-${selectedPropertyId || "all"}`}
                            properties={propertyRows.map((property) => ({
                                id: property.id,
                                name: property.name,
                                address: property.address,
                            }))}
                            selectedPropertyId={selectedPropertyId}
                            autoOpen={Boolean(composeMode)}
                            defaultMode={composeMode ?? "manual"}
                            closeHref={composeMode ? composerCloseHref : undefined}
                        />
                    </div>
                </section>

                <section className="card finance-table-shell">
                    <div className="section-header">
                        <div>
                            <div className="card-title">Tranzakciók</div>
                            <p className="muted-note">Összesen {filteredRows.length} tétel</p>
                        </div>
                    </div>

                    <div className="finance-table-scroll">
                        <table className="finance-table">
                            <colgroup>
                                <col className="finance-col-date" />
                                <col className="finance-col-type" />
                                <col className="finance-col-title" />
                                <col className="finance-col-property" />
                                <col className="finance-col-partner" />
                                <col className="finance-col-amount" />
                                <col className="finance-col-status" />
                                <col className="finance-col-document" />
                                <col className="finance-col-actions" />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>Dátum</th>
                                    <th>Típus</th>
                                    <th>Megnevezés</th>
                                    <th>Ingatlan</th>
                                    <th>Bérlő / Partner</th>
                                    <th>Összeg</th>
                                    <th>Státusz</th>
                                    <th title="Dokumentum">Dok.</th>
                                    <th title="Műveletek">Műv.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedRows.map((charge) => {
                                    const property = propertyById.get(charge.property_id);
                                    const tenant = charge.tenant_id ? tenantById.get(charge.tenant_id) : null;
                                    const documentUrl = documentByCharge.get(charge.id) ?? "";
                                    const expenseRow = isExpenseCharge(charge);
                                    const status = statusLabel(charge);
                                    const canMarkPaid = !expenseRow && charge.status === "UNPAID";
                                    const canUndoPaid = !expenseRow && charge.status === "PAID";
                                    const canPublish = charge.status === "IMPORT_DRAFT";
                                    const canCancel = charge.status !== "PAID" && charge.status !== "ARCHIVED" && charge.status !== "CANCELLED";
                                    const canArchive = expenseRow ? charge.status === "UNPAID" : charge.status === "PAID";
                                    const canRestore = charge.status === "ARCHIVED" || charge.status === "CANCELLED";
                                    const canDelete = charge.status === "CANCELLED";
                                    const restoreTooltip = charge.status === "ARCHIVED" ? "Újranyitás" : "Visszaállítás";

                                    return (
                                        <tr id={`charge-${charge.id}`} key={charge.id} className={charge.status === "ARCHIVED" ? "finance-row-muted" : ""}>
                                            <td>{formatDisplayDate(charge.due_date)}</td>
                                            <td>
                                                <span className={`dashboard-inline-badge ${typeTone(charge.type, charge.tenant_id)}`}>
                                                    {getChargeTypeLabel(charge.type, charge.tenant_id)}
                                                </span>
                                            </td>
                                            <td className="finance-cell-title">
                                                <div className="dashboard-table-main">
                                                    <strong>{charge.title}</strong>
                                                    {charge.notes ? <span className="dashboard-table-subtitle">{charge.notes}</span> : null}
                                                </div>
                                            </td>
                                            <td className="finance-cell-property">{property?.name ?? "Ismeretlen ingatlan"}</td>
                                            <td className="finance-cell-partner">{tenant?.full_name || tenant?.email || "Saját"}</td>
                                            <td className={`finance-cell-amount ${expenseRow ? "transaction-amount-negative" : "transaction-amount-positive"}`}>
                                                {expenseRow ? "-" : charge.type === "RENT" ? "+" : ""}{formatCurrency(Number(charge.amount), charge.currency || "HUF")}
                                            </td>
                                            <td>
                                                <span className={`dashboard-inline-badge ${statusTone(status)}`}>{status}</span>
                                            </td>
                                            <td className="finance-cell-document">
                                                {documentUrl ? (
                                                    <a className="dashboard-icon-button dashboard-icon-button-danger" href={documentUrl} target="_blank" rel="noreferrer" aria-label="PDF megnyitása" title="PDF megnyitása" data-tooltip="PDF megnyitása">
                                                        <PdfIcon />
                                                    </a>
                                                ) : (
                                                    <UploadInvoice chargeId={charge.id} variant="icon" />
                                                )}
                                            </td>
                                            <td className="finance-cell-actions">
                                                <div className="dashboard-table-actions">
                                                    <FinanceChargeEditor
                                                        charge={{
                                                            id: charge.id,
                                                            title: charge.title,
                                                            notes: charge.notes,
                                                            type: charge.type,
                                                            amount: charge.amount,
                                                            currency: charge.currency,
                                                            due_date: charge.due_date,
                                                            tenant_id: charge.tenant_id,
                                                            status: charge.status,
                                                            recurring_group: charge.recurring_group ?? null,
                                                        }}
                                                    />
                                                    {canPublish ? (
                                                        <ConfirmActionForm
                                                            action={async () => {
                                                                "use server";
                                                                await publishCharge(charge.id);
                                                            }}
                                                            confirmMessage="Biztosan publikálod ezt az importált piszkozatot a bérlő felé?"
                                                        >
                                                            <button type="submit" className="dashboard-icon-button dashboard-icon-button-success" aria-label="Publikálás" title="Publikálás" data-tooltip="Publikálás">
                                                                <PublishIcon />
                                                            </button>
                                                        </ConfirmActionForm>
                                                    ) : null}
                                                    {canMarkPaid ? (
                                                        <ConfirmActionForm
                                                            action={async () => {
                                                                "use server";
                                                                await markChargePaid(charge.id);
                                                            }}
                                                            confirmMessage="Biztosan fizetettnek jelölöd ezt a tételt?"
                                                        >
                                                            <button type="submit" className="dashboard-icon-button dashboard-icon-button-success" aria-label="Fizetettnek jelölés" title="Fizetettnek jelölés" data-tooltip="Fizetettnek jelölés">
                                                                <CheckIcon />
                                                            </button>
                                                        </ConfirmActionForm>
                                                    ) : null}
                                                    {canUndoPaid ? (
                                                        <ConfirmActionForm
                                                            action={async () => {
                                                                "use server";
                                                                await undoChargePaid(charge.id);
                                                            }}
                                                            confirmMessage="Biztosan visszavonod a fizetett státuszt?"
                                                        >
                                                            <button type="submit" className="dashboard-icon-button dashboard-icon-button-amber" aria-label="Fizetett visszavonása" title="Fizetett visszavonása" data-tooltip="Fizetett visszavonása">
                                                                <UndoPaidIcon />
                                                            </button>
                                                        </ConfirmActionForm>
                                                    ) : null}
                                                    {canCancel ? (
                                                        <ConfirmActionForm
                                                            action={async () => {
                                                                "use server";
                                                                await cancelCharge(charge.id);
                                                            }}
                                                            confirmMessage="Biztosan érvényteleníted ezt a tételt?"
                                                        >
                                                            <button type="submit" className="dashboard-icon-button dashboard-icon-button-danger" aria-label="Sztornó" title="Sztornó" data-tooltip="Érvénytelenítés">
                                                                <CancelIcon />
                                                            </button>
                                                        </ConfirmActionForm>
                                                    ) : null}
                                                    {canArchive ? (
                                                        <ConfirmActionForm
                                                            action={async () => {
                                                                "use server";
                                                                await archiveCharge(charge.id);
                                                            }}
                                                            confirmMessage="Biztosan archiválod ezt a tételt?"
                                                        >
                                                            <button type="submit" className="dashboard-icon-button" aria-label="Archiválás" title="Archiválás" data-tooltip="Archiválás">
                                                                <ArchiveIcon />
                                                            </button>
                                                        </ConfirmActionForm>
                                                    ) : null}
                                                    {canRestore ? (
                                                        <ConfirmActionForm
                                                            action={async () => {
                                                                "use server";
                                                                await restoreCharge(charge.id);
                                                            }}
                                                            confirmMessage={charge.status === "ARCHIVED" ? "Biztosan újranyitod ezt a tételt?" : "Biztosan visszaállítod ezt a tételt?"}
                                                        >
                                                            <button type="submit" className="dashboard-icon-button dashboard-icon-button-success" aria-label={restoreTooltip} title={restoreTooltip} data-tooltip={restoreTooltip}>
                                                                <RestoreIcon />
                                                            </button>
                                                        </ConfirmActionForm>
                                                    ) : null}
                                                    {canDelete ? (
                                                        <ConfirmActionForm
                                                            action={async () => {
                                                                "use server";
                                                                await deleteCharge(charge.id);
                                                            }}
                                                            confirmMessage="Biztosan végleg törlöd ezt a sztornózott tételt? Ez nem visszavonható."
                                                        >
                                                            <button type="submit" className="dashboard-icon-button dashboard-icon-button-danger" aria-label="Végleges törlés" title="Végleges törlés" data-tooltip="Végleges törlés">
                                                                <DeleteIcon />
                                                            </button>
                                                        </ConfirmActionForm>
                                                    ) : null}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {paginatedRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="dashboard-empty-note">Nincs találat a megadott szűrőkkel.</td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>

                    <div className="finance-mobile-list">
                        {paginatedRows.length === 0 ? (
                            <div className="dashboard-empty-note">Nincs találat a megadott szűrőkkel.</div>
                        ) : paginatedRows.map((charge) => {
                            const property = propertyById.get(charge.property_id);
                            const tenant = charge.tenant_id ? tenantById.get(charge.tenant_id) : null;
                            const documentUrl = documentByCharge.get(charge.id) ?? "";
                            const expenseRow = isExpenseCharge(charge);
                            const status = statusLabel(charge);
                            const canMarkPaid = !expenseRow && charge.status === "UNPAID";
                            const canUndoPaid = !expenseRow && charge.status === "PAID";
                            const canPublish = charge.status === "IMPORT_DRAFT";
                            const canCancel = charge.status !== "PAID" && charge.status !== "ARCHIVED" && charge.status !== "CANCELLED";
                            const canArchive = expenseRow ? charge.status === "UNPAID" : charge.status === "PAID";
                            const canRestore = charge.status === "ARCHIVED" || charge.status === "CANCELLED";
                            const canDelete = charge.status === "CANCELLED";
                            const restoreTooltip = charge.status === "ARCHIVED" ? "Újranyitás" : "Visszaállítás";

                            return (
                                <article key={`${charge.id}-mobile`} className={`finance-mobile-card${charge.status === "ARCHIVED" ? " finance-row-muted" : ""}`}>
                                    <div className="finance-mobile-head">
                                        <div className="dashboard-table-main">
                                            <strong>{charge.title}</strong>
                                            {charge.notes ? <span className="dashboard-table-subtitle">{charge.notes}</span> : null}
                                        </div>
                                        <span className={`dashboard-inline-badge ${statusTone(status)}`}>{status}</span>
                                    </div>
                                    <div className="finance-mobile-grid">
                                        <div className="finance-mobile-item">
                                            <span>Dátum</span>
                                            <strong>{formatDisplayDate(charge.due_date)}</strong>
                                        </div>
                                        <div className="finance-mobile-item">
                                            <span>Típus</span>
                                            <strong>{getChargeTypeLabel(charge.type, charge.tenant_id)}</strong>
                                        </div>
                                        <div className="finance-mobile-item">
                                            <span>Ingatlan</span>
                                            <strong>{property?.name ?? "Ismeretlen ingatlan"}</strong>
                                        </div>
                                        <div className="finance-mobile-item">
                                            <span>Bérlő / Partner</span>
                                            <strong>{tenant?.full_name || tenant?.email || "Saját"}</strong>
                                        </div>
                                        <div className="finance-mobile-item finance-mobile-item-wide">
                                            <span>Összeg</span>
                                            <strong className={expenseRow ? "transaction-amount-negative" : "transaction-amount-positive"}>
                                                {expenseRow ? "-" : charge.type === "RENT" ? "+" : ""}{formatCurrency(Number(charge.amount), charge.currency || "HUF")}
                                            </strong>
                                        </div>
                                    </div>
                                    <div className="finance-mobile-actions">
                                        <div className="finance-mobile-document">
                                            <span>Dokumentum</span>
                                            {documentUrl ? (
                                                <a className="dashboard-icon-button dashboard-icon-button-danger finance-mobile-action-button" href={documentUrl} target="_blank" rel="noreferrer" aria-label="PDF megnyitása" title="PDF megnyitása" data-tooltip="PDF megnyitása">
                                                    <PdfIcon />
                                                    <span>PDF</span>
                                                </a>
                                            ) : (
                                                <UploadInvoice chargeId={charge.id} variant="mobile" />
                                            )}
                                        </div>
                                        <div className="finance-mobile-action-row">
                                            <FinanceChargeEditor
                                                charge={{
                                                    id: charge.id,
                                                    title: charge.title,
                                                    notes: charge.notes,
                                                    type: charge.type,
                                                    amount: charge.amount,
                                                    currency: charge.currency,
                                                    due_date: charge.due_date,
                                                    tenant_id: charge.tenant_id,
                                                    status: charge.status,
                                                    recurring_group: charge.recurring_group ?? null,
                                                }}
                                                mobileLabel="Szerkesztés"
                                            />
                                            {canPublish ? (
                                                <ConfirmActionForm
                                                    action={async () => {
                                                        "use server";
                                                        await publishCharge(charge.id);
                                                    }}
                                                    confirmMessage="Biztosan publikálod ezt az importált piszkozatot a bérlő felé?"
                                                >
                                                    <button type="submit" className="dashboard-icon-button dashboard-icon-button-success finance-mobile-action-button" aria-label="Publikálás" title="Publikálás" data-tooltip="Publikálás">
                                                        <PublishIcon />
                                                        <span>Publikálás</span>
                                                    </button>
                                                </ConfirmActionForm>
                                            ) : null}
                                            {canMarkPaid ? (
                                                <ConfirmActionForm
                                                    action={async () => {
                                                        "use server";
                                                        await markChargePaid(charge.id);
                                                    }}
                                                    confirmMessage="Biztosan fizetettnek jelölöd ezt a tételt?"
                                                >
                                                    <button type="submit" className="dashboard-icon-button dashboard-icon-button-success finance-mobile-action-button" aria-label="Fizetettnek jelölés" title="Fizetettnek jelölés" data-tooltip="Fizetettnek jelölés">
                                                        <CheckIcon />
                                                        <span>Fizetett</span>
                                                    </button>
                                                </ConfirmActionForm>
                                            ) : null}
                                            {canUndoPaid ? (
                                                <ConfirmActionForm
                                                    action={async () => {
                                                        "use server";
                                                        await undoChargePaid(charge.id);
                                                    }}
                                                    confirmMessage="Biztosan visszavonod a fizetett státuszt?"
                                                >
                                                    <button type="submit" className="dashboard-icon-button dashboard-icon-button-amber finance-mobile-action-button" aria-label="Fizetett visszavonása" title="Fizetett visszavonása" data-tooltip="Fizetett visszavonása">
                                                        <UndoPaidIcon />
                                                        <span>Visszavonás</span>
                                                    </button>
                                                </ConfirmActionForm>
                                            ) : null}
                                            {canCancel ? (
                                                <ConfirmActionForm
                                                    action={async () => {
                                                        "use server";
                                                        await cancelCharge(charge.id);
                                                    }}
                                                    confirmMessage="Biztosan érvényteleníted ezt a tételt?"
                                                >
                                                    <button type="submit" className="dashboard-icon-button dashboard-icon-button-danger finance-mobile-action-button" aria-label="Sztornó" title="Sztornó" data-tooltip="Érvénytelenítés">
                                                        <CancelIcon />
                                                        <span>Sztornó</span>
                                                    </button>
                                                </ConfirmActionForm>
                                            ) : null}
                                            {canArchive ? (
                                                <ConfirmActionForm
                                                    action={async () => {
                                                        "use server";
                                                        await archiveCharge(charge.id);
                                                    }}
                                                    confirmMessage="Biztosan archiválod ezt a tételt?"
                                                >
                                                    <button type="submit" className="dashboard-icon-button finance-mobile-action-button" aria-label="Archiválás" title="Archiválás" data-tooltip="Archiválás">
                                                        <ArchiveIcon />
                                                        <span>Archiválás</span>
                                                    </button>
                                                </ConfirmActionForm>
                                            ) : null}
                                            {canRestore ? (
                                                <ConfirmActionForm
                                                    action={async () => {
                                                        "use server";
                                                        await restoreCharge(charge.id);
                                                    }}
                                                    confirmMessage={charge.status === "ARCHIVED" ? "Biztosan újranyitod ezt a tételt?" : "Biztosan visszaállítod ezt a tételt?"}
                                                >
                                                    <button type="submit" className="dashboard-icon-button dashboard-icon-button-success finance-mobile-action-button" aria-label={restoreTooltip} title={restoreTooltip} data-tooltip={restoreTooltip}>
                                                        <RestoreIcon />
                                                        <span>{restoreTooltip}</span>
                                                    </button>
                                                </ConfirmActionForm>
                                            ) : null}
                                            {canDelete ? (
                                                <ConfirmActionForm
                                                    action={async () => {
                                                        "use server";
                                                        await deleteCharge(charge.id);
                                                    }}
                                                    confirmMessage="Biztosan végleg törlöd ezt a sztornózott tételt? Ez nem visszavonható."
                                                >
                                                    <button type="submit" className="dashboard-icon-button dashboard-icon-button-danger finance-mobile-action-button" aria-label="Végleges törlés" title="Végleges törlés" data-tooltip="Végleges törlés">
                                                        <DeleteIcon />
                                                        <span>Törlés</span>
                                                    </button>
                                                </ConfirmActionForm>
                                            ) : null}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>

                    {totalPages > 1 ? (
                        <div className="charge-actions">
                            {page > 1 ? (
                                <Link className="btn btn-secondary btn-sm" href={`/owner/charges${buildQuery({
                                    property: selectedPropertyId || undefined,
                                    preset,
                                    from,
                                    to,
                                    status: statusFilter || undefined,
                                    type: typeFilter || undefined,
                                    billing: billingFilter || undefined,
                                    sort: sortFilter,
                                    q: keywordFilter || undefined,
                                    page: String(page - 1),
                                })}`}>
                                    Előző
                                </Link>
                            ) : <span />}
                            <span className="muted-note">Oldal {page} / {totalPages}</span>
                            {page < totalPages ? (
                                <Link className="btn btn-secondary btn-sm" href={`/owner/charges${buildQuery({
                                    property: selectedPropertyId || undefined,
                                    preset,
                                    from,
                                    to,
                                    status: statusFilter || undefined,
                                    type: typeFilter || undefined,
                                    billing: billingFilter || undefined,
                                    sort: sortFilter,
                                    q: keywordFilter || undefined,
                                    page: String(page + 1),
                                })}`}>
                                    Következő
                                </Link>
                            ) : <span />}
                        </div>
                    ) : null}
                </section>
            </div>
        </main>
    );
}
