import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/requireUser";
import { chooseRole } from "./actions";
import PendingSubmitButton from "@/components/PendingSubmitButton";

export default async function RoleChooserPage() {
    const { profile } = await requireUser();

    if (profile.available_roles.length <= 1) {
        redirect("/dashboard");
    }

    return (
        <main className="auth-shell page-enter">
            <div className="auth-card form-shell">
                <div>
                    <div className="eyebrow">Nézetválasztás</div>
                    <h1>Melyik felületre lépsz be?</h1>
                    <p className="muted-note">Ugyanazzal az e-mail-címmel több szerepköröd is lehet. Válaszd ki az aktuális nézetet.</p>
                </div>

                <div className="charge-actions">
                    {profile.available_roles.includes("OWNER") ? (
                        <form action={async () => { "use server"; await chooseRole("OWNER"); }}>
                            <PendingSubmitButton className="btn btn-primary w-full" label="Belépés bérbeadóként" pendingLabel="Betöltés..." />
                        </form>
                    ) : null}
                    {profile.available_roles.includes("TENANT") ? (
                        <form action={async () => { "use server"; await chooseRole("TENANT"); }}>
                            <PendingSubmitButton className="btn btn-secondary w-full" label="Belépés bérlőként" pendingLabel="Betöltés..." />
                        </form>
                    ) : null}
                    {profile.available_roles.includes("ADMIN") ? (
                        <form action={async () => { "use server"; await chooseRole("ADMIN"); }}>
                            <PendingSubmitButton className="btn btn-secondary w-full" label="Belépés adminként" pendingLabel="Betöltés..." />
                        </form>
                    ) : null}
                </div>
            </div>
        </main>
    );
}
