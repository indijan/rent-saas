import Link from "next/link";

type Props = {
    dashboardHref?: string | null;
};

export default function PublicHeader({ dashboardHref }: Props) {
    return (
        <header className="app-header">
            <div className="brand">
                <div className="flex items-center gap-3">
                    <div
                        className="flex h-10 w-10 items-center justify-center rounded-full"
                        style={{
                            background: "linear-gradient(135deg, #1d4ed8, #0ea5e9)",
                            color: "#f8fbff",
                            fontWeight: 800,
                            boxShadow: "0 10px 20px rgba(37, 99, 235, 0.22)",
                        }}
                        aria-hidden="true"
                    >
                        R
                    </div>
                    <div className="text-lg font-semibold">Rentapp</div>
                </div>
                <span>Bérbeadói és bérlői adminisztráció közös nevezőn.</span>
            </div>
            <nav className="nav-pills">
                <Link className="pill" href="/funkciok">Funkciók</Link>
                <Link className="pill" href="/hasznalati-dij">Használati díj</Link>
                <Link className="pill" href="/berbeadoi-regisztracio">Bérbeadói regisztráció</Link>
                {dashboardHref ? (
                    <Link className="pill pill-active" href={dashboardHref}>Saját felület</Link>
                ) : (
                    <Link className="pill pill-active" href="/login">Belépés</Link>
                )}
            </nav>
        </header>
    );
}
