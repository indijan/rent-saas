import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import { getSignedInDashboardHref } from "@/lib/auth/getDashboardHref";

export default async function PricingPage() {
    const dashboardHref = await getSignedInDashboardHref();

    return (
        <main className="app-shell page-enter space-y-4">
            <PublicHeader dashboardHref={dashboardHref} />

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Használati díj</div>
                        <h1>Sávos, ingatlanalapú díjazás</h1>
                        <p>
                            A rendszer díja az ingatlanok számával csökkenő sávokban működik.
                            Nincs külön bérlői díj, a bérlői hozzáférés az ingatlan kezelésének része.
                        </p>
                    </div>
                </div>
                <div className="kpi-grid stagger">
                    <div className="kpi-card">
                        <div className="kpi-label">1-3 ingatlan</div>
                        <div className="kpi-value">3 000 Ft</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">4-9 ingatlan</div>
                        <div className="kpi-value">2 000 Ft</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">10+ ingatlan</div>
                        <div className="kpi-value">1 000 Ft</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Elszámolás alapja</div>
                        <div className="kpi-value">ingatlan / hó</div>
                    </div>
                </div>
            </section>

            <section className="card section-stack">
                <div className="card-title">Mit tartalmaz?</div>
                <div className="feature-list">
                    <div className="feature-item">Tulajdonosi felület ingatlanokhoz, bérlőkhöz és díjakhoz.</div>
                    <div className="feature-item">Bérlői felület dokumentumokkal és státuszkövetéssel.</div>
                    <div className="feature-item">Automatikus számlaimport piszkozatmódban, kézi kontrollal.</div>
                    <div className="feature-item">Mobilbarát kezelőfelület és egységes admin logika.</div>
                    <div className="feature-item">A bérlői hozzáférés minden csomagban benne van, külön díj nélkül.</div>
                </div>
                <div className="charge-actions">
                    <Link className="btn btn-primary" href="/berbeadoi-regisztracio">Bérbeadói regisztráció</Link>
                    <Link className="btn btn-secondary" href="/funkciok">Teljes feature lista</Link>
                </div>
            </section>
        </main>
    );
}
