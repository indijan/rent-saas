import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import { getSignedInDashboardHref } from "@/lib/auth/getDashboardHref";

const pricingCards = [
    {
        title: "1–3 ingatlan",
        price: "3 000 Ft",
        suffix: "/ ingatlan / hó",
        body: "Tökéletes, ha néhány bérleményt kezelsz, és szeretnéd végre rendszerezni a káoszt.",
        bullets: [
            "teljes funkcionalitás",
            "AI számlafeldolgozás",
            "email import",
            "bérlőkezelés",
            "dokumentumtár",
            "teendő dashboard",
            "emlékeztetők",
            "mobil használat",
        ],
    },
    {
        title: "4–9 ingatlan",
        price: "2 000 Ft",
        suffix: "/ ingatlan / hó",
        body: "Ha már kisebb portfóliót kezelsz, a Rentapp még jobban megtérül.",
        bullets: [
            "minden funkció",
            "kedvezőbb egységár",
            "portfólió szintű átláthatóság",
            "kevesebb manuális adminisztráció",
        ],
    },
    {
        title: "10+ ingatlan",
        price: "1 000 Ft",
        suffix: "/ ingatlan / hó",
        body: "Nagyobb portfóliónál már nem luxus a rendszer — hanem szükségszerűség.",
        bullets: [
            "minden funkció",
            "legerősebb ár / érték arány",
            "skálázható működés",
            "centralizált adminisztráció",
        ],
    },
];

const faqs = [
    {
        question: "Van ingyenes próba?",
        answer: "Igen. A Rentapp 30 napig teljes funkcionalitással ingyen kipróbálható.",
    },
    {
        question: "Van setup díj?",
        answer: "Nincs. Csak a választott csomag havi díját fizeted.",
    },
    {
        question: "Hosszú távra el kell köteleződnöm?",
        answer: "Nem. A szolgáltatást rugalmasan használhatod.",
    },
    {
        question: "Ha csak egy lakásom van, akkor is megéri?",
        answer: "Igen. Már egyetlen bérleménynél is meglepően sok adminisztráció gyűlik össze: számlák, határidők, dokumentumok, bérlői kommunikáció és emlékeztetők.",
    },
    {
        question: "Minden funkció benne van minden csomagban?",
        answer: "Igen. Az árkülönbséget kizárólag az ingatlanok száma adja. Nincsenek mesterségesen korlátozott funkciók.",
    },
    {
        question: "Mi történik a próbaidő után?",
        answer: "A próbaidő végén eldöntheted, szeretnéd-e tovább használni a Rentappot.",
    },
];

export default async function PricingPage() {
    const dashboardHref = await getSignedInDashboardHref();

    return (
        <main className="app-shell page-enter space-y-4">
            <PublicHeader dashboardHref={dashboardHref} />

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Használati díj</div>
                        <h1>Egyszerű árazás. Rejtett meglepetések nélkül.</h1>
                        <p>
                            A Rentapp ára az ingatlanjaid számához igazodik. Nincs setup díj.
                            Nincs hosszú távú elköteleződés. 30 napig kockázat nélkül kipróbálhatod.
                        </p>
                    </div>
                    <div className="charge-actions">
                        <Link className="btn btn-primary" href="/berbeadoi-regisztracio">Elindítom az ingyenes próbaidőt</Link>
                    </div>
                </div>
            </section>

            <section className="grid">
                {pricingCards.map((card) => (
                    <article key={card.title} className="card section-stack">
                        <div className="eyebrow">{card.title}</div>
                        <div className="kpi-value">{card.price}</div>
                        <div className="muted-note">{card.suffix}</div>
                        <p>{card.body}</p>
                        <div className="feature-list">
                            {card.bullets.map((bullet) => (
                                <div key={bullet} className="feature-item">✔ {bullet}</div>
                            ))}
                        </div>
                    </article>
                ))}
            </section>

            <section className="grid">
                <article className="card section-stack">
                    <div className="eyebrow">Érték</div>
                    <h2>Nem az app kerül pénzbe. A káosz.</h2>
                    <p>
                        Egy elfelejtett határidő. Egy elveszett számla. Egy késve kezelt ügy. Egy „majd észben tartom” pillanat.
                        A Rentapp nem azért van, mert muszáj még egy rendszert használni. Hanem azért, hogy ne kelljen mindent neked fejben menedzselni.
                    </p>
                </article>
                <article className="card section-stack">
                    <div className="eyebrow">ROI</div>
                    <h2>Nézzük egyszerűen.</h2>
                    <div className="feature-list">
                        <div className="feature-item">1–2 óra adminisztrációt spórol havonta</div>
                        <div className="feature-item">megakadályoz egy elfelejtett határidőt</div>
                        <div className="feature-item">kiváltja a dokumentumvadászatot</div>
                        <div className="feature-item">csökkenti a bérlői egyeztetések idejét</div>
                    </div>
                    <p className="muted-note">Ha ezekből csak egy részt megfog, már valószínűleg többet hoz vissza, mint amennyibe kerül.</p>
                </article>
            </section>

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Próbaidő</div>
                        <h2>Próbáld ki előbb. Dönts utána.</h2>
                        <p>
                            Nem kell vakon előfizetned. 30 napig teljes funkcionalitással használhatod.
                            Nézd meg a saját működésedben, hogy mennyit vesz le a válladról.
                        </p>
                    </div>
                    <div className="charge-actions">
                        <Link className="btn btn-primary" href="/berbeadoi-regisztracio">Elindítom az ingyenes próbaidőt</Link>
                    </div>
                </div>
            </section>

            <section className="card section-stack">
                <div>
                    <div className="eyebrow">FAQ</div>
                    <h2>Gyakori kérdések</h2>
                </div>
                <div className="faq-list">
                    {faqs.map((item) => (
                        <details key={item.question} className="faq-item">
                            <summary>{item.question}</summary>
                            <p>{item.answer}</p>
                        </details>
                    ))}
                </div>
            </section>

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Végső CTA</div>
                        <h2>Kezdd el most. Az első hónap a miénk.</h2>
                        <p>30 napig teljes funkcionalitással kipróbálhatod. Kockázat nélkül.</p>
                    </div>
                    <div className="charge-actions">
                        <Link className="btn btn-primary" href="/berbeadoi-regisztracio">Elindítom az ingyenes próbaidőt</Link>
                        <Link className="btn btn-secondary" href="/gyik">GYIK</Link>
                    </div>
                </div>
            </section>
        </main>
    );
}
