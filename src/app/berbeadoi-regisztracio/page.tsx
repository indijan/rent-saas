import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import { submitOwnerRegistration } from "./actions";
import { getSignedInDashboardHref } from "@/lib/auth/getDashboardHref";

type Props = {
    searchParams?: Promise<{ status?: string; message?: string }> | { status?: string; message?: string };
};

export default async function OwnerRegistrationPage({ searchParams }: Props) {
    const dashboardHref = await getSignedInDashboardHref();
    const sp = (searchParams instanceof Promise) ? await searchParams : (searchParams ?? {});
    const status = sp.status ? String(sp.status) : "";
    const message = sp.message ? String(sp.message) : "";

    return (
        <main className="app-shell page-enter space-y-4">
            <PublicHeader dashboardHref={dashboardHref} />

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Bérbeadói regisztráció</div>
                        <h1>Érdeklődés és belépés a rendszerbe</h1>
                        <p>
                            A bérbeadói fiókokat jelenleg adminisztrátori oldalon hozzuk létre.
                            Küldd el az adataidat, és a beállítás után felvesszük veled a kapcsolatot.
                        </p>
                    </div>
                    <div className="info-strip">
                        <span>Bérlőket továbbra is az admin rögzíti a háttérrendszerben.</span>
                        <span>A saját felületeden csak a saját ingatlanjaidat és bérlőidet látod majd.</span>
                    </div>
                </div>
            </section>

            {message ? (
                <div className={`card ${status === "error" ? "text-red-600" : "text-green-600"}`}>
                    {message}
                </div>
            ) : null}

            <form action={submitOwnerRegistration} className="card form-shell">
                <div className="form-panel">
                    <div className="form-grid">
                        <label className="field-stack">
                            <span className="field-label">Név</span>
                            <input name="full_name" className="input" placeholder="Teljes név" required />
                        </label>
                        <label className="field-stack">
                            <span className="field-label">Cégnév</span>
                            <input name="company_name" className="input" placeholder="Opcionális" />
                        </label>
                        <label className="field-stack">
                            <span className="field-label">E-mail-cím</span>
                            <input name="email" type="email" className="input" placeholder="Email" required />
                        </label>
                        <label className="field-stack">
                            <span className="field-label">Telefonszám</span>
                            <input name="phone" className="input" placeholder="+36..." required />
                        </label>
                    </div>
                </div>
                <div className="form-panel">
                    <label className="field-stack">
                        <span className="field-label">Számlázási cím</span>
                        <textarea name="billing_address" className="input textarea" placeholder="Irányítószám, város, cím" required />
                    </label>
                </div>
                <div className="charge-actions">
                    <button className="btn btn-primary" type="submit">Igény elküldése</button>
                    <Link className="btn btn-secondary" href="/hasznalati-dij">Használati díj megtekintése</Link>
                </div>
            </form>
        </main>
    );
}
