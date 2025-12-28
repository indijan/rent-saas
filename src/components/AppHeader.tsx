import Link from "next/link";
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
        return [{ href: "/account", label: "Fiók" }];
    })();

    return (
        <header className="app-header">
            <div className="brand">
                <div className="flex items-center gap-3">
                    <div
                        className="flex h-10 w-10 items-center justify-center rounded-full"
                        style={{
                            background: "linear-gradient(135deg, #e07a5f, #f1c453)",
                            color: "#12181f",
                            fontWeight: 800,
                            boxShadow: "0 8px 16px rgba(18, 24, 31, 0.18)",
                        }}
                        aria-hidden="true"
                    >
                        R
                    </div>
                    <div className="text-lg font-semibold">Rentapp</div>
                </div>
                <span>
                    {profile.full_name || profile.email} · {profile.role}
                </span>
            </div>
            <nav className="nav-pills">
                {navItems.map((item) => (
                    <Link key={item.href} className="pill" href={item.href}>
                        {item.label}
                    </Link>
                ))}
            </nav>
        </header>
    );
}
