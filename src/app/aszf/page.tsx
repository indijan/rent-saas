import PublicHeader from "@/components/PublicHeader";
import PublicPageEnhancements from "@/components/PublicPageEnhancements";
import { getSignedInDashboardHref } from "@/lib/auth/getDashboardHref";

export default async function TermsPage() {
    const dashboardHref = await getSignedInDashboardHref();

    return (
        <main className="app-shell page-enter space-y-4">
            <PublicHeader dashboardHref={dashboardHref} />
            <PublicPageEnhancements />

            <section className="card section-stack">
                <div className="eyebrow">ÁSZF</div>
                <h1>Általános szerződési feltételek</h1>
                <p>
                    Ez egy rövid, általános tájékoztató a Rentapp publikus oldalának és szolgáltatásának alapvető használati szabályairól.
                    Nem részletes jogi dokumentum, hanem közérthető összefoglaló.
                </p>
            </section>

            <section className="card section-stack">
                <h2>1. A szolgáltatás lényege</h2>
                <p>
                    A Rentapp bérbeadók és bérlők számára készült digitális rendszer. A célja, hogy a bérbeadással kapcsolatos
                    adminisztrációt, díjkezelést, dokumentumokat és kommunikációs folyamatokat egy helyen segítse kezelni.
                </p>
            </section>

            <section className="card section-stack">
                <h2>2. Használat</h2>
                <p>
                    A publikus oldal tájékoztató jellegű. A rendszer zárt részei csak jogosult felhasználók számára érhetők el.
                    A szolgáltatás használata során a felhasználó felel azért, hogy valós és pontos adatokat adjon meg.
                </p>
            </section>

            <section className="card section-stack">
                <h2>3. Fiókok és hozzáférések</h2>
                <p>
                    A hozzáférések személyhez kötöttek. A felhasználó felel a belépési adatainak biztonságos kezeléséért.
                    Jogosulatlan hozzáférés vagy visszaélés gyanúja esetén a hozzáférést korlátozhatjuk vagy megszüntethetjük.
                </p>
            </section>

            <section className="card section-stack">
                <h2>4. Beküldött tartalmak</h2>
                <p>
                    A felhasználó felel az általa feltöltött dokumentumokért, adatokért és üzenetekért. A Rentapp technikai
                    segítséget és automatizációt nyújt, de a feltöltött számlák, díjak és adatok végső ellenőrzése továbbra is a felhasználó feladata.
                </p>
            </section>

            <section className="card section-stack">
                <h2>5. Folyamatos fejlesztés</h2>
                <p>
                    A szolgáltatás folyamatosan fejlődik. A funkciók, megjelenés vagy működés változhat annak érdekében,
                    hogy a rendszer pontosabb, gyorsabb és használhatóbb legyen.
                </p>
            </section>

            <section className="card section-stack">
                <h2>6. Felelősség</h2>
                <p>
                    A Rentapp törekszik a megbízható működésre, de technikai hiba, kimaradás vagy külső szolgáltatótól eredő fennakadás előfordulhat.
                    A szolgáltatás használata során hozott pénzügyi vagy adminisztratív döntésekért a felhasználó felel.
                </p>
            </section>

            <section className="card section-stack">
                <h2>7. Kapcsolat</h2>
                <p>
                    Ha kérdésed van a szolgáltatással, működéssel vagy adatokkal kapcsolatban, a publikus oldalon elérhető kapcsolatfelvételi
                    csatornákon tudsz jelezni.
                </p>
            </section>
        </main>
    );
}
