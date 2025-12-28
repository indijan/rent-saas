import Link from "next/link";
import { requireUser } from "@/lib/auth/requireUser";
import { logout, updatePassword, updateProfile } from "./actions";

type Props = {
    searchParams?: Promise<{ status?: string; message?: string }> | { status?: string; message?: string };
};

export default async function AccountPage({ searchParams }: Props) {
    const { profile } = await requireUser();
    const sp = (searchParams instanceof Promise) ? await searchParams : (searchParams ?? {});
    const status = sp.status ? String(sp.status) : "";
    const message = sp.message ? String(sp.message) : "";

    return (
        <main className="app-shell page-enter space-y-4">
            <div className="card space-y-2">
                <h1>Fiók</h1>
                <div className="text-sm text-gray-600">Email: {profile.email}</div>
                <div className="text-sm text-gray-600">Szerepkör: {profile.role}</div>
                <div className="flex flex-wrap gap-3 text-sm">
                    {profile.role === "OWNER" ? (
                        <>
                            <Link className="link" href="/owner/properties">Ingatlanok</Link>
                            <Link className="link" href="/owner/tenants">Bérlők</Link>
                        </>
                    ) : null}
                    {profile.role === "TENANT" ? (
                        <Link className="link" href="/tenant/charges">Saját díjak</Link>
                    ) : null}
                    {profile.role === "ADMIN" ? (
                        <Link className="link" href="/admin/users">Admin</Link>
                    ) : null}
                </div>
            </div>

            {message ? (
                <div className={`card ${status === "error" ? "text-red-600" : "text-green-600"}`}>
                    {message}
                </div>
            ) : null}

            <form action={updateProfile} className="card space-y-3">
                <div className="card-title">Saját adatok</div>
                <input
                    name="full_name"
                    placeholder="Teljes név"
                    className="input"
                    defaultValue={profile.full_name ?? ""}
                    required
                />
                <button type="submit" className="btn btn-primary">
                    Név mentése
                </button>
            </form>

            <form action={updatePassword} className="card space-y-3">
                <div className="card-title">Jelszó módosítása</div>
                <input
                    name="password"
                    type="password"
                    placeholder="Új jelszó"
                    className="input"
                    required
                />
                <input
                    name="password_confirm"
                    type="password"
                    placeholder="Új jelszó mégegyszer"
                    className="input"
                    required
                />
                <button type="submit" className="btn btn-primary">
                    Jelszó mentése
                </button>
            </form>

            <form action={logout} className="card">
                <button type="submit" className="btn btn-primary">
                    Kijelentkezés
                </button>
            </form>
        </main>
    );
}
