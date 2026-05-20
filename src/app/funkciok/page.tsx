import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import { getSignedInDashboardHref } from "@/lib/auth/getDashboardHref";

const features = [
    {
        title: "Ingatlanok kezelése káosz nélkül",
        body: "Akár egyetlen lakást adsz bérbe, akár több ingatlant kezelsz, minden egy helyen átlátható: ingatlan adatok, bérlők hozzárendelése, kapcsolódó díjak, dokumentumok és státuszok.",
    },
    {
        title: "Bérlők kezelése egyszerűen",
        body: "Minden bérlő a saját ingatlanához kapcsolva jelenik meg. Látod, ki melyik ingatlanhoz tartozik, milyen nyitott tételei vannak és milyen dokumentumok kapcsolódnak hozzá. A bérlők csak a saját dolgaikat látják.",
    },
    {
        title: "AI támogatott számlafeldolgozás",
        body: "Nem kell kézzel bepötyögni minden adatot. Tölts fel egy PDF számlát, vagy küldd tovább emailben, és a rendszer előkészíti a feldolgozást. Az AI segít felismerni az összeget, esedékességet, szolgáltatót, díjtípust és más releváns adatokat.",
    },
    {
        title: "Emailből automatikusan",
        body: "Van egy dedikált email címed a számlákhoz. Egyszerűen továbbküldöd a számlát, a rendszer pedig felismeri, feldolgozza, és draftként előkészíti.",
    },
    {
        title: "Soha többé „majd észben tartom”",
        body: "A Teendők dashboard folyamatosan mutatja, mivel kell foglalkoznod: lejárt fizetések, közelgő határidők, ellenőrzésre váró importok és hiányzó beállítások.",
    },
    {
        title: "Dokumentumok ott, ahol kellenek",
        body: "Szerződések, számlák, PDF-ek. Nem email mellékletek között kell vadászni. Minden kapcsolódik ahhoz az ingatlanhoz vagy tételhez, amihez tartozik.",
    },
    {
        title: "Bérlői önkiszolgáló hozzáférés",
        body: "A bérlő belép, és látja a saját dolgait: nyitott tételek, fizetett tételek, dokumentumok, státuszok. Kevesebb kérdés. Kevesebb üzenet. Kevesebb admin.",
    },
    {
        title: "Mobilról is használható",
        body: "Mert a bérbeadással kapcsolatos dolgok ritkán akkor történnek, amikor laptop előtt ülsz. A Rentapp mobilon is kényelmesen használható.",
    },
];

export default async function FeaturesPage() {
    const dashboardHref = await getSignedInDashboardHref();

    return (
        <main className="app-shell page-enter space-y-4">
            <PublicHeader dashboardHref={dashboardHref} />

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Funkciók</div>
                        <h1>Minden, ami a bérbeadás menedzseléséhez kell. Egy helyen.</h1>
                        <p>
                            A Rentapp nem csak nyilvántart. Segít rendet rakni a bérbeadás körüli adminisztrációban,
                            automatizálja a monoton részeket, és leveszi a terhet a fejedről.
                        </p>
                    </div>
                    <div className="info-strip">
                        <span>Nem Excelben</span>
                        <span>Nem fejben</span>
                        <span>Nem szétszórva</span>
                    </div>
                </div>
            </section>

            <section className="grid">
                {features.map((feature, index) => (
                    <article key={feature.title} className="card section-stack">
                        <div className="eyebrow">Funkció {index + 1}</div>
                        <div className="card-title">{feature.title}</div>
                        <p>{feature.body}</p>
                    </article>
                ))}
            </section>

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">CTA</div>
                        <h2>Próbáld ki 30 napig ingyen.</h2>
                        <p>
                            Nézd meg, milyen érzés úgy kezelni a bérbeadást, hogy nem kell mindent fejben tartani.
                        </p>
                    </div>
                    <div className="charge-actions">
                        <Link className="btn btn-primary" href="/berbeadoi-regisztracio">Elindítom az ingyenes próbaidőt</Link>
                        <Link className="btn btn-secondary" href="/gyik">Gyakori kérdések</Link>
                    </div>
                </div>
            </section>
        </main>
    );
}
