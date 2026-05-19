import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { approveTenantExitRequest, createTenant, deleteTenant, rejectTenantExitRequest } from "./actions";
import DeleteTenantButton from "./DeleteTenantButton";
import AppHeader from "@/components/AppHeader";
import { listOwnerTenantIds } from "@/lib/tenantOwnership";
import PendingSubmitButton from "@/components/PendingSubmitButton";

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
            .order("created_at", { ascending: false });

    const { data: exitRequests } = await admin
        .from("tenant_exit_requests")
        .select("id,tenant_id,property_id,created_at,properties(name,address),profiles!tenant_exit_requests_tenant_id_fkey(email,full_name)")
        .eq("owner_id", profile.id)
        .eq("status", "PENDING")
        .order("created_at", { ascending: true });

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
                <PendingSubmitButton className="btn btn-primary" label="Meghívó küldése" pendingLabel="Küldés..." />
            </form>

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="card-title">Kilépési kérelmek</div>
                        <p className="muted-note">A bérlők itt kérhetik, hogy lekerüljenek az egyik ingatlanodról.</p>
                    </div>
                </div>

                {(exitRequests ?? []).length === 0 ? (
                    <p className="muted-note">Nincs függő kilépési kérelem.</p>
                ) : (
                    <div className="charge-list">
                        {(exitRequests ?? []).map((request) => {
                            const tenant = Array.isArray(request.profiles) ? request.profiles[0] : request.profiles;
                            const property = Array.isArray(request.properties) ? request.properties[0] : request.properties;
                            return (
                                <div key={request.id} className="charge-card flex flex-col gap-3">
                                    <div>
                                        <div className="card-title">{tenant?.full_name || tenant?.email || "Bérlő"}</div>
                                        {tenant?.email ? <div className="text-sm text-gray-600">{tenant.email}</div> : null}
                                        <div className="muted-note">
                                            {property?.name || "Ingatlan"}{property?.address ? ` · ${property.address}` : ""}
                                        </div>
                                    </div>
                                    <div className="charge-actions">
                                        <form
                                            action={async () => {
                                                "use server";
                                                const res = await approveTenantExitRequest(request.id);
                                                if (!res.ok) {
                                                    const msg = res.error ?? "Ismeretlen hiba.";
                                                    redirect(`/owner/tenants?status=error&message=${encodeURIComponent(msg)}`);
                                                }
                                                redirect("/owner/tenants?status=success&message=A+kil%C3%A9p%C3%A9si+k%C3%A9relem+j%C3%B3v%C3%A1hagyva.");
                                            }}
                                        >
                                            <PendingSubmitButton className="btn btn-primary btn-sm" label="Jóváhagyom" pendingLabel="Mentés..." />
                                        </form>
                                        <form
                                            action={async () => {
                                                "use server";
                                                const res = await rejectTenantExitRequest(request.id);
                                                if (!res.ok) {
                                                    const msg = res.error ?? "Ismeretlen hiba.";
                                                    redirect(`/owner/tenants?status=error&message=${encodeURIComponent(msg)}`);
                                                }
                                                redirect("/owner/tenants?status=success&message=A+kil%C3%A9p%C3%A9si+k%C3%A9relem+elutas%C3%ADtva.");
                                            }}
                                        >
                                            <PendingSubmitButton className="btn btn-secondary btn-sm" label="Elutasítom" pendingLabel="Mentés..." />
                                        </form>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

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
