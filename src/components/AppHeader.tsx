"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import type { AppRole } from "@/lib/auth/requireUser";

type Profile = {
    role: AppRole;
    full_name: string | null;
    email: string;
    available_roles?: AppRole[];
};

type Props = {
    profile: Profile;
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

export default function AppHeader({ profile }: Props) {
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);
    const navItems = (() => {
        if (profile.role === "OWNER") {
            return [
                { href: "/owner/todo", label: "Teendők" },
                { href: "/owner/osszefoglalo", label: "Összesítő" },
                { href: "/owner/properties", label: "Ingatlanok" },
                { href: "/owner/charges", label: "Díjak" },
                { href: "/owner/importok", label: "Importok" },
                { href: "/owner/tenants", label: "Bérlők" },
            ];
        }
        if (profile.role === "TENANT") {
            return [{ href: "/tenant/charges", label: "Díjak" }];
        }
        if (profile.role === "ADMIN") {
            return [{ href: "/admin/berbeadok", label: "Bérbeadók" }];
        }
        return [];
    })();
    const roleLabel = profile.role === "OWNER" ? "Tulajdonos" : profile.role === "TENANT" ? "Bérlő" : "Admin";

    return (
        <header className="app-header">
            <div className="brand">
                <div className="brand-kicker">Automate for freedom</div>
                <div className="brand-title-row">
                    <div className="brand-mark" aria-hidden="true">
                        R
                    </div>
                    <div className="brand-copy">
                        <div className="brand-title">Rentapp</div>
                        <span className="brand-meta">
                            {profile.full_name || profile.email} · {roleLabel}
                        </span>
                    </div>
                </div>
            </div>
            <button
                type="button"
                className="header-toggle"
                aria-expanded={menuOpen}
                aria-controls="app-navigation"
                onClick={() => setMenuOpen((value) => !value)}
            >
                Menü
            </button>
            <div className="header-actions">
                <div className="header-utility-bar">
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
                    <Link
                        className="header-icon-link"
                        href={profile.role === "ADMIN" ? "/admin/otletlada" : "/otletlada"}
                        data-tooltip="Ötletláda"
                        aria-label="Ötletláda"
                        onClick={() => setMenuOpen(false)}
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
                        href="/account"
                        data-tooltip="Fiók"
                        aria-label="Fiók"
                        onClick={() => setMenuOpen(false)}
                    >
                        <UtilityIcon label="Fiók">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21a8 8 0 0 0-16 0" />
                                <circle cx="12" cy="8" r="4" />
                            </svg>
                        </UtilityIcon>
                    </Link>
                    {(profile.available_roles?.length ?? 0) > 1 ? (
                        <Link
                            className="header-icon-link"
                            href="/valassz-nezetet"
                            data-tooltip="Nézetváltás"
                            aria-label="Nézetváltás"
                            onClick={() => setMenuOpen(false)}
                        >
                            <UtilityIcon label="Nézetváltás">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 7h11" />
                                    <path d="m12 3 4 4-4 4" />
                                    <path d="M20 17H9" />
                                    <path d="m12 13-4 4 4 4" />
                                </svg>
                            </UtilityIcon>
                        </Link>
                    ) : null}
                </div>
                <div className="header-nav-shell">
                    <nav id="app-navigation" className={`nav-pills${menuOpen ? " nav-open" : ""}`}>
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            className={`pill${pathname.startsWith(item.href) ? " pill-active" : ""}`}
                            href={item.href}
                            onClick={() => setMenuOpen(false)}
                        >
                            {item.label}
                        </Link>
                    ))}
                    </nav>
                </div>
            </div>
        </header>
    );
}
