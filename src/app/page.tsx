import PublicHeader from "@/components/PublicHeader";
import PublicPageEnhancements from "@/components/PublicPageEnhancements";
import Link from "next/link";
import { getSignedInDashboardHref } from "@/lib/auth/getDashboardHref";

const painPoints = [
    {
        title: "A számlák több helyen vannak",
        body: "Emailben, PDF-ek között, letöltésekben vagy egy random mappában.",
    },
    {
        title: "Határidőket fejben tartasz",
        body: "Ami addig működik, amíg egyszer nem felejtesz el valamit.",
    },
    {
        title: "A bérlő kérdez, te keresel",
        body: "„Elküldted?” „Mennyi volt?” „Mikor esedékes?”",
    },
    {
        title: "A bérbeadás szétszórt káosz",
        body: "WhatsApp. Messenger. Email. Jegyzetek. Naptár.",
    },
];

const coreBlocks = [
    {
        title: "Ingatlanok és bérlők kezelése",
        body: "Lásd egy helyen, melyik ingatlanhoz ki tartozik, milyen tételek nyitottak, milyen dokumentumok vannak feltöltve, és hol van teendő.",
    },
    {
        title: "Számlák AI segítséggel",
        body: "Tölts fel egy PDF-et vagy küldd tovább emailben. A rendszer felismeri a fontos adatokat, előkészíti a tételt, neked csak ellenőrizni és jóváhagyni kell.",
    },
    {
        title: "Teendő dashboard",
        body: "Nem kell emlékezni. A rendszer mutatja a lejárt tételeket, a közelgő fizetéseket, az ellenőrzésre váró importokat és a hiányos beállításokat.",
    },
    {
        title: "Dokumentumok rendszerezetten",
        body: "Szerződések, számlák, kapcsolódó dokumentumok. Nem kell többé azt keresni, hogy valahol megvolt PDF-ben.",
    },
    {
        title: "Bérlői hozzáférés",
        body: "A bérlő csak azt látja, amit kell. Nyitott tételek, dokumentumok, státuszok. Kevesebb felesleges kérdés, kevesebb oda-vissza kommunikáció.",
    },
];

const audiences = [
    {
        title: "Ha egyetlen lakást adsz bérbe",
        body: "Már egy ingatlannál is meglepően sok adminisztráció gyűlik össze.",
    },
    {
        title: "Ha több ingatlanod van",
        body: "Portfólió szinten is átlátható. Nem kell külön rendszerek között ugrálni.",
    },
    {
        title: "Ha nem akarsz fejben projektmenedzser lenni",
        body: "A Rentapp azért van, hogy ne neked kelljen mindent észben tartani.",
    },
];

export default async function HomePage() {
    const dashboardHref = await getSignedInDashboardHref();

    return (
        <main className="app-shell page-enter space-y-4">
            <PublicHeader dashboardHref={dashboardHref} />
            <PublicPageEnhancements />

            <section className="card hero-marketing">
                <div className="hero-copy">
                    <div className="eyebrow">Rentapp</div>
                    <h1>Automate for freedom.</h1>
                    <p className="hero-lead">
                        A Rentapp rendet tesz a bérbeadás körüli káoszban: számlák, bérlők, dokumentumok, határidők és teendők egy rendszerben,
                        hogy a működésed ne rád nehezedjen, hanem helyetted dolgozzon.
                    </p>
                    <div className="hero-copy-note">
                        Kevesebb adminisztráció, kevesebb fejben tartás, több kontroll a teljes bérbeadási működésed fölött.
                    </div>
                    <div className="charge-actions">
                        <Link className="btn btn-primary" href="/berbeadoi-regisztracio">Próbáld ki 30 napig ingyen</Link>
                        <Link className="btn btn-secondary" href="/funkciok">Funkciók megtekintése</Link>
                    </div>
                    <div className="hero-proof-grid">
                        <div className="hero-proof-card">
                            <span className="hero-proof-label">Próbaidő</span>
                            <strong>30 nap ingyen</strong>
                        </div>
                        <div className="hero-proof-card">
                            <span className="hero-proof-label">Használat</span>
                            <strong>Mobilról is kényelmes</strong>
                        </div>
                        <div className="hero-proof-card">
                            <span className="hero-proof-label">Import</span>
                            <strong>AI támogatott számlafeldolgozás</strong>
                        </div>
                        <div className="hero-proof-card">
                            <span className="hero-proof-label">Workspace</span>
                            <strong>Saját landlord rendszer</strong>
                        </div>
                    </div>
                </div>

                <div className="hero-panel">
                    <div className="kpi-card signal-card">
                        <div className="signal-grid">
                            <div className="signal-column signal-column-input">
                                <span className="signal-badge">Bejövő</span>
                                <div className="signal-node">Számlák</div>
                                <div className="signal-node">Határidők</div>
                                <div className="signal-node">Bérlői ügyek</div>
                                <div className="signal-node">Dokumentumok</div>
                            </div>
                            <div className="signal-core">
                                <div className="signal-core-shell">
                                    <div className="signal-core-title">Automation engine</div>
                                    <div className="signal-core-line" />
                                    <p>AI + workflow + emberi kontroll</p>
                                </div>
                            </div>
                            <div className="signal-column signal-column-output">
                                <span className="signal-badge signal-badge-success">Kimenő</span>
                                <div className="signal-node signal-node-success">Kevesebb admin</div>
                                <div className="signal-node signal-node-success">Tisztább döntések</div>
                                <div className="signal-node signal-node-success">Több szabadság</div>
                            </div>
                        </div>
                    </div>
                    <div className="hero-outcomes">
                        <article className="hero-outcome-card">
                            <span className="hero-outcome-dot" aria-hidden="true" />
                            <div>
                                <div className="hero-outcome-title">Számlaimport, ami nem rád borul</div>
                                <p>PDF vagy email alapú számlaimport, AI előkészítéssel és emberi jóváhagyással.</p>
                            </div>
                        </article>
                        <article className="hero-outcome-card">
                            <span className="hero-outcome-dot" aria-hidden="true" />
                            <div>
                                <div className="hero-outcome-title">Minden ügy egy nézetben</div>
                                <p>Nyitott tételek, dokumentumok és bérlői státuszok egy helyen, nem több külön felületen.</p>
                            </div>
                        </article>
                        <article className="hero-outcome-card">
                            <span className="hero-outcome-dot" aria-hidden="true" />
                            <div>
                                <div className="hero-outcome-title">A rendszer szól, mielőtt gond lenne</div>
                                <p>Lejáratok, hiányzó beállítások és importok egy teendő dashboardon.</p>
                            </div>
                        </article>
                    </div>
                </div>
            </section>

            <section className="card section-stack">
                <div>
                    <div className="eyebrow">Ismerős?</div>
                    <h2>A Rentapp ott kezd hasznos lenni, ahol a fejben tartás elfogy.</h2>
                </div>
                <div className="grid">
                    {painPoints.map((item) => (
                        <article key={item.title} className="feature-item">
                            <div className="card-title">{item.title}</div>
                            <p>{item.body}</p>
                        </article>
                    ))}
                </div>
                <p className="card-title">A Rentapp ezt rakja rendbe.</p>
            </section>

            <section className="card section-stack">
                <div>
                    <div className="eyebrow">Minden egy helyen</div>
                    <h2>Minden egy helyen. Végre.</h2>
                </div>
                <div className="grid">
                    {coreBlocks.map((item) => (
                        <article key={item.title} className="feature-item">
                            <div className="card-title">{item.title}</div>
                            <p>{item.body}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="grid">
                <article className="card section-stack">
                    <div className="eyebrow">Kontroll</div>
                    <h2>A saját rendszered. A te kontrolloddal.</h2>
                    <p>
                        A Rentapp nem egy bonyolult könyvelőplatform. Ez a saját személyes landlord workspace-ed,
                        ahol egy helyen rendszerezheted a bérbeadással kapcsolatos adminisztrációdat.
                    </p>
                    <p className="muted-note">Te döntöd el, mit kezelsz benne, mikor és hogyan.</p>
                </article>
                <article className="card section-stack">
                    <div className="eyebrow">Ár / érték</div>
                    <h2>Kevesebbe kerül, mint egy elfelejtett hiba.</h2>
                    <p>
                        Egy elfelejtett határidő, egy elveszett számla vagy egy kimaradt adminisztráció sokkal többe kerülhet,
                        mint egy rendezett rendszer.
                    </p>
                    <div className="feature-list">
                        <div className="feature-item">1–3 ingatlan · 3 000 Ft / ingatlan / hó</div>
                        <div className="feature-item">4–9 ingatlan · 2 000 Ft / ingatlan / hó</div>
                        <div className="feature-item">10+ ingatlan · 1 000 Ft / ingatlan / hó</div>
                        <div className="feature-item">30 nap ingyenes próba</div>
                    </div>
                </article>
            </section>

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Visszajelzés-alapú fejlesztés</div>
                        <h2>Nem egy rugalmatlan, elavult rendszer.</h2>
                        <p>
                            A Rentapp reflektál a bérbeadók igényeire. Ha olyan funkció hiányzik,
                            aminek szükségességét többen is jelzik, azt belefejlesztjük külön díj nélkül.
                            Ugyanígy azt is megírhatod, ha valami most nem megfelelően működik, vagy máshogyan lenne jobb.
                        </p>
                    </div>
                </div>
            </section>

            <section className="card section-stack">
                <div>
                    <div className="eyebrow">Kinek készült?</div>
                    <h2>Nem az ingatlanok számától lesz hasznos.</h2>
                </div>
                <div className="grid">
                    {audiences.map((item) => (
                        <article key={item.title} className="feature-item">
                            <div className="card-title">{item.title}</div>
                            <p>{item.body}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Próbaidő</div>
                        <h2>Próbáld ki úgy, hogy közben nincs kockázat.</h2>
                        <p>
                            30 napig teljes funkcionalitással kipróbálhatod. Ha egyszer megtapasztalod,
                            milyen érzés nem fejben menedzselni a bérbeadást, nehéz visszamenni.
                        </p>
                    </div>
                    <div className="charge-actions">
                        <Link className="btn btn-primary" href="/berbeadoi-regisztracio">Elindítom az ingyenes próbaidőt</Link>
                        <Link className="btn btn-secondary" href="/hasznalati-dij">Árazás megtekintése</Link>
                    </div>
                </div>
            </section>

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Ötletláda</div>
                        <h2>Van egy jó ötleted vagy hiányérzeted?</h2>
                        <p>
                            Küldd be. A rendszer használat közben lesz igazán erős, ezért a fejlesztési irányt
                            valós bérbeadói visszajelzések alapján finomítjuk.
                        </p>
                    </div>
                    <div className="charge-actions">
                        <Link className="btn btn-secondary" href="/otletlada">Megnyitom az ötletládát</Link>
                    </div>
                </div>
            </section>
        </main>
    );
}
