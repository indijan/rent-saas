import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createTenant, deleteTenant } from "./actions";
import DeleteTenantButton from "./DeleteTenantButton";
import AppHeader from "@/components/AppHeader";
import { listOwnerTenantIds } from "@/lib/tenantOwnership";

type Props = {
    searchParams?: Promise<{ status?: string; message?: string }> | { status?: string; message?: string };
};

export default async function OwnerTenantsPage({ searchParams }: Props) {
    const { profile } = await requireRole("OWNER");
    const admin = createSupabaseAdminClient();
    const sp = (searchParams instanceof Promise) ? await searchParams : (searchParams ?? {});
    const status = sp.status ? String(sp.status) : "";
    const message = sp.message ? String(sp.message) : "";

    const tenantIds = await listOwnerTenantIds(profile.id);
    const { data: tenants, error } = tenantIds.length === 0
        ? { data: [], error: null }
        : await admin
            .from("profiles")
            .select("id,email,full_name,created_at")
            .in("id", tenantIds)
            .eq("role", "TENANT")
            .order("created_at", { ascending: false });

    if (error) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <div className="card space-y-2">
                    <h1>Bérlők</h1>
                    <p className="mt-2 text-red-600">Hiba: {error.message}</p>
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
                        <div className="eyebrow">Bérlők kezelése</div>
                        <h1>Bérlők</h1>
                        <p>Itt csak a saját bérlőid láthatók. Innen indul a meghívás és a fiókaktiválás is.</p>
                    </div>
                </div>
            </section>

            {message ? (
                <div className={`card ${status === "error" ? "text-red-600" : "text-green-600"}`}>
                    {message}
                </div>
            ) : null}

            <form
                action={async (formData) => {
                    "use server";
                    const res = await createTenant(formData);
                    if (!res.ok) {
                        const msg = res.error ?? "Ismeretlen hiba.";
                        redirect(`/owner/tenants?status=error&message=${encodeURIComponent(msg)}`);
                    }
                    redirect("/owner/tenants?status=success&message=B%C3%A9rl%C5%91+megh%C3%ADvva.");
                }}
                className="card form-shell"
            >
                <div className="section-header">
                    <div>
                        <div className="card-title">Új bérlő meghívása</div>
                        <p className="muted-note">A bérlő e-mailben kap meghívót, majd saját jelszót állít be.</p>
                    </div>
                </div>
                <div className="form-panel">
                    <div className="form-grid">
                        <label className="field-stack">
                            <span className="field-label">Teljes név</span>
                            <input
                                name="full_name"
                                placeholder="Név"
                                className="input"
                                required
                            />
                        </label>
                        <label className="field-stack">
                            <span className="field-label">E-mail-cím</span>
                            <input
                                name="email"
                                type="email"
                                placeholder="email@pelda.hu"
                                className="input"
                                required
                            />
                        </label>
                    </div>
                </div>
                <button className="btn btn-primary">
                    Meghívó küldése
                </button>
            </form>

            {(!tenants || tenants.length === 0) ? (
                <div className="card">
                    <p className="card-title">Még nincs bérlő.</p>
                </div>
            ) : (
                <div className="card charge-list">
                    {tenants.map((tenant) => (
                        <div key={tenant.id} className="charge-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <div className="card-title">{tenant.full_name || "Név nélküli"}</div>
                                <div className="text-sm text-gray-600">{tenant.email}</div>
                            </div>
                            <DeleteTenantButton
                                action={async () => {
                                    "use server";
                                    const res = await deleteTenant(tenant.id);
                                    if (!res.ok) {
                                        const msg = res.error ?? "Ismeretlen hiba.";
                                        redirect(`/owner/tenants?status=error&message=${encodeURIComponent(msg)}`);
                                    }
                                    redirect("/owner/tenants?status=success&message=B%C3%A9rl%C5%91+t%C3%B6r%C3%B6lve.");
                                }}
                            />
                        </div>
                    ))}
                </div>
            )}
        </main>
    );
}
