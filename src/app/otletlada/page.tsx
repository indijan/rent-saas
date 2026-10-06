import PublicHeader from "@/components/PublicHeader";
import PublicPageEnhancements from "@/components/PublicPageEnhancements";
import IdeaBoxForm from "@/components/IdeaBoxForm";
import { getSignedInDashboardHref } from "@/lib/auth/getDashboardHref";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestAuthContext } from "@/lib/auth/requestContext";

export default async function IdeaBoxPage() {
    const [dashboardHref, { userId }] = await Promise.all([
        getSignedInDashboardHref(),
        getRequestAuthContext(),
    ]);
    const admin = createSupabaseAdminClient();

    let defaultEmail = "";
    let defaultName = "";

    if (userId) {
        const { data: profile } = await admin
            .from("profiles")
            .select("email,full_name")
            .eq("id", userId)
            .maybeSingle();
        defaultEmail = String(profile?.email || "");
        defaultName = String(profile?.full_name || "");
    }

    return (
        <main className="app-shell page-enter space-y-4">
            <PublicHeader dashboardHref={dashboardHref} />
            <PublicPageEnhancements />

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Ötletláda</div>
                        <h1>Nem egy rugalmatlan, elavult rendszer.</h1>
                        <p>
                            A Rentapp a bérbeadók visszajelzései alapján folyamatosan fejlődik.
                            Ha egy funkció hiányzik, nem megfelelően működik, vagy egyszerűen jobb lenne másképp,
                            itt közvetlenül megírhatod.
                        </p>
                    </div>
                </div>
                <div className="info-strip">
                    <span>Visszajelzés-alapú fejlesztés</span>
                    <span>Valódi használati igényekre reagálunk</span>
                    <span>Ha többen kérik, külön díj nélkül belefejlesztjük</span>
                </div>
            </section>

            <IdeaBoxForm
                eyebrow="Javaslatküldés"
                title="Mondd el, mire lenne szükséged."
                description="Lehet új funkció, finomítás, hiba, vagy egyszerűen egy jobb működési ötlet. A lényeg, hogy valós használati helyzetből jöjjön."
                pageContext="idea-box-page"
                defaultEmail={defaultEmail}
                defaultName={defaultName}
                lockIdentity={Boolean(defaultEmail)}
            />
        </main>
    );
}
