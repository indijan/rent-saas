import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import AppHeader from "@/components/AppHeader";
import { addPropertyImportAlias, deletePropertyImportAlias } from "./actions";

type Props = {
    searchParams?: Promise<{ status?: string; message?: string }> | { status?: string; message?: string };
};

type PropertyRow = {
    id: string;
    name: string;
    address: string;
};

type AliasRow = {
    id: string;
    property_id: string;
    alias_text: string;
    created_at: string;
};

export default async function OwnerImportSettingsPage({ searchParams }: Props) {
    const { supabase, user, profile } = await requireRole("OWNER");
    const sp = searchParams instanceof Promise ? await searchParams : (searchParams ?? {});
    const status = sp.status ? String(sp.status) : "";
    const message = sp.message ? String(sp.message) : "";

    const [{ data: properties, error: propertyError }, { data: aliases, error: aliasError }] = await Promise.all([
        supabase
            .from("properties")
            .select("id,name,address")
            .eq("owner_id", user.id)
            .order("name"),
        supabase
            .from("property_import_aliases")
            .select("id,property_id,alias_text,created_at")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false }),
    ]);

    if (propertyError || aliasError) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <div className="card">
                    <h1>Import beállítások</h1>
                    <p className="text-red-600">Hiba: {propertyError?.message || aliasError?.message}</p>
                </div>
            </main>
        );
    }

    const propertyRows = (properties ?? []) as PropertyRow[];
    const aliasRows = (aliases ?? []) as AliasRow[];
    const aliasesByProperty = new Map<string, AliasRow[]>();

    for (const alias of aliasRows) {
        const items = aliasesByProperty.get(alias.property_id) ?? [];
        items.push(alias);
        aliasesByProperty.set(alias.property_id, items);
    }

    return (
        <main className="app-shell page-enter space-y-4">
            <AppHeader profile={profile} />

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <Link className="link text-sm" href="/owner/importok">
                            ← Vissza az importokhoz
                        </Link>
                        <div className="eyebrow">Automatikus hozzárendelés</div>
                        <h1>Import beállítások</h1>
                        <p>
                            Itt adhatsz meg olyan aliasokat, amelyek alapján az e-mailből érkező számlák
                            nagyobb eséllyel a megfelelő ingatlanhoz kerülnek.
                        </p>
                    </div>
                </div>
            </section>

            {message ? (
                <div className={`card ${status === "error" ? "text-red-600" : "text-green-600"}`}>
                    {message}
                </div>
            ) : null}

            {propertyRows.length === 0 ? (
                <section className="card">
                    <div className="card-title">Még nincs ingatlan.</div>
                    <p className="muted-note">Aliasokat akkor tudsz megadni, ha már van legalább egy ingatlanod.</p>
                </section>
            ) : (
                <div className="space-y-4">
                    {propertyRows.map((property) => {
                        const propertyAliases = aliasesByProperty.get(property.id) ?? [];

                        return (
                            <section key={property.id} className="card section-stack">
                                <div className="section-header">
                                    <div>
                                        <div className="card-title">{property.name}</div>
                                        <p className="muted-note">{property.address}</p>
                                    </div>
                                </div>

                                <form
                                    action={async (formData) => {
                                        "use server";
                                        const res = await addPropertyImportAlias(formData);
                                        if (!res.ok) {
                                            const msg = res.error ?? "Ismeretlen hiba.";
                                            redirect(`/owner/importok/beallitasok?status=error&message=${encodeURIComponent(msg)}`);
                                        }
                                        redirect("/owner/importok/beallitasok?status=success&message=Az+import+alias+elmentve.");
                                    }}
                                    className="form-panel"
                                >
                                    <input type="hidden" name="property_id" value={property.id} />
                                    <div className="form-grid">
                                        <label className="field-stack">
                                            <span className="field-label">Új alias</span>
                                            <input
                                                name="alias_text"
                                                className="input"
                                                placeholder="Pl. Váci 12, Belvárosi lakás, Nagymező utcai lakás"
                                                required
                                            />
                                        </label>
                                    </div>
                                    <button className="btn btn-secondary" type="submit">
                                        Alias mentése
                                    </button>
                                </form>

                                {propertyAliases.length === 0 ? (
                                    <p className="muted-note">Ehhez az ingatlanhoz még nincs import alias.</p>
                                ) : (
                                    <div className="charge-list">
                                        {propertyAliases.map((alias) => (
                                            <article key={alias.id} className="charge-card">
                                                <div className="section-header">
                                                    <div>
                                                        <div className="card-title">{alias.alias_text}</div>
                                                        <div className="muted-note">
                                                            {new Date(alias.created_at).toLocaleString("hu-HU")}
                                                        </div>
                                                    </div>
                                                    <form
                                                        action={async () => {
                                                            "use server";
                                                            const res = await deletePropertyImportAlias(alias.id);
                                                            if (!res.ok) {
                                                                const msg = res.error ?? "Ismeretlen hiba.";
                                                                redirect(`/owner/importok/beallitasok?status=error&message=${encodeURIComponent(msg)}`);
                                                            }
                                                            redirect("/owner/importok/beallitasok?status=success&message=Az+alias+t%C3%B6r%C3%B6lve.");
                                                        }}
                                                    >
                                                        <button className="btn btn-ghost btn-sm" type="submit">
                                                            Törlés
                                                        </button>
                                                    </form>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}
        </main>
    );
}
