import Link from "next/link";
import { requireRole } from "@/lib/auth/requireRole";
import { formatCurrency } from "@/lib/formatters";
import AppHeader from "@/components/AppHeader";
import { archiveTenantCharge } from "./actions";

type ChargeStatus = "UNPAID" | "PAID" | "ARCHIVED" | "CANCELLED";
type ChargeType = "RENT" | "UTILITY" | "COMMON_COST" | "OTHER";

type SearchParams = {
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

function buildQueryString(input: SearchParams) {
    const params = new URLSearchParams();
    if (input.property) params.set("property", input.property);
    if (input.status) params.set("status", input.status);
    if (input.type) params.set("type", input.type);
    if (input.from) params.set("from", input.from);
    if (input.to) params.set("to", input.to);
    if (input.page && input.page !== "1") params.set("page", input.page);
    return params.toString();
}

function buildStatusHref(current: SearchParams, nextStatus: string) {
    return `/tenant/charges?${buildQueryString({
        ...current,
        status: nextStatus,
        page: undefined,
    })}`;
}

function statusLabel(status: ChargeStatus) {
    switch (status) {
        case "UNPAID":
            return "Aktív";
        case "PAID":
            return "Fizetett";
        case "ARCHIVED":
            return "Archivált";
        case "CANCELLED":
            return "Törölt";
        default:
            return status;
    }
}

function typeLabel(type: ChargeType) {
    switch (type) {
        case "RENT":
            return "Bérleti díj";
        case "UTILITY":
            return "Rezsi";
        case "COMMON_COST":
            return "Közös költség";
        case "OTHER":
            return "Egyéb";
        default:
            return type;
    }
}

function getDueState(dueDate: string, status: ChargeStatus) {
    if (status === "PAID" || status === "ARCHIVED" || status === "CANCELLED") {
        return { cardClass: "", pillClass: "due-fresh", label: "Lezárt" };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(`${dueDate}T00:00:00`);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return { cardClass: " charge-overdue", pillClass: "due-overdue", label: `${Math.abs(diffDays)} napja lejárt` };
    }
    if (diffDays <= 5) {
        return { cardClass: " charge-soon", pillClass: "due-soon", label: diffDays === 0 ? "Ma esedékes" : `${diffDays} napon belül esedékes` };
    }
    return { cardClass: " charge-fresh", pillClass: "due-fresh", label: "Rendben, még nem járt le" };
}

function firstProperty(value: ChargeProperty | ChargeProperty[] | null | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

export default async function TenantChargesPage({ searchParams }: Props) {
    const { supabase, user, profile } = await requireRole("TENANT");

    const sp = (searchParams instanceof Promise) ? await searchParams : (searchParams ?? {});
    const selectedPropertyId = sp.property ? String(sp.property) : "";
    const statusFilter = sp.status ? String(sp.status) : "";
    const typeFilter = sp.type ? String(sp.type) : "";
    const fromFilter = sp.from ? String(sp.from) : "";
    const toFilter = sp.to ? String(sp.to) : "";
    const pageParam = sp.page ? Number(sp.page) : 1;
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const pageSize = 12;
    const rangeFrom = (page - 1) * pageSize;
    const rangeTo = rangeFrom + pageSize - 1;

    const { data: properties, error: propErr } = await supabase
        .from("properties")
        .select("id,name,address,status")
        .eq("tenant_id", user.id)
        .order("created_at", { ascending: false });

    if (propErr) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <div className="card space-y-2">
                    <h1>Saját díjaim</h1>
                    <p className="mt-2 text-red-600">Hiba (properties): {propErr.message}</p>
                </div>
            </main>
        );
    }

    const propertyRows = (properties ?? []) as PropertyRow[];
    const selectedProperty = selectedPropertyId
        ? propertyRows.find((property) => property.id === selectedPropertyId) ?? null
        : null;

    let listQuery = supabase
        .from("charges")
        .select("id,title,type,amount,currency,due_date,status,paid_at,property_id,recurring_group,recurring_index,recurring_count,properties(id,name,address)", { count: "exact" })
        .eq("tenant_id", user.id)
        .neq("status", "IMPORT_DRAFT")
        .order("due_date", { ascending: false });

    if (selectedPropertyId) listQuery = listQuery.eq("property_id", selectedPropertyId);
    if (statusFilter) listQuery = listQuery.eq("status", statusFilter);
    if (typeFilter) listQuery = listQuery.eq("type", typeFilter);
    if (fromFilter) listQuery = listQuery.gte("due_date", fromFilter);
    if (toFilter) listQuery = listQuery.lte("due_date", toFilter);

    const { data: charges, error, count } = await listQuery.range(rangeFrom, rangeTo);

    const currentYear = new Date().getFullYear();
    const totalsFrom = fromFilter || `${currentYear}-01-01`;
    const totalsTo = toFilter || `${currentYear}-12-31`;
    let totalsQuery = supabase
        .from("charges")
        .select("amount,status")
        .eq("tenant_id", user.id)
        .neq("status", "IMPORT_DRAFT")
        .gte("due_date", totalsFrom)
        .lte("due_date", totalsTo);

    if (selectedPropertyId) totalsQuery = totalsQuery.eq("property_id", selectedPropertyId);
    if (typeFilter) totalsQuery = totalsQuery.eq("type", typeFilter);
    const { data: totalsRows } = await totalsQuery;

    const { data: documents } = await supabase
        .from("documents")
        .select("id,charge_id,bucket_path,created_at")
        .eq("tenant_id", user.id)
        .order("created_at", { ascending: false });

    const documentsWithUrls = await Promise.all(
        ((documents ?? []) as DocumentRow[]).map(async (doc) => {
            const { data } = await supabase.storage
                .from("documents")
                .createSignedUrl(doc.bucket_path, 60 * 60);
            return { ...doc, signed_url: data?.signedUrl ?? "" };
        })
    );

    const documentsByCharge = new Map<string, DocumentWithUrl[]>();
    documentsWithUrls.forEach((doc) => {
        const list = documentsByCharge.get(doc.charge_id) ?? [];
        list.push(doc);
        documentsByCharge.set(doc.charge_id, list);
    });

    const summary = ((totalsRows ?? []) as TotalsRow[]).reduce(
        (acc, row) => {
            const amount = Number(row.amount) || 0;
            acc.total += row.status !== "CANCELLED" ? amount : 0;
            acc.paid += row.status === "PAID" || row.status === "ARCHIVED" ? amount : 0;
            acc.unpaid += row.status === "UNPAID" ? amount : 0;
            acc.closed += row.status === "PAID" || row.status === "ARCHIVED" ? 1 : 0;
            return acc;
        },
        { total: 0, paid: 0, unpaid: 0, closed: 0 }
    );

    if (error) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <div className="card space-y-2">
                    <h1>Saját díjaim</h1>
                    <p className="mt-2 text-red-600">Hiba (charges): {error.message}</p>
                </div>
            </main>
        );
    }

    const activeQuery = {
        property: selectedPropertyId,
        status: statusFilter,
        type: typeFilter,
        from: fromFilter,
        to: toFilter,
    };
    const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
    const chargeRows = (charges ?? []) as ChargeRow[];
    const formatMoney = (value: number) => formatCurrency(value, "HUF");

    return (
        <main className="app-shell page-enter space-y-4">
            <AppHeader profile={profile} />

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Bérlői áttekintés</div>
                        <h1>Saját díjaim</h1>
                        <p>
                            {selectedProperty
                                ? `${selectedProperty.name} · ${selectedProperty.address}`
                                : "Az összes hozzád rendelt díj egy helyen."}
                        </p>
                    </div>
                    <div className="muted-note">
                        A kártya színe jelzi, hogy a díj rendben van, közeleg vagy már lejárt.
                    </div>
                </div>

                <div className="kpi-grid stagger">
                    <div className="kpi-card">
                        <div className="kpi-label">Összes terhelés</div>
                        <div className="kpi-value">{formatMoney(summary.total)}</div>
                        <div className="muted-note">{totalsFrom} - {totalsTo}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Nyitott egyenleg</div>
                        <div className="kpi-value">{formatMoney(summary.unpaid)}</div>
                        <div className="muted-note">még nem rendezett díjak</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Már fizetett</div>
                        <div className="kpi-value">{formatMoney(summary.paid)}</div>
                        <div className="muted-note">{summary.closed} lezárt tétel</div>
                    </div>
                </div>
            </section>

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="card-title">Szűrők és nézetek</div>
                        <p className="muted-note">Az áttekintés a teljes kiválasztott időszakra számol, nem csak erre az oldalra.</p>
                    </div>
                    <a className="btn btn-secondary" href={`/tenant/charges/export?${buildQueryString(activeQuery)}`}>
                        Exportálás CSV-be
                    </a>
                </div>

                <div className="nav-pills">
                    <Link className={`pill${!statusFilter ? " pill-active" : ""}`} href={buildStatusHref(activeQuery, "")}>
                        Összes
                    </Link>
                    <Link className={`pill${statusFilter === "UNPAID" ? " pill-active" : ""}`} href={buildStatusHref(activeQuery, "UNPAID")}>
                        Aktív
                    </Link>
                    <Link className={`pill${statusFilter === "PAID" ? " pill-active" : ""}`} href={buildStatusHref(activeQuery, "PAID")}>
                        Fizetett
                    </Link>
                    <Link className={`pill${statusFilter === "ARCHIVED" ? " pill-active" : ""}`} href={buildStatusHref(activeQuery, "ARCHIVED")}>
                        Archivált
                    </Link>
                </div>

                <form method="GET" className="section-stack">
                    <div className="filter-grid">
                        <select name="property" defaultValue={selectedPropertyId} className="select">
                            <option value="">Minden ingatlan</option>
                            {propertyRows.map((property) => (
                                <option key={property.id} value={property.id}>
                                    {property.name} - {property.address}
                                </option>
                            ))}
                        </select>
                        <select name="status" defaultValue={statusFilter} className="select">
                            <option value="">Minden státusz</option>
                            <option value="UNPAID">Aktív</option>
                            <option value="PAID">Fizetett</option>
                            <option value="ARCHIVED">Archivált</option>
                            <option value="CANCELLED">Törölt</option>
                        </select>
                        <select name="type" defaultValue={typeFilter} className="select">
                            <option value="">Minden típus</option>
                            <option value="RENT">Bérleti díj</option>
                            <option value="UTILITY">Rezsi</option>
                            <option value="COMMON_COST">Közös költség</option>
                            <option value="OTHER">Egyéb</option>
                        </select>
                        <input name="from" type="date" defaultValue={fromFilter} className="input" />
                        <input name="to" type="date" defaultValue={toFilter} className="input" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button className="btn btn-primary">Szűrés frissítése</button>
                        <Link className="btn btn-secondary" href="/tenant/charges">
                            Szűrők törlése
                        </Link>
                    </div>
                </form>
            </section>

            {selectedProperty ? (
                <section className="card section-stack">
                    <div className="card-title">Kiválasztott ingatlan</div>
                    <div className="charge-meta">
                        <span>{selectedProperty.name}</span>
                        <span>{selectedProperty.address}</span>
                        <span>Státusz: {selectedProperty.status}</span>
                    </div>
                </section>
            ) : null}

            {chargeRows.length === 0 ? (
                <div className="card">
                    <p className="card-title">Nincs megjeleníthető díj ebben a nézetben.</p>
                    <p className="muted-note">Válts ingatlant, módosíts dátumtartományt, vagy várj új tulajdonosi rögzítésre.</p>
                </div>
            ) : (
                <section className="card section-stack">
                    <div className="section-header">
                        <div>
                            <div className="card-title">Tétellista</div>
                            <p className="muted-note">{count ?? chargeRows.length} tétel, oldalméret {pageSize}.</p>
                        </div>
                    </div>

                    <div className="charge-list">
                        {chargeRows.map((charge) => {
                            const property = firstProperty(charge.properties);
                            const dueState = getDueState(charge.due_date, charge.status);
                            const docList = documentsByCharge.get(charge.id) ?? [];
                            const recurringLabel = charge.recurring_group && charge.recurring_index && charge.recurring_count
                                ? `Ismétlődés ${charge.recurring_index}/${charge.recurring_count}`
                                : null;

                            return (
                                <article
                                    key={charge.id}
                                    className={`charge-card${dueState.cardClass}${charge.status === "ARCHIVED" ? " charge-archived" : ""}`}
                                >
                                    <div className="section-header">
                                        <div>
                                            <div className="card-title">{charge.title}</div>
                                            <div className="charge-meta">
                                                {property?.name ? <span>{property.name}</span> : null}
                                                {property?.address ? <span>{property.address}</span> : null}
                                                <span>{typeLabel(charge.type)}</span>
                                                <span>{formatCurrency(Number(charge.amount), String(charge.currency || "HUF"))}</span>
                                                <span>Esedékes: {charge.due_date}</span>
                                                {charge.status === "PAID" && charge.paid_at ? (
                                                    <span>Fizetve: {new Date(charge.paid_at).toLocaleDateString("hu-HU")}</span>
                                                ) : null}
                                                {recurringLabel ? <span>{recurringLabel}</span> : null}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className={`due-pill ${dueState.pillClass}`}>
                                                {dueState.label}
                                            </div>
                                            <div className={`status-badge status-${String(charge.status).toLowerCase()}`}>
                                                {statusLabel(charge.status)}
                                            </div>
                                        </div>
                                    </div>

                                    {docList.length > 0 ? (
                                        <div className="charge-docs">
                                            {docList.map((doc) => (
                                                <div key={doc.id}>
                                                    <a className="link" href={doc.signed_url} target="_blank" rel="noreferrer">
                                                        Dokumentum: {doc.bucket_path.split("/").at(-1)}
                                                    </a>{" "}
                                                    · {new Date(doc.created_at).toLocaleString("hu-HU")}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="charge-docs">
                                            <span>Nincs feltöltött dokumentum.</span>
                                        </div>
                                    )}

                                    <div className="charge-actions action-box">
                                        <div className="charge-actions-primary">
                                            <Link className="btn btn-primary btn-sm" href={`/tenant/charges/${charge.id}`}>
                                                Részletek
                                            </Link>
                                        </div>

                                        {charge.status === "PAID" ? (
                                            <>
                                                <div className="action-divider" />
                                                <div className="charge-actions-secondary">
                                                    <form
                                                        action={async () => {
                                                            "use server";
                                                            await archiveTenantCharge(charge.id);
                                                        }}
                                                    >
                                                        <button type="submit" className="btn btn-secondary btn-sm">
                                                            Archiválás
                                                        </button>
                                                    </form>
                                                </div>
                                            </>
                                        ) : null}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
            )}

            {count && count > pageSize ? (
                <div className="card section-header">
                    <div className="muted-note">
                        Oldal {page} / {totalPages}
                    </div>
                    <div className="flex gap-2">
                        {page > 1 ? (
                            <Link
                                className="btn btn-secondary btn-sm"
                                href={`/tenant/charges?${buildQueryString({ ...activeQuery, page: String(page - 1) })}`}
                            >
                                Előző
                            </Link>
                        ) : (
                            <span className="btn btn-secondary btn-sm" aria-disabled="true">Előző</span>
                        )}
                        {page < totalPages ? (
                            <Link
                                className="btn btn-secondary btn-sm"
                                href={`/tenant/charges?${buildQueryString({ ...activeQuery, page: String(page + 1) })}`}
                            >
                                Következő
                            </Link>
                        ) : (
                            <span className="btn btn-secondary btn-sm" aria-disabled="true">Következő</span>
                        )}
                    </div>
                </div>
            ) : null}
        </main>
    );
}
