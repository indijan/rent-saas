import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { assignTenantToProperty, deleteProperty, removeTenantFromProperty, updateProperty } from "./actions";
import DeletePropertyForm from "./DeletePropertyForm";
import AppHeader from "@/components/AppHeader";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listOwnerTenantIds } from "@/lib/tenantOwnership";
import OwnerPropertyEditForm from "./OwnerPropertyEditForm";
import { maskAddress } from "@/lib/addressMasking";
import PendingSubmitButton from "@/components/PendingSubmitButton";
import { listPropertyTenants } from "@/lib/propertyTenants";
import DesignIcon from "@/components/dashboard/DesignIcon";

type Props = {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ status?: string; message?: string }> | { status?: string; message?: string };
};

type TenantOption = {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
};

type ChargeSummaryRow = {
    id: string;
    tenant_id: string | null;
    status: string;
    due_date: string;
    type: string;
};

export default async function OwnerPropertyDetailPage({ params, searchParams }: Props) {
    const { id } = await params;
    const { supabase, profile } = await requireRole("OWNER");
    const sp = searchParams instanceof Promise ? await searchParams : (searchParams ?? {});
    const status = sp.status ? String(sp.status) : "";
    const message = sp.message ? String(sp.message) : "";

    const { data: property, error } = await supabase
        .from("properties")
        .select("id,name,address,status,created_at,tenant_id")
        .eq("id", id)
        .eq("owner_id", profile.id)
        .single();

    if (error || !property) return notFound();

    const admin = createSupabaseAdminClient();
    const tenantIds = await listOwnerTenantIds(profile.id);
    const assignedTenants = await listPropertyTenants(property.id);
    const [{ data: tenants }, { data: chargeRows }, { data: documentRows }] = await Promise.all([
        tenantIds.length === 0
            ? Promise.resolve({ data: [] as TenantOption[] })
            : admin.from("profiles").select("id,email,full_name,role").in("id", tenantIds).order("email"),
        supabase.from("charges").select("id,tenant_id,status,due_date,type").eq("property_id", property.id),
        supabase.from("documents").select("id").eq("property_id", property.id),
    ]);
    const tenantOptions = (tenants ?? []) as TenantOption[];
    const charges = (chargeRows ?? []) as ChargeSummaryRow[];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tenantFacingCharges = charges.filter((charge) => charge.tenant_id);
    const overdueCount = tenantFacingCharges.filter((charge) => charge.status === "UNPAID" && new Date(`${charge.due_date}T00:00:00`).getTime() < today.getTime()).length;
    const activeChargeCount = tenantFacingCharges.filter((charge) => charge.status === "UNPAID").length;
    const ownExpenseCount = charges.filter((charge) => !charge.tenant_id).length;
    const nextDueCharge = tenantFacingCharges
        .filter((charge) => charge.status === "UNPAID")
        .sort((left, right) => new Date(`${left.due_date}T00:00:00`).getTime() - new Date(`${right.due_date}T00:00:00`).getTime())[0];

    return (
        <main className="app-shell page-enter space-y-4">
            <AppHeader profile={profile} />

            <div className="dashboard-stack">
                <section className="card dashboard-section-card property-detail-hero">
                    <div className="dashboard-page-header property-detail-heading">
                        <div className="property-detail-heading-copy">
                            <Link className="btn btn-secondary btn-sm property-detail-backlink" href="/owner/properties">
                                <span className="property-detail-backicon" aria-hidden="true">←</span>
                                <span>Vissza az ingatlanokhoz</span>
                            </Link>
                            <div className="eyebrow property-detail-eyebrow">Ingatlan vezérlőnézet</div>
                            <h1>{property.name}</h1>
                            <p>{maskAddress(property.address)}</p>
                        </div>
                        <div className="property-detail-hero-actions">
                            <Link className="btn btn-primary" href={`/owner/charges?property=${property.id}&compose=manual`}>
                                Új tétel
                            </Link>
                            <Link className="btn btn-secondary" href={`/owner/charges?property=${property.id}&compose=upload`}>
                                PDF feltöltés
                            </Link>
                        </div>
                    </div>
                </section>

                {message ? (
                    <div className={`card dashboard-section-card ${status === "error" ? "text-red-600" : "text-green-600"}`}>
                        {message}
                    </div>
                ) : null}

                <section className="dashboard-summary-strip">
                    <article className="dashboard-summary-card">
                        <DesignIcon name="ingatlanok" alt="Ingatlan státusz" />
                        <div className="dashboard-summary-copy">
                            <div className="dashboard-summary-label">Státusz</div>
                            <strong>{property.status === "ACTIVE" ? "Aktív" : "Inaktív"}</strong>
                            <span>{property.status === "ACTIVE" ? "Aktívan kezelt portfólióelem" : "Jelenleg inaktív"}</span>
                        </div>
                    </article>
                    <article className="dashboard-summary-card">
                        <DesignIcon name={assignedTenants.length > 0 ? "aktiv_berlo" : "Berlo_nelkuli_ingatlan"} alt="Bérlők" tone={assignedTenants.length > 0 ? "design-icon-badge-green" : "design-icon-badge-amber"} />
                        <div className="dashboard-summary-copy">
                            <div className="dashboard-summary-label">Hozzárendelt bérlő</div>
                            <strong>{assignedTenants.length}</strong>
                            <span>{property.tenant_id ? "Van elsődleges bérlő" : "Nincs elsődleges hozzárendelés"}</span>
                        </div>
                    </article>
                    <article className="dashboard-summary-card">
                        <DesignIcon name="lejart_dij" alt="Aktív díjak" tone="design-icon-badge-danger" />
                        <div className="dashboard-summary-copy">
                            <div className="dashboard-summary-label">Aktív / lejárt díj</div>
                            <strong>{activeChargeCount} / {overdueCount}</strong>
                            <span>{nextDueCharge ? `Következő esedékesség: ${nextDueCharge.due_date}` : "Nincs nyitott bérlői tétel"}</span>
                        </div>
                    </article>
                    <article className="dashboard-summary-card">
                        <DesignIcon name="kiadas" alt="Saját költség" tone="design-icon-badge-purple" />
                        <div className="dashboard-summary-copy">
                            <div className="dashboard-summary-label">Dokumentum / saját költség</div>
                            <strong>{documentRows?.length ?? 0} / {ownExpenseCount}</strong>
                            <span>Ingatlanhoz kötött mellékletek és saját költség tételek</span>
                        </div>
                    </article>
                </section>

                <div className="dashboard-split-grid property-detail-grid">
                    <section className="card dashboard-section-card property-tenant-section">
                        <div className="dashboard-section-head">
                            <div>
                                <div className="card-title">Hozzárendelt bérlők</div>
                                <p>Az elsődleges bérlő automatikusan tükröződik a pénzügyi és dokumentum workflow-kban is.</p>
                            </div>
                        </div>

                        {assignedTenants.length === 0 ? (
                            <div className="dashboard-empty-state">
                                <strong>Ehhez az ingatlanhoz még nincs bérlő hozzárendelve.</strong>
                                <span>A jobb oldali panelből rögtön hozzá tudsz rendelni egy meglévő bérlőt.</span>
                            </div>
                        ) : (
                            <div className="account-card-list">
                                {assignedTenants.map((tenant) => (
                                    <div key={tenant.id} className="account-list-card property-tenant-card">
                                        <div className="property-tenant-card-copy">
                                            <strong>{tenant.full_name || tenant.email}</strong>
                                            <span>{tenant.email}</span>
                                            {tenant.id === property.tenant_id ? <small>Elsődleges bérlő</small> : null}
                                        </div>
                                        <form
                                            action={async () => {
                                                "use server";
                                                const res = await removeTenantFromProperty(property.id, tenant.id);
                                                if (!res.ok) {
                                                    const msg = res.error ?? "Ismeretlen hiba.";
                                                    redirect(`/owner/properties/${property.id}?status=error&message=${encodeURIComponent(msg)}`);
                                                }
                                                redirect(`/owner/properties/${property.id}?status=success&message=A+b%C3%A9rl%C5%91+le+lett+v%C3%A1lasztva+az+ingatlanr%C3%B3l.`);
                                            }}
                                        >
                                            <PendingSubmitButton className="btn btn-secondary btn-sm" label="Leválasztás" pendingLabel="Mentés..." />
                                        </form>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <div className="dashboard-stack">
                        <OwnerPropertyEditForm
                            action={async (formData) => {
                                "use server";
                                const res = await updateProperty(property.id, formData);
                                if (!res.ok) {
                                    const msg = res.error ?? "Ismeretlen hiba.";
                                    redirect(`/owner/properties/${property.id}?status=error&message=${encodeURIComponent(msg)}`);
                                }
                                redirect(`/owner/properties/${property.id}?status=success&message=Az+ingatlan+adatai+elmentve.`);
                            }}
                            name={property.name}
                            address={property.address}
                            status={property.status}
                        />

                        <form
                            action={async (formData) => {
                                "use server";
                                const res = await assignTenantToProperty(property.id, formData);
                                if (!res.ok) {
                                    const msg = res.error ?? "Ismeretlen hiba.";
                                    redirect(`/owner/properties/${property.id}?status=error&message=${encodeURIComponent(msg)}`);
                                }
                                redirect(`/owner/properties/${property.id}?status=success&message=A+b%C3%A9rl%C5%91+hozz%C3%A1rendel%C3%A9se+siker%C3%BClt.`);
                            }}
                            className="card dashboard-section-card form-shell property-editor-card"
                        >
                            <div className="dashboard-section-head">
                                <div>
                                    <div className="card-title">Bérlő hozzárendelése</div>
                                    <p>A bérlőt bármikor át tudod tenni másik ingatlanhoz is. A meghívás továbbra is a Bérlők oldalon indul.</p>
                                </div>
                            </div>
                            <div className="form-panel">
                                <label className="field-stack">
                                    <span className="field-label">Válassz bérlőt</span>
                                    <select
                                        name="tenant_id"
                                        className="select"
                                        required
                                        defaultValue=""
                                    >
                                        <option value="" disabled>Válassz bérlőt...</option>
                                        {tenantOptions.map((tenant) => (
                                            <option key={tenant.id} value={tenant.id}>
                                                {tenant.full_name ? `${tenant.full_name} · ${tenant.email}` : tenant.email}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            <PendingSubmitButton
                                className="btn btn-primary"
                                label="Bérlő hozzárendelése"
                                pendingLabel="Hozzárendelés..."
                            />
                        </form>
                    </div>
                </div>

                <section className="card dashboard-section-card">
                        <div className="dashboard-section-head">
                            <div>
                                <div className="card-title">Kapcsolódó műveletek</div>
                                <p>Innen rögtön az új pénzügyi, import és bérlői folyamatok megfelelő belépési pontjaira lépsz.</p>
                            </div>
                        </div>
                    <div className="account-quick-grid property-hub-actions">
                        <Link className="account-quick-link" href={`/owner/charges?property=${property.id}`}>Pénzügyek</Link>
                        <Link className="account-quick-link" href={`/owner/charges?property=${property.id}&compose=manual`}>Új tétel</Link>
                        <Link className="account-quick-link" href={`/owner/charges?property=${property.id}&compose=upload`}>Számla feltöltés</Link>
                        <Link className="account-quick-link" href="/owner/tenants">Bérlők kezelése</Link>
                    </div>
                </section>

                <DeletePropertyForm
                    action={async () => {
                        "use server";
                        const res = await deleteProperty(property.id);
                        if (!res.ok) {
                            const msg = res.error ?? "Ismeretlen hiba.";
                            redirect(`/owner/properties/${property.id}?status=error&message=${encodeURIComponent(msg)}`);
                        }
                        redirect("/owner/properties?status=success&message=Az+ingatlan+t%C3%B6r%C3%B6lve+lett.");
                    }}
                />
            </div>
        </main>
    );
}
