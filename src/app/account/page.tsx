import { logout } from "./actions";

export default function AccountPage() {
    return (
        <main className="app-shell page-enter">
            <div className="card space-y-3">
                <h1>Fiók</h1>

                <form action={logout}>
                    <button type="submit" className="btn btn-primary">
                        Kijelentkezés
                    </button>
                </form>
            </div>
        </main>
    );
}
