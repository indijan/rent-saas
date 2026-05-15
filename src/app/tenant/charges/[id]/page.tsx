import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { formatCurrency } from "@/lib/formatters";

type Props = { params: Promise<{ id: string }> };

type ChargeDocument = {
    id: string;
    bucket_path: string;
    created_at: string;
};

type ChargeDocumentWithUrl = ChargeDocument & {
    signed_url: string;
};

function getDueState(dueDate: string, status: string) {
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

export default async function TenantChargeDetailPage({ params }: Props) {
    const { id } = await params;
    const { supabase, user } = await requireRole("TENANT");

    const { data: charge, error } = await supabase
        .from("charges")
        .select("id,title,type,amount,currency,due_date,status,paid_at,notes,properties(name,address)")
        .eq("id", id)
        .eq("tenant_id", user.id)
        .neq("status", "IMPORT_DRAFT")
        .single();

    if (error || !charge) return notFound();

    const { data: documents } = await supabase
        .from("documents")
        .select("id,bucket_path,created_at")
        .eq("charge_id", id)
        .order("created_at", { ascending: false });

    const documentsWithUrls = await Promise.all(
        ((documents ?? []) as ChargeDocument[]).map(async (doc) => {
            const { data } = await supabase.storage
                .from("documents")
                .createSignedUrl(doc.bucket_path, 60 * 60);
            return { ...doc, signed_url: data?.signedUrl ?? "" };
        })
    );

    const property = Array.isArray(charge.properties) ? charge.properties[0] : charge.properties;
    const dueState = getDueState(String(charge.due_date), String(charge.status));

    return (
        <main className="app-shell page-enter space-y-4">
            <Link className="link text-sm" href="/tenant/charges">
                ← Vissza a díjakhoz
            </Link>

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Tétel részletei</div>
                        <h1>{charge.title}</h1>
                        <p>Itt látod az adott díj állapotát, esedékességét és a kapcsolódó dokumentumokat.</p>
                    </div>
                    <span className={`due-pill ${dueState.pillClass}`}>{dueState.label}</span>
                </div>
            </section>

            <div className={`card section-stack${dueState.cardClass}`}>
                <div className="card-title">Pénzügyi adatok</div>
                <div className="form-grid">
                    <div className="form-panel">
                        <div className="field-label">Ingatlan</div>
                        <div>{property?.name ?? "-"}</div>
                        {property?.address ? <div className="muted-note">{property.address}</div> : null}
                    </div>
                    <div className="form-panel">
                        <div className="field-label">Összeg</div>
                        <div>{formatCurrency(Number(charge.amount), String(charge.currency || "HUF"))}</div>
                    </div>
                    <div className="form-panel">
                        <div className="field-label">Esedékesség</div>
                        <div>{charge.due_date}</div>
                    </div>
                    <div className="form-panel">
                        <div className="field-label">Státusz</div>
                        <span className={`status-badge status-${String(charge.status).toLowerCase()}`}>
                            {charge.status === "UNPAID" ? "Aktív" : charge.status === "PAID" ? "Fizetett" : charge.status === "ARCHIVED" ? "Archivált" : "Törölt"}
                        </span>
                        {charge.status === "PAID" && charge.paid_at ? (
                            <div className="muted-note">Fizetve: {new Date(charge.paid_at).toLocaleString("hu-HU")}</div>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="card-title">Dokumentumok</div>
                        <p className="muted-note">Itt nyithatod meg a feltöltött számlát vagy mellékletet.</p>
                    </div>
                </div>
                {(documentsWithUrls ?? []).length === 0 ? (
                    <p className="text-sm text-gray-600">Nincs feltöltött dokumentum.</p>
                ) : (
                    <div className="charge-docs">
                        {(documentsWithUrls as ChargeDocumentWithUrl[]).map((doc) => (
                            <div key={doc.id} className="form-panel">
                                <a className="link" href={doc.signed_url} target="_blank" rel="noreferrer">
                                    Dokumentum: {doc.bucket_path.split("/").at(-1)}
                                </a>{" "}
                                <span className="muted-note">{new Date(doc.created_at).toLocaleString("hu-HU")}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
