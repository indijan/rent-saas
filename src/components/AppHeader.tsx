"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { AppRole } from "@/lib/auth/requireUser";

type Profile = {
    role: AppRole;
    full_name: string | null;
    email: string;
};

type Props = {
    profile: Profile;
};

export default function AppHeader({ profile }: Props) {
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);
    const navItems = (() => {
        if (profile.role === "OWNER") {
            return [
                { href: "/owner/properties", label: "Ingatlanok" },
                { href: "/owner/tenants", label: "Bérlők" },
                { href: "/account", label: "Fiók" },
            ];
        }
        if (profile.role === "TENANT") {
            return [
                { href: "/tenant/charges", label: "Díjak" },
                { href: "/account", label: "Fiók" },
            ];
        }
        if (profile.role === "ADMIN") {
            return [
                { href: "/admin/berlok", label: "Bérlők" },
                { href: "/account", label: "Fiók" },
            ];
        }
        return [{ href: "/account", label: "Fiók" }];
    })();
    const roleLabel = profile.role === "OWNER" ? "Tulajdonos" : profile.role === "TENANT" ? "Bérlő" : "Admin";

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
                <span>
                    {profile.full_name || profile.email} · {roleLabel}
                </span>
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
        </header>
    );
}
