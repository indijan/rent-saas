"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";

type Props = {
    dashboardHref?: string | null;
};

function UtilityIcon({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <>
            <span className="sr-only">{label}</span>
            <span aria-hidden="true">{children}</span>
        </>
    );
}

export default function PublicHeader({ dashboardHref }: Props) {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <header className="app-header">
            <Link className="brand" href="/" onClick={() => setMenuOpen(false)}>
                <div className="brand-kicker">Automate for freedom</div>
                <div className="brand-title-row">
                    <div className="brand-mark" aria-hidden="true">
                        R
                    </div>
                    <div className="brand-copy">
                        <div className="brand-title">Rentapp</div>
                        <span className="brand-meta">A landlord operating system, ami rendet tesz a káoszban.</span>
                    </div>
                </div>
            </Link>
            <button
                type="button"
                className="header-toggle"
                aria-expanded={menuOpen}
                aria-controls="public-navigation"
                onClick={() => setMenuOpen((value) => !value)}
            >
                Menü
            </button>
            <div className="header-actions">
                <div className="header-utility-bar">
                    <Link
                        className="header-icon-link"
                        href="/otletlada"
                        data-tooltip="Ötletláda"
                        aria-label="Ötletláda"
                    >
                        <UtilityIcon label="Ötletláda">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 18h6" />
                                <path d="M10 22h4" />
                                <path d="M12 2a7 7 0 0 0-4 12.8c.7.5 1 1 1.2 1.7h5.6c.2-.7.5-1.2 1.2-1.7A7 7 0 0 0 12 2Z" />
                            </svg>
                        </UtilityIcon>
                    </Link>
                    <Link
                        className="header-icon-link"
                        href="/gyik#nem-talaltad"
                        data-tooltip="Kapcsolat"
                        aria-label="Kapcsolat"
                        onClick={() => setMenuOpen(false)}
                    >
                        <UtilityIcon label="Kapcsolat">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M7 10h10" />
                                <path d="M7 14h6" />
                                <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4l-3 3-3-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
                            </svg>
                        </UtilityIcon>
                    </Link>
                </div>
                <div className="header-nav-shell">
                    <nav id="public-navigation" className={`nav-pills${menuOpen ? " nav-open" : ""}`}>
                    <Link className="pill" href="/funkciok" onClick={() => setMenuOpen(false)}>Funkciók</Link>
                    <Link className="pill" href="/hasznalati-dij" onClick={() => setMenuOpen(false)}>Díjak</Link>
                    <Link className="pill" href="/gyik" onClick={() => setMenuOpen(false)}>GYIK</Link>
                    <Link className="pill" href="/berbeadoi-regisztracio" onClick={() => setMenuOpen(false)}>Regisztráció</Link>
                    {dashboardHref ? (
                        <Link className="pill pill-active" href={dashboardHref} onClick={() => setMenuOpen(false)}>Saját felület</Link>
                    ) : (
                        <Link className="pill pill-active" href="/login" onClick={() => setMenuOpen(false)}>Belépés</Link>
                    )}
                    </nav>
                </div>
            </div>
        </header>
    );
}
