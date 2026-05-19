import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { assignTenantToProperty, deleteProperty, removeTenantFromProperty, updateProperty } from "./actions";
import DeletePropertyForm from "./DeletePropertyForm";
import AppHeader from "@/components/AppHeader";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listOwnerTenantIds } from "@/lib/tenantOwnership";
import OwnerPropertyEditForm from "./OwnerPropertyEditForm";
import { maskAddress } from "@/lib/addressMasking";
import PendingSubmitButton from "@/components/PendingSubmitButton";
import { listPropertyTenants } from "@/lib/propertyTenants";

type Props = {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ status?: string; message?: string }> | { status?: string; message?: string };
};

type TenantOption = {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
};

export default async function OwnerPropertyDetailPage({ params, searchParams }: Props) {
    const { id } = await params;
    const { supabase, profile } = await requireRole("OWNER");
    const sp = searchParams instanceof Promise ? await searchParams : (searchParams ?? {});
    const status = sp.status ? String(sp.status) : "";
    const message = sp.message ? String(sp.message) : "";

    const { data: property, error } = await supabase
        .from("properties")
        .select("id,name,address,status,created_at,tenant_id")
        .eq("id", id)
        .eq("owner_id", profile.id)
        .single();

    if (error || !property) return notFound();

    const admin = createSupabaseAdminClient();
    const tenantIds = await listOwnerTenantIds(profile.id);
    const assignedTenants = await listPropertyTenants(property.id);
    const { data: tenants } = tenantIds.length === 0
        ? { data: [] }
        : await admin
            .from("profiles")
            .select("id,email,full_name,role")
            .in("id", tenantIds)
            .order("email");
    const tenantOptions = (tenants ?? []) as TenantOption[];

    return (
        <main className="app-shell page-enter space-y-4">
            <AppHeader profile={profile} />

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <Link className="link text-sm" href="/owner/properties">
                            ← Vissza
                        </Link>
                        <div className="eyebrow">Ingatlan részletei</div>
                        <h1>{property.name}</h1>
                        <p className="text-sm text-gray-600">{maskAddress(property.address)}</p>
                    </div>
                </div>
            </section>

            {message ? (
                <div className={`card ${status === "error" ? "text-red-600" : "text-green-600"}`}>
                    {message}
                </div>
            ) : null}

            <section className="card section-stack">
                <div className="card-title">Áttekintés</div>
                <div className="info-strip">
                    <span>
                        <b>Státusz:</b>{" "}
                    <span className={`status-badge status-${String(property.status).toLowerCase()}`}>
                        {property.status === "ACTIVE" ? "Aktív" : "Inaktív"}
                    </span>
                    </span>
                    <span>
                        <b>Elsődleges bérlő:</b>{" "}
                    {property.tenant_id
                        ? tenantOptions.find((tenant) => tenant.id === property.tenant_id)?.email ?? "ismeretlen"
                        : "nincs hozzárendelve"}
                    </span>
                </div>
            </section>
            <section className="card section-stack">
                <div className="card-title">Hozzárendelt bérlők</div>
                {assignedTenants.length === 0 ? (
                    <p className="muted-note">Ehhez az ingatlanhoz még nincs bérlő hozzárendelve.</p>
                ) : (
                    <div className="charge-list">
                        {assignedTenants.map((tenant) => (
                            <div key={tenant.id} className="charge-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <div className="card-title">{tenant.full_name || tenant.email}</div>
                                    <div className="text-sm text-gray-600">{tenant.email}</div>
                                    {tenant.id === property.tenant_id ? (
                                        <div className="muted-note">Elsődleges bérlő</div>
                                    ) : null}
                                </div>
                                <form
                                    action={async () => {
                                        "use server";
                                        const res = await removeTenantFromProperty(property.id, tenant.id);
                                        if (!res.ok) {
                                            const msg = res.error ?? "Ismeretlen hiba.";
                                            redirect(`/owner/properties/${property.id}?status=error&message=${encodeURIComponent(msg)}`);
                                        }
                                        redirect(`/owner/properties/${property.id}?status=success&message=A+b%C3%A9rl%C5%91+le+lett+v%C3%A1lasztva+az+ingatlanr%C3%B3l.`);
                                    }}
                                >
                                    <PendingSubmitButton className="btn btn-secondary btn-sm" label="Leválasztás" pendingLabel="Mentés..." />
                                </form>
                            </div>
                        ))}
                    </div>
                )}
            </section>
            <OwnerPropertyEditForm
                action={async (formData) => {
                    "use server";
                    const res = await updateProperty(property.id, formData);
                    if (!res.ok) {
                        const msg = res.error ?? "Ismeretlen hiba.";
                        redirect(`/owner/properties/${property.id}?status=error&message=${encodeURIComponent(msg)}`);
                    }
                    redirect(`/owner/properties/${property.id}?status=success&message=Az+ingatlan+adatai+elmentve.`);
                }}
                name={property.name}
                address={property.address}
                status={property.status}
            />
            <form
                action={async (formData) => {
                    "use server";
                    const res = await assignTenantToProperty(property.id, formData);
                    if (!res.ok) {
                        const msg = res.error ?? "Ismeretlen hiba.";
                        redirect(`/owner/properties/${property.id}?status=error&message=${encodeURIComponent(msg)}`);
                    }
                    redirect(`/owner/properties/${property.id}?status=success&message=A+b%C3%A9rl%C5%91+hozz%C3%A1rendel%C3%A9se+siker%C3%BClt.`);
                }}
                className="card form-shell"
            >
                <div className="section-header">
                    <div>
                        <div className="card-title">Bérlő hozzárendelése</div>
                        <p className="muted-note">A bérlőt bármikor át tudod tenni másik ingatlanhoz is.</p>
                    </div>
                </div>
                <div className="form-panel">
                    <label className="field-stack">
                        <span className="field-label">Válassz bérlőt</span>
                        <select
                            name="tenant_id"
                            className="select"
                            required
                            defaultValue=""
                        >
                            <option value="" disabled>Válassz bérlőt...</option>
                            {tenantOptions.map((tenant) => (
                                <option key={tenant.id} value={tenant.id}>
                                    {tenant.email}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <PendingSubmitButton
                    className="btn btn-primary"
                    label="Bérlő hozzárendelése"
                    pendingLabel="Hozzárendelés..."
                />
                <p className="muted-note">
                    Tipp: a bérlői fióknak már léteznie kell, ezt a Bérlők oldalon tudod létrehozni.
                </p>
            </form>

            <section className="card section-stack">
                <div className="card-title">Kapcsolódó műveletek</div>
                <div className="charge-actions">
                    <Link className="btn btn-primary" href={`/owner/properties/${property.id}/charges`}>
                        Díjak megnyitása
                    </Link>
                </div>
            </section>

            <DeletePropertyForm
                action={async () => {
                    "use server";
                    const res = await deleteProperty(property.id);
                    if (!res.ok) {
                        const msg = res.error ?? "Ismeretlen hiba.";
                        redirect(`/owner/properties/${property.id}?status=error&message=${encodeURIComponent(msg)}`);
                    }
                    redirect("/owner/properties?status=success&message=Az+ingatlan+t%C3%B6r%C3%B6lve+lett.");
                }}
            />
        </main>
    );
}
