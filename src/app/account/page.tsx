import { requireUser } from "@/lib/auth/requireUser";
import { deleteProfile, logout, requestTenantProfileDeletion, updatePassword, updateProfile } from "./actions";
import AppHeader from "@/components/AppHeader";

type Props = {
    searchParams?: Promise<{ status?: string; message?: string }> | { status?: string; message?: string };
};

export default async function AccountPage({ searchParams }: Props) {
    const { profile } = await requireUser();
    const sp = (searchParams instanceof Promise) ? await searchParams : (searchParams ?? {});
    const status = sp.status ? String(sp.status) : "";
    const message = sp.message ? String(sp.message) : "";
    const tenantOnly = profile.role === "TENANT" && (profile.available_roles?.length ?? 0) === 1;

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
                <button type="submit" className="btn btn-primary">
                    Név mentése
                </button>
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
                <button type="submit" className="btn btn-primary">
                    Jelszó mentése
                </button>
            </form>

            <form action={logout} className="card form-shell">
                <div className="card-title">Munkamenet</div>
                <p className="muted-note">Ha közösen használt gépen dolgozol, érdemes kijelentkezni a végén.</p>
                <button type="submit" className="btn btn-secondary">
                    Kijelentkezés
                </button>
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
                <form action={requestTenantProfileDeletion} className="card form-shell">
                    <div className="card-title">Profil törlési kérelem</div>
                    <p className="muted-note">
                        Bérlőként közvetlen törlés helyett törlési kérelmet tudsz küldeni a bérbeadódnak.
                    </p>
                    <button type="submit" className="btn btn-danger">
                        Törlési kérelem küldése
                    </button>
                </form>
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
                    <button type="submit" className="btn btn-danger">
                        Profil végleges törlése
                    </button>
                </form>
            )}
        </main>
    );
}
