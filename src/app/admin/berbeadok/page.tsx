import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import AppHeader from "@/components/AppHeader";
import { createOwner } from "./actions";

type Props = {
    searchParams?: Promise<{ status?: string; message?: string }> | { status?: string; message?: string };
};

type OwnerProfileRow = {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    created_at: string | null;
};

type PropertyOwnerRow = {
    owner_id: string;
};

export default async function AdminOwnersPage({ searchParams }: Props) {
    const { profile } = await requireRole("ADMIN");
    const admin = createSupabaseAdminClient();
    const sp = searchParams instanceof Promise ? await searchParams : (searchParams ?? {});
    const status = sp.status ? String(sp.status) : "";
    const message = sp.message ? String(sp.message) : "";

    const { data: memberships, error: membershipError } = await admin
        .from("owner_memberships")
        .select("user_id");

    if (membershipError) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <div className="card">
                    <h1>Admin bérbeadókezelés</h1>
                    <p className="text-red-600">Hiba: {membershipError.message}</p>
                </div>
            </main>
        );
    }

    const ownerIds = Array.from(new Set((memberships ?? []).map((row) => row.user_id as string).filter(Boolean)));
    const { data: owners, error: ownerError } = ownerIds.length === 0
        ? { data: [], error: null }
        : await admin
            .from("profiles")
            .select("id,email,full_name,role,created_at")
            .in("id", ownerIds)
            .order("created_at", { ascending: false });

    if (ownerError) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <div className="card">
                    <h1>Admin bérbeadókezelés</h1>
                    <p className="text-red-600">Hiba: {ownerError.message}</p>
                </div>
            </main>
        );
    }

    const { data: propertyRows } = ownerIds.length === 0
        ? { data: [] }
        : await admin
            .from("properties")
            .select("owner_id")
            .in("owner_id", ownerIds);

    const propertyCountByOwner = new Map<string, number>();
    ((propertyRows ?? []) as PropertyOwnerRow[]).forEach((row) => {
        propertyCountByOwner.set(row.owner_id, (propertyCountByOwner.get(row.owner_id) ?? 0) + 1);
    });

    return (
        <main className="app-shell page-enter space-y-4">
            <AppHeader profile={profile} />

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Admin</div>
                        <h1>Bérbeadók</h1>
                        <p>
                            Itt a bérbeadói hozzáféréseket kezeled. Innen lehet új bérbeadót meghívni,
                            vagy meglévő fióknak owner jogosultságot adni.
                        </p>
                    </div>
                </div>
            </section>

            {message ? (
                <div className={`card ${status === "error" ? "text-red-600" : "text-green-600"}`}>
                    {message}
                </div>
            ) : null}

            <form
                action={async (formData) => {
                    "use server";
                    const res = await createOwner(formData);
                    if (!res.ok) {
                        const msg = res.error ?? "Ismeretlen hiba.";
                        redirect(`/admin/berbeadok?status=error&message=${encodeURIComponent(msg)}`);
                    }
                    redirect("/admin/berbeadok?status=success&message=B%C3%A9rbead%C3%B3+megh%C3%ADvva.");
                }}
                className="card form-shell"
            >
                <div className="section-header">
                    <div>
                        <div className="card-title">Új bérbeadó meghívása</div>
                        <p className="muted-note">Ha az e-mail-cím már létezik, a rendszer owner jogosultságot ad a meglévő fióknak.</p>
                    </div>
                </div>
                <div className="form-panel">
                    <div className="form-grid">
                        <label className="field-stack">
                            <span className="field-label">Teljes név</span>
                            <input name="full_name" className="input" placeholder="Név" required />
                        </label>
                        <label className="field-stack">
                            <span className="field-label">E-mail-cím</span>
                            <input name="email" type="email" className="input" placeholder="email@pelda.hu" required />
                        </label>
                    </div>
                </div>
                <button className="btn btn-primary" type="submit">
                    Meghívó küldése
                </button>
            </form>

            <section className="card charge-list">
                {((owners ?? []) as OwnerProfileRow[]).length === 0 ? (
                    <div className="charge-card">
                        <div className="card-title">Még nincs bérbeadó.</div>
                    </div>
                ) : (
                    ((owners ?? []) as OwnerProfileRow[]).map((owner) => (
                        <article key={owner.id} className="charge-card">
                            <div className="card-title">{owner.full_name || "Név nélküli bérbeadó"}</div>
                            <div className="charge-meta">
                                <span>{owner.email}</span>
                                <span>Alap szerepkör: {owner.role === "ADMIN" ? "Admin" : owner.role === "OWNER" ? "Tulajdonos" : "Bérlő"}</span>
                                <span>Ingatlanok: {propertyCountByOwner.get(owner.id) ?? 0}</span>
                                <span>Létrehozva: {owner.created_at ? new Date(owner.created_at).toLocaleDateString("hu-HU") : "-"}</span>
                            </div>
                        </article>
                    ))
                )}
            </section>
        </main>
    );
}
