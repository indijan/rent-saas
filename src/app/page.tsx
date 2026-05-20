import PublicHeader from "@/components/PublicHeader";
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

            <section className="card hero-marketing">
                <div className="hero-copy">
                    <div className="eyebrow">Rentapp</div>
                    <h1>A bérbeadás ne egy második teljes állás legyen.</h1>
                    <p>
                        A Rentapp egy személyes landlord dashboard, ami segít rendben tartani a bérleményeidet,
                        bérlőidet, számláidat, dokumentumaidat és teendőidet — hogy ne neked kelljen mindent fejben tartani.
                    </p>
                    <div className="charge-actions">
                        <Link className="btn btn-primary" href="/berbeadoi-regisztracio">Próbáld ki 30 napig ingyen</Link>
                        <Link className="btn btn-secondary" href="/funkciok">Funkciók megtekintése</Link>
                    </div>
                    <div className="info-strip">
                        <span>30 nap ingyenes próba</span>
                        <span>Mobilról is kényelmesen használható</span>
                        <span>AI támogatott számlafeldolgozás</span>
                        <span>Saját, privát landlord workspace</span>
                    </div>
                </div>

                <div className="hero-panel">
                    <div className="kpi-card">
                        <div className="kpi-label">Miért más?</div>
                        <div className="kpi-value">Nem még egy rendszer</div>
                        <div className="muted-note">Hanem egy olyan saját workspace, ami leveszi a szétszórt adminisztrációt a fejedről.</div>
                    </div>
                    <div className="feature-list">
                        <div className="feature-item">PDF vagy email alapú számlaimport, AI előkészítéssel és emberi jóváhagyással.</div>
                        <div className="feature-item">Nyitott tételek, dokumentumok és bérlői státuszok egy helyen, nem több külön felületen.</div>
                        <div className="feature-item">Lejáratok, hiányzó beállítások és importok egy teendő dashboardon.</div>
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
        </main>
    );
}
