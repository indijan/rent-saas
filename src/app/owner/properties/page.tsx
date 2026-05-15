import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import AppHeader from "@/components/AppHeader";
import { createProperty } from "./actions";

export default async function OwnerPropertiesPage() {
    const { supabase, profile } = await requireRole("OWNER");
    const admin = createSupabaseAdminClient();

    const { data: properties, error } = await supabase
        .from("properties")
        .select("id,name,address,status,created_at,tenant_id")
        .order("created_at", { ascending: false });

    async function onCreate(formData: FormData) {
        "use server";
        const res = await createProperty(formData);
        if (!res.ok) return;
        revalidatePath("/owner/properties");
    }

    if (error) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <div className="card space-y-2">
                <h1>Ingatlanok</h1>
                <p className="mt-2 text-red-600">Hiba: {error.message}</p>
                </div>
            </main>
        );
    }

    const tenantIds = Array.from(new Set((properties ?? []).map((property) => property.tenant_id).filter(Boolean)));
    const { data: tenantProfiles } = tenantIds.length > 0
        ? await admin.from("profiles").select("id,email,full_name").in("id", tenantIds)
        : { data: [] as { id: string; email: string; full_name: string | null }[] };
    const tenantById = new Map((tenantProfiles ?? []).map((tenant) => [tenant.id, tenant]));

    const propertyCount = properties?.length ?? 0;
    const activeCount = (properties ?? []).filter((property) => property.status === "ACTIVE").length;
    const inactiveCount = Math.max(0, propertyCount - activeCount);

    return (
        <main className="app-shell page-enter space-y-4">
            <AppHeader profile={profile} />

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Portfólió áttekintés</div>
                        <h1>Ingatlanok</h1>
                        <p>Itt kezeled az ingatlanállományt, a státuszokat és az egyes lakások pénzügyi felületeit.</p>
                    </div>
                </div>
                <div className="kpi-grid stagger">
                    <div className="kpi-card">
                        <div className="kpi-label">Összes ingatlan</div>
                        <div className="kpi-value">{propertyCount}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Aktív</div>
                        <div className="kpi-value">{activeCount}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Inaktív</div>
                        <div className="kpi-value">{inactiveCount}</div>
                    </div>
                </div>
            </section>

            <form action={onCreate} className="card form-shell">
                <div className="section-header">
                    <div>
                        <div className="card-title">Új ingatlan felvétele</div>
                        <p className="muted-note">Az új ingatlan automatikusan aktív státuszban jön létre.</p>
                    </div>
                </div>
                <div className="form-panel">
                    <div className="form-grid">
                        <label className="field-stack">
                            <span className="field-label">Megnevezés</span>
                            <input
                                name="name"
                                placeholder="Pl. Belvárosi lakás"
                                className="input"
                                required
                            />
                        </label>
                        <label className="field-stack">
                            <span className="field-label">Cím</span>
                            <input
                                name="address"
                                placeholder="Cím"
                                className="input"
                                required
                            />
                        </label>
                    </div>
                </div>
                <button className="btn btn-primary">
                    Ingatlan létrehozása
                </button>
            </form>

            {(!properties || properties.length === 0) ? (
                <div className="card">
                    <p className="card-title">Nincs még ingatlanod.</p>
                </div>
            ) : (
                <div className="card charge-list">
                    {properties.map((p) => (
                        (() => {
                            const tenant = p.tenant_id ? tenantById.get(p.tenant_id) : null;
                            return (
                        <Link
                            key={p.id}
                            href={`/owner/properties/${p.id}`}
                            className="charge-card block"
                        >
                            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <div className="card-title">{p.name}</div>
                                    <div className="text-sm text-gray-600">{p.address}</div>
                                    <div className="muted-note">
                                        Bérlő: {tenant ? (tenant.full_name || tenant.email) : "Nincs hozzárendelve"}
                                    </div>
                                </div>
                                <div className={`status-badge status-${String(p.status).toLowerCase()}`}>
                                    {p.status === "ACTIVE" ? "Aktív" : "Inaktív"}
                                </div>
                            </div>
                        </Link>
                            );
                        })()
                    ))}
                </div>
            )}
        </main>
    );
}
