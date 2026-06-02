import Link from "next/link";
import { requireUser } from "@/lib/auth/requireUser";
import { deleteProfile, logout, requestTenantProfileDeletion, sendAccountContactMessage, updatePassword, updateProfile } from "./actions";
import AppHeader from "@/components/AppHeader";
import PendingSubmitButton from "@/components/PendingSubmitButton";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listTenantProperties } from "@/lib/propertyTenants";
import IdeaBoxForm from "@/components/IdeaBoxForm";
import DesignIcon from "@/components/dashboard/DesignIcon";

type Props = {
    searchParams?: Promise<{ status?: string; message?: string }> | { status?: string; message?: string };
};

function roleLabel(role: "OWNER" | "TENANT" | "ADMIN") {
    return role === "OWNER" ? "Bérbeadó" : role === "TENANT" ? "Bérlő" : "Admin";
}

export default async function AccountPage({ searchParams }: Props) {
    const { supabase, user, profile } = await requireUser();
    const sp = (searchParams instanceof Promise) ? await searchParams : (searchParams ?? {});
    const status = sp.status ? String(sp.status) : "";
    const message = sp.message ? String(sp.message) : "";
    const isTenantView = profile.role === "TENANT";
    const tenantOnly = profile.role === "TENANT" && (profile.available_roles?.length ?? 0) === 1;
    const admin = createSupabaseAdminClient();
    const tenantProperties = isTenantView ? await listTenantProperties(user.id) : [];
    const { data: pendingExitRequests } = isTenantView
        ? await admin
            .from("tenant_exit_requests")
            .select("property_id,status,properties(name,address)")
            .eq("tenant_id", user.id)
            .eq("status", "PENDING")
        : { data: [] };

    const [{ count: ownedPropertyCount }, { count: ownedTenantCount }] = profile.role === "OWNER"
        ? await Promise.all([
            supabase.from("properties").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
            admin.from("tenant_memberships").select("user_id", { count: "exact", head: true }).eq("owner_id", user.id),
        ])
        : [{ count: 0 }, { count: 0 }];
    const distinctTenantOwnerCount = isTenantView
        ? new Set(
            tenantProperties.map((property) => property.owner_id || property.owner_email || property.owner_name || property.id)
        ).size
        : 0;
    const pendingExitPropertyIds = new Set((pendingExitRequests ?? []).map((request) => request.property_id));

    const currentRoleLabel = roleLabel(profile.role);
    const availableRoleLabels = (profile.available_roles ?? []).map(roleLabel);
    const hasOwnerRole = (profile.available_roles ?? []).includes("OWNER");
    const hasTenantRole = (profile.available_roles ?? []).includes("TENANT");
    const mixedRoleAccount = hasOwnerRole && hasTenantRole;
    const primaryMetricValue = profile.role === "OWNER"
        ? String(ownedPropertyCount ?? 0)
        : profile.role === "TENANT"
            ? String(tenantProperties.length)
            : String(availableRoleLabels.length);
    const primaryMetricLabel = profile.role === "OWNER"
        ? "Kezelt ingatlan"
        : profile.role === "TENANT"
            ? "Aktív hozzárendelés"
            : "Aktív szerepkör";
    const secondaryMetricValue = profile.role === "OWNER"
        ? String(ownedTenantCount ?? 0)
        : profile.role === "TENANT"
            ? String(distinctTenantOwnerCount)
            : profile.email;
    const secondaryMetricLabel = profile.role === "OWNER"
        ? "Kapcsolt bérlő"
        : profile.role === "TENANT"
            ? "Bérbeadó kapcsolat"
            : "Belépési e-mail";
    const quickLinks = profile.role === "OWNER"
        ? [
            { href: "/owner/properties", label: "Ingatlanok" },
            { href: "/owner/charges?compose=manual", label: "Új tétel" },
            { href: "/owner/charges?compose=upload", label: "PDF feltöltés" },
        ]
        : profile.role === "TENANT"
            ? [
                { href: "/tenant/charges", label: "Díjak" },
                { href: "/account#kilepesi-kerelem-kuldes", label: "Kilépés ingatlanból" },
            ]
            : [{ href: "/valassz-nezetet", label: "Nézetváltás" }];

    return (
        <main className="app-shell page-enter space-y-4">
            <AppHeader profile={profile} />

            <div className="dashboard-stack">
                <section className="card dashboard-section-card account-hero-card">
                    <div className="dashboard-page-header">
                        <div>
                            <div className="eyebrow">Fiók központ</div>
                            <h1>{profile.full_name || "Saját profil"}</h1>
                            <p>Profil, biztonság, dokumentumok, visszajelzés és közvetlen kapcsolat egy privát dashboard nézetben.</p>
                        </div>
                        <div className="account-hero-badge">
                            <strong>{currentRoleLabel}</strong>
                            <span>{profile.email}</span>
                        </div>
                    </div>

                    <div className="account-jump-links">
                        <a href="#profil" className="btn btn-secondary">Profil</a>
                        <a href="#biztonsag" className="btn btn-secondary">Biztonság</a>
                        {isTenantView ? <a href="#kilepesi-kerelem-kuldes" className="btn btn-secondary">Kilépés</a> : null}
                        <a href="#otletlada" className="btn btn-secondary">Ötletláda</a>
                        <a href="#kapcsolat" className="btn btn-secondary">Kapcsolat</a>
                    </div>

                    <div className="account-stat-grid">
                        <article className="account-stat-card">
                            <span className="account-stat-label">Aktív nézet</span>
                            <strong>{currentRoleLabel}</strong>
                            <span>{availableRoleLabels.join(" · ")}</span>
                        </article>
                        <article className="account-stat-card">
                            <span className="account-stat-label">{primaryMetricLabel}</span>
                            <strong>{primaryMetricValue}</strong>
                            <span>{profile.role === "OWNER" ? "Portfólió szintű menedzsment" : profile.role === "TENANT" ? "Bérlői hozzáférések" : "Elérhető szerepkörök"}</span>
                        </article>
                        <article className="account-stat-card">
                            <span className="account-stat-label">{secondaryMetricLabel}</span>
                            <strong>{secondaryMetricValue}</strong>
                            <span>{profile.role === "OWNER" ? "A jelenlegi bérlői kapcsolataid" : profile.role === "TENANT" ? "Aktív bérbeadói kapcsolatok" : "Azonosított bejelentkezés"}</span>
                        </article>
                    </div>
                </section>

                {message ? (
                    <div className={`card dashboard-section-card account-status-card ${status === "error" ? "text-red-600" : "text-green-600"}`}>
                        {message}
                    </div>
                ) : null}

                <section className="dashboard-widget-grid account-widget-grid">
                    <article className="card dashboard-section-card">
                        <div className="widget-header">
                            <div>
                                <div className="card-title">Profil összefoglaló</div>
                                <p>Minden fontos account-információ egy helyen, a jelenlegi nézethez igazítva.</p>
                            </div>
                            <DesignIcon name="level" alt="Profil" tone="design-icon-badge-blue" size={52} />
                        </div>
                        <div className="account-profile-list">
                            <div><span>Név</span><strong>{profile.full_name || "Nincs beállítva"}</strong></div>
                            <div><span>E-mail</span><strong>{profile.email}</strong></div>
                            <div><span>Aktív szerepkör</span><strong>{currentRoleLabel}</strong></div>
                            <div><span>Elérhető nézetek</span><strong>{availableRoleLabels.join(", ")}</strong></div>
                        </div>
                    </article>

                    <article className="card dashboard-section-card">
                        <div className="widget-header">
                            <div>
                                <div className="card-title">Gyors műveletek</div>
                                <p>Innen nem a publikus oldalra kerülsz, hanem a belső workflowkra.</p>
                            </div>
                            <DesignIcon name="kozelgo_feladatok" alt="Gyors műveletek" tone="design-icon-badge-amber" size={52} />
                        </div>
                        <div className="account-quick-grid">
                            {quickLinks.map((item) => (
                                <Link key={item.href} href={item.href} className="account-quick-link">
                                    {item.label}
                                </Link>
                            ))}
                            <a href="#otletlada" className="account-quick-link">Ötletláda</a>
                            <a href="#kapcsolat" className="account-quick-link">Kapcsolat</a>
                        </div>
                    </article>

                    <article className="card dashboard-section-card">
                        <div className="widget-header">
                            <div>
                                <div className="card-title">Támogatási csatornák</div>
                                <p>Gyors kapcsolatfelvétel vagy dokumentum-export ugyanebből a privát shellből.</p>
                            </div>
                            <DesignIcon name="level" alt="Kapcsolat" tone="design-icon-badge-purple" size={52} />
                        </div>
                        <div className="account-channel-stack">
                            <a className="account-channel-card" href="https://wa.me/64275665850" target="_blank" rel="noreferrer">
                                <strong>WhatsApp</strong>
                                <span>Gyors mobilos egyeztetés</span>
                            </a>
                            <a className="account-channel-card" href="https://m.me/indijanmac" target="_blank" rel="noreferrer">
                                <strong>Messenger</strong>
                                <span>Közvetlen chat a böngészőből</span>
                            </a>
                            <a className="account-channel-card" href="/api/account/documents/export">
                                <strong>Dokumentumok letöltése</strong>
                                <span>ZIP export egy kattintással</span>
                            </a>
                        </div>
                    </article>
                </section>

                <div className="dashboard-split-grid account-form-grid">
                    <form id="profil" action={updateProfile} className="card dashboard-section-card form-shell">
                        <div className="dashboard-section-head">
                            <div>
                                <div className="card-title">Saját adatok</div>
                                <p>Az itt mentett név jelenik meg a shellben, meghívásoknál és a belső kommunikációban.</p>
                            </div>
                        </div>
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

                    <section className="card dashboard-section-card account-security-stack">
                        <div className="dashboard-section-head">
                            <div>
                                <div className="card-title">Munkamenet és fájlok</div>
                                <p>Kilépés, dokumentum-export és gyors housekeeping ugyanebből a panelből.</p>
                            </div>
                        </div>
                        <div className="account-utility-actions">
                            <a className="btn btn-secondary" href="/api/account/documents/export">
                                Dokumentumok letöltése
                            </a>
                            <form action={logout}>
                                <PendingSubmitButton className="btn btn-secondary" label="Kijelentkezés" pendingLabel="Kilépés..." />
                            </form>
                        </div>
                        <p className="muted-note">Ha közösen használt gépen dolgozol, érdemes kijelentkezni a végén.</p>
                    </section>
                </div>

                <div className="dashboard-split-grid account-form-grid">
                    <form id="biztonsag" action={updatePassword} className="card dashboard-section-card form-shell">
                        <div className="dashboard-section-head">
                            <div>
                                <div className="card-title">Biztonság</div>
                                <p>A jelszóváltás rögtön a jelenlegi fiókra megy rá, külön megerősítő kör nélkül.</p>
                            </div>
                        </div>
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

                    {isTenantView ? (
                        <section className="card dashboard-section-card">
                            <div className="dashboard-section-head">
                                <div>
                                    <div className="card-title">Bérlői kapcsolatok</div>
                                    <p>Innen látszik, hány ingatlanhoz és hány külön bérbeadóhoz tartozik a jelenlegi bérlői nézet.</p>
                                </div>
                            </div>
                            <div className="account-profile-list">
                                <div><span>Aktív ingatlan</span><strong>{tenantProperties.length}</strong></div>
                                <div><span>Bérbeadó kapcsolat</span><strong>{distinctTenantOwnerCount}</strong></div>
                            </div>
                        </section>
                    ) : (
                        <section className="card dashboard-section-card">
                            <div className="dashboard-section-head">
                                <div>
                                    <div className="card-title">Owner áttekintés</div>
                                    <p>A portfólió gyors állapota az account oldalról is látszik.</p>
                                </div>
                            </div>
                            <div className="account-profile-list">
                                <div><span>Kezelt ingatlan</span><strong>{ownedPropertyCount ?? 0}</strong></div>
                                <div><span>Kapcsolt bérlő</span><strong>{ownedTenantCount ?? 0}</strong></div>
                            </div>
                        </section>
                    )}
                </div>

                <div id="otletlada">
                    <IdeaBoxForm
                        eyebrow="Ötletláda"
                        title="Mondj véleményt a rendszerről."
                        description="Ha hiányzik egy funkció, valami nem jól működik, vagy másképp lenne használhatóbb, itt közvetlenül megírhatod."
                        pageContext="account"
                        defaultEmail={profile.email}
                        defaultName={profile.full_name}
                        lockIdentity
                    />
                </div>

                <section id="kapcsolat" className="card dashboard-section-card account-contact-shell">
                    <div className="dashboard-section-head">
                        <div>
                            <div className="eyebrow">Kapcsolat</div>
                            <div className="card-title">Közvetlen üzenetküldés a profilból</div>
                            <p>Mivel be vagy jelentkezve, nem kell újra megadnod az elérhetőségeidet. Elég leírni az üzenetet és küldeni.</p>
                        </div>
                        <DesignIcon name="level" alt="Kapcsolat" tone="design-icon-badge-blue" size={56} />
                    </div>
                    <div className="account-contact-layout">
                        <div className="account-channel-stack">
                            <a className="account-channel-card" href="https://wa.me/64275665850" target="_blank" rel="noreferrer">
                                <strong>WhatsApp</strong>
                                <span>Gyors egyeztetés mobilon</span>
                            </a>
                            <a className="account-channel-card" href="https://m.me/indijanmac" target="_blank" rel="noreferrer">
                                <strong>Messenger</strong>
                                <span>Közvetlen chat Facebook nélkül</span>
                            </a>
                            <div className="account-identity-card">
                                <span>Azonosított feladó</span>
                                <strong>{profile.full_name || profile.email}</strong>
                                <small>{profile.email}</small>
                            </div>
                        </div>

                        <form action={sendAccountContactMessage} className="account-contact-form">
                            <div className="form-grid">
                                <label className="field-stack">
                                    <span className="field-label">Téma</span>
                                    <select name="topic" className="select" defaultValue="Kapcsolat">
                                        <option value="Kapcsolat">Kapcsolat</option>
                                        <option value="Bug riport">Bug riport</option>
                                        <option value="Feature kérés">Feature kérés</option>
                                        <option value="Számlázás">Számlázás</option>
                                    </select>
                                </label>
                            </div>
                            <label className="field-stack">
                                <span className="field-label">Üzenet</span>
                                <textarea
                                    name="message"
                                    className="textarea"
                                    rows={7}
                                    placeholder="Írd le röviden, miben tudunk segíteni."
                                    required
                                />
                            </label>
                            <div className="charge-actions">
                                <PendingSubmitButton className="btn btn-primary" label="Üzenet küldése" pendingLabel="Küldés..." />
                                <span className="muted-note">Az üzenet azonosított account-adatokkal megy ki az indijanmac@gmail.com címre.</span>
                            </div>
                        </form>
                    </div>
                </section>

                {isTenantView ? (
                    <>
                        {tenantProperties.length > 0 ? (
                            <section id="kilepesi-kerelem-kuldes" className="card dashboard-section-card form-shell">
                                <div className="dashboard-section-head">
                                    <div>
                                        <div className="card-title">Aktív ingatlan-hozzárendelések</div>
                                        <p>Itt látod, melyik bérbeadói portfóliókhoz vagy jelenleg kapcsolva, és ugyanitt tudsz ingatlanonként kilépési kérelmet küldeni.</p>
                                    </div>
                                </div>
                                <div className="account-card-list">
                                    {tenantProperties.map((property) => {
                                        const hasPendingExit = pendingExitPropertyIds.has(property.id);
                                        return (
                                            <form key={property.id} action={requestTenantProfileDeletion} className="account-list-card account-inline-form-card">
                                                <div className="account-inline-form-copy">
                                                    <strong>{property.name}</strong>
                                                    <span>{property.address}</span>
                                                    <small>Bérbeadó: {property.owner_name || property.owner_email || "ismeretlen"}</small>
                                                    <small className={hasPendingExit ? "text-amber-600" : undefined}>
                                                        {hasPendingExit ? "Ehhez az ingatlanhoz már folyamatban van egy kilépési kérelmed." : "A kérelem a bérbeadó jóváhagyására vár majd."}
                                                    </small>
                                                </div>
                                                <input type="hidden" name="property_id" value={property.id} />
                                                <PendingSubmitButton
                                                    className={`btn btn-sm ${hasPendingExit ? "btn-secondary" : "btn-danger"}`}
                                                    label={hasPendingExit ? "Kérelem folyamatban" : "Kilépési kérelem küldése"}
                                                    pendingLabel="Küldés..."
                                                    disabled={hasPendingExit}
                                                />
                                            </form>
                                        );
                                    })}
                                </div>
                                {tenantProperties.length > 1 && pendingExitPropertyIds.size === 0 ? (
                                    <form action={requestTenantProfileDeletion} className="account-exit-all-form">
                                        <input type="hidden" name="property_id" value="ALL" />
                                        <PendingSubmitButton className="btn btn-danger" label="Kilépési kérelmek küldése minden ingatlanra" pendingLabel="Küldés..." />
                                    </form>
                                ) : null}
                            </section>
                        ) : tenantOnly ? (
                            <form action={deleteProfile} className="card dashboard-section-card form-shell">
                                <div className="dashboard-section-head">
                                    <div>
                                        <div className="card-title">Profil végleges törlése</div>
                                        <p>Mivel már nincs aktív ingatlan-hozzárendelésed, a bérlői fiókot végleg törölheted. A dokumentumok megmaradnak a bérbeadónál.</p>
                                    </div>
                                </div>
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
                        ) : (
                            <section id="kilepesi-kerelem-kuldes" className="card dashboard-section-card">
                                <div className="dashboard-section-head">
                                    <div>
                                        <div className="card-title">Kilépés ingatlanból</div>
                                        <p>Ebben a bérlői nézetben jelenleg nincs aktív ingatlan-hozzárendelésed, ezért nincs küldhető kilépési kérelem.</p>
                                    </div>
                                </div>
                            </section>
                        )}
                    </>
                ) : (
                    <>
                        <form action={deleteProfile} className="card dashboard-section-card form-shell">
                            <div className="dashboard-section-head">
                                <div>
                                    <div className="card-title">Profil végleges törlése</div>
                                    <p>Ez a művelet törli a teljes fiókodat és minden hozzá tartozó adatot. Nem visszavonható.</p>
                                </div>
                            </div>
                            <input type="hidden" name="scope" value="ACCOUNT" />
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
                    </>
                )}

                {mixedRoleAccount ? (
                    <section className="card dashboard-section-card">
                        <div className="dashboard-section-head">
                            <div>
                                <div className="card-title">Szerepkörök külön törlése</div>
                                <p>Ha ugyanazzal a fiókkal bérbeadóként és bérlőként is jelen vagy, a két profilt külön is törölheted.</p>
                            </div>
                        </div>
                        <div className="account-card-list">
                            <form action={deleteProfile} className="account-list-card account-inline-form-card">
                                <div className="account-inline-form-copy">
                                    <strong>Bérbeadói profil törlése</strong>
                                    <span>A kezelt ingatlanok, díjak és dokumentumok is törlődnek, a bérlői hozzáférésed megmarad.</span>
                                </div>
                                <input type="hidden" name="scope" value="OWNER_ROLE" />
                                <input type="hidden" name="confirmation" value="DELETE" />
                                <PendingSubmitButton className="btn btn-danger btn-sm" label="Bérbeadói profil törlése" pendingLabel="Törlés..." />
                            </form>
                            <form action={deleteProfile} className="account-list-card account-inline-form-card">
                                <div className="account-inline-form-copy">
                                    <strong>Bérlői profil törlése</strong>
                                    <span>Csak akkor törölhető külön, ha már nincs aktív ingatlan-hozzárendelésed.</span>
                                </div>
                                <input type="hidden" name="scope" value="TENANT_ROLE" />
                                <input type="hidden" name="confirmation" value="DELETE" />
                                <PendingSubmitButton className="btn btn-danger btn-sm" label="Bérlői profil törlése" pendingLabel="Törlés..." />
                            </form>
                        </div>
                    </section>
                ) : null}
            </div>
        </main>
    );
}
