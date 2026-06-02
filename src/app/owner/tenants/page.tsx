import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { approveTenantExitRequest, createTenant, deleteTenant, rejectTenantExitRequest } from "./actions";
import DeleteTenantButton from "./DeleteTenantButton";
import AppHeader from "@/components/AppHeader";
import DesignIcon from "@/components/dashboard/DesignIcon";
import { listOwnerTenantIds } from "@/lib/tenantOwnership";
import PendingSubmitButton from "@/components/PendingSubmitButton";

type Props = {
    searchParams?: Promise<{ status?: string; message?: string }> | { status?: string; message?: string };
};

type PropertyRow = {
    id: string;
    name: string;
    status: string;
};

type TenantProfileRow = {
    id: string;
    email: string;
    full_name: string | null;
    created_at: string;
};

export default async function OwnerTenantsPage({ searchParams }: Props) {
    const { profile } = await requireRole("OWNER");
    const admin = createSupabaseAdminClient();
    const sp = searchParams instanceof Promise ? await searchParams : (searchParams ?? {});
    const status = sp.status ? String(sp.status) : "";
    const message = sp.message ? String(sp.message) : "";

    const tenantIds = await listOwnerTenantIds(profile.id);
    const [{ data: tenants, error }, { data: properties }, { data: propertyTenantRows }, { data: exitRequests }] = await Promise.all([
        tenantIds.length === 0
            ? Promise.resolve({ data: [], error: null })
            : admin
                .from("profiles")
                .select("id,email,full_name,created_at")
                .in("id", tenantIds)
                .order("created_at", { ascending: false }),
        admin
            .from("properties")
            .select("id,name,status")
            .eq("owner_id", profile.id)
            .neq("status", "ARCHIVED")
            .order("name"),
        admin
            .from("property_tenants")
            .select("property_id,tenant_id")
            .eq("owner_id", profile.id),
        admin
            .from("tenant_exit_requests")
            .select("id,tenant_id,property_id,created_at,properties(name,address),profiles!tenant_exit_requests_tenant_id_fkey(email,full_name)")
            .eq("owner_id", profile.id)
            .eq("status", "PENDING")
            .order("created_at", { ascending: true }),
    ]);

    if (error) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <div className="card">
                    <h1>Bérlők</h1>
                    <p className="text-red-600">Hiba: {error.message}</p>
                </div>
            </main>
        );
    }

    const propertyRows = (properties ?? []) as PropertyRow[];
    const tenantProfiles = (tenants ?? []) as TenantProfileRow[];
    const pendingExitRequests = exitRequests ?? [];
    const propertyNamesByTenantId = new Map<string, string[]>();
    const assignedPropertyIds = new Set<string>();

    (propertyTenantRows ?? []).forEach((row) => {
        const propertyId = row.property_id as string | null;
        const tenantId = row.tenant_id as string | null;
        if (!propertyId || !tenantId) return;
        assignedPropertyIds.add(propertyId);
        const property = propertyRows.find((item) => item.id === propertyId);
        if (!property) return;
        const items = propertyNamesByTenantId.get(tenantId) ?? [];
        if (!items.includes(property.name)) items.push(property.name);
        propertyNamesByTenantId.set(tenantId, items);
    });

    const exitRequestByTenantId = new Map(
        pendingExitRequests.map((request) => [request.tenant_id as string, request])
    );

    const activeTenantCount = tenantProfiles.filter((tenant) => (propertyNamesByTenantId.get(tenant.id) ?? []).length > 0 && !exitRequestByTenantId.has(tenant.id)).length;
    const invitedTenantCount = tenantProfiles.filter((tenant) => (propertyNamesByTenantId.get(tenant.id) ?? []).length === 0 && !exitRequestByTenantId.has(tenant.id)).length;
    const exitingTenantCount = pendingExitRequests.length;
    const unassignedPropertyCount = propertyRows.filter((property) => !assignedPropertyIds.has(property.id) && property.status === "ACTIVE").length;

    return (
        <main className="app-shell page-enter">
            <AppHeader profile={profile} />

            <div className="dashboard-stack">
                <section className="dashboard-page-header">
                    <div>
                        <h1>Bérlők</h1>
                        <p>Bérlők kezelése, meghívások és kilépési kérelmek egy közös operatív felületen.</p>
                    </div>
                </section>

                <section className="dashboard-kpi-grid">
                    <article className="card dashboard-kpi-card dashboard-kpi-card-compact">
                        <DesignIcon name="aktiv_berlo" alt="Aktív bérlők" tone="design-icon-badge-blue" />
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Aktív bérlők</div>
                            <div className="dashboard-kpi-value">{activeTenantCount}</div>
                            <div className="muted-note">Hozzárendelt bérlők</div>
                        </div>
                    </article>
                    <article className="card dashboard-kpi-card dashboard-kpi-card-compact">
                        <DesignIcon name="meghivott_berlo" alt="Meghívásra vár" tone="design-icon-badge-amber" />
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Meghívásra vár</div>
                            <div className="dashboard-kpi-value">{invitedTenantCount}</div>
                            <div className="muted-note">Még nincs aktív hozzárendelés</div>
                        </div>
                    </article>
                    <article className="card dashboard-kpi-card dashboard-kpi-card-compact">
                        <DesignIcon name="kilepesi_kerelem_folyamatban" alt="Kilépési kérelmek" tone="design-icon-badge-purple" />
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Kilépési kérelmek</div>
                            <div className="dashboard-kpi-value">{exitingTenantCount}</div>
                            <div className="muted-note">Függő jóváhagyások</div>
                        </div>
                    </article>
                    <article className="card dashboard-kpi-card dashboard-kpi-card-compact">
                        <DesignIcon name="Berlo_nelkuli_ingatlan" alt="Üres ingatlanok" tone="design-icon-badge-green" />
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Üres ingatlanok</div>
                            <div className="dashboard-kpi-value">{unassignedPropertyCount}</div>
                            <div className="muted-note">Aktív, bérlő nélkül</div>
                        </div>
                    </article>
                </section>

                {message ? (
                    <section className="card dashboard-section-card">
                        <div className={status === "error" ? "text-red-600" : "text-green-600"}>{message}</div>
                    </section>
                ) : null}

                <section className="dashboard-split-grid tenant-directory-grid">
                    <article className="card dashboard-section-card finance-table-shell tenant-directory-table-shell">
                        <div className="dashboard-section-head">
                            <div>
                                <div className="card-title">Bérlők listája</div>
                                <p className="muted-note">Név, e-mail, ingatlan és státusz a saját portfóliódhoz.</p>
                            </div>
                        </div>

                        {tenantProfiles.length === 0 ? (
                            <p className="dashboard-empty-note">Még nincs bérlőd.</p>
                        ) : (
                            <>
                                <div className="finance-table-scroll tenant-directory-scroll">
                                    <table className="dashboard-data-table tenant-directory-table">
                                        <colgroup>
                                            <col className="tenant-directory-col-name" />
                                            <col className="tenant-directory-col-email" />
                                            <col className="tenant-directory-col-properties" />
                                            <col className="tenant-directory-col-status" />
                                            <col className="tenant-directory-col-actions" />
                                        </colgroup>
                                        <thead>
                                            <tr>
                                                <th>Név</th>
                                                <th>Email</th>
                                                <th>Ingatlan</th>
                                                <th>Státusz</th>
                                                <th>Műveletek</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tenantProfiles.map((tenant) => {
                                                const assignedProperties = propertyNamesByTenantId.get(tenant.id) ?? [];
                                                const hasExitRequest = exitRequestByTenantId.has(tenant.id);
                                                const tenantStatus = hasExitRequest ? "Kilépés alatt" : assignedProperties.length > 0 ? "Aktív" : "Meghívva";
                                                const statusTone = hasExitRequest
                                                    ? "dashboard-inline-badge-red"
                                                    : assignedProperties.length > 0
                                                        ? "dashboard-inline-badge-green"
                                                        : "dashboard-inline-badge-amber";

                                                return (
                                                    <tr key={tenant.id}>
                                                        <td className="tenant-directory-cell-name">
                                                            <div className="dashboard-list-main">
                                                                <span className="dashboard-avatar-pill">
                                                                    {(tenant.full_name || tenant.email).slice(0, 2).toUpperCase()}
                                                                </span>
                                                                <div className="dashboard-table-main">
                                                                    <strong>{tenant.full_name || "Név nélküli bérlő"}</strong>
                                                                    <span className="dashboard-table-subtitle">Létrehozva: {new Date(tenant.created_at).toLocaleDateString("hu-HU")}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="tenant-directory-cell-email">{tenant.email}</td>
                                                        <td className="tenant-directory-cell-properties">
                                                            {assignedProperties.length > 0 ? assignedProperties.join(", ") : "Nincs hozzárendelve"}
                                                        </td>
                                                        <td className="tenant-directory-cell-status">
                                                            <span className={`dashboard-inline-badge ${statusTone}`}>{tenantStatus}</span>
                                                        </td>
                                                        <td className="tenant-directory-cell-actions">
                                                            <DeleteTenantButton
                                                                action={async () => {
                                                                    "use server";
                                                                    const res = await deleteTenant(tenant.id);
                                                                    if (!res.ok) {
                                                                        redirect(`/owner/tenants?status=error&message=${encodeURIComponent(res.error ?? "Ismeretlen hiba.")}`);
                                                                    }
                                                                    redirect("/owner/tenants?status=success&message=B%C3%A9rl%C5%91+t%C3%B6r%C3%B6lve.");
                                                                }}
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="tenant-directory-mobile-list">
                                    {tenantProfiles.map((tenant) => {
                                        const assignedProperties = propertyNamesByTenantId.get(tenant.id) ?? [];
                                        const hasExitRequest = exitRequestByTenantId.has(tenant.id);
                                        const tenantStatus = hasExitRequest ? "Kilépés alatt" : assignedProperties.length > 0 ? "Aktív" : "Meghívva";
                                        const statusTone = hasExitRequest
                                            ? "dashboard-inline-badge-red"
                                            : assignedProperties.length > 0
                                                ? "dashboard-inline-badge-green"
                                                : "dashboard-inline-badge-amber";

                                        return (
                                            <article key={`${tenant.id}-mobile`} className="tenant-directory-mobile-card">
                                                <div className="dashboard-list-main">
                                                    <span className="dashboard-avatar-pill">
                                                        {(tenant.full_name || tenant.email).slice(0, 2).toUpperCase()}
                                                    </span>
                                                    <div className="dashboard-list-copy">
                                                        <strong>{tenant.full_name || "Név nélküli bérlő"}</strong>
                                                        <span>{tenant.email}</span>
                                                        <span>Létrehozva: {new Date(tenant.created_at).toLocaleDateString("hu-HU")}</span>
                                                    </div>
                                                </div>
                                                <div className="tenant-directory-mobile-meta">
                                                    <div>
                                                        <small>Ingatlan</small>
                                                        <strong>{assignedProperties.length > 0 ? assignedProperties.join(", ") : "Nincs hozzárendelve"}</strong>
                                                    </div>
                                                    <div>
                                                        <small>Státusz</small>
                                                        <span className={`dashboard-inline-badge ${statusTone}`}>{tenantStatus}</span>
                                                    </div>
                                                </div>
                                                <DeleteTenantButton
                                                    action={async () => {
                                                        "use server";
                                                        const res = await deleteTenant(tenant.id);
                                                        if (!res.ok) {
                                                            redirect(`/owner/tenants?status=error&message=${encodeURIComponent(res.error ?? "Ismeretlen hiba.")}`);
                                                        }
                                                        redirect("/owner/tenants?status=success&message=B%C3%A9rl%C5%91+t%C3%B6r%C3%B6lve.");
                                                    }}
                                                />
                                            </article>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </article>

                    <div className="dashboard-stack">
                        <form
                            action={async (formData) => {
                                "use server";
                                const res = await createTenant(formData);
                                if (!res.ok) {
                                    redirect(`/owner/tenants?status=error&message=${encodeURIComponent(res.error ?? "Ismeretlen hiba.")}`);
                                }
                                redirect("/owner/tenants?status=success&message=B%C3%A9rl%C5%91+megh%C3%ADvva.");
                            }}
                            className="card dashboard-section-card"
                        >
                            <div className="dashboard-section-head">
                                <div>
                                    <div className="card-title">Új bérlő meghívása</div>
                                    <p className="muted-note">A meghívott bérlő azonnal hozzárendelhető a kiválasztott ingatlanhoz.</p>
                                </div>
                            </div>

                            {propertyRows.length === 0 ? (
                                <div className="dashboard-upload-dropzone">
                                    <strong>Előbb legyen legalább egy ingatlanod.</strong>
                                    <div className="muted-note">A meghívás most kötelezően ingatlanhoz kötött.</div>
                                    <Link className="btn btn-secondary" href="/owner/properties">Ingatlan létrehozása</Link>
                                </div>
                            ) : null}

                            <div className="dashboard-stack">
                                <label className="field-stack">
                                    <span className="field-label">Név</span>
                                    <input name="full_name" className="input" placeholder="Pl. Nagy Béla" required disabled={propertyRows.length === 0} />
                                </label>
                                <label className="field-stack">
                                    <span className="field-label">Email</span>
                                    <input name="email" type="email" className="input" placeholder="pelda@email.hu" required disabled={propertyRows.length === 0} />
                                </label>
                                <label className="field-stack">
                                    <span className="field-label">Ingatlan</span>
                                    <select name="property_id" className="select" required defaultValue="" disabled={propertyRows.length === 0}>
                                        <option value="" disabled>Válassz ingatlant</option>
                                        {propertyRows.map((property) => (
                                            <option key={property.id} value={property.id}>{property.name}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            {propertyRows.length > 0 ? <PendingSubmitButton className="btn btn-primary" label="Meghívó küldése" pendingLabel="Küldés..." /> : null}
                        </form>
                    </div>
                </section>

                <section className="card dashboard-section-card">
                        <div className="dashboard-section-head">
                            <div>
                                <div className="card-title">Kilépési kérelmek</div>
                                <p className="muted-note">A bérlői kilépési igények itt hagyhatók jóvá vagy utasíthatók el.</p>
                            </div>
                        </div>

                    {pendingExitRequests.length === 0 ? (
                        <p className="dashboard-empty-note">Nincs függő kilépési kérelem.</p>
                    ) : (
                        <div className="dashboard-list">
                            {pendingExitRequests.map((request) => {
                                const tenant = Array.isArray(request.profiles) ? request.profiles[0] : request.profiles;
                                const property = Array.isArray(request.properties) ? request.properties[0] : request.properties;
                                return (
                                    <div key={request.id} className="dashboard-list-item">
                                        <div className="dashboard-list-main">
                                            <span className="dashboard-avatar-pill">
                                                {((tenant?.full_name || tenant?.email || "T") as string).slice(0, 2).toUpperCase()}
                                            </span>
                                            <div className="dashboard-list-copy">
                                                <strong>{tenant?.full_name || tenant?.email || "Bérlő"}</strong>
                                                <span>{property?.name || "Ingatlan"} · {new Date(request.created_at).toLocaleDateString("hu-HU")}</span>
                                            </div>
                                        </div>
                                        <div className="dashboard-table-actions">
                                            <form
                                                action={async () => {
                                                    "use server";
                                                    const res = await approveTenantExitRequest(request.id);
                                                    if (!res.ok) {
                                                        redirect(`/owner/tenants?status=error&message=${encodeURIComponent(res.error ?? "Ismeretlen hiba.")}`);
                                                    }
                                                    redirect("/owner/tenants?status=success&message=A+kil%C3%A9p%C3%A9si+k%C3%A9relem+j%C3%B3v%C3%A1hagyva.");
                                                }}
                                            >
                                                <PendingSubmitButton className="btn btn-primary btn-sm" label="Elfogadás" pendingLabel="Mentés..." />
                                            </form>
                                            <form
                                                action={async () => {
                                                    "use server";
                                                    const res = await rejectTenantExitRequest(request.id);
                                                    if (!res.ok) {
                                                        redirect(`/owner/tenants?status=error&message=${encodeURIComponent(res.error ?? "Ismeretlen hiba.")}`);
                                                    }
                                                    redirect("/owner/tenants?status=success&message=A+kil%C3%A9p%C3%A9si+k%C3%A9relem+elutas%C3%ADtva.");
                                                }}
                                            >
                                                <PendingSubmitButton className="btn btn-secondary btn-sm" label="Elutasítás" pendingLabel="Mentés..." />
                                            </form>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
