import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import AppHeader from "@/components/AppHeader";
import DesignIcon from "@/components/dashboard/DesignIcon";
import { formatCurrency } from "@/lib/formatters";
import { buildDocumentOpenHref } from "@/lib/documentStorage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getChargeTypeLabel } from "@/lib/chargeTypes";
import { listTenantProperties } from "@/lib/propertyTenants";

type Props = { params: Promise<{ id: string }> };

type ChargeDocument = {
    id: string;
    bucket_path: string;
    created_at: string;
};

function startOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

function formatDisplayDate(dateValue: string) {
    return new Intl.DateTimeFormat("hu-HU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date(`${dateValue}T00:00:00`));
}

function getDueState(dueDate: string, status: string) {
    if (status === "PAID" || status === "ARCHIVED" || status === "CANCELLED") {
        return { label: "Lezárt", tone: "dashboard-inline-badge-green" };
    }

    const today = startOfToday();
    const due = new Date(`${dueDate}T00:00:00`);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return { label: `${Math.abs(diffDays)} napja lejárt`, tone: "dashboard-inline-badge-red" };
    }
    if (diffDays <= 5) {
        return { label: diffDays === 0 ? "Ma esedékes" : `${diffDays} napon belül esedékes`, tone: "dashboard-inline-badge-amber" };
    }
    return { label: "Határidőn belül", tone: "dashboard-inline-badge-blue" };
}

function statusLabel(status: string, dueDate: string) {
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

function statusTone(status: string) {
    if (status === "Fizetett") return "dashboard-inline-badge-green";
    if (status === "Lejárt") return "dashboard-inline-badge-red";
    if (status === "Aktív") return "dashboard-inline-badge-blue";
    if (status === "Archivált") return "dashboard-inline-badge-purple";
    return "dashboard-inline-badge-amber";
}

export default async function TenantChargeDetailPage({ params }: Props) {
    const { id } = await params;
    const { user, profile } = await requireRole("TENANT");
    const admin = createSupabaseAdminClient();
    const tenantProperties = await listTenantProperties(user.id);
    const propertyIds = tenantProperties.map((property) => property.id);

    const { data: charge, error } = await admin
        .from("charges")
        .select("id,title,type,amount,currency,due_date,status,paid_at,notes,property_id,properties(name,address)")
        .eq("id", id)
        .neq("status", "IMPORT_DRAFT")
        .single();

    if (error || !charge || !propertyIds.includes(charge.property_id)) return notFound();

    const { data: documents } = await admin
        .from("documents")
        .select("id,bucket_path,created_at")
        .eq("charge_id", id)
        .order("created_at", { ascending: false });

    const documentRows = (documents ?? []) as ChargeDocument[];

    const property = Array.isArray(charge.properties) ? charge.properties[0] : charge.properties;
    const dueState = getDueState(String(charge.due_date), String(charge.status));
    const displayStatus = statusLabel(String(charge.status), String(charge.due_date));

    return (
        <main className="app-shell page-enter">
            <AppHeader
                profile={profile}
                dashboardContext={{
                    label: "Ingatlan",
                    items: tenantProperties.map((propertyRow) => ({ id: propertyRow.id, label: propertyRow.name })),
                    value: charge.property_id,
                    baseHref: "/tenant/charges",
                }}
            />

            <div className="dashboard-stack">
                <section className="card dashboard-section-card property-detail-hero">
                    <div className="dashboard-page-header property-detail-heading">
                        <div className="tenant-charge-detail-copy">
                            <Link className="btn btn-secondary btn-sm property-detail-backlink" href="/tenant/charges">
                                <span className="property-detail-backicon" aria-hidden="true">←</span>
                                <span>Vissza a díjakhoz</span>
                            </Link>
                            <div className="eyebrow">Tétel részletei</div>
                            <h1>{charge.title}</h1>
                            <p>{property?.name ? `${property.name} · ${property.address || ""}` : "A kiválasztott tétel teljes pénzügyi és dokumentum adatai."}</p>
                        </div>
                        <div className="property-detail-hero-actions">
                            <span className={`dashboard-inline-badge ${dueState.tone}`}>{dueState.label}</span>
                            <span className={`dashboard-inline-badge ${statusTone(displayStatus)}`}>{displayStatus}</span>
                        </div>
                    </div>
                </section>

                <section className="dashboard-summary-strip">
                    <article className="dashboard-summary-card">
                        <DesignIcon name="ingatlanok" alt="Ingatlan" />
                        <div className="dashboard-summary-copy">
                            <div className="dashboard-summary-label">Ingatlan</div>
                            <strong>{property?.name || "-"}</strong>
                            <span>{property?.address || "Nincs címinformáció"}</span>
                        </div>
                    </article>
                    <article className="dashboard-summary-card">
                        <DesignIcon name="bevetel" alt="Összeg" tone="design-icon-badge-green" />
                        <div className="dashboard-summary-copy">
                            <div className="dashboard-summary-label">Összeg</div>
                            <strong>{formatCurrency(Number(charge.amount), String(charge.currency || "HUF"))}</strong>
                            <span>{getChargeTypeLabel(String(charge.type), user.id)}</span>
                        </div>
                    </article>
                    <article className="dashboard-summary-card">
                        <DesignIcon name="kozelgo_feladatok" alt="Esedékesség" tone="design-icon-badge-amber" />
                        <div className="dashboard-summary-copy">
                            <div className="dashboard-summary-label">Esedékesség</div>
                            <strong>{formatDisplayDate(String(charge.due_date))}</strong>
                            <span>{dueState.label}</span>
                        </div>
                    </article>
                    <article className="dashboard-summary-card">
                        <DesignIcon name="sikeresen_feldolgozva" alt="Státusz" tone="design-icon-badge-purple" />
                        <div className="dashboard-summary-copy">
                            <div className="dashboard-summary-label">Státusz</div>
                            <strong>{displayStatus}</strong>
                            <span>{charge.status === "PAID" && charge.paid_at ? `Fizetve: ${new Date(charge.paid_at).toLocaleString("hu-HU")}` : "Bérlői információs nézet"}</span>
                        </div>
                    </article>
                </section>

                <div className="dashboard-split-grid property-detail-grid">
                    <section className="card dashboard-section-card">
                        <div className="dashboard-section-head">
                            <div>
                                <div className="card-title">Pénzügyi adatok</div>
                                <p>A tétel típusát, összegét és a kapcsolódó megjegyzést itt látod egy tömbben.</p>
                            </div>
                        </div>
                        <div className="account-card-list">
                            <div className="account-list-card">
                                <strong>Tétel típusa</strong>
                                <span>{getChargeTypeLabel(String(charge.type), user.id)}</span>
                            </div>
                            <div className="account-list-card">
                                <strong>Elszámolási pénznem</strong>
                                <span>{charge.currency || "HUF"}</span>
                            </div>
                            <div className="account-list-card">
                                <strong>Megjegyzés</strong>
                                <span>{String(charge.notes || "").trim() || "Nincs megjegyzés a tételhez."}</span>
                            </div>
                        </div>
                    </section>

                    <section className="card dashboard-section-card">
                        <div className="dashboard-section-head">
                            <div>
                                <div className="card-title">Dokumentumok</div>
                                <p>Itt tudod megnyitni a csatolt PDF-et vagy mellékletet.</p>
                            </div>
                        </div>
                        {documentRows.length === 0 ? (
                            <div className="dashboard-empty-state">
                                <strong>Nincs feltöltött dokumentum.</strong>
                                <span>Ha a bérbeadó később csatol PDF-et, itt fog megjelenni.</span>
                            </div>
                        ) : (
                            <div className="account-card-list">
                                {documentRows.map((doc) => {
                                    const pathParts = doc.bucket_path.split("/");
                                    const fileName = pathParts[pathParts.length - 1];

                                    return (
                                        <a key={doc.id} className="account-channel-card" href={buildDocumentOpenHref(doc.id)} target="_blank" rel="noreferrer">
                                            <strong>{fileName}</strong>
                                            <span>Megnyitás új fülön</span>
                                            <small>{new Date(doc.created_at).toLocaleString("hu-HU")}</small>
                                        </a>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </main>
    );
}
