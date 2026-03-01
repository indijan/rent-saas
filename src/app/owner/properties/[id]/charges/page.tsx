import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { archiveCharge, cancelCharge, deleteCharge, markChargePaid } from "./actions";
import ConfirmActionForm from "./ConfirmActionForm";
import UploadInvoice from "@/components/UploadInvoice";
import CreateChargeForm from "./CreateChargeForm";
import EditChargeForm from "./EditChargeForm";
import { formatCurrency } from "@/lib/formatters";

type Props = {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ status?: string; type?: string; from?: string; to?: string; page?: string }> | {
        status?: string;
        type?: string;
        from?: string;
        to?: string;
        page?: string;
    };
};

export default async function OwnerPropertyChargesPage({ params, searchParams }: Props) {
    const { id: propertyId } = await params;
    const { supabase } = await requireRole("OWNER");

    const sp = (searchParams instanceof Promise) ? await searchParams : (searchParams ?? {});
    const statusFilter = sp.status ? String(sp.status) : "";
    const typeFilter = sp.type ? String(sp.type) : "";
    const fromFilter = sp.from ? String(sp.from) : "";
    const toFilter = sp.to ? String(sp.to) : "";
    const pageParam = sp.page ? Number(sp.page) : 1;
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const pageSize = 20;
    const rangeFrom = (page - 1) * pageSize;
    const rangeTo = rangeFrom + pageSize - 1;

    const { data: property, error: propErr } = await supabase
        .from("properties")
        .select("id,name,address")
        .eq("id", propertyId)
        .single();

    if (propErr || !property) return notFound();

    let q = supabase
        .from("charges")
        .select("id,title,type,amount,currency,due_date,status,paid_at,created_at,tenant_id,recurring_group,recurring_index,recurring_count", { count: "exact" })
        .eq("property_id", propertyId)
        .order("due_date", { ascending: false });

    if (statusFilter) q = q.eq("status", statusFilter);
    if (typeFilter) q = q.eq("type", typeFilter);
    if (fromFilter) q = q.gte("due_date", fromFilter);
    if (toFilter) q = q.lte("due_date", toFilter);

    const { data: charges, error, count } = await q.range(rangeFrom, rangeTo);

    const { data: documents } = await supabase
        .from("documents")
        .select("id,charge_id,bucket_path,created_at")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false });

    const documentsWithUrls = await Promise.all(
        (documents ?? []).map(async (doc: any) => {
            const { data } = await supabase.storage
                .from("documents")
                .createSignedUrl(doc.bucket_path, 60 * 60);
            return { ...doc, signed_url: data?.signedUrl ?? "" };
        })
    );

    const documentsByCharge = new Map<string, { id: string; bucket_path: string; created_at: string; signed_url: string }[]>();
    documentsWithUrls.forEach((doc: any) => {
        const list = documentsByCharge.get(doc.charge_id) ?? [];
        list.push(doc);
        documentsByCharge.set(doc.charge_id, list);
    });

    const today = new Date().toISOString().slice(0, 10);
    const dueCharges = (charges ?? []).filter((c: any) => String(c.due_date) <= today);
    const totals = dueCharges.reduce(
        (acc, c: any) => {
            const amount = Number(c.amount) || 0;
            if (c.status === "PAID" || c.status === "ARCHIVED") acc.paid += amount;
            if (c.status === "UNPAID") acc.unpaid += amount;
            if (c.status !== "CANCELLED") acc.total += amount;
            return acc;
        },
        { paid: 0, unpaid: 0, total: 0 }
    );
    const formatMoney = (value: number) => formatCurrency(value, "HUF");

    if (error) {
        return (
            <main className="app-shell page-enter">
                <div className="card space-y-2">
                    <h1>Díjak</h1>
                <p className="mt-2 text-red-600">Hiba: {error.message}</p>
                </div>
            </main>
        );
    }

    return (
        <main className="app-shell page-enter space-y-4">
            <div className="card">
                <Link className="link" href={`/owner/properties/${propertyId}`}>
                    ← Ingatlan részletek
                </Link>
                <h1>Díjak – {property.name}</h1>
                <p>{property.address}</p>
            </div>

            <form method="GET" className="card space-y-3">
                <div className="card-title">Szűrők</div>
                <div className="grid gap-3 md:grid-cols-4">
                    <select name="status" defaultValue={statusFilter} className="select">
                        <option value="">Összes státusz</option>
                        <option value="UNPAID">UNPAID</option>
                        <option value="PAID">PAID</option>
                        <option value="ARCHIVED">ARCHIVED</option>
                        <option value="CANCELLED">CANCELLED</option>
                    </select>
                    <select name="type" defaultValue={typeFilter} className="select">
                        <option value="">Összes típus</option>
                        <option value="RENT">RENT</option>
                        <option value="UTILITY">UTILITY</option>
                        <option value="COMMON_COST">COMMON_COST</option>
                        <option value="OTHER">OTHER</option>
                    </select>
                    <input
                        name="from"
                        type="date"
                        defaultValue={fromFilter}
                        className="input"
                    />
                    <input
                        name="to"
                        type="date"
                        defaultValue={toFilter}
                        className="input"
                    />
                </div>
                <div className="flex flex-wrap gap-2">
                    <button className="btn btn-primary">
                        Szűrés
                    </button>
                    <a
                        className="btn btn-secondary"
                        href={`/owner/properties/${propertyId}/charges/export?${new URLSearchParams({
                            ...(statusFilter ? { status: statusFilter } : {}),
                            ...(typeFilter ? { type: typeFilter } : {}),
                            ...(fromFilter ? { from: fromFilter } : {}),
                            ...(toFilter ? { to: toFilter } : {}),
                        }).toString()}`}
                    >
                        Export Excel
                    </a>
                </div>
            </form>

            <CreateChargeForm propertyId={propertyId} />

            <div className="grid">
                <div className="card">
                    <div className="card-title">Összes</div>
                    <div className="hero-kpi">{formatMoney(totals.total)} HUF</div>
                </div>
                <div className="card">
                    <div className="card-title">Befizetett</div>
                    <div className="hero-kpi">{formatMoney(totals.paid)} HUF</div>
                </div>
                <div className="card">
                    <div className="card-title">Hátralék</div>
                    <div className="hero-kpi">{formatMoney(totals.unpaid)} HUF</div>
                </div>
            </div>

            {(!charges || charges.length === 0) ? (
                <div className="card">
                    <p className="card-title">Nincs még díj ehhez az ingatlanhoz.</p>
                </div>
            ) : (
                <div className="card divide-y">
                    {charges.map((c: any) => (
                        <div
                            key={c.id}
                            className={`p-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between${c.status === "ARCHIVED" ? " charge-archived" : ""}`}
                        >
                            <div>
                                <div className="card-title">{c.title}</div>
                                <div className="text-sm">
                                    {c.type} • {formatCurrency(Number(c.amount), String(c.currency || "HUF"))} • esedékes: {c.due_date}
                                    {c.status === "PAID" && c.paid_at ? (
                                        <span> • fizetve: {new Date(c.paid_at).toLocaleString("hu-HU")}</span>
                                    ) : null}
                                </div>
                                {documentsByCharge.get(c.id)?.length ? (
                                    <div className="mt-2 text-xs text-gray-600">
                                        {documentsByCharge.get(c.id)?.map((doc) => (
                                            <div key={doc.id}>
                                                <a className="link" href={doc.signed_url} target="_blank" rel="noreferrer">
                                                    Dok: {doc.bucket_path.split("/").at(-1)}
                                                </a>{" "}
                                                • {new Date(doc.created_at).toLocaleString("hu-HU")}
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
                                <EditChargeForm charge={c} />
                                <UploadInvoice
                                    chargeId={c.id}
                                />
                                <div className={`status-badge status-${String(c.status).toLowerCase()}`}>
                                    {c.status}
                                </div>
                                <ConfirmActionForm
                                    action={async () => {
                                        "use server";
                                        if (c.status !== "PAID") return;
                                        const res = await archiveCharge(c.id);
                                        if (!res.ok) return;
                                    }}
                                    confirmMessage="Biztosan archiválod ezt a díjat?"
                                >
                                    <button
                                        type="submit"
                                        className="btn btn-secondary btn-sm"
                                        disabled={c.status !== "PAID"}
                                        title={c.status === "PAID" ? "Archiválás" : "Csak PAID díj archiválható"}
                                    >
                                        ARCHIVE
                                    </button>
                                </ConfirmActionForm>

                                <ConfirmActionForm
                                    action={async () => {
                                        "use server";
                                        if (c.status === "PAID" || c.status === "CANCELLED" || c.status === "ARCHIVED") return;
                                        const res = await markChargePaid(c.id);
                                        if (!res.ok) return;
                                    }}
                                    confirmMessage="Biztosan fizetettnek jelölöd ezt a díjat?"
                                >
                                    <button
                                        type="submit"
                                        className="btn btn-success btn-sm"
                                        disabled={c.status === "PAID" || c.status === "CANCELLED" || c.status === "ARCHIVED"}
                                        title={c.status === "PAID" || c.status === "ARCHIVED" ? "Már fizetett" : "Megjelölés fizetettnek"}
                                    >
                                        PAID
                                    </button>
                                </ConfirmActionForm>
                                <ConfirmActionForm
                                    action={async () => {
                                        "use server";
                                        if (c.status === "PAID" || c.status === "CANCELLED" || c.status === "ARCHIVED") return;
                                        const res = await cancelCharge(c.id);
                                        if (!res.ok) return;
                                    }}
                                    confirmMessage="Biztosan törlöd (cancel) ezt a díjat?"
                                >
                                    <button
                                        type="submit"
                                        className="btn btn-danger btn-sm"
                                        disabled={c.status === "PAID" || c.status === "CANCELLED" || c.status === "ARCHIVED"}
                                        title={c.status === "PAID" || c.status === "ARCHIVED" ? "Fizetett díj" : "Díj törlése"}
                                    >
                                        CANCEL
                                    </button>
                                </ConfirmActionForm>
                                <ConfirmActionForm
                                    action={async () => {
                                        "use server";
                                        const res = await deleteCharge(c.id);
                                        if (!res.ok) return;
                                    }}
                                    confirmMessage="Biztosan végleg törlöd ezt a díjat?"
                                >
                                    <button
                                        type="submit"
                                        className="btn btn-secondary btn-sm"
                                        title="Díj törlése"
                                    >
                                        DELETE
                                    </button>
                                </ConfirmActionForm>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {count && count > pageSize ? (
                <div className="card flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                        Oldal: {page} / {Math.max(1, Math.ceil(count / pageSize))}
                    </div>
                    <div className="flex gap-2">
                        {page > 1 ? (
                            <Link
                                className="btn btn-secondary btn-sm"
                                href={`?${new URLSearchParams({
                                    ...(statusFilter ? { status: statusFilter } : {}),
                                    ...(typeFilter ? { type: typeFilter } : {}),
                                    ...(fromFilter ? { from: fromFilter } : {}),
                                    ...(toFilter ? { to: toFilter } : {}),
                                    page: String(page - 1),
                                }).toString()}`}
                            >
                                Előző
                            </Link>
                        ) : (
                            <span className="btn btn-secondary btn-sm" aria-disabled="true">Előző</span>
                        )}
                        {page < Math.ceil(count / pageSize) ? (
                            <Link
                                className="btn btn-secondary btn-sm"
                                href={`?${new URLSearchParams({
                                    ...(statusFilter ? { status: statusFilter } : {}),
                                    ...(typeFilter ? { type: typeFilter } : {}),
                                    ...(fromFilter ? { from: fromFilter } : {}),
                                    ...(toFilter ? { to: toFilter } : {}),
                                    page: String(page + 1),
                                }).toString()}`}
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
