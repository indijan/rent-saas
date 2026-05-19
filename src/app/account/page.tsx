import { requireUser } from "@/lib/auth/requireUser";
import { deleteProfile, logout, requestTenantProfileDeletion, updatePassword, updateProfile } from "./actions";
import AppHeader from "@/components/AppHeader";
import PendingSubmitButton from "@/components/PendingSubmitButton";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listTenantProperties } from "@/lib/propertyTenants";

type Props = {
    searchParams?: Promise<{ status?: string; message?: string }> | { status?: string; message?: string };
};

export default async function AccountPage({ searchParams }: Props) {
    const { user, profile } = await requireUser();
    const sp = (searchParams instanceof Promise) ? await searchParams : (searchParams ?? {});
    const status = sp.status ? String(sp.status) : "";
    const message = sp.message ? String(sp.message) : "";
    const tenantOnly = profile.role === "TENANT" && (profile.available_roles?.length ?? 0) === 1;
    const admin = createSupabaseAdminClient();
    const tenantProperties = tenantOnly ? await listTenantProperties(user.id) : [];
    const { data: pendingExitRequests } = tenantOnly
        ? await admin
            .from("tenant_exit_requests")
            .select("property_id,status,properties(name,address)")
            .eq("tenant_id", user.id)
            .eq("status", "PENDING")
        : { data: [] };

    return (
        <main className="app-shell page-enter space-y-4">
            <AppHeader profile={profile} />

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Saját fiók</div>
                        <h1>Fiók</h1>
                        <p>Profiladatok, jelszó és munkamenet-kezelés egy helyen.</p>
                    </div>
                    <div className="info-strip">
                        <span>E-mail: {profile.email}</span>
                        <span>Szerepkör: {profile.role === "OWNER" ? "Tulajdonos" : profile.role === "TENANT" ? "Bérlő" : "Admin"}</span>
                        {(profile.available_roles?.length ?? 0) > 1 ? (
                            <span>Elérhető nézetek: {profile.available_roles?.map((role) => role === "OWNER" ? "Tulajdonos" : role === "TENANT" ? "Bérlő" : "Admin").join(", ")}</span>
                        ) : null}
                    </div>
                </div>
            </section>

            {message ? (
                <div className={`card ${status === "error" ? "text-red-600" : "text-green-600"}`}>
                    {message}
                </div>
            ) : null}

            <form action={updateProfile} className="card form-shell">
                <div className="card-title">Saját adatok</div>
                <div className="form-panel">
                    <label className="field-stack">
                        <span className="field-label">Teljes név</span>
                        <input
                            name="full_name"
                            placeholder="Teljes név"
                            className="input"
                            defaultValue={profile.full_name ?? ""}
                            required
                        />
                    </label>
                </div>
                <PendingSubmitButton className="btn btn-primary" label="Név mentése" pendingLabel="Mentés..." />
            </form>

            <form action={updatePassword} className="card form-shell">
                <div className="card-title">Jelszó módosítása</div>
                <div className="form-panel">
                    <div className="form-grid">
                        <label className="field-stack">
                            <span className="field-label">Új jelszó</span>
                            <input
                                name="password"
                                type="password"
                                placeholder="Új jelszó"
                                className="input"
                                required
                            />
                        </label>
                        <label className="field-stack">
                            <span className="field-label">Megerősítés</span>
                            <input
                                name="password_confirm"
                                type="password"
                                placeholder="Új jelszó még egyszer"
                                className="input"
                                required
                            />
                        </label>
                    </div>
                </div>
                <PendingSubmitButton className="btn btn-primary" label="Jelszó mentése" pendingLabel="Mentés..." />
            </form>

            <form action={logout} className="card form-shell">
                <div className="card-title">Munkamenet</div>
                <p className="muted-note">Ha közösen használt gépen dolgozol, érdemes kijelentkezni a végén.</p>
                <PendingSubmitButton className="btn btn-secondary" label="Kijelentkezés" pendingLabel="Kilépés..." />
            </form>

            <section className="card form-shell">
                <div className="card-title">Dokumentumok letöltése</div>
                <p className="muted-note">
                    Egy gombbal le tudod tölteni a profilodhoz tartozó dokumentumokat ZIP-ben.
                </p>
                <a className="btn btn-secondary" href="/api/account/documents/export">
                    Dokumentumok letöltése
                </a>
            </section>

            {tenantOnly ? (
                <>
                    <section className="card form-shell">
                        <div className="card-title">Aktív ingatlan-hozzárendelések</div>
                        {tenantProperties.length === 0 ? (
                            <p className="muted-note">Nincs aktív hozzárendelésed. A végleges törlés már engedélyezett.</p>
                        ) : (
                            <div className="charge-list">
                                {tenantProperties.map((property) => (
                                    <div key={property.id} className="charge-card">
                                        <div className="card-title">{property.name}</div>
                                        <div className="text-sm text-gray-600">{property.address}</div>
                                        <div className="muted-note">
                                            Bérbeadó: {property.owner_name || property.owner_email || "ismeretlen"}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="card form-shell">
                        <div className="card-title">Kilépési kérelmek</div>
                        {(pendingExitRequests ?? []).length === 0 ? (
                            <p className="muted-note">Még nincs függő kilépési kérelmed.</p>
                        ) : (
                            <div className="charge-list">
                                {(pendingExitRequests ?? []).map((request) => {
                                    const property = Array.isArray(request.properties) ? request.properties[0] : request.properties;
                                    return (
                                        <div key={request.property_id} className="charge-card">
                                            <div className="card-title">{property?.name || "Ingatlan"}</div>
                                            {property?.address ? <div className="text-sm text-gray-600">{property.address}</div> : null}
                                            <div className="muted-note">Jóváhagyásra vár</div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {tenantProperties.length > 0 ? (
                        <form action={requestTenantProfileDeletion} className="card form-shell">
                            <div className="card-title">Kilépési kérelmek küldése</div>
                            <p className="muted-note">
                                A végleges törlés előtt minden ingatlanról le kell kerülnöd. A kérelmet az adott bérbeadó hagyja jóvá.
                            </p>
                            <PendingSubmitButton className="btn btn-danger" label="Kilépési kérelmek küldése" pendingLabel="Küldés..." />
                        </form>
                    ) : (
                        <form action={deleteProfile} className="card form-shell">
                            <div className="card-title">Profil végleges törlése</div>
                            <p className="muted-note">
                                Mivel már nincs aktív ingatlan-hozzárendelésed, a bérlői fiókot végleg törölheted. A dokumentumok megmaradnak a bérbeadónál.
                            </p>
                            <label className="field-stack">
                                <span className="field-label">Megerősítés</span>
                                <input
                                    name="confirmation"
                                    className="input"
                                    placeholder="Írd be pontosan: DELETE"
                                    required
                                />
                            </label>
                            <PendingSubmitButton className="btn btn-danger" label="Profil végleges törlése" pendingLabel="Törlés..." />
                        </form>
                    )}
                </>
            ) : (
                <form action={deleteProfile} className="card form-shell">
                    <div className="card-title">Profil végleges törlése</div>
                    <p className="muted-note">
                        Ez a művelet törli a fiókodat és az ownerként hozzád tartozó dokumentumokat is. Nem visszavonható.
                    </p>
                    <label className="field-stack">
                        <span className="field-label">Megerősítés</span>
                        <input
                            name="confirmation"
                            className="input"
                            placeholder="Írd be pontosan: DELETE"
                            required
                        />
                    </label>
                    <PendingSubmitButton className="btn btn-danger" label="Profil végleges törlése" pendingLabel="Törlés..." />
                </form>
            )}
        </main>
    );
}
