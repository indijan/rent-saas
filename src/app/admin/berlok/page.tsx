import { requireRole } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import AppHeader from "@/components/AppHeader";

export default async function AdminTenantsPage() {
    const { profile } = await requireRole("ADMIN");
    const admin = createSupabaseAdminClient();

    const { data: tenants, error } = await admin
        .from("profiles")
        .select("id,email,full_name,created_at")
        .eq("role", "TENANT")
        .order("created_at", { ascending: false });

    if (error) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <div className="card">
                    <h1>Admin bérlőkezelés</h1>
                    <p className="text-red-600">Hiba: {error.message}</p>
                </div>
            </main>
        );
    }

    return (
        <main className="app-shell page-enter space-y-4">
            <AppHeader profile={profile} />

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Admin</div>
                        <h1>Bérlőkezelés</h1>
                        <p>
                            Itt kizárólag a bérlői fiókok alapadatai láthatók.
                            Az admin nem lát ingatlan-, díj- vagy dokumentumadatokat.
                        </p>
                    </div>
                </div>
            </section>

            <section className="card charge-list">
                {(tenants ?? []).map((tenant) => (
                    <article key={tenant.id} className="charge-card">
                        <div className="card-title">{tenant.full_name || "Név nélküli bérlő"}</div>
                        <div className="charge-meta">
                            <span>{tenant.email}</span>
                            <span>Létrehozva: {tenant.created_at ? new Date(tenant.created_at).toLocaleDateString("hu-HU") : "-"}</span>
                        </div>
                    </article>
                ))}
            </section>
        </main>
    );
}
