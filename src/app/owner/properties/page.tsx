import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import AppHeader from "@/components/AppHeader";
import DesignIcon from "@/components/dashboard/DesignIcon";
import { createProperty } from "./actions";
import OwnerPropertyCreateForm from "./OwnerPropertyCreateForm";
import { maskAddress } from "@/lib/addressMasking";

type Props = {
    searchParams?: Promise<{ status?: string; message?: string }> | { status?: string; message?: string };
};

type ChargeAggregateRow = {
    property_id: string;
    status: string;
    due_date: string;
};

export default async function OwnerPropertiesPage({ searchParams }: Props) {
    const { supabase, profile } = await requireRole("OWNER");
    const admin = createSupabaseAdminClient();
    const sp = searchParams instanceof Promise ? await searchParams : (searchParams ?? {});
    const status = sp.status ? String(sp.status) : "";
    const message = sp.message ? String(sp.message) : "";

    const { data: properties, error } = await supabase
        .from("properties")
        .select("id,name,address,status,created_at,tenant_id")
        .eq("owner_id", profile.id)
        .order("created_at", { ascending: false });

    async function onCreate(formData: FormData) {
        "use server";
        const res = await createProperty(formData);
        if (!res.ok) {
            const msg = res.error ?? "Ismeretlen hiba.";
            redirect(`/owner/properties?status=error&message=${encodeURIComponent(msg)}`);
        }
        if (res.duplicate) {
            redirect("/owner/properties?status=success&message=Ez+az+ingatlan+m%C3%A1r+l%C3%A9tezik%2C+ez%C3%A9rt+nem+hoztuk+l%C3%A9tre+ism%C3%A9t.");
        }
        redirect("/owner/properties?status=success&message=Az+ingatlan+l%C3%A9trej%C3%B6tt.");
    }

    if (error) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <div className="card dashboard-section-card">
                    <h1>Ingatlanok</h1>
                    <p className="mt-2 text-red-600">Hiba: {error.message}</p>
                </div>
            </main>
        );
    }

    const propertyRows = properties ?? [];
    const tenantIds = Array.from(new Set(propertyRows.map((property) => property.tenant_id).filter(Boolean)));
    const propertyIds = propertyRows.map((property) => property.id);
    const [{ data: tenantProfiles }, { data: propertyTenantRows }, { data: chargeRows }, { data: documentRows }] = await Promise.all([
        tenantIds.length > 0
            ? admin.from("profiles").select("id,email,full_name").in("id", tenantIds)
            : Promise.resolve({ data: [] as { id: string; email: string; full_name: string | null }[] }),
        propertyIds.length > 0
            ? admin.from("property_tenants").select("property_id,tenant_id").in("property_id", propertyIds)
            : Promise.resolve({ data: [] as Array<{ property_id: string; tenant_id: string }> }),
        propertyIds.length > 0
            ? supabase.from("charges").select("property_id,status,due_date").in("property_id", propertyIds)
            : Promise.resolve({ data: [] as ChargeAggregateRow[] }),
        propertyIds.length > 0
            ? supabase.from("documents").select("property_id").in("property_id", propertyIds)
            : Promise.resolve({ data: [] as Array<{ property_id: string }> }),
    ]);

    const tenantById = new Map((tenantProfiles ?? []).map((tenant) => [tenant.id, tenant]));
    const tenantCountByProperty = new Map<string, number>();
    (propertyTenantRows ?? []).forEach((row) => {
        const propertyId = row.property_id as string | null;
        if (!propertyId) return;
        tenantCountByProperty.set(propertyId, (tenantCountByProperty.get(propertyId) ?? 0) + 1);
    });

    const chargeStatsByProperty = new Map<string, { total: number; overdue: number; active: number }>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    (chargeRows ?? []).forEach((row) => {
        const propertyId = row.property_id;
        const current = chargeStatsByProperty.get(propertyId) ?? { total: 0, overdue: 0, active: 0 };
        current.total += 1;
        if (row.status === "UNPAID") {
            current.active += 1;
            const dueDate = new Date(`${row.due_date}T00:00:00`);
            if (dueDate.getTime() < today.getTime()) current.overdue += 1;
        }
        chargeStatsByProperty.set(propertyId, current);
    });

    const documentCountByProperty = new Map<string, number>();
    (documentRows ?? []).forEach((row) => {
        const propertyId = row.property_id as string | null;
        if (!propertyId) return;
        documentCountByProperty.set(propertyId, (documentCountByProperty.get(propertyId) ?? 0) + 1);
    });

    const propertyCount = propertyRows.length;
    const activeCount = propertyRows.filter((property) => property.status === "ACTIVE").length;
    const occupiedCount = propertyRows.filter((property) => (tenantCountByProperty.get(property.id) ?? (property.tenant_id ? 1 : 0)) > 0).length;
    const totalOverdue = Array.from(chargeStatsByProperty.values()).reduce((sum, current) => sum + current.overdue, 0);

    return (
        <main className="app-shell page-enter">
            <AppHeader profile={profile} />

            <div className="dashboard-stack">
                <section className="card dashboard-section-card">
                    <div className="dashboard-page-header">
                        <div>
                            <div className="eyebrow">Portfólió műveleti központ</div>
                            <h1>Ingatlanok</h1>
                            <p>A teljes portfólió egy nézetben: státuszok, bérlők, dokumentumok és azonnali átvezetés az új pénzügyi flow-kba.</p>
                        </div>
                        <div className="account-hero-badge property-hub-badge">
                            <strong>{propertyCount} ingatlan</strong>
                            <span>{activeCount} aktív portfólióelem</span>
                        </div>
                    </div>

                    <div className="dashboard-summary-strip">
                        <article className="dashboard-summary-card">
                            <DesignIcon name="ingatlanok" alt="Összes ingatlan" />
                            <div className="dashboard-summary-copy">
                                <div className="dashboard-summary-label">Összes ingatlan</div>
                                <strong>{propertyCount}</strong>
                                <span>Teljes owner portfólió</span>
                            </div>
                        </article>
                        <article className="dashboard-summary-card">
                            <DesignIcon name="aktiv_berlo" alt="Lakott ingatlan" tone="design-icon-badge-green" />
                            <div className="dashboard-summary-copy">
                                <div className="dashboard-summary-label">Lakott ingatlan</div>
                                <strong>{occupiedCount}</strong>
                                <span>Van hozzárendelt bérlő</span>
                            </div>
                        </article>
                        <article className="dashboard-summary-card">
                            <DesignIcon name="Berlo_nelkuli_ingatlan" alt="Üres ingatlan" tone="design-icon-badge-amber" />
                            <div className="dashboard-summary-copy">
                                <div className="dashboard-summary-label">Bérlő nélküli</div>
                                <strong>{Math.max(0, propertyCount - occupiedCount)}</strong>
                                <span>Beavatkozást kérhet</span>
                            </div>
                        </article>
                        <article className="dashboard-summary-card">
                            <DesignIcon name="lejart_dij" alt="Lejárt tételek" tone="design-icon-badge-danger" />
                            <div className="dashboard-summary-copy">
                                <div className="dashboard-summary-label">Lejárt tétel</div>
                                <strong>{totalOverdue}</strong>
                                <span>Portfólió szintű teendők</span>
                            </div>
                        </article>
                    </div>
                </section>

                {message ? (
                    <div className={`card dashboard-section-card ${status === "error" ? "text-red-600" : "text-green-600"}`}>
                        {message}
                    </div>
                ) : null}

                <div className="dashboard-split-grid property-hub-grid">
                    <section className="card dashboard-section-card">
                        <div className="dashboard-section-head">
                            <div>
                                <div className="card-title">Portfólió elemek</div>
                                <p>Kattints egy ingatlanra a részletes kezelőnézethez, szerkesztéshez vagy a property-szintű pénzügyekhez.</p>
                            </div>
                            <Link className="btn btn-secondary" href="/owner/charges">
                                Pénzügyek megnyitása
                            </Link>
                        </div>

                        {propertyRows.length === 0 ? (
                            <div className="dashboard-empty-state">
                                <strong>Még nincs felvitt ingatlan.</strong>
                                <span>Az első portfólióelemet jobb oldalon tudod létrehozni.</span>
                            </div>
                        ) : (
                            <div className="property-hub-card-grid">
                                {propertyRows.map((property) => {
                                    const tenant = property.tenant_id ? tenantById.get(property.tenant_id) : null;
                                    const tenantCount = tenantCountByProperty.get(property.id) ?? (tenant ? 1 : 0);
                                    const chargeStats = chargeStatsByProperty.get(property.id) ?? { total: 0, overdue: 0, active: 0 };
                                    const documentCount = documentCountByProperty.get(property.id) ?? 0;

                                    return (
                                        <Link
                                            key={property.id}
                                            href={`/owner/properties/${property.id}`}
                                            className="property-hub-card"
                                        >
                                            <div className="property-hub-card-head">
                                                <div className="property-hub-card-copy">
                                                    <div className="property-hub-card-title-row">
                                                        <strong>{property.name}</strong>
                                                        <span className={`status-badge status-${String(property.status).toLowerCase()}`}>
                                                            {property.status === "ACTIVE" ? "Aktív" : "Inaktív"}
                                                        </span>
                                                    </div>
                                                    <span>{maskAddress(property.address)}</span>
                                                </div>
                                                <DesignIcon
                                                    name={tenantCount > 0 ? "ingatlanok" : "Berlo_nelkuli_ingatlan"}
                                                    alt={tenantCount > 0 ? "Ingatlan" : "Bérlő nélküli ingatlan"}
                                                    tone={tenantCount > 0 ? "design-icon-badge-blue" : "design-icon-badge-amber"}
                                                    size={56}
                                                />
                                            </div>

                                            <div className="property-hub-metrics">
                                                <div>
                                                    <span>Bérlők</span>
                                                    <strong>{tenantCount}</strong>
                                                </div>
                                                <div>
                                                    <span>Aktív tétel</span>
                                                    <strong>{chargeStats.active}</strong>
                                                </div>
                                                <div>
                                                    <span>Dokumentum</span>
                                                    <strong>{documentCount}</strong>
                                                </div>
                                            </div>

                                            <div className="property-hub-footer">
                                                <span>
                                                    {tenantCount > 0
                                                        ? `Elsődleges bérlő: ${tenant?.full_name || tenant?.email || "ismeretlen"}`
                                                        : "Nincs hozzárendelt bérlő"}
                                                </span>
                                                <span>{chargeStats.overdue > 0 ? `${chargeStats.overdue} lejárt tétel` : "Nincs lejárt tétel"}</span>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <div className="dashboard-stack">
                        <div id="uj-ingatlan">
                            <OwnerPropertyCreateForm action={onCreate} />
                        </div>

                        <section className="card dashboard-section-card">
                            <div className="dashboard-section-head">
                                <div>
                                    <div className="card-title">Bekötés a vérkeringésbe</div>
                                    <p>Az új shellből közvetlenül elérhetőek a property-köré épülő operatív nézetek is.</p>
                                </div>
                            </div>
                            <div className="account-quick-grid property-hub-actions">
                                <Link href="/owner/charges?compose=manual" className="account-quick-link">Új tétel</Link>
                                <Link href="/owner/charges?compose=upload" className="account-quick-link">PDF feltöltés</Link>
                                <Link href="/owner/tenants" className="account-quick-link">Bérlők kezelése</Link>
                                <Link href="/owner/importok" className="account-quick-link">Importok</Link>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </main>
    );
}
