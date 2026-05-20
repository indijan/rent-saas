import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import AppHeader from "@/components/AppHeader";
import { maskAddress } from "@/lib/addressMasking";

type PropertyRow = {
    id: string;
    name: string;
    address: string;
    status: string;
};

export default async function OwnerChargesOverviewPage() {
    const { supabase, profile } = await requireRole("OWNER");

    const { data: properties, error } = await supabase
        .from("properties")
        .select("id,name,address,status")
        .eq("owner_id", profile.id)
        .neq("status", "ARCHIVED")
        .order("name");

    if (error) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <div className="card">
                    <h1>Díjak</h1>
                    <p className="text-red-600">Hiba: {error.message}</p>
                </div>
            </main>
        );
    }

    const propertyRows = (properties ?? []) as PropertyRow[];

    if (propertyRows.length === 1) {
        redirect(`/owner/properties/${propertyRows[0].id}/charges`);
    }

    return (
        <main className="app-shell page-enter space-y-4">
            <AppHeader profile={profile} />

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Díjak</div>
                        <h1>Válassz ingatlant</h1>
                        <p className="muted-note">Ha több ingatlanod van, innen egy kattintással eléred a hozzájuk tartozó díjakat.</p>
                    </div>
                </div>
            </section>

            {propertyRows.length === 0 ? (
                <section className="card">
                    <p className="muted-note">Még nincs rögzített ingatlan.</p>
                </section>
            ) : (
                <section className="property-picker-grid">
                    {propertyRows.map((property) => (
                        <Link key={property.id} className="property-picker-card" href={`/owner/properties/${property.id}/charges`}>
                            <div className="property-picker-head">
                                <div className="property-picker-copy">
                                    <div className="card-title">{property.name}</div>
                                    <p className="muted-note">{maskAddress(property.address)}</p>
                                </div>
                                <div className="property-picker-pill">Díjak megnyitása</div>
                            </div>
                        </Link>
                    ))}
                </section>
            )}
        </main>
    );
}
