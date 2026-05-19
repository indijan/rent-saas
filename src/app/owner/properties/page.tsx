import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import AppHeader from "@/components/AppHeader";
import { createProperty } from "./actions";
import OwnerPropertyCreateForm from "./OwnerPropertyCreateForm";
import { maskAddress } from "@/lib/addressMasking";

type Props = {
    searchParams?: Promise<{ status?: string; message?: string }> | { status?: string; message?: string };
};

export default async function OwnerPropertiesPage({ searchParams }: Props) {
    const { supabase, profile } = await requireRole("OWNER");
    const admin = createSupabaseAdminClient();
    const sp = searchParams instanceof Promise ? await searchParams : (searchParams ?? {});
    const status = sp.status ? String(sp.status) : "";
    const message = sp.message ? String(sp.message) : "";

    const { data: properties, error } = await supabase
        .from("properties")
        .select("id,name,address,status,created_at,tenant_id")
        .eq("owner_id", profile.id)
        .order("created_at", { ascending: false });

    async function onCreate(formData: FormData) {
        "use server";
        const res = await createProperty(formData);
        if (!res.ok) {
            const msg = res.error ?? "Ismeretlen hiba.";
            redirect(`/owner/properties?status=error&message=${encodeURIComponent(msg)}`);
        }
        if (res.duplicate) {
            redirect("/owner/properties?status=success&message=Ez+az+ingatlan+m%C3%A1r+l%C3%A9tezik%2C+ez%C3%A9rt+nem+hoztuk+l%C3%A9tre+ism%C3%A9t.");
        }
        redirect("/owner/properties?status=success&message=Az+ingatlan+l%C3%A9trej%C3%B6tt.");
    }

    if (error) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <div className="card space-y-2">
                <h1>Ingatlanok</h1>
                <p className="mt-2 text-red-600">Hiba: {error.message}</p>
                </div>
            </main>
        );
    }

    const tenantIds = Array.from(new Set((properties ?? []).map((property) => property.tenant_id).filter(Boolean)));
    const { data: tenantProfiles } = tenantIds.length > 0
        ? await admin.from("profiles").select("id,email,full_name").in("id", tenantIds)
        : { data: [] as { id: string; email: string; full_name: string | null }[] };
    const tenantById = new Map((tenantProfiles ?? []).map((tenant) => [tenant.id, tenant]));
    const propertyIds = (properties ?? []).map((property) => property.id);
    const { data: propertyTenantRows } = propertyIds.length === 0
        ? { data: [] as Array<{ property_id: string; tenant_id: string }> }
        : await admin
            .from("property_tenants")
            .select("property_id,tenant_id")
            .in("property_id", propertyIds);
    const tenantCountByProperty = new Map<string, number>();
    (propertyTenantRows ?? []).forEach((row) => {
        const propertyId = row.property_id as string | null;
        if (!propertyId) return;
        tenantCountByProperty.set(propertyId, (tenantCountByProperty.get(propertyId) ?? 0) + 1);
    });

    const propertyCount = properties?.length ?? 0;
    const activeCount = (properties ?? []).filter((property) => property.status === "ACTIVE").length;
    const inactiveCount = Math.max(0, propertyCount - activeCount);

    return (
        <main className="app-shell page-enter space-y-4">
            <AppHeader profile={profile} />

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Portfólió áttekintés</div>
                        <h1>Ingatlanok</h1>
                        <p>Itt kezeled az ingatlanállományt, a státuszokat és az egyes lakások pénzügyi felületeit.</p>
                    </div>
                </div>
                <div className="kpi-grid stagger">
                    <div className="kpi-card">
                        <div className="kpi-label">Összes ingatlan</div>
                        <div className="kpi-value">{propertyCount}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Aktív</div>
                        <div className="kpi-value">{activeCount}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Inaktív</div>
                        <div className="kpi-value">{inactiveCount}</div>
                    </div>
                </div>
            </section>

            {message ? (
                <div className={`card ${status === "error" ? "text-red-600" : "text-green-600"}`}>
                    {message}
                </div>
            ) : null}

            <OwnerPropertyCreateForm action={onCreate} />

            {(!properties || properties.length === 0) ? (
                <div className="card">
                    <p className="card-title">Nincs még ingatlanod.</p>
                </div>
            ) : (
                <div className="card charge-list">
                    {properties.map((p) => (
                        (() => {
                            const tenant = p.tenant_id ? tenantById.get(p.tenant_id) : null;
                            const tenantCount = tenantCountByProperty.get(p.id) ?? (tenant ? 1 : 0);
                            return (
                        <Link
                            key={p.id}
                            href={`/owner/properties/${p.id}`}
                            className="charge-card block"
                        >
                            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <div className="card-title">{p.name}</div>
                                    <div className="text-sm text-gray-600">{maskAddress(p.address)}</div>
                                    <div className="muted-note">
                                        {tenantCount > 1
                                            ? `Elsődleges bérlő: ${tenant ? (tenant.full_name || tenant.email) : "ismeretlen"} · Összes bérlő: ${tenantCount}`
                                            : `Bérlő: ${tenant ? (tenant.full_name || tenant.email) : "Nincs hozzárendelve"}`}
                                    </div>
                                </div>
                                <div className={`status-badge status-${String(p.status).toLowerCase()}`}>
                                    {p.status === "ACTIVE" ? "Aktív" : "Inaktív"}
                                </div>
                            </div>
                        </Link>
                            );
                        })()
                    ))}
                </div>
            )}
        </main>
    );
}
