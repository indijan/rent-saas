/* eslint-disable @next/next/no-html-link-for-pages */
"use client";

import Image from "next/image";
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
            <a className="brand" href="/">
                <div className="brand-kicker">Automate for freedom</div>
                <div className="brand-title-row">
                    <div className="brand-mark brand-mark-logo" aria-hidden="true">
                        <Image src="/rentapp-logo.png" alt="" width={42} height={42} className="brand-mark-logo-image" />
                    </div>
                    <div className="brand-copy">
                        <div className="brand-title">Rentapp</div>
                        <span className="brand-meta">Bérbeadói automatizálás, egyetlen nyugodt rendszerben.</span>
                    </div>
                </div>
            </a>
            <div className="header-actions">
                <div className="header-utility-bar">
                    <a
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
                    </a>
                    <a
                        className="header-icon-link"
                        href="/gyik#nem-talaltad"
                        data-tooltip="Kapcsolat"
                        aria-label="Kapcsolat"
                    >
                        <UtilityIcon label="Kapcsolat">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M7 10h10" />
                                <path d="M7 14h6" />
                                <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4l-3 3-3-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
                            </svg>
                        </UtilityIcon>
                    </a>
                    <a
                        className="header-icon-link"
                        href="/aszf"
                        data-tooltip="ÁSZF"
                        aria-label="ÁSZF"
                    >
                        <UtilityIcon label="ÁSZF">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M8 3h6l5 5v13H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
                                <path d="M14 3v5h5" />
                                <path d="M10 12h6" />
                                <path d="M10 16h6" />
                            </svg>
                        </UtilityIcon>
                    </a>
                </div>
                <nav id="public-navigation" className="nav-pills nav-pills-desktop">
                    <a className="pill" href="/funkciok">Funkciók</a>
                    <a className="pill" href="/hasznalati-dij">Díjak</a>
                    <a className="pill" href="/gyik">GYIK</a>
                    <a className="pill" href="/berbeadoi-regisztracio">Regisztráció</a>
                    {dashboardHref ? (
                        <a className="pill pill-active" href={dashboardHref}>Saját felület</a>
                    ) : (
                        <a className="pill pill-active" href="/login">Belépés</a>
                    )}
                </nav>
                <div className="header-nav-shell header-nav-shell-mobile">
                    <button
                        type="button"
                        className="header-toggle"
                        aria-expanded={menuOpen}
                        aria-controls="public-navigation-mobile"
                        onClick={() => setMenuOpen((value) => !value)}
                    >
                        Menü
                    </button>
                    <nav id="public-navigation-mobile" className={`nav-pills nav-pills-mobile${menuOpen ? " nav-open" : ""}`}>
                        <a className="pill" href="/funkciok" onClick={() => setMenuOpen(false)}>Funkciók</a>
                        <a className="pill" href="/hasznalati-dij" onClick={() => setMenuOpen(false)}>Díjak</a>
                        <a className="pill" href="/gyik" onClick={() => setMenuOpen(false)}>GYIK</a>
                        <a className="pill" href="/berbeadoi-regisztracio" onClick={() => setMenuOpen(false)}>Regisztráció</a>
                        {dashboardHref ? (
                            <a className="pill pill-active" href={dashboardHref} onClick={() => setMenuOpen(false)}>Saját felület</a>
                        ) : (
                            <a className="pill pill-active" href="/login" onClick={() => setMenuOpen(false)}>Belépés</a>
                        )}
                    </nav>
                </div>
            </div>
        </header>
    );
}
