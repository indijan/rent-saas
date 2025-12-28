import { requireUser } from "@/lib/auth/requireUser";
import { logout, updatePassword, updateProfile } from "./actions";

export default async function AccountPage() {
    const { profile } = await requireUser();

    return (
        <main className="app-shell page-enter space-y-4">
            <div className="card space-y-2">
                <h1>Fiók</h1>
                <div className="text-sm text-gray-600">Email: {profile.email}</div>
                <div className="text-sm text-gray-600">Szerepkör: {profile.role}</div>
            </div>

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
