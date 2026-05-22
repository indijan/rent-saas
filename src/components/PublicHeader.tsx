"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
    dashboardHref?: string | null;
};

export default function PublicHeader({ dashboardHref }: Props) {
    const [menuOpen, setMenuOpen] = useState(false);

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
            <button
                type="button"
                className="header-toggle"
                aria-expanded={menuOpen}
                aria-controls="public-navigation"
                onClick={() => setMenuOpen((value) => !value)}
            >
                Menü
            </button>
            <nav id="public-navigation" className={`nav-pills${menuOpen ? " nav-open" : ""}`}>
                <Link className="pill" href="/funkciok" onClick={() => setMenuOpen(false)}>Funkciók</Link>
                <Link className="pill" href="/hasznalati-dij" onClick={() => setMenuOpen(false)}>Használati díj</Link>
                <Link className="pill" href="/gyik" onClick={() => setMenuOpen(false)}>GYIK</Link>
                <Link className="pill" href="/otletlada" onClick={() => setMenuOpen(false)}>Ötletláda</Link>
                <Link className="pill pill-with-icon" href="/gyik#nem-talaltad" onClick={() => setMenuOpen(false)}>
                    <span className="pill-icon" aria-hidden="true">?</span>
                    Kapcsolat
                </Link>
                <Link className="pill" href="/berbeadoi-regisztracio" onClick={() => setMenuOpen(false)}>Bérbeadói regisztráció</Link>
                {dashboardHref ? (
                    <Link className="pill pill-active" href={dashboardHref} onClick={() => setMenuOpen(false)}>Saját felület</Link>
                ) : (
                    <Link className="pill pill-active" href="/login" onClick={() => setMenuOpen(false)}>Belépés</Link>
                )}
            </nav>
        </header>
    );
}
