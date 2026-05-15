import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import PublicHeader from "@/components/PublicHeader";

async function getDashboardHref() {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (!profile) return null;
    if (profile.role === "ADMIN") return "/admin/berlok";
    if (profile.role === "OWNER") return "/owner/properties";
    return "/tenant/charges";
}

const ownerFeatures = [
    "Ingatlanok, bérlők és díjak kezelése egy felületen.",
    "Automatikus számlaimport piszkozatként, kézi ellenőrzés és publikálás előtt.",
    "Dokumentumfeltöltés és számlamellékletek megőrzése charge szinten.",
    "Esedékesség szerinti vizuális jelzés: rendben, közelgő, lejárt.",
    "Éves összesítők és szűrhető díjlista nem az aktuális lapból, hanem a teljes időszakból.",
];

const tenantFeatures = [
    "Áttekinthető saját díjlista lejárati állapotokkal.",
    "Kapcsolódó számladokumentumok megnyitása egy helyről.",
    "Archiválás a rendezett tételeken, tiszta történettel.",
    "Konzisztens mobilnézet és egyszerű, közérthető státuszok minden képernyőn.",
];

export default async function FeaturesPage() {
    const dashboardHref = await getDashboardHref();

    return (
        <main className="app-shell page-enter space-y-4">
            <PublicHeader dashboardHref={dashboardHref} />

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Funkciók</div>
                        <h1>Mit tud a Rentapp?</h1>
                        <p>
                            A bérbeadói és a bérlői felületet közös nevezőre hozzuk:
                            ugyanazok a státuszok, ugyanaz a logika, kevesebb félreértés.
                        </p>
                    </div>
                    <div className="info-strip">
                        <span>Az automatikus import nem élesedik magától.</span>
                        <span>A publikálás és a szerkesztés a bérbeadó kezében marad.</span>
                    </div>
                </div>
            </section>

            <section className="grid">
                <article className="card section-stack">
                    <div>
                        <div className="eyebrow">Bérbeadói oldal</div>
                        <h2>Operatív kezelés napi használatra</h2>
                    </div>
                    <div className="feature-list">
                        {ownerFeatures.map((item) => (
                            <div key={item} className="feature-item">{item}</div>
                        ))}
                    </div>
                </article>

                <article className="card section-stack">
                    <div>
                        <div className="eyebrow">Bérlői oldal</div>
                        <h2>Tiszta díjkövetés felesleges zaj nélkül</h2>
                    </div>
                    <div className="feature-list">
                        {tenantFeatures.map((item) => (
                            <div key={item} className="feature-item">{item}</div>
                        ))}
                    </div>
                </article>
            </section>

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="card-title">Árazás és indulás</div>
                        <p className="muted-note">
                            Az induló díj egyszerű: 3 eHUF / ingatlan / hó.
                        </p>
                    </div>
                    <div className="charge-actions">
                        <Link className="btn btn-primary" href="/hasznalati-dij">Használati díj</Link>
                        <Link className="btn btn-secondary" href="/berbeadoi-regisztracio">Bérbeadói regisztráció</Link>
                    </div>
                </div>
            </section>
        </main>
    );
}
