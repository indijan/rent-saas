import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { revalidatePath } from "next/cache";
import { assignTenantToProperty, updateProperty } from "./actions";
import { createClient } from "@supabase/supabase-js";

type Props = { params: Promise<{ id: string }> };

export default async function OwnerPropertyDetailPage({ params }: Props) {
    const { id } = await params;
    const { supabase } = await requireRole("OWNER");

    const { data: property, error } = await supabase
        .from("properties")
        .select("id,name,address,status,created_at,tenant_id")
        .eq("id", id)
        .single();

    if (error || !property) return notFound();

    const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: tenants } = await admin
        .from("profiles")
        .select("id,email,full_name,role")
        .eq("role", "TENANT")
        .order("email");

    return (
        <main className="app-shell page-enter space-y-4">
            <div className="card flex items-center justify-between">
                <div>
                    <Link className="link text-sm" href="/owner/properties">
                        ← Vissza
                    </Link>
                    <h1 className="mt-2">{property.name}</h1>
                    <p className="text-sm text-gray-600">{property.address}</p>
                </div>

                <Link className="link" href="/account">
                    Account
                </Link>
            </div>

            <div className="card space-y-2">
                <div>
                    <b>Státusz:</b>{" "}
                    <span className={`status-badge status-${String(property.status).toLowerCase()}`}>
                        {property.status}
                    </span>
                </div>
                <div>
                    <b>Tenant:</b>{" "}
                    {property.tenant_id
                        ? (tenants ?? []).find((t: any) => t.id === property.tenant_id)?.email ?? "ismeretlen"
                        : "nincs"}
                </div>
            </div>
            <form
                action={async (formData) => {
                    "use server";
                    const res = await updateProperty(property.id, formData);
                    if (!res.ok) return;
                    revalidatePath(`/owner/properties/${property.id}`);
                    revalidatePath(`/owner/properties/${property.id}/charges`);
                }}
                className="card space-y-3"
            >
                <div className="card-title">Ingatlan szerkesztése</div>
                <div className="grid gap-3 md:grid-cols-2">
                    <input
                        name="name"
                        className="input"
                        defaultValue={property.name}
                        required
                    />
                    <input
                        name="address"
                        className="input"
                        defaultValue={property.address}
                        required
                    />
                    <select
                        name="status"
                        className="select"
                        defaultValue={property.status}
                    >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="INACTIVE">INACTIVE</option>
                    </select>
                </div>
                <button className="btn btn-primary">
                    Mentés
                </button>
            </form>
            <form
                action={async (formData) => {
                    "use server";
                    const res = await assignTenantToProperty(property.id, formData);
                    if (!res.ok) return;
                    revalidatePath(`/owner/properties/${property.id}`);
                    revalidatePath(`/owner/properties/${property.id}/charges`);
                }}
                className="card space-y-3"
            >
                <div className="card-title">Tenant hozzárendelés</div>
                <select
                    name="tenant_id"
                    className="select"
                    required
                    defaultValue=""
                >
                    <option value="" disabled>Válassz tenantot…</option>
                    {(tenants ?? []).map((t: any) => (
                        <option key={t.id} value={t.id}>
                            {t.email}
                        </option>
                    ))}
                </select>
                <button className="btn btn-primary">
                    Hozzárendelés
                </button>
                <p className="text-xs text-gray-600">
                    Tipp: a TENANT usernek már léteznie kell (Auth user + profiles sor).
                </p>
            </form>

            <div className="card space-y-2">
                <Link className="link" href={`/owner/properties/${property.id}/charges`}>
                    Díjak megnyitása →
                </Link>
            </div>
        </main>
    );
}
