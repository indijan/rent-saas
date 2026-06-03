import Link from "next/link";
import { requireRole } from "@/lib/auth/requireRole";
import { formatCurrency } from "@/lib/formatters";
import AppHeader from "@/components/AppHeader";
import FinancePeriodFilter from "@/app/owner/charges/FinancePeriodFilter";
import DesignIcon from "@/components/dashboard/DesignIcon";
import { createDocumentSignedUrl } from "@/lib/documentStorage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listTenantProperties } from "@/lib/propertyTenants";
import { ALL_CHARGE_TYPE_OPTIONS, getChargeTypeLabel, type ChargeType } from "@/lib/chargeTypes";

type ChargeStatus = "UNPAID" | "PAID" | "ARCHIVED" | "CANCELLED";
type PeriodPreset = "CURRENT_MONTH" | "LAST_30_DAYS" | "LAST_3_MONTHS" | "LAST_6_MONTHS" | "LAST_12_MONTHS" | "MAX" | "CUSTOM";

type SearchParams = {
    preset?: string;
    property?: string;
    status?: string;
    type?: string;
    from?: string;
    to?: string;
    page?: string;
};

type PropertyRow = {
    id: string;
    name: string;
    address: string;
    status: string;
};

type ChargeProperty = {
    id: string;
    name: string;
    address: string;
};

type ChargeRow = {
    id: string;
    title: string;
    type: ChargeType;
    amount: number | string;
    currency: string | null;
    due_date: string;
    status: ChargeStatus;
    paid_at: string | null;
    property_id: string;
    recurring_group: string | null;
    recurring_index: number | null;
    recurring_count: number | null;
    properties?: ChargeProperty | ChargeProperty[] | null;
};

type TotalsRow = {
    amount: number | string;
    status: ChargeStatus;
};

type DocumentRow = {
    id: string;
    charge_id: string;
    bucket_path: string;
    created_at: string;
};

type DocumentWithUrl = DocumentRow & {
    signed_url: string;
};

type Props = {
    searchParams?: Promise<SearchParams> | SearchParams;
};

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

function shiftMonths(base: Date, months: number) {
    const next = new Date(base);
    next.setMonth(next.getMonth() + months);
    return next;
}

function normalizePeriodPreset(value: string | undefined): PeriodPreset {
    const preset = String(value || "CURRENT_MONTH").trim().toUpperCase();
    if (["CURRENT_MONTH", "LAST_30_DAYS", "LAST_3_MONTHS", "LAST_6_MONTHS", "LAST_12_MONTHS", "MAX", "CUSTOM"].includes(preset)) {
        return preset as PeriodPreset;
    }
    return "CURRENT_MONTH";
}

function resolvePeriodRange(preset: PeriodPreset, requestedFrom?: string, requestedTo?: string) {
    const today = startOfToday();
    const todayValue = toDateInputValue(today);

    switch (preset) {
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
                to: todayValue,
                label: "Elmúlt 3 hónap",
            };
        case "LAST_6_MONTHS":
            return {
                from: toDateInputValue(shiftMonths(today, -6)),
                to: todayValue,
                label: "Elmúlt fél év",
            };
        case "LAST_12_MONTHS":
            return {
                from: toDateInputValue(shiftMonths(today, -12)),
                to: todayValue,
                label: "Elmúlt 1 év",
            };
        case "MAX":
            return {
                from: "2000-01-01",
                to: todayValue,
                label: "Maximum",
            };
        case "CUSTOM":
            return {
                from: requestedFrom || startOfCurrentMonth(),
                to: requestedTo || endOfCurrentMonth(),
                label: "Egyedi időszak",
            };
        default:
            return {
                from: startOfCurrentMonth(),
                to: endOfCurrentMonth(),
                label: "Aktuális hónap",
            };
    }
}

function buildQuery(input: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    Object.entries(input).forEach(([key, value]) => {
        if (value) params.set(key, value);
    });
    const query = params.toString();
    return query ? `?${query}` : "";
}

function formatDisplayDate(dateValue: string) {
    return new Intl.DateTimeFormat("hu-HU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date(`${dateValue}T00:00:00`));
}

function statusLabel(status: ChargeStatus, dueDate: string) {
    if (status === "UNPAID" && new Date(`${dueDate}T00:00:00`).getTime() < startOfToday().getTime()) {
        return "Lejárt";
    }
    switch (status) {
        case "UNPAID":
            return "Aktív";
        case "PAID":
            return "Fizetett";
        case "ARCHIVED":
            return "Archivált";
        case "CANCELLED":
            return "Sztornó";
        default:
            return status;
    }
}

function typeTone(type: ChargeType) {
    switch (type) {
        case "RENT":
            return "dashboard-inline-badge-green";
        case "UTILITY":
            return "dashboard-inline-badge-blue";
        case "INSURANCE":
            return "dashboard-inline-badge-amber";
        case "COMMON_COST":
            return "dashboard-inline-badge-purple";
        case "RENOVATION":
            return "dashboard-inline-badge-green";
        default:
            return "dashboard-inline-badge-red";
    }
}

function statusTone(status: string) {
    if (status === "Fizetett") return "dashboard-inline-badge-green";
    if (status === "Lejárt") return "dashboard-inline-badge-red";
    if (status === "Aktív") return "dashboard-inline-badge-blue";
    if (status === "Archivált") return "dashboard-inline-badge-purple";
    return "dashboard-inline-badge-amber";
}

function getDueState(dueDate: string, status: ChargeStatus) {
    if (status === "PAID" || status === "ARCHIVED" || status === "CANCELLED") {
        return { label: "Lezárt", overdue: false, soon: false };
    }

    const today = startOfToday();
    const due = new Date(`${dueDate}T00:00:00`);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return { label: `${Math.abs(diffDays)} napja lejárt`, overdue: true, soon: false };
    }
    if (diffDays <= 5) {
        return { label: diffDays === 0 ? "Ma esedékes" : `${diffDays} napon belül esedékes`, overdue: false, soon: true };
    }
    return { label: "Határidőn belül", overdue: false, soon: false };
}

function firstProperty(value: ChargeProperty | ChargeProperty[] | null | undefined) {
    return Array.isArray(value) ? value[0] : value;
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

function DetailIcon() {
    return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
            <circle cx="12" cy="12" r="2.6" />
        </svg>
    );
}

export default async function TenantChargesPage({ searchParams }: Props) {
    const { user, profile } = await requireRole("TENANT");
    const admin = createSupabaseAdminClient();
    const tenantProperties = await listTenantProperties(user.id);
    const propertyIds = tenantProperties.map((property) => property.id);

    const sp = searchParams instanceof Promise ? await searchParams : (searchParams ?? {});
    const preset = normalizePeriodPreset(sp.preset ? String(sp.preset) : undefined);
    const periodRange = resolvePeriodRange(preset, sp.from ? String(sp.from) : undefined, sp.to ? String(sp.to) : undefined);
    const from = periodRange.from;
    const to = periodRange.to;
    const selectedPropertyId = sp.property ? String(sp.property) : "";
    const statusFilter = sp.status ? String(sp.status) : "";
    const typeFilter = sp.type ? String(sp.type) : "";
    const pageParam = sp.page ? Number(sp.page) : 1;
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const pageSize = 10;
    const rangeFrom = (page - 1) * pageSize;
    const rangeTo = rangeFrom + pageSize - 1;

    const propertyRows = tenantProperties.map((property) => ({
        id: property.id,
        name: property.name,
        address: property.address,
        status: "ACTIVE",
    } satisfies PropertyRow));
    const propertyById = new Map(propertyRows.map((property) => [property.id, property]));
    const selectedProperty = selectedPropertyId ? propertyById.get(selectedPropertyId) ?? null : null;

    let listQuery = admin
        .from("charges")
        .select("id,title,type,amount,currency,due_date,status,paid_at,property_id,recurring_group,recurring_index,recurring_count,properties(id,name,address)", { count: "exact" })
        .in("property_id", propertyIds.length > 0 ? propertyIds : ["00000000-0000-0000-0000-000000000000"])
        .neq("status", "IMPORT_DRAFT")
        .gte("due_date", from)
        .lte("due_date", to)
        .order("due_date", { ascending: true });

    if (selectedPropertyId) listQuery = listQuery.eq("property_id", selectedPropertyId);
    if (statusFilter === "OVERDUE") {
        listQuery = listQuery.eq("status", "UNPAID").lt("due_date", toDateInputValue(startOfToday()));
    } else if (statusFilter) {
        listQuery = listQuery.eq("status", statusFilter);
    }
    if (typeFilter) listQuery = listQuery.eq("type", typeFilter);

    const { data: charges, error, count } = await listQuery.range(rangeFrom, rangeTo);

    const totalsQuery = admin
        .from("charges")
        .select("amount,status,due_date")
        .in("property_id", propertyIds.length > 0 ? propertyIds : ["00000000-0000-0000-0000-000000000000"])
        .neq("status", "IMPORT_DRAFT")
        .gte("due_date", from)
        .lte("due_date", to);

    const { data: totalsRows } = selectedPropertyId
        ? await totalsQuery.eq("property_id", selectedPropertyId)
        : await totalsQuery;

    const chargeIds = ((charges ?? []) as ChargeRow[]).map((charge) => charge.id);

    const { data: documents } = chargeIds.length === 0
        ? { data: [] }
        : await admin
            .from("documents")
            .select("id,charge_id,bucket_path,created_at")
            .in("charge_id", chargeIds)
            .order("created_at", { ascending: false });

    const documentsWithUrls = await Promise.all(
        ((documents ?? []) as DocumentRow[]).map(async (doc) => {
            try {
                const signedUrl = await createDocumentSignedUrl(doc.bucket_path, 60 * 60);
                return { ...doc, signed_url: signedUrl };
            } catch {
                return { ...doc, signed_url: "" };
            }
        })
    );

    const documentsByCharge = new Map<string, DocumentWithUrl[]>();
    documentsWithUrls.forEach((doc) => {
        const list = documentsByCharge.get(doc.charge_id) ?? [];
        list.push(doc);
        documentsByCharge.set(doc.charge_id, list);
    });

    const summary = ((totalsRows ?? []) as Array<TotalsRow & { due_date: string }>).reduce(
        (acc, row) => {
            const amount = Number(row.amount) || 0;
            const overdue = row.status === "UNPAID" && new Date(`${row.due_date}T00:00:00`).getTime() < startOfToday().getTime();
            const diffDays = Math.ceil((new Date(`${row.due_date}T00:00:00`).getTime() - startOfToday().getTime()) / (1000 * 60 * 60 * 24));
            const soon = row.status === "UNPAID" && diffDays >= 0 && diffDays <= 5;

            acc.total += row.status !== "CANCELLED" ? amount : 0;
            acc.paid += row.status === "PAID" || row.status === "ARCHIVED" ? amount : 0;
            acc.unpaid += row.status === "UNPAID" ? amount : 0;
            acc.overdueCount += overdue ? 1 : 0;
            acc.overdueAmount += overdue ? amount : 0;
            acc.soonCount += soon ? 1 : 0;
            acc.archivedCount += row.status === "ARCHIVED" ? 1 : 0;
            return acc;
        },
        { total: 0, paid: 0, unpaid: 0, overdueCount: 0, overdueAmount: 0, soonCount: 0, archivedCount: 0 }
    );

    if (error) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <section className="card">
                    <h1>Saját díjaim</h1>
                    <p className="text-red-600">Hiba: {error.message}</p>
                </section>
            </main>
        );
    }

    const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
    const chargeRows = (charges ?? []) as ChargeRow[];
    const periodLabel = preset === "CUSTOM" ? `${formatDisplayDate(from)} - ${formatDisplayDate(to)}` : periodRange.label;

    return (
        <main className="app-shell page-enter">
            <AppHeader
                profile={profile}
                dashboardContext={{
                    label: "Ingatlan",
                    items: propertyRows.map((property) => ({ id: property.id, label: property.name })),
                    value: selectedPropertyId || "__all__",
                    baseHref: "/tenant/charges",
                    query: {
                        preset,
                        from: preset === "CUSTOM" ? from : undefined,
                        to: preset === "CUSTOM" ? to : undefined,
                        status: statusFilter || undefined,
                        type: typeFilter || undefined,
                    },
                }}
            />

            <div className="finance-page-grid">
                <section className="dashboard-page-header">
                    <div>
                        <h1>Saját díjaim</h1>
                        <p>{selectedProperty ? `${selectedProperty.name} · ${selectedProperty.address}` : "A hozzád rendelt bérleti díjak és költségek egy helyen."}</p>
                    </div>
                    <FinancePeriodFilter
                        property={selectedPropertyId || undefined}
                        status={statusFilter || undefined}
                        type={typeFilter || undefined}
                        preset={preset}
                        from={from}
                        to={to}
                        propertyLabel={selectedProperty ? selectedProperty.name : "Összes ingatlan"}
                    />
                </section>

                <section className="card dashboard-summary-strip">
                    <article className="dashboard-summary-card">
                        <DesignIcon name="lejart_dij" alt="Lejárt díjak" tone="design-icon-badge-danger" size={58} />
                        <div className="dashboard-summary-copy">
                            <div className="dashboard-summary-title">Lejárt díjak</div>
                            <div className="dashboard-summary-value">{summary.overdueCount}</div>
                            <div className="muted-note">{formatCurrency(summary.overdueAmount, "HUF")}</div>
                        </div>
                    </article>
                    <article className="dashboard-summary-card">
                        <DesignIcon name="kozelgo_feladatok" alt="Közelgő tételek" tone="design-icon-badge-amber" size={58} />
                        <div className="dashboard-summary-copy">
                            <div className="dashboard-summary-title">Közelgő tételek</div>
                            <div className="dashboard-summary-value">{summary.soonCount}</div>
                            <div className="muted-note">5 napon belül esedékes</div>
                        </div>
                    </article>
                    <article className="dashboard-summary-card">
                        <DesignIcon name="kintlevoseg" alt="Nyitott egyenleg" tone="design-icon-badge-blue" size={58} />
                        <div className="dashboard-summary-copy">
                            <div className="dashboard-summary-title">Nyitott egyenleg</div>
                            <div className="dashboard-summary-value">{formatCurrency(summary.unpaid, "HUF")}</div>
                            <div className="muted-note">{periodLabel}</div>
                        </div>
                    </article>
                    <article className="dashboard-summary-card">
                        <DesignIcon name="bevetel" alt="Fizetett tételek" tone="design-icon-badge-green" size={58} />
                        <div className="dashboard-summary-copy">
                            <div className="dashboard-summary-title">Fizetett / lezárt</div>
                            <div className="dashboard-summary-value">{formatCurrency(summary.paid, "HUF")}</div>
                            <div className="muted-note">{summary.archivedCount} archivált tétel</div>
                        </div>
                    </article>
                </section>

                <section className="card section-stack">
                    <div className="section-header">
                        <div>
                            <div className="card-title">Gyors elérés</div>
                            <p className="muted-note">Ha költözöl, kérdésed van vagy áttekintenéd a lezárt tételeket, innen egyből eléred.</p>
                        </div>
                    </div>
                    <div className="quick-action-grid">
                        <Link className="quick-action-card" href="/account#kilepesi-kerelem-kuldes">
                            <DesignIcon name="kilepesi_kerelem_folyamatban" alt="Kilépési kérelem" tone="design-icon-badge-amber" />
                            <strong>Kilépési kérelem</strong>
                        </Link>
                        <Link className="quick-action-card" href="/account#kapcsolat">
                            <DesignIcon name="level" alt="Kapcsolat" tone="design-icon-badge-purple" />
                            <strong>Kapcsolat</strong>
                        </Link>
                        <Link className="quick-action-card" href="/account#otletlada">
                            <DesignIcon name="level" alt="Ötletláda" tone="design-icon-badge-blue" />
                            <strong>Ötletláda</strong>
                        </Link>
                        <Link className="quick-action-card" href="/tenant/charges?status=PAID">
                            <DesignIcon name="beerkezett" alt="Fizetett tételek" tone="design-icon-badge-green" />
                            <strong>Fizetett tételek</strong>
                        </Link>
                    </div>
                </section>

                <section className="card finance-filter-shell">
                    <div>
                        <div className="card-title">Szűrők</div>
                        <p className="muted-note">Az időszakot a felső vezérlő határozza meg, itt már csak a lista nézetét finomítod.</p>
                    </div>
                    <div className="finance-filter-period-note">
                        <span className="field-label">Aktív időszak</span>
                        <strong>{periodLabel}</strong>
                        <span>{selectedProperty ? selectedProperty.name : "Összes ingatlan"}</span>
                    </div>
                    <form method="GET" className="finance-filter-form">
                        {selectedPropertyId ? <input type="hidden" name="property" value={selectedPropertyId} /> : null}
                        <input type="hidden" name="preset" value={preset} />
                        <input type="hidden" name="from" value={from} />
                        <input type="hidden" name="to" value={to} />
                        <div className="finance-filter-grid">
                            <label className="field-stack">
                                <span className="field-label">Státusz</span>
                                <select name="status" className="select" defaultValue={statusFilter}>
                                    <option value="">Minden státusz</option>
                                    <option value="UNPAID">Aktív</option>
                                    <option value="OVERDUE">Lejárt</option>
                                    <option value="PAID">Fizetett</option>
                                    <option value="ARCHIVED">Archivált</option>
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
                                    href={`/tenant/charges${buildQuery({
                                        property: selectedPropertyId || undefined,
                                        preset,
                                        from,
                                        to,
                                    })}`}
                                >
                                    Szűrők törlése
                                </Link>
                                <a
                                    className="btn btn-secondary"
                                    href={`/tenant/charges/export${buildQuery({
                                        property: selectedPropertyId || undefined,
                                        from,
                                        to,
                                        status: statusFilter || undefined,
                                        type: typeFilter || undefined,
                                    })}`}
                                >
                                    Export Excelbe
                                </a>
                            </div>
                        </div>
                    </form>
                </section>

                <section className="card finance-table-shell">
                    <div className="section-header">
                        <div>
                            <div className="card-title">Tételek</div>
                            <p className="muted-note">Összesen {count ?? chargeRows.length} tétel</p>
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
                                    <th>Határidő</th>
                                    <th>Összeg</th>
                                    <th>Státusz</th>
                                    <th>Dokumentum</th>
                                    <th>Műveletek</th>
                                </tr>
                            </thead>
                            <tbody>
                                {chargeRows.map((charge) => {
                                    const property = firstProperty(charge.properties);
                                    const documentUrl = (documentsByCharge.get(charge.id) ?? []).find((doc) => doc.signed_url)?.signed_url ?? "";
                                    const status = statusLabel(charge.status, charge.due_date);
                                    const dueState = getDueState(charge.due_date, charge.status);
                                    const recurringLabel = charge.recurring_group && charge.recurring_index && charge.recurring_count
                                        ? `Ismétlődés ${charge.recurring_index}/${charge.recurring_count}`
                                        : "Egyszeri tétel";
                                    return (
                                        <tr key={charge.id} className={charge.status === "ARCHIVED" ? "finance-row-muted" : ""}>
                                            <td>{formatDisplayDate(charge.due_date)}</td>
                                            <td>
                                                <span className={`dashboard-inline-badge ${typeTone(charge.type)}`}>
                                                    {getChargeTypeLabel(charge.type, user.id)}
                                                </span>
                                            </td>
                                            <td className="finance-cell-title">
                                                <div className="dashboard-table-main">
                                                    <strong>{charge.title}</strong>
                                                    <span className="dashboard-table-subtitle">{recurringLabel}</span>
                                                </div>
                                            </td>
                                            <td className="finance-cell-property">{property?.name ?? "Ismeretlen ingatlan"}</td>
                                            <td className="finance-cell-partner">{dueState.label}</td>
                                            <td className="finance-cell-amount">{formatCurrency(Number(charge.amount), charge.currency || "HUF")}</td>
                                            <td>
                                                <span className={`dashboard-inline-badge ${statusTone(status)}`}>{status}</span>
                                            </td>
                                            <td className="finance-cell-document">
                                                {documentUrl ? (
                                                    <a className="dashboard-icon-button dashboard-icon-button-danger" href={documentUrl} target="_blank" rel="noreferrer" aria-label="PDF megnyitása" title="PDF megnyitása" data-tooltip="PDF megnyitása">
                                                        <PdfIcon />
                                                    </a>
                                                ) : (
                                                    <button type="button" className="dashboard-icon-button" aria-label="Nincs dokumentum" title="Nincs dokumentum" data-tooltip="Nincs dokumentum" disabled>
                                                        <PdfIcon />
                                                    </button>
                                                )}
                                            </td>
                                            <td className="finance-cell-actions">
                                                <div className="dashboard-table-actions">
                                                    <Link className="dashboard-icon-button" href={`/tenant/charges/${charge.id}`} aria-label="Részletek" title="Részletek" data-tooltip="Részletek">
                                                        <DetailIcon />
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {chargeRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="dashboard-empty-note">Nincs találat a megadott szűrőkkel.</td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>

                    <div className="finance-mobile-list">
                        {chargeRows.length === 0 ? (
                            <div className="dashboard-empty-note">Nincs találat a megadott szűrőkkel.</div>
                        ) : chargeRows.map((charge) => {
                            const property = firstProperty(charge.properties);
                            const documentUrl = (documentsByCharge.get(charge.id) ?? []).find((doc) => doc.signed_url)?.signed_url ?? "";
                            const status = statusLabel(charge.status, charge.due_date);
                            const dueState = getDueState(charge.due_date, charge.status);
                            return (
                                <article key={`${charge.id}-mobile`} className={`finance-mobile-card${charge.status === "ARCHIVED" ? " finance-row-muted" : ""}`}>
                                    <div className="finance-mobile-head">
                                        <div className="dashboard-table-main">
                                            <strong>{charge.title}</strong>
                                            <span className="dashboard-table-subtitle">{property?.name ?? "Ismeretlen ingatlan"}</span>
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
                                            <strong>{getChargeTypeLabel(charge.type, user.id)}</strong>
                                        </div>
                                        <div className="finance-mobile-item">
                                            <span>Határidő</span>
                                            <strong>{dueState.label}</strong>
                                        </div>
                                        <div className="finance-mobile-item">
                                            <span>Összeg</span>
                                            <strong>{formatCurrency(Number(charge.amount), charge.currency || "HUF")}</strong>
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
                                                <button type="button" className="dashboard-icon-button finance-mobile-action-button" aria-label="Nincs dokumentum" title="Nincs dokumentum" data-tooltip="Nincs dokumentum" disabled>
                                                    <PdfIcon />
                                                    <span>Nincs PDF</span>
                                                </button>
                                            )}
                                        </div>
                                        <div className="finance-mobile-action-row">
                                            <Link className="dashboard-icon-button finance-mobile-action-button" href={`/tenant/charges/${charge.id}`} aria-label="Részletek" title="Részletek" data-tooltip="Részletek">
                                                <DetailIcon />
                                                <span>Részletek</span>
                                            </Link>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>

                    {totalPages > 1 ? (
                        <div className="charge-actions">
                            {page > 1 ? (
                                <Link className="btn btn-secondary btn-sm" href={`/tenant/charges${buildQuery({
                                    property: selectedPropertyId || undefined,
                                    preset,
                                    from,
                                    to,
                                    status: statusFilter || undefined,
                                    type: typeFilter || undefined,
                                    page: String(page - 1),
                                })}`}>
                                    Előző
                                </Link>
                            ) : <span />}
                            <span className="muted-note">Oldal {page} / {totalPages}</span>
                            {page < totalPages ? (
                                <Link className="btn btn-secondary btn-sm" href={`/tenant/charges${buildQuery({
                                    property: selectedPropertyId || undefined,
                                    preset,
                                    from,
                                    to,
                                    status: statusFilter || undefined,
                                    type: typeFilter || undefined,
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
