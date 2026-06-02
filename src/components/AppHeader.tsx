"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type MouseEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import type { AppRole } from "@/lib/auth/requireUser";

type Profile = {
    role: AppRole;
    full_name: string | null;
    email: string;
    available_roles?: AppRole[];
};

type Props = {
    profile: Profile;
    dashboardContext?: {
        label: string;
        items: Array<{ id: string; label: string }>;
        value: string;
        baseHref?: string;
        query?: Record<string, string | undefined>;
    };
};

type NavItem = {
    href: string;
    label: string;
    icon: ReactNode;
    matches?: string[];
    mobile?: boolean;
};

type NavConfig = {
    primary: NavItem[];
    secondary: NavItem[];
};

type ThemeMode = "auto" | "light" | "dark";

function HomeIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 10.5 12 4l8 6.5" />
            <path d="M6.5 9.5V20h11V9.5" />
        </svg>
    );
}

function WalletIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="6" width="18" height="12" rx="2.5" />
            <path d="M16 12h5" />
            <circle cx="16" cy="12" r=".8" fill="currentColor" stroke="none" />
        </svg>
    );
}

function ImportIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4v10" />
            <path d="m8 10 4 4 4-4" />
            <path d="M5 19h14" />
        </svg>
    );
}

function UsersIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 20v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" />
            <circle cx="10" cy="8" r="3.2" />
            <path d="M20 20v-1a3.6 3.6 0 0 0-2.7-3.47" />
            <path d="M16.5 5.1a3 3 0 0 1 0 5.8" />
        </svg>
    );
}

function ClipboardIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="7" y="4.5" width="10" height="15" rx="2" />
            <path d="M9.5 4.5h5" />
            <path d="m9.5 12.5 1.8 1.8L15 10.5" />
        </svg>
    );
}

function IdeaIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.5 18.5h5" />
            <path d="M10.2 22h3.6" />
            <path d="M12 2.5a6.8 6.8 0 0 0-4 12.3c.85.64 1.35 1.56 1.35 2.58v1.09h5.3v-1.09c0-1.02.5-1.94 1.35-2.58A6.8 6.8 0 0 0 12 2.5Z" />
        </svg>
    );
}

function ContactIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 6.5h15A1.5 1.5 0 0 1 21 8v8a1.5 1.5 0 0 1-1.5 1.5h-4.2L12 20l-3.3-2.5H4.5A1.5 1.5 0 0 1 3 16V8a1.5 1.5 0 0 1 1.5-1.5Z" />
            <path d="M7 10.5h10" />
            <path d="M7 14h6" />
        </svg>
    );
}

function ProfileIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5 20c.9-3.3 3.4-5 7-5s6.1 1.7 7 5" />
        </svg>
    );
}

function CogIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3.4" />
            <path d="M19.4 15a1 1 0 0 0 .2 1.08l.07.08a2 2 0 0 1-2.83 2.82l-.08-.08a1 1 0 0 0-1.07-.2 1 1 0 0 0-.62.92V20a2 2 0 1 1-4 0v-.1a1 1 0 0 0-.62-.92 1 1 0 0 0-1.08.2l-.07.08a2 2 0 1 1-2.83-2.82l.08-.08A1 1 0 0 0 4.6 15a1 1 0 0 0-.92-.62H3.5a2 2 0 1 1 0-4h.18A1 1 0 0 0 4.6 9a1 1 0 0 0-.2-1.08l-.08-.07a2 2 0 1 1 2.83-2.83l.07.08A1 1 0 0 0 8.3 5.3a1 1 0 0 0 .62-.92V4.2a2 2 0 1 1 4 0v.18a1 1 0 0 0 .62.92 1 1 0 0 0 1.07-.2l.08-.08a2 2 0 0 1 2.83 2.83l-.07.07A1 1 0 0 0 19.4 9c.1.27.36.46.65.46h.18a2 2 0 1 1 0 4h-.18a1 1 0 0 0-.65.54Z" />
        </svg>
    );
}

function BuildingIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 20.5V6.5A1.5 1.5 0 0 1 6 5h4.5v15.5" />
            <path d="M13.5 20.5V3.5H18A1.5 1.5 0 0 1 19.5 5v15.5" />
            <path d="M8 9h.01" />
            <path d="M8 13h.01" />
            <path d="M16 8h.01" />
            <path d="M16 12h.01" />
        </svg>
    );
}

function ChevronLeftIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
        </svg>
    );
}

function ChevronRightIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
        </svg>
    );
}

function ChevronDownIcon() {
    return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
        </svg>
    );
}

function MenuIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h16" />
        </svg>
    );
}

function MoreIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
            <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
        </svg>
    );
}

function closeOpenMenu(event: MouseEvent<HTMLElement>) {
    const details = event.currentTarget.closest("details");
    if (details instanceof HTMLDetailsElement) {
        details.open = false;
    }
}

function closeClosestDetails(element: HTMLElement | null) {
    const details = element?.closest("details");
    if (details instanceof HTMLDetailsElement) {
        details.open = false;
    }
}

function getNavConfig(role: AppRole): NavConfig {
    if (role === "OWNER") {
        return {
            primary: [
                { href: "/owner/osszefoglalo", label: "Áttekintés", icon: <HomeIcon />, mobile: true },
                { href: "/owner/charges", label: "Pénzügyek", icon: <WalletIcon />, matches: ["/owner/properties/"], mobile: true },
                { href: "/owner/importok", label: "Importok", icon: <ImportIcon />, mobile: true },
                { href: "/owner/tenants", label: "Bérlők", icon: <UsersIcon />, mobile: true },
                { href: "/owner/todo", label: "Feladatok", icon: <ClipboardIcon />, mobile: true },
            ],
            secondary: [
                { href: "/account#otletlada", label: "Ötletláda", icon: <IdeaIcon /> },
                { href: "/account#kapcsolat", label: "Kapcsolat", icon: <ContactIcon /> },
            ],
        };
    }

    if (role === "TENANT") {
        return {
            primary: [
                { href: "/tenant/charges", label: "Díjak", icon: <WalletIcon />, mobile: true },
                { href: "/account", label: "Profil", icon: <ProfileIcon />, mobile: true },
            ],
            secondary: [
                { href: "/account#otletlada", label: "Ötletláda", icon: <IdeaIcon /> },
                { href: "/account#kapcsolat", label: "Kapcsolat", icon: <ContactIcon /> },
            ],
        };
    }

    if (role === "ADMIN") {
        return {
            primary: [
                { href: "/admin/berbeadok", label: "Bérbeadók", icon: <UsersIcon />, mobile: true },
                { href: "/admin/otletlada", label: "Ötletláda", icon: <IdeaIcon />, mobile: true },
            ],
            secondary: [],
        };
    }

    return { primary: [], secondary: [] };
}

function isNavItemActive(pathname: string, item: NavItem) {
    return pathname.startsWith(item.href) || item.matches?.some((match) => pathname.startsWith(match)) || false;
}

export default function AppHeader({ profile, dashboardContext }: Props) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const searchKey = searchParams.toString();
    const [menuOpen, setMenuOpen] = useState(false);
    const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
    const [mobileContextOpen, setMobileContextOpen] = useState(false);
    const [isCompactViewport, setIsCompactViewport] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        if (typeof window === "undefined") return false;
        return window.localStorage.getItem("rentapp-sidebar-collapsed") === "1";
    });
    const [appearanceMode, setAppearanceMode] = useState<ThemeMode>(() => {
        if (typeof window === "undefined") return "auto";
        const saved = window.localStorage.getItem("rentapp-dashboard-theme");
        return saved === "light" || saved === "dark" || saved === "auto" ? saved : "auto";
    });

    const navConfig = useMemo(() => getNavConfig(profile.role), [profile.role]);
    const navItems = useMemo(() => [...navConfig.primary, ...navConfig.secondary], [navConfig]);
    const mobileNavItems = useMemo(() => navConfig.primary.filter((item) => item.mobile), [navConfig.primary]);
    const roleLabel = profile.role === "OWNER" ? "Bérbeadó" : profile.role === "TENANT" ? "Bérlő" : "Admin";
    const initials = (profile.full_name || profile.email).trim().slice(0, 2).toUpperCase();
    const overviewHref = navConfig.primary[0]?.href || "/";
    const currentPropertyLabel = dashboardContext?.value && dashboardContext.value !== "__all__"
        ? dashboardContext.items.find((item) => item.id === dashboardContext.value)?.label ?? "Összes ingatlan"
        : "Összes ingatlan";

    useEffect(() => {
        window.localStorage.setItem("rentapp-sidebar-collapsed", sidebarCollapsed ? "1" : "0");
        document.documentElement.dataset.dashboardSidebar = sidebarCollapsed ? "collapsed" : "expanded";
    }, [sidebarCollapsed]);

    useEffect(() => {
        const media = window.matchMedia("(max-width: 980px)");
        const syncViewport = () => {
            const compact = media.matches;
            setIsCompactViewport(compact);
            if (!compact) {
                setMobileMoreOpen(false);
                setMobileContextOpen(false);
            }
        };

        syncViewport();
        media.addEventListener?.("change", syncViewport);
        return () => media.removeEventListener?.("change", syncViewport);
    }, []);

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            setMenuOpen(false);
            setMobileMoreOpen(false);
            setMobileContextOpen(false);
        });
        return () => window.cancelAnimationFrame(frame);
    }, [pathname, searchKey]);

    useEffect(() => {
        const closeMobileSheets = () => {
            setMobileMoreOpen(false);
            setMobileContextOpen(false);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                closeMobileSheets();
            }
        };
        window.addEventListener("hashchange", closeMobileSheets);
        window.addEventListener("popstate", closeMobileSheets);
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("hashchange", closeMobileSheets);
            window.removeEventListener("popstate", closeMobileSheets);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    useEffect(() => {
        if (appearanceMode === "auto") {
            delete document.documentElement.dataset.dashboardTheme;
            return;
        }
        document.documentElement.dataset.dashboardTheme = appearanceMode;
    }, [appearanceMode]);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;

            document.querySelectorAll<HTMLDetailsElement>("details.dashboard-dropdown[open]").forEach((details) => {
                if (!details.contains(target)) {
                    details.open = false;
                }
            });

            const mobileSheet = document.querySelector<HTMLElement>(".dashboard-mobile-sheet.is-open");
            const mobileTrigger = target instanceof HTMLElement
                ? target.closest<HTMLElement>("[data-dashboard-mobile-sheet-trigger='true']")
                : null;
            if ((mobileMoreOpen || mobileContextOpen) && mobileSheet && !mobileSheet.contains(target) && !mobileTrigger) {
                setMobileMoreOpen(false);
                setMobileContextOpen(false);
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        return () => document.removeEventListener("pointerdown", handlePointerDown);
    }, [mobileMoreOpen, mobileContextOpen]);

    const toggleMobileContext = () => {
        setMobileMoreOpen(false);
        setMobileContextOpen((value) => !value);
    };

    const toggleMobileMore = () => {
        setMobileContextOpen(false);
        setMobileMoreOpen((value) => !value);
    };

    const closeMobileSheets = () => {
        setMobileMoreOpen(false);
        setMobileContextOpen(false);
    };

    const handleMobileNavigate = (href: string) => (event: MouseEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        closeMobileSheets();
        window.setTimeout(() => {
            window.location.assign(href);
        }, 0);
    };

    const setThemeMode = (nextMode: ThemeMode) => {
        setAppearanceMode(nextMode);
        window.localStorage.setItem("rentapp-dashboard-theme", nextMode);
        if (nextMode === "auto") {
            delete document.documentElement.dataset.dashboardTheme;
        } else {
            document.documentElement.dataset.dashboardTheme = nextMode;
        }
    };

    const buildContextHref = (propertyValue: string) => {
        if (!dashboardContext) return overviewHref;
        const params = new URLSearchParams();
        Object.entries(dashboardContext.query ?? {}).forEach(([key, value]) => {
            if (value) params.set(key, value);
        });
        if (propertyValue !== "__all__") params.set("property", propertyValue);
        else params.delete("property");
        const query = params.toString();
        return `${dashboardContext.baseHref ?? pathname}${query ? `?${query}` : ""}`;
    };

    return (
        <>
            <header className={`app-header${sidebarCollapsed ? " app-header-collapsed" : ""}`}>
                <aside className={`dashboard-sidebar${sidebarCollapsed ? " dashboard-sidebar-collapsed" : ""}`}>
                    <div className="dashboard-sidebar-head">
                        <Link href={overviewHref} className="dashboard-brand" onClick={() => setMenuOpen(false)}>
                            <Image src="/rentapp-logo.png" alt="Rentapp" width={42} height={42} className="dashboard-brand-logo" />
                            <div className="dashboard-brand-copy">
                                <strong>Rentapp</strong>
                            </div>
                        </Link>

                        {profile.role !== "OWNER" ? (
                            <button
                                type="button"
                                className="header-toggle"
                                aria-expanded={menuOpen}
                                aria-controls="app-navigation"
                                onClick={() => setMenuOpen((value) => !value)}
                            >
                                <span className="dashboard-nav-icon" aria-hidden="true"><MenuIcon /></span>
                                <span>Menü</span>
                            </button>
                        ) : null}
                    </div>

                    <nav id="app-navigation" className={`dashboard-nav${menuOpen ? " nav-open" : ""}`}>
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                className={`dashboard-nav-item${isNavItemActive(pathname, item) ? " is-active" : ""}`}
                                href={item.href}
                                data-tooltip={item.label}
                                title={sidebarCollapsed ? item.label : undefined}
                                aria-label={item.label}
                                onClick={() => setMenuOpen(false)}
                            >
                                <span className="dashboard-nav-icon">{item.icon}</span>
                                <span className="dashboard-nav-label">{item.label}</span>
                                <span className="dashboard-nav-tooltip" aria-hidden="true">{item.label}</span>
                            </Link>
                        ))}
                    </nav>

                    <div className="dashboard-sidebar-footer">
                        <button
                            type="button"
                            className="dashboard-utility-link dashboard-collapse-button"
                            data-tooltip={sidebarCollapsed ? "Menü kinyitása" : "Menü összecsukása"}
                            title={sidebarCollapsed ? "Menü kinyitása" : "Menü összecsukása"}
                            aria-label={sidebarCollapsed ? "Menü kinyitása" : "Menü összecsukása"}
                            onClick={() => setSidebarCollapsed((value) => !value)}
                        >
                            <span className="dashboard-nav-icon">{sidebarCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}</span>
                            <span className="dashboard-nav-label">{sidebarCollapsed ? "Összenyitás" : "Összecsukás"}</span>
                            <span className="dashboard-nav-tooltip" aria-hidden="true">{sidebarCollapsed ? "Menü kinyitása" : "Menü összecsukása"}</span>
                        </button>
                    </div>
                </aside>

                <div className="dashboard-topbar">
                    <div className="dashboard-topbar-main">
                        <div className="dashboard-topbar-left">
                            {dashboardContext ? (
                                isCompactViewport ? (
                                    <button
                                        type="button"
                                        className="dashboard-context-input dashboard-context-summary dashboard-context-mobile-trigger"
                                        aria-expanded={mobileContextOpen}
                                        data-dashboard-mobile-sheet-trigger="true"
                                        onClick={toggleMobileContext}
                                    >
                                        <span className="dashboard-context-icon" aria-hidden="true">
                                            <BuildingIcon />
                                        </span>
                                        <span className="dashboard-context-summary-copy">
                                            <span className="dashboard-context-summary-label">{currentPropertyLabel}</span>
                                        </span>
                                        <span className="dashboard-context-caret" aria-hidden="true">
                                            <ChevronDownIcon />
                                        </span>
                                    </button>
                                ) : (
                                    <details className="dashboard-dropdown dashboard-context-dropdown">
                                        <summary className="dashboard-context-input dashboard-context-summary">
                                            <span className="dashboard-context-icon" aria-hidden="true">
                                                <BuildingIcon />
                                            </span>
                                            <span className="dashboard-context-summary-copy">
                                                <span className="dashboard-context-summary-label">{currentPropertyLabel}</span>
                                            </span>
                                            <span className="dashboard-context-caret" aria-hidden="true">
                                                <ChevronDownIcon />
                                            </span>
                                        </summary>
                                        <div className="dashboard-dropdown-menu">
                                            <div className="dashboard-dropdown-section-label">{dashboardContext.label}</div>
                                            <Link className="dashboard-dropdown-item" href={buildContextHref("__all__")} onClick={closeOpenMenu}>
                                                Összes ingatlan
                                            </Link>
                                            {dashboardContext.items.map((item) => (
                                                <Link key={item.id} className="dashboard-dropdown-item" href={buildContextHref(item.id)} onClick={closeOpenMenu}>
                                                    {item.label}
                                                </Link>
                                            ))}
                                            {profile.role === "OWNER" ? (
                                                <>
                                                    <div className="dashboard-dropdown-divider" />
                                                    <Link className="dashboard-dropdown-item dashboard-dropdown-item-accent" href="/owner/properties" onClick={closeOpenMenu}>
                                                        + Új ingatlan hozzáadása
                                                    </Link>
                                                </>
                                            ) : null}
                                        </div>
                                    </details>
                                )
                            ) : <div className="dashboard-topbar-spacer" aria-hidden="true" />}
                        </div>

                        <div className="header-actions">
                            <details className="dashboard-dropdown dashboard-settings-dropdown">
                                <summary className="header-icon-link dashboard-icon-summary" aria-label="Megjelenés">
                                    <CogIcon />
                                </summary>
                                <div className="dashboard-dropdown-menu dashboard-dropdown-menu-compact">
                                    <div className="dashboard-dropdown-section-label">Megjelenés</div>
                                    <button
                                        type="button"
                                        className={`dashboard-dropdown-item${appearanceMode === "auto" ? " dashboard-dropdown-item-selected" : ""}`}
                                        onClick={(event) => {
                                            setThemeMode("auto");
                                            closeClosestDetails(event.currentTarget);
                                        }}
                                    >
                                        Automatikus
                                    </button>
                                    <button
                                        type="button"
                                        className={`dashboard-dropdown-item${appearanceMode === "light" ? " dashboard-dropdown-item-selected" : ""}`}
                                        onClick={(event) => {
                                            setThemeMode("light");
                                            closeClosestDetails(event.currentTarget);
                                        }}
                                    >
                                        Világos
                                    </button>
                                    <button
                                        type="button"
                                        className={`dashboard-dropdown-item${appearanceMode === "dark" ? " dashboard-dropdown-item-selected" : ""}`}
                                        onClick={(event) => {
                                            setThemeMode("dark");
                                            closeClosestDetails(event.currentTarget);
                                        }}
                                    >
                                        Sötét
                                    </button>
                                </div>
                            </details>

                            {isCompactViewport ? (
                                <button
                                    type="button"
                                    className="dashboard-profile-chip dashboard-profile-mobile-trigger"
                                    aria-label="Profil és további műveletek"
                                    aria-expanded={mobileMoreOpen}
                                    data-dashboard-mobile-sheet-trigger="true"
                                    onClick={toggleMobileMore}
                                >
                                    <span className="dashboard-profile-avatar">{initials}</span>
                                </button>
                            ) : (
                                <details className="dashboard-dropdown dashboard-profile-dropdown">
                                    <summary className="dashboard-profile-chip">
                                        <span className="dashboard-profile-avatar">{initials}</span>
                                        <span className="dashboard-profile-copy">
                                            <strong>{profile.full_name || profile.email}</strong>
                                            <span>{roleLabel}</span>
                                        </span>
                                        <span className="dashboard-profile-caret" aria-hidden="true">
                                            <ChevronDownIcon />
                                        </span>
                                    </summary>
                                    <div className="dashboard-dropdown-menu dashboard-profile-menu">
                                        <div className="dashboard-dropdown-section-label">{roleLabel}</div>
                                        <Link className="dashboard-dropdown-item" href="/valassz-nezetet" onClick={closeOpenMenu}>
                                            Nézetváltás
                                        </Link>
                                        <Link className="dashboard-dropdown-item" href="/account" onClick={closeOpenMenu}>
                                            Profil
                                        </Link>
                                        {profile.role === "TENANT" ? (
                                            <>
                                                <Link className="dashboard-dropdown-item" href="/tenant/charges" onClick={closeOpenMenu}>
                                                    Saját díjak
                                                </Link>
                                                <Link className="dashboard-dropdown-item" href="/account#kilepesi-kerelem-kuldes" onClick={closeOpenMenu}>
                                                    Kilépés ingatlanból
                                                </Link>
                                                <Link className="dashboard-dropdown-item" href="/account#otletlada" onClick={closeOpenMenu}>
                                                    Ötletláda
                                                </Link>
                                                <Link className="dashboard-dropdown-item" href="/account#kapcsolat" onClick={closeOpenMenu}>
                                                    Kapcsolat
                                                </Link>
                                            </>
                                        ) : null}
                                        {profile.role === "OWNER" ? (
                                            <>
                                                <Link className="dashboard-dropdown-item" href="/owner/properties" onClick={closeOpenMenu}>
                                                    Ingatlanok kezelése
                                                </Link>
                                                <Link className="dashboard-dropdown-item dashboard-dropdown-item-accent" href="/owner/properties" onClick={closeOpenMenu}>
                                                    + Új ingatlan
                                                </Link>
                                                <Link className="dashboard-dropdown-item" href="/account#otletlada" onClick={closeOpenMenu}>
                                                    Ötletláda
                                                </Link>
                                                <Link className="dashboard-dropdown-item" href="/account#kapcsolat" onClick={closeOpenMenu}>
                                                    Kapcsolat
                                                </Link>
                                            </>
                                        ) : null}
                                        <div className="dashboard-dropdown-divider" />
                                        <Link className="dashboard-dropdown-item dashboard-dropdown-item-danger" href="/auth/sign-out" onClick={closeOpenMenu}>
                                            Kijelentkezés
                                        </Link>
                                    </div>
                                </details>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {mobileNavItems.length > 0 ? (
                <>
                    {mobileMoreOpen || mobileContextOpen ? (
                        <button
                            type="button"
                            className="dashboard-mobile-more-backdrop"
                            aria-label="Mobil menü bezárása"
                            onClick={closeMobileSheets}
                        />
                    ) : null}

                    {dashboardContext && isCompactViewport ? (
                        <div className={`dashboard-mobile-sheet dashboard-mobile-context-sheet${mobileContextOpen ? " is-open" : ""}`}>
                            <div className="dashboard-mobile-more-header">
                                <strong>{dashboardContext.label}</strong>
                                <span>{currentPropertyLabel}</span>
                            </div>

                            <div className="dashboard-mobile-more-grid dashboard-mobile-context-grid">
                                <Link href={buildContextHref("__all__")} className="dashboard-mobile-more-link" onClick={handleMobileNavigate(buildContextHref("__all__"))}>
                                    Összes ingatlan
                                </Link>
                                {dashboardContext.items.map((item) => (
                                    <Link key={item.id} href={buildContextHref(item.id)} className="dashboard-mobile-more-link" onClick={handleMobileNavigate(buildContextHref(item.id))}>
                                        {item.label}
                                    </Link>
                                ))}
                            </div>

                            {profile.role === "OWNER" ? (
                                <div className="dashboard-mobile-more-section">
                                    <Link href="/owner/properties" className="dashboard-mobile-more-link" onClick={handleMobileNavigate("/owner/properties")}>
                                        + Új ingatlan
                                    </Link>
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {profile.role === "OWNER" || navConfig.secondary.length > 0 ? (
                        <div className={`dashboard-mobile-sheet dashboard-mobile-more-sheet${mobileMoreOpen ? " is-open" : ""}`}>
                            <div className="dashboard-mobile-more-header">
                                <strong>Több</strong>
                                <span>{roleLabel}</span>
                            </div>

                            <div className="dashboard-mobile-more-grid">
                                <Link href="/valassz-nezetet" className="dashboard-mobile-more-link" onClick={handleMobileNavigate("/valassz-nezetet")}>
                                    Nézetváltás
                                </Link>
                                <Link href="/account" className="dashboard-mobile-more-link" onClick={handleMobileNavigate("/account")}>
                                    Profil
                                </Link>
                                {profile.role !== "TENANT" ? (
                                    <Link href="/account" className="dashboard-mobile-more-link" onClick={handleMobileNavigate("/account")}>
                                        Saját adatok
                                    </Link>
                                ) : null}
                                {profile.role === "OWNER" ? (
                                    <>
                                        <Link href="/owner/properties" className="dashboard-mobile-more-link" onClick={handleMobileNavigate("/owner/properties")}>
                                            Ingatlanok kezelése
                                        </Link>
                                        <Link href="/owner/properties" className="dashboard-mobile-more-link" onClick={handleMobileNavigate("/owner/properties")}>
                                            + Új ingatlan
                                        </Link>
                                    </>
                                ) : null}
                                {profile.role === "TENANT" ? (
                                    <Link href="/account#kilepesi-kerelem-kuldes" className="dashboard-mobile-more-link" onClick={handleMobileNavigate("/account#kilepesi-kerelem-kuldes")}>
                                        Kilépés ingatlanból
                                    </Link>
                                ) : null}
                                {navConfig.secondary.map((item) => (
                                    <Link key={item.href} href={item.href} className="dashboard-mobile-more-link" onClick={handleMobileNavigate(item.href)}>
                                        {item.label}
                                    </Link>
                                ))}
                                <Link href="/auth/sign-out" className="dashboard-mobile-more-link dashboard-mobile-more-link-danger" onClick={handleMobileNavigate("/auth/sign-out")}>
                                    Kijelentkezés
                                </Link>
                            </div>

                            <div className="dashboard-mobile-more-section">
                                <div className="dashboard-dropdown-section-label">Megjelenés</div>
                                <div className="dashboard-mobile-theme-grid">
                                    <button
                                        type="button"
                                        className={`dashboard-mobile-theme-button${appearanceMode === "auto" ? " is-active" : ""}`}
                                        onClick={() => setThemeMode("auto")}
                                    >
                                        Auto
                                    </button>
                                    <button
                                        type="button"
                                        className={`dashboard-mobile-theme-button${appearanceMode === "light" ? " is-active" : ""}`}
                                        onClick={() => setThemeMode("light")}
                                    >
                                        Világos
                                    </button>
                                    <button
                                        type="button"
                                        className={`dashboard-mobile-theme-button${appearanceMode === "dark" ? " is-active" : ""}`}
                                        onClick={() => setThemeMode("dark")}
                                    >
                                        Sötét
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <nav className="dashboard-mobile-nav" aria-label="Mobil navigáció">
                        {mobileNavItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`dashboard-mobile-nav-item${isNavItemActive(pathname, item) ? " is-active" : ""}`}
                                onClick={handleMobileNavigate(item.href)}
                            >
                                <span className="dashboard-mobile-nav-icon">{item.icon}</span>
                                <span>{item.label}</span>
                            </Link>
                        ))}
                        {profile.role === "OWNER" || navConfig.secondary.length > 0 ? (
                            <button
                                type="button"
                                className={`dashboard-mobile-nav-item dashboard-mobile-nav-button${mobileMoreOpen ? " is-active" : ""}`}
                                aria-expanded={mobileMoreOpen}
                                aria-label="További menüpontok"
                                data-dashboard-mobile-sheet-trigger="true"
                                onClick={toggleMobileMore}
                            >
                                <span className="dashboard-mobile-nav-icon"><MoreIcon /></span>
                                <span>Több</span>
                            </button>
                        ) : null}
                    </nav>
                </>
            ) : null}
        </>
    );
}
