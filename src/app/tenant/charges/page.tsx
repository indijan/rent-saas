import Link from "next/link";
import { requireRole } from "@/lib/auth/requireRole";

type Props = {
    searchParams?: Promise<{ property?: string; status?: string; type?: string; from?: string; to?: string }> | {
        property?: string;
        status?: string;
        type?: string;
        from?: string;
        to?: string;
    };
};

export default async function TenantChargesPage({ searchParams }: Props) {
    const { supabase, user } = await requireRole("TENANT");

    const sp = (searchParams instanceof Promise) ? await searchParams : (searchParams ?? {});
    const selectedPropertyId = sp.property ? String(sp.property) : "";
    const statusFilter = sp.status ? String(sp.status) : "";
    const typeFilter = sp.type ? String(sp.type) : "";
    const fromFilter = sp.from ? String(sp.from) : "";
    const toFilter = sp.to ? String(sp.to) : "";

    // 1) Tenant ingatlanjai (lehet több is)
    const { data: properties, error: propErr } = await supabase
        .from("properties")
        .select("id,name,address,status")
        .eq("tenant_id", user.id)
        .order("created_at", { ascending: false });

    if (propErr) {
        return (
            <main className="app-shell page-enter">
                <div className="card flex items-center justify-between">
                    <h1>Saját díjaim</h1>
                    <Link className="link" href="/account">Account</Link>
                </div>
                <p className="mt-2 text-red-600">Hiba (properties): {propErr.message}</p>
            </main>
        );
    }

    const selectedProperty =
        selectedPropertyId ? (properties ?? []).find((p: any) => p.id === selectedPropertyId) : null;

    // 2) Díjak lekérése (szűrhető property szerint)
    let q = supabase
        .from("charges")
        .select("id,title,type,amount,currency,due_date,status,paid_at,created_at,property_id,recurring_group,recurring_index,recurring_count,properties(id,name,address)")
        .eq("tenant_id", user.id)
        .order("due_date", { ascending: false });

    if (selectedPropertyId) q = q.eq("property_id", selectedPropertyId);
    if (statusFilter) q = q.eq("status", statusFilter);
    if (typeFilter) q = q.eq("type", typeFilter);
    if (fromFilter) q = q.gte("due_date", fromFilter);
    if (toFilter) q = q.lte("due_date", toFilter);

    const { data: charges, error } = await q;

    const { data: documents } = await supabase
        .from("documents")
        .select("id,charge_id,bucket_path,created_at")
        .eq("tenant_id", user.id)
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
            if (c.status === "PAID") acc.paid += amount;
            if (c.status === "UNPAID") acc.unpaid += amount;
            if (c.status !== "CANCELLED") acc.total += amount;
            return acc;
        },
        { paid: 0, unpaid: 0, total: 0 }
    );
    const formatMoney = (value: number) => value.toLocaleString("hu-HU");

    if (error) {
        return (
            <main className="app-shell page-enter">
                <div className="card flex items-center justify-between">
                    <h1>Saját díjaim</h1>
                    <Link className="link" href="/account">Account</Link>
                </div>
                <p className="mt-2 text-red-600">Hiba (charges): {error.message}</p>
            </main>
        );
    }

    return (
        <main className="app-shell page-enter space-y-4">
            <div className="card flex items-center justify-between">
                <h1>Saját díjaim</h1>
                <Link className="link" href="/account">Account</Link>
            </div>

            {/* Ingatlan választó */}
            <form method="GET" className="card space-y-3">
                <div className="card-title">Szűrők</div>
                <div className="grid gap-3 md:grid-cols-2">
                    <select name="property" defaultValue={selectedPropertyId} className="select">
                        <option value="">Összes ingatlan</option>
                        {(properties ?? []).map((p: any) => (
                            <option key={p.id} value={p.id}>
                                {p.name} — {p.address}
                            </option>
                        ))}
                    </select>
                    <select name="status" defaultValue={statusFilter} className="select">
                        <option value="">Összes státusz</option>
                        <option value="UNPAID">UNPAID</option>
                        <option value="PAID">PAID</option>
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

                <button className="btn btn-primary">
                    Mutasd
                </button>
            </form>

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

            {/* Kiválasztott ingatlan részletei */}
            {selectedProperty ? (
                <div className="card space-y-1">
                    <div className="card-title">Ingatlan adatok</div>
                    <div className="text-sm"><b>Név:</b> {selectedProperty.name}</div>
                    <div className="text-sm"><b>Cím:</b> {selectedProperty.address}</div>
                    <div className="text-sm"><b>Státusz:</b> {selectedProperty.status}</div>
                </div>
            ) : null}

            {/* Díjak */}
            {(!charges || charges.length === 0) ? (
                <div className="card">
                    <p className="card-title">Nincs díj{selectedPropertyId ? " ehhez az ingatlanhoz" : ""}.</p>
                    <p className="mt-1 text-sm text-gray-600">
                        Ha az OWNER díjat rögzít, itt fog megjelenni.
                    </p>
                </div>
            ) : (
                <div className="card divide-y">
                    {(() => {
                        const today = new Date().toISOString().slice(0, 10);
                        const grouped = new Map<string, any[]>();
                        const singles: any[] = [];

                        (charges ?? []).forEach((c: any) => {
                            if (c.recurring_group) {
                                const items = grouped.get(c.recurring_group) ?? [];
                                items.push(c);
                                grouped.set(c.recurring_group, items);
                            } else {
                                singles.push(c);
                            }
                        });

                        const recurringCards = Array.from(grouped.entries()).map(([groupId, items]) => {
                            items.sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
                            const nextIndex = items.findIndex((i) => String(i.due_date) >= today);
                            const index = nextIndex >= 0 ? nextIndex : items.length - 1;
                            const next = items[index];
                            const rest = items.filter((_, i) => i !== index);

                            return { kind: "recurring", groupId, next, rest };
                        });

                        const cards = [
                            ...recurringCards.map((c) => ({ ...c, due_date: c.next?.due_date })),
                            ...singles.map((c) => ({ kind: "single", due_date: c.due_date, item: c })),
                        ].sort((a: any, b: any) => String(b.due_date).localeCompare(String(a.due_date)));

                        return cards.map((card: any) => {
                            if (card.kind === "single") {
                                const c = card.item;
                                return (
                                    <div key={c.id} className="p-4 flex items-center justify-between gap-4">
                                        <div>
                                            <div className="card-title">{c.title}</div>
                                            <div className="text-sm">
                                                {(c.properties?.name ? `${c.properties.name} • ` : "")}
                                                {(c.properties?.address ? `${c.properties.address} • ` : "")}
                                                {c.type} • {c.amount} {c.currency} • esedékes: {c.due_date}
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

                                        <div className={`status-badge status-${String(c.status).toLowerCase()}`}>
                                            {c.status}
                                        </div>
                                    </div>
                                );
                            }

                            const next = card.next;
                            return (
                                <div key={card.groupId} className="p-4 space-y-3">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <div className="card-title">{next?.title}</div>
                                            <div className="text-sm">
                                                {(next?.properties?.name ? `${next.properties.name} • ` : "")}
                                                {(next?.properties?.address ? `${next.properties.address} • ` : "")}
                                                {next?.type} • {next?.amount} {next?.currency} • esedékes: {next?.due_date}
                                                {next?.status === "PAID" && next?.paid_at ? (
                                                    <span> • fizetve: {new Date(next.paid_at).toLocaleString("hu-HU")}</span>
                                                ) : null}
                                            </div>
                                            {next?.id && documentsByCharge.get(next.id)?.length ? (
                                                <div className="mt-2 text-xs text-gray-600">
                                                    {documentsByCharge.get(next.id)?.map((doc) => (
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
                                        <div className={`status-badge status-${String(next?.status).toLowerCase()}`}>
                                            {next?.status}
                                        </div>
                                    </div>

                                    {card.rest.length > 0 ? (
                                        <details className="text-sm text-gray-600">
                                            <summary>
                                                További ismétlődések ({card.rest.length})
                                            </summary>
                                            <div className="mt-2 space-y-2">
                                                {card.rest.map((c: any) => (
                                                    <div key={c.id} className="flex items-center justify-between gap-4">
                                                        <div>
                                                            <div className="card-title">{c.title}</div>
                                                            <div className="text-sm">
                                                                {c.type} • {c.amount} {c.currency} • esedékes: {c.due_date}
                                                            </div>
                                                        </div>
                                                        <div className={`status-badge status-${String(c.status).toLowerCase()}`}>
                                                            {c.status}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </details>
                                    ) : null}
                                </div>
                            );
                        });
                    })()}
                </div>
            )}
        </main>
    );
}
