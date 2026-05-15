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

export default async function PricingPage() {
    const dashboardHref = await getDashboardHref();

    return (
        <main className="app-shell page-enter space-y-4">
            <PublicHeader dashboardHref={dashboardHref} />

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Használati díj</div>
                        <h1>Egyszerű, ingatlanalapú díjazás</h1>
                        <p>
                            A rendszer díja jelenleg <b>3 eHUF / ingatlan / hó</b>.
                            Nincs külön bérlői díj, a bérlői hozzáférés az ingatlan kezelésének része.
                        </p>
                    </div>
                </div>
                <div className="kpi-grid stagger">
                    <div className="kpi-card">
                        <div className="kpi-label">Havidíj</div>
                        <div className="kpi-value">3 eHUF</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Elszámolás alapja</div>
                        <div className="kpi-value">ingatlan / hó</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Bérlői hozzáférés</div>
                        <div className="kpi-value">benne van</div>
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
                </div>
                <div className="charge-actions">
                    <Link className="btn btn-primary" href="/berbeadoi-regisztracio">Bérbeadói regisztráció</Link>
                    <Link className="btn btn-secondary" href="/funkciok">Teljes feature lista</Link>
                </div>
            </section>
        </main>
    );
}
