import Link from "next/link";

type Props = {
    searchParams?: Promise<{ status?: string; title?: string; message?: string }> | { status?: string; title?: string; message?: string };
};

export default async function EmailActionResultPage({ searchParams }: Props) {
    const sp = (searchParams instanceof Promise) ? await searchParams : (searchParams ?? {});
    const status = sp.status === "error" ? "error" : "success";
    const title = sp.title ? String(sp.title) : (status === "error" ? "A művelet nem sikerült." : "A művelet sikeres volt.");
    const message = sp.message
        ? String(sp.message)
        : (status === "error"
            ? "Valami hiba történt az e-mailes művelet közben."
            : "A művelet lefutott, nincs több teendőd.");

    return (
        <main className="auth-shell page-enter">
            <section className="auth-card form-shell email-action-result-card">
                <div className="eyebrow">Rentapp e-mailes művelet</div>
                <div className="section-stack email-action-result-copy">
                    <div className="brand-title-row" style={{ justifyContent: "center" }}>
                        <div className="brand-mark" aria-hidden="true">
                            R
                        </div>
                    </div>
                    <h1>{title}</h1>
                    <p className={status === "error" ? "text-red-600" : "muted-note"}>{message}</p>
                </div>
                <div className="charge-actions">
                    <Link className="btn btn-primary" href="/login">
                        Megnyitom a Rentappot
                    </Link>
                    <Link className="btn btn-secondary" href="/">
                        Vissza a főoldalra
                    </Link>
                </div>
            </section>
        </main>
    );
}
