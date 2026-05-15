import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { archiveCharge, cancelCharge, deleteCharge, markChargePaid, publishCharge, restoreCharge } from "./actions";
import ConfirmActionForm from "./ConfirmActionForm";
import UploadInvoice from "@/components/UploadInvoice";
import CreateChargeForm from "./CreateChargeForm";
import EditChargeForm from "./EditChargeForm";
import { formatCurrency } from "@/lib/formatters";
import AppHeader from "@/components/AppHeader";

type ChargeStatus = "UNPAID" | "PAID" | "ARCHIVED" | "CANCELLED" | "IMPORT_DRAFT";
type ChargeType = "RENT" | "UTILITY" | "COMMON_COST" | "OTHER";

type SearchParams = {
    status?: string;
    type?: string;
    from?: string;
    to?: string;
    page?: string;
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
    created_at: string;
    recurring_group: string | null;
    recurring_index: number | null;
    recurring_count: number | null;
};

type ChargeTotalsRow = {
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
    params: Promise<{ id: string }>;
    searchParams?: Promise<SearchParams> | SearchParams;
};

function buildQueryString(input: SearchParams) {
    const params = new URLSearchParams();
    if (input.status) params.set("status", input.status);
    if (input.type) params.set("type", input.type);
    if (input.from) params.set("from", input.from);
    if (input.to) params.set("to", input.to);
    if (input.page && input.page !== "1") params.set("page", input.page);
    return params.toString();
}

function buildStatusHref(basePath: string, current: SearchParams, nextStatus: string) {
    return `${basePath}?${buildQueryString({
        ...current,
        status: nextStatus,
        page: undefined,
    })}`;
}

function statusLabel(status: ChargeStatus) {
    switch (status) {
        case "IMPORT_DRAFT":
            return "Piszkozat";
        case "UNPAID":
            return "Aktiv";
        case "PAID":
            return "Fizetett";
        case "ARCHIVED":
            return "Archivalt";
        case "CANCELLED":
            return "Torolt";
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

export default async function OwnerPropertyChargesPage({ params, searchParams }: Props) {
    const { id: propertyId } = await params;
    const { supabase, profile } = await requireRole("OWNER");

    const sp = (searchParams instanceof Promise) ? await searchParams : (searchParams ?? {});
    const statusFilter = sp.status ? String(sp.status) : "";
    const typeFilter = sp.type ? String(sp.type) : "";
    const fromFilter = sp.from ? String(sp.from) : "";
    const toFilter = sp.to ? String(sp.to) : "";
    const pageParam = sp.page ? Number(sp.page) : 1;
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const pageSize = 12;
    const rangeFrom = (page - 1) * pageSize;
    const rangeTo = rangeFrom + pageSize - 1;

    const { data: property, error: propErr } = await supabase
        .from("properties")
        .select("id,name,address")
        .eq("id", propertyId)
        .single();

    if (propErr || !property) return notFound();

    let listQuery = supabase
        .from("charges")
        .select("id,title,type,amount,currency,due_date,status,paid_at,created_at,recurring_group,recurring_index,recurring_count", { count: "exact" })
        .eq("property_id", propertyId)
        .order("due_date", { ascending: false });

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
        .eq("property_id", propertyId)
        .gte("due_date", totalsFrom)
        .lte("due_date", totalsTo);

    if (typeFilter) totalsQuery = totalsQuery.eq("type", typeFilter);
    const { data: totalsRows } = await totalsQuery;

    const { data: documents } = await supabase
        .from("documents")
        .select("id,charge_id,bucket_path,created_at")
        .eq("property_id", propertyId)
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

    const summary = ((totalsRows ?? []) as ChargeTotalsRow[]).reduce(
        (acc, row) => {
            const amount = Number(row.amount) || 0;
            acc.total += row.status !== "CANCELLED" ? amount : 0;
            acc.paid += row.status === "PAID" || row.status === "ARCHIVED" ? amount : 0;
            acc.unpaid += row.status === "UNPAID" ? amount : 0;
            acc.drafts += row.status === "IMPORT_DRAFT" ? 1 : 0;
            acc.active += row.status === "UNPAID" ? 1 : 0;
            acc.closed += row.status === "PAID" || row.status === "ARCHIVED" ? 1 : 0;
            return acc;
        },
        { total: 0, paid: 0, unpaid: 0, drafts: 0, active: 0, closed: 0 }
    );

    if (error) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <div className="card space-y-2">
                    <h1>Díjak</h1>
                    <p className="mt-2 text-red-600">Hiba: {error.message}</p>
                </div>
            </main>
        );
    }

    const basePath = `/owner/properties/${propertyId}/charges`;
    const activeQuery = {
        status: statusFilter,
        type: typeFilter,
        from: fromFilter,
        to: toFilter,
    };
    const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
    const formatMoney = (value: number) => formatCurrency(value, "HUF");
    const chargeRows = (charges ?? []) as ChargeRow[];

    return (
        <main className="app-shell page-enter space-y-4">
            <AppHeader profile={profile} />

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Pénzügyek és díjak</div>
                        <Link className="link" href={`/owner/properties/${propertyId}`}>
                            ← Vissza az ingatlanhoz
                        </Link>
                        <h1>Díjak</h1>
                        <p>{property.name} · {property.address}</p>
                    </div>
                    <div className="muted-note">
                        Az automatikusan importált számlák először piszkozatként jönnek létre.
                    </div>
                </div>

                <div className="kpi-grid stagger">
                    <div className="kpi-card">
                        <div className="kpi-label">Összes terhelés</div>
                        <div className="kpi-value">{formatMoney(summary.total)}</div>
                        <div className="muted-note">{totalsFrom} - {totalsTo}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Nyitott állomány</div>
                        <div className="kpi-value">{formatMoney(summary.unpaid)}</div>
                        <div className="muted-note">{summary.active} aktív tétel</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Piszkozatok</div>
                        <div className="kpi-value">{summary.drafts}</div>
                        <div className="muted-note">publikálás előtt ellenőrizendő</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Lezárt / fizetett</div>
                        <div className="kpi-value">{formatMoney(summary.paid)}</div>
                        <div className="muted-note">{summary.closed} lezárt tétel</div>
                    </div>
                </div>
            </section>

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="card-title">Szűrők és nézetek</div>
                        <p className="muted-note">A lista lapozott, de az áttekintés a teljes időszakot számolja.</p>
                    </div>
                    <a
                        className="btn btn-secondary"
                        href={`/owner/properties/${propertyId}/charges/export?${buildQueryString(activeQuery)}`}
                    >
                        Exportálás CSV-be
                    </a>
                </div>

                <div className="nav-pills">
                    <Link className={`pill${!statusFilter ? " pill-active" : ""}`} href={buildStatusHref(basePath, activeQuery, "")}>
                        Összes
                    </Link>
                    <Link className={`pill${statusFilter === "IMPORT_DRAFT" ? " pill-active" : ""}`} href={buildStatusHref(basePath, activeQuery, "IMPORT_DRAFT")}>
                        Piszkozatok
                    </Link>
                    <Link className={`pill${statusFilter === "UNPAID" ? " pill-active" : ""}`} href={buildStatusHref(basePath, activeQuery, "UNPAID")}>
                        Aktív
                    </Link>
                    <Link className={`pill${statusFilter === "PAID" ? " pill-active" : ""}`} href={buildStatusHref(basePath, activeQuery, "PAID")}>
                        Fizetett
                    </Link>
                    <Link className={`pill${statusFilter === "ARCHIVED" ? " pill-active" : ""}`} href={buildStatusHref(basePath, activeQuery, "ARCHIVED")}>
                        Archivált
                    </Link>
                </div>

                <form method="GET" className="section-stack">
                    <div className="filter-grid">
                        <select name="status" defaultValue={statusFilter} className="select">
                            <option value="">Minden státusz</option>
                            <option value="IMPORT_DRAFT">Piszkozat</option>
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
                        <Link className="btn btn-secondary" href={basePath}>
                            Szűrők törlése
                        </Link>
                    </div>
                </form>
            </section>

            <CreateChargeForm propertyId={propertyId} />

            {chargeRows.length === 0 ? (
                <div className="card">
                    <p className="card-title">Nincs megjeleníthető díj ebben a nézetben.</p>
                    <p className="muted-note">Válts státuszt, módosíts dátumtartományt, vagy hozz létre új tételt.</p>
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
                            const docList = documentsByCharge.get(charge.id) ?? [];
                            const recurringLabel = charge.recurring_group && charge.recurring_index && charge.recurring_count
                                ? `Ismétlődés ${charge.recurring_index}/${charge.recurring_count}`
                                : null;
                            const dueState = getDueState(charge.due_date, charge.status);

                            return (
                                <article
                                    key={charge.id}
                                    className={`charge-card${dueState.cardClass}${charge.status === "ARCHIVED" ? " charge-archived" : ""}`}
                                >
                                    <div className="section-header">
                                        <div>
                                            <div className="card-title">{charge.title}</div>
                                            <div className="charge-meta">
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
                                            <span>Nincs kapcsolódó dokumentum.</span>
                                        </div>
                                    )}

                                    <div className="charge-actions action-box">
                                        <div className="charge-actions-primary">
                                            {charge.status === "IMPORT_DRAFT" ? (
                                                <ConfirmActionForm
                                                    action={async () => {
                                                        "use server";
                                                        await publishCharge(charge.id);
                                                    }}
                                                confirmMessage="Publikálod ezt a díjat a bérlő felé?"
                                            >
                                                <button type="submit" className="btn btn-primary btn-sm">
                                                    Publikálás
                                                </button>
                                                </ConfirmActionForm>
                                            ) : null}

                                            {charge.status === "UNPAID" ? (
                                                <ConfirmActionForm
                                                    action={async () => {
                                                        "use server";
                                                        await markChargePaid(charge.id);
                                                    }}
                                                confirmMessage="Biztosan fizetettnek jelölöd ezt a díjat?"
                                            >
                                                <button type="submit" className="btn btn-success btn-sm">
                                                    Fizetettnek jelölés
                                                </button>
                                                </ConfirmActionForm>
                                            ) : null}

                                            {charge.status === "PAID" ? (
                                                <ConfirmActionForm
                                                    action={async () => {
                                                        "use server";
                                                        await archiveCharge(charge.id);
                                                    }}
                                                confirmMessage="Biztosan archiválod ezt a díjat?"
                                            >
                                                <button type="submit" className="btn btn-secondary btn-sm">
                                                    Archiválás
                                                </button>
                                                </ConfirmActionForm>
                                            ) : null}

                                            {charge.status === "CANCELLED" ? (
                                                <ConfirmActionForm
                                                    action={async () => {
                                                        "use server";
                                                        await restoreCharge(charge.id);
                                                    }}
                                                confirmMessage="Visszaállítod ezt a díjat aktívra?"
                                            >
                                                <button type="submit" className="btn btn-success btn-sm">
                                                    Visszaállítás
                                                </button>
                                                </ConfirmActionForm>
                                            ) : null}
                                        </div>

                                        <div className="action-divider" />

                                        <div className="charge-actions-secondary">
                                            <UploadInvoice chargeId={charge.id} />
                                        </div>

                                        <div className="charge-actions-danger">
                                            {(charge.status === "UNPAID" || charge.status === "IMPORT_DRAFT") ? (
                                                <ConfirmActionForm
                                                    action={async () => {
                                                        "use server";
                                                        await cancelCharge(charge.id);
                                                    }}
                                                confirmMessage="Biztosan érvényteleníted ezt a díjat?"
                                            >
                                                <button type="submit" className="btn btn-ghost btn-sm">
                                                    Érvénytelenítés
                                                </button>
                                                </ConfirmActionForm>
                                            ) : null}

                                            <ConfirmActionForm
                                                action={async () => {
                                                    "use server";
                                                    await deleteCharge(charge.id);
                                                }}
                                                confirmMessage="Biztosan sztornózod ezt a díjat? Ez a művelet végleges."
                                            >
                                                <button type="submit" className="btn btn-danger btn-sm">
                                                    Sztornó
                                                </button>
                                            </ConfirmActionForm>
                                        </div>
                                    </div>

                                    <EditChargeForm charge={charge} />
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
                                href={`${basePath}?${buildQueryString({ ...activeQuery, page: String(page - 1) })}`}
                            >
                                Előző
                            </Link>
                        ) : (
                            <span className="btn btn-secondary btn-sm" aria-disabled="true">Előző</span>
                        )}
                        {page < totalPages ? (
                            <Link
                                className="btn btn-secondary btn-sm"
                                href={`${basePath}?${buildQueryString({ ...activeQuery, page: String(page + 1) })}`}
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
