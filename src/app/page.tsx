import PublicHeader from "@/components/PublicHeader";
import Link from "next/link";
import { getSignedInDashboardHref } from "@/lib/auth/getDashboardHref";

export default async function HomePage() {
    const dashboardHref = await getSignedInDashboardHref();

    return (
        <main className="app-shell page-enter space-y-4">
            <PublicHeader dashboardHref={dashboardHref} />

            <section className="card hero-marketing">
                <div className="hero-copy">
                    <div className="eyebrow">Rentapp</div>
                    <h1>Rendezett bérbeadás, kontrollált számlakezelés.</h1>
                    <p>
                        A tulajdonosi és a bérlői felületet közös nevezőre hozzuk:
                        egyértelmű státuszok, tiszta díjkezelés, mobilon is használható admin.
                    </p>
                    <div className="charge-actions">
                        <Link className="btn btn-primary" href="/berbeadoi-regisztracio">Bérbeadói regisztráció</Link>
                        <Link className="btn btn-secondary" href="/funkciok">Teljes feature lista</Link>
                        <Link className="btn btn-secondary" href="/hasznalati-dij">Használati díj</Link>
                    </div>
                </div>
                <div className="hero-panel">
                    <div className="kpi-card">
                        <div className="kpi-label">Használati díj</div>
                        <div className="kpi-value">1 000-3 000 Ft / ingatlan / hó</div>
                    </div>
                    <div className="feature-list">
                        <div className="feature-item">Automatikus számlaimport piszkozatként, nem azonnali élesítéssel.</div>
                        <div className="feature-item">Tulajdonosi és bérlői nézet ugyanazzal a státuszlogikával.</div>
                        <div className="feature-item">Mobilra igazított kezelés, egyértelmű akciókkal.</div>
                    </div>
                </div>
            </section>

            <section className="grid">
                <article className="card section-stack">
                    <div className="eyebrow">Bérbeadóknak</div>
                    <h2>Ingatlanok, bérlők és díjak egy felületen</h2>
                    <p>
                        A rendszerben a számlák, feltöltött dokumentumok, státuszok és éves összesítők
                        ugyanott kezelhetők, külön háttérrendszeres kerülőutak nélkül.
                    </p>
                    <p className="muted-note">Sávos díjazás: 1-3 ingatlan 3 000 Ft, 4-9 ingatlan 2 000 Ft, 10+ ingatlan 1 000 Ft / ingatlan / hó.</p>
                </article>
                <article className="card section-stack">
                    <div className="eyebrow">Bérlőknek</div>
                    <h2>Nyitott, fizetett és archivált tételek tiszta bontásban</h2>
                    <p>
                        A bérlő csak a saját díjait és a hozzájuk tartozó dokumentumokat látja,
                        lejárati jelzésekkel és mobilon is olvasható nézetben.
                    </p>
                </article>
            </section>
        </main>
    );
}
