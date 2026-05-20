import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import { getSignedInDashboardHref } from "@/lib/auth/getDashboardHref";

const sections = [
    {
        id: "altalanos",
        title: "Általános",
        items: [
            {
                q: "Mi is pontosan a Rentapp?",
                a: "A Rentapp egy személyes landlord adminisztrációs rendszer. Segít egy helyen kezelni a bérbeadással kapcsolatos adminisztrációt: ingatlanok, bérlők, számlák, dokumentumok, határidők, teendők és emlékeztetők.",
            },
            {
                q: "Kinek készült?",
                a: "Neked való, ha akár egyetlen ingatlant adsz bérbe, akár több bérleményt kezelsz, eleged van a szétszórt adminisztrációból, és szeretnél egy rendszert, ami segít rendet tartani.",
            },
            {
                q: "Bérlőknek is használható?",
                a: "Igen. A bérlők saját hozzáférést kapnak, ahol csak a hozzájuk tartozó nyitott tételeket, fizetett tételeket, dokumentumokat és státuszokat látják.",
            },
            {
                q: "Több bérlő is lehet egy ingatlanhoz?",
                a: "Igen. Egy ingatlanhoz több bérlő is hozzárendelhető.",
            },
            {
                q: "Több ingatlan kezelésére is alkalmas?",
                a: "Igen. Akár egyetlen lakásról, akár teljes portfólióról van szó.",
            },
        ],
    },
    {
        id: "szamlak",
        title: "Számlák",
        items: [
            {
                q: "Kell kézzel felvinnem minden számlát?",
                a: "Nem feltétlenül. Két lehetőséged van: kézi feltöltés PDF-ből vagy emailes import.",
            },
            {
                q: "Mit tud az AI?",
                a: "A rendszer segít felismerni a számlák fontos adatait, például az összeget, esedékességet, szolgáltatót és díjtípust, így sokkal kevesebb manuális munka marad.",
            },
            {
                q: "Az AI automatikusan publikál mindent?",
                a: 'Nem. A rendszer draftként készíti elő a feldolgozott tételeket. Te ellenőrzöd és hagyod jóvá.',
            },
            {
                q: "Mi van, ha hibásan olvassa be?",
                a: "Semmi gond. A feldolgozott adatokat publikálás előtt ellenőrizheted és javíthatod.",
            },
        ],
    },
    {
        id: "ai-email",
        title: "AI és email import",
        items: [
            {
                q: "Hogyan működik az emailes import?",
                a: "Egyszerűen továbbküldöd a számlát a dedikált email címre. A rendszer feldolgozza és előkészíti.",
            },
            {
                q: "Minden hónapban kézzel kell adminisztrálnom?",
                a: "Nem ez a cél. A rendszer pont azért készült, hogy a visszatérő adminisztrációból minél kevesebb maradjon rád.",
            },
            {
                q: "Mi van, ha a jelszó-visszaállító levél a spam mappába ment?",
                a: "Tedd a feladót a megbízható feladók közé, majd kérj új jelszó-visszaállító linket. A spam mappából megnyitott régi link könnyen hibára fut.",
            },
        ],
    },
    {
        id: "berlok",
        title: "Bérlők",
        items: [
            {
                q: "Mit lát a bérlő?",
                a: "Csak a saját dolgait. Nem lát más bérlőket vagy más ingatlanokat.",
            },
            {
                q: "Kapnak emlékeztetőt?",
                a: "A rendszer segít az emlékeztetések kezelésében, de a kommunikáció kontrollja a bérbeadó kezében marad.",
            },
            {
                q: "Kevesebb kérdés lesz tőlük?",
                a: "Erősen valószínű. Mert a releváns információk elérhetők számukra, nem kell mindent külön elkérniük.",
            },
        ],
    },
    {
        id: "biztonsag",
        title: "Biztonság",
        items: [
            {
                q: "Biztonságos a használata?",
                a: "Igen. A Rentapp úgy lett kialakítva, hogy a felhasználók csak a saját adataikhoz férjenek hozzá.",
            },
            {
                q: "Más bérbeadó látja az én adataimat?",
                a: "Nem. Minden landlord kizárólag a saját adatait látja.",
            },
            {
                q: "A bérlő lát minden dokumentumot?",
                a: "Nem. Csak azt, ami hozzá tartozik.",
            },
        ],
    },
    {
        id: "kezdes",
        title: "Kezdés",
        items: [
            {
                q: "Mennyi idő beállítani?",
                a: "Az alapok gyorsan elindíthatók. Ingatlan hozzáadása, bérlő hozzárendelése, első tételek feltöltése. Nem egy enterprise rendszer onboarding.",
            },
            {
                q: "Ha nem vagyok tech zseni?",
                a: "Nem kell annak lenned. A Rentapp nem fejlesztőknek készült.",
            },
            {
                q: "Mobilról is működik?",
                a: "Igen. A felület mobilon is kényelmesen használható.",
            },
        ],
    },
    {
        id: "arazas",
        title: "Árazás",
        items: [
            {
                q: "Van ingyenes próba?",
                a: "Igen. 30 napig teljes funkcionalitással.",
            },
            {
                q: "Van setup díj?",
                a: "Nincs.",
            },
            {
                q: "Hosszú távra kell elköteleződni?",
                a: "Nem.",
            },
            {
                q: "Minden funkció minden csomagban elérhető?",
                a: "Igen. Az árkülönbséget csak az ingatlanok száma adja.",
            },
        ],
    },
];

export default async function FaqPage() {
    const dashboardHref = await getSignedInDashboardHref();

    return (
        <main className="app-shell page-enter space-y-4">
            <PublicHeader dashboardHref={dashboardHref} />

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">GYIK</div>
                        <h1>Kérdésed van? Jó helyen jársz.</h1>
                        <p>
                            Összeszedtük a leggyakoribb kérdéseket, hogy gyorsan átlásd, hogyan működik a Rentapp.
                            Ha mégsem találod, amit keresel, írj nekünk — segítünk.
                        </p>
                    </div>
                    <div className="charge-actions">
                        <Link className="btn btn-primary" href="https://wa.me/64275665850" target="_blank" rel="noreferrer">WhatsApp</Link>
                        <Link className="btn btn-secondary" href="https://m.me/indijanmac" target="_blank" rel="noreferrer">Messenger</Link>
                    </div>
                </div>
            </section>

            <section className="card sticky-subnav">
                <div className="nav-pills">
                    {sections.map((section) => (
                        <a key={section.id} className="pill" href={`#${section.id}`}>{section.title}</a>
                    ))}
                </div>
            </section>

            {sections.map((section) => (
                <section key={section.id} id={section.id} className="card section-stack faq-section">
                    <div>
                        <div className="eyebrow">{section.title}</div>
                        <h2>{section.title}</h2>
                    </div>
                    <div className="faq-list">
                        {section.items.map((item) => (
                            <details key={item.q} className="faq-item">
                                <summary>{item.q}</summary>
                                <p>{item.a}</p>
                            </details>
                        ))}
                    </div>
                </section>
            ))}

            <section id="nem-talaltad" className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Nem találtad?</div>
                        <h2>Nem találtad a választ?</h2>
                        <p>Semmi gond. Írj nekünk, segítünk.</p>
                    </div>
                    <div className="charge-actions">
                        <Link className="btn btn-primary" href="https://wa.me/64275665850" target="_blank" rel="noreferrer">WhatsApp</Link>
                        <Link className="btn btn-secondary" href="https://m.me/indijanmac" target="_blank" rel="noreferrer">Messenger</Link>
                    </div>
                </div>
            </section>
        </main>
    );
}
