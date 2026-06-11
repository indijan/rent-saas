import Image from "next/image";

import PublicHeader from "@/components/PublicHeader";
import PublicPageEnhancements from "@/components/PublicPageEnhancements";
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

const heroProofs = [
    {
        label: "Próbaidő",
        value: "30 nap ingyen",
    },
    {
        label: "Import",
        value: "AI támogatott számlafeldolgozás",
    },
    {
        label: "Felület",
        value: "Mobilról is kényelmes",
    },
];

const pricingTiers = [
    {
        label: "1–3 ingatlan",
        value: "3 000 Ft / ingatlan / hó",
    },
    {
        label: "4–9 ingatlan",
        value: "2 000 Ft / ingatlan / hó",
        featured: true,
    },
    {
        label: "10+ ingatlan",
        value: "1 000 Ft / ingatlan / hó",
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
                        A Rentapp egyetlen nyugodt rendszerbe rendezi a bérbeadás működését:
                        számlák, bérlők, dokumentumok, határidők és teendők egy helyen.
                    </p>
                    <div className="hero-copy-note">
                        Kevesebb adminisztráció. Kevesebb fejben tartás. Több kontroll.
                    </div>
                    <div className="charge-actions">
                        <a className="btn btn-primary" href="/berbeadoi-regisztracio">Próbáld ki 30 napig ingyen</a>
                        <a className="btn btn-secondary" href="/funkciok">Funkciók megtekintése</a>
                    </div>
                    <div className="hero-proof-grid">
                        {heroProofs.map((item) => (
                            <div key={item.label} className="hero-proof-card">
                                <span className="hero-proof-label">{item.label}</span>
                                <strong>{item.value}</strong>
                            </div>
                        ))}
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
                        A Rentapp nem egy bonyolult könyvelőplatform. Ez a saját személyes bérbeadói felületed,
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
                    <div className="pricing-inline-list">
                        {pricingTiers.map((tier) => (
                            <div key={tier.label} className={`pricing-inline-item${tier.featured ? " pricing-inline-item-featured" : ""}`}>
                                <span>{tier.label}</span>
                                <strong>{tier.value}</strong>
                            </div>
                        ))}
                        <div className="pricing-inline-item pricing-inline-item-muted">
                            <span>Próbaidő</span>
                            <strong>30 nap ingyenes próba</strong>
                        </div>
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

            <section className="founder-story">
                <div className="founder-story-shell">
                    <div className="founder-story-copy">
                        <div className="eyebrow founder-story-eyebrow">👋 Ki áll a Rentapp mögött?</div>
                        <h2>Nem egy multinacionális cég.</h2>
                        <p className="founder-story-headline">
                            Hanem valaki, aki hisz abban, hogy az adminisztrációt rendszereknek kell elvégezniük.
                        </p>
                        <div className="founder-story-body">
                            <div className="founder-story-photo-panel">
                                <div className="founder-story-photo-frame">
                                    <Image
                                        src="/founder-istvan-final.jpeg"
                                        alt="Kovács István, a Rentapp alapítója"
                                        width={2316}
                                        height={3088}
                                        className="founder-story-photo"
                                    />
                                </div>
                            </div>
                            <p><strong>Helló! István vagyok.</strong></p>
                            <p>Elsősorban nem szoftvereket építek. Problémákat szeretek megszüntetni.</p>
                            <p>
                                Az elmúlt években mindig ugyanazt láttam: rengeteg vállalkozó és bérbeadó értékes órákat pazarol olyan
                                feladatokra, amelyeket egy jól megtervezett rendszer néhány másodperc alatt el tudna végezni. Automatikusan.
                            </p>
                            <p>
                                Hiszek abban, hogy a technológia nem arra való, hogy még bonyolultabbá tegye az életünket,
                                hanem arra, hogy visszaadja az időnket. Ez a gondolat hívta életre a Rentappot.
                            </p>
                            <p>
                                Egy olyan platformot építek, amely rendszerbe foglalja és automatizálja a bérbeadással járó ismétlődő
                                adminisztrációt, miközben a döntések és a kontroll végig a bérbeadó kezében maradnak.
                            </p>
                            <blockquote className="founder-story-inline-quote">Ön dönt. Az AI elvégzi.</blockquote>
                            <p>
                                A célom nem egy újabb ingatlankezelő szoftver létrehozása. A célom egy olyan rendszer megalkotása,
                                amely nyugodtabbá, átláthatóbbá és hatékonyabbá teszi a bérbeadást.
                            </p>
                            <p>
                                Szeretem megkérdőjelezni a megszokott működést, és feltenni az egyszerű kérdést:
                            </p>
                            <blockquote className="founder-story-inline-quote">Biztos, hogy ezt még mindig embernek kell csinálnia?</blockquote>
                            <p>
                                Ha a válasz nem, akkor azt automatizálni kell. A Rentapp jelenleg is folyamatos fejlesztés alatt áll,
                                ezért minden visszajelzésnek és ötletnek örülök.
                            </p>
                            <p>
                                Hiszem, hogy a legjobb termékeket nem egy fejlesztő, hanem a felhasználók és a fejlesztő közösen építik.
                                Ha te is úgy gondolod, hogy a bérbeadásnak nem Excelből, Messengerből és emlékeztetőkből kellene állnia,
                                akkor jó helyen jársz.
                            </p>
                            <p>Üdvözöllek a Rentapp világában!</p>
                        </div>
                    </div>
                </div>
                <div className="founder-story-footer">
                    <div className="founder-story-mantra">
                        <strong>Automate for Freedom.</strong>
                        <span>Kevesebb admin. Több szabadság.</span>
                    </div>
                    <a className="btn btn-secondary founder-story-cta" href="https://discord.gg/3UN4kmyH" target="_blank" rel="noreferrer">🚀 Legyél a Rentapp első tesztelői között</a>
                </div>
            </section>

            <section id="elso-tesztelok" className="card section-stack">
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
                        <a className="btn btn-primary" href="/berbeadoi-regisztracio">Elindítom az ingyenes próbaidőt</a>
                        <a className="btn btn-secondary" href="/hasznalati-dij">Árazás megtekintése</a>
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
                        <a className="btn btn-secondary" href="/otletlada">Megnyitom az ötletládát</a>
                    </div>
                </div>
            </section>
        </main>
    );
}
