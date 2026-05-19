import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TenantProfile = {
    id: string;
    email: string;
    full_name: string | null;
};

export type TenantPropertyRow = {
    id: string;
    name: string;
    address: string;
    owner_id: string;
    owner_name: string | null;
    owner_email: string | null;
};

export async function listTenantPropertyIds(tenantId: string) {
    const admin = createSupabaseAdminClient();
    const ids = new Set<string>();

    try {
        const { data: memberships } = await admin
            .from("property_tenants")
            .select("property_id")
            .eq("tenant_id", tenantId);

        (memberships ?? []).forEach((row) => {
            const propertyId = row.property_id as string | null;
            if (propertyId) ids.add(propertyId);
        });
    } catch {
        // A tábla migráció előtt még nem biztos, hogy létezik.
    }

    const { data: fallbackProperties } = await admin
        .from("properties")
        .select("id")
        .eq("tenant_id", tenantId);

    (fallbackProperties ?? []).forEach((row) => {
        const propertyId = row.id as string | null;
        if (propertyId) ids.add(propertyId);
    });

    return Array.from(ids);
}

export async function listPropertyTenants(propertyId: string) {
    const admin = createSupabaseAdminClient();
    const ids = new Set<string>();

    try {
        const { data: memberships } = await admin
            .from("property_tenants")
            .select("tenant_id")
            .eq("property_id", propertyId);

        (memberships ?? []).forEach((row) => {
            const tenantId = row.tenant_id as string | null;
            if (tenantId) ids.add(tenantId);
        });
    } catch {
        // A tábla migráció előtt még nem biztos, hogy létezik.
    }

    const { data: property } = await admin
        .from("properties")
        .select("tenant_id")
        .eq("id", propertyId)
        .maybeSingle();

    const fallbackTenantId = property?.tenant_id as string | null | undefined;
    if (fallbackTenantId) ids.add(fallbackTenantId);

    if (ids.size === 0) return [] as TenantProfile[];

    const { data: profiles } = await admin
        .from("profiles")
        .select("id,email,full_name")
        .in("id", Array.from(ids))
        .order("email");

    return (profiles ?? []) as TenantProfile[];
}

export async function isTenantAssignedToProperty(tenantId: string, propertyId: string) {
    const propertyIds = await listTenantPropertyIds(tenantId);
    return propertyIds.includes(propertyId);
}

export async function ensurePropertyPrimaryTenant(propertyId: string) {
    const admin = createSupabaseAdminClient();
    const tenants = await listPropertyTenants(propertyId);
    const nextPrimaryTenantId = tenants[0]?.id ?? null;

    await admin
        .from("properties")
        .update({ tenant_id: nextPrimaryTenantId })
        .eq("id", propertyId);

    await admin
        .from("charges")
        .update({ tenant_id: nextPrimaryTenantId })
        .eq("property_id", propertyId);

    await admin
        .from("documents")
        .update({ tenant_id: nextPrimaryTenantId })
        .eq("property_id", propertyId);

    return nextPrimaryTenantId;
}

export async function syncOwnerTenantMembership(ownerId: string, tenantId: string) {
    const admin = createSupabaseAdminClient();

    let hasAssignedProperty = false;

    try {
        const { data: propertyTenants } = await admin
            .from("property_tenants")
            .select("property_id")
            .eq("owner_id", ownerId)
            .eq("tenant_id", tenantId)
            .limit(1);

        hasAssignedProperty = (propertyTenants ?? []).length > 0;
    } catch {
        const { data: properties } = await admin
            .from("properties")
            .select("id")
            .eq("owner_id", ownerId)
            .eq("tenant_id", tenantId)
            .limit(1);

        hasAssignedProperty = (properties ?? []).length > 0;
    }

    if (hasAssignedProperty) {
        await admin
            .from("tenant_memberships")
            .upsert({ user_id: tenantId, owner_id: ownerId }, { onConflict: "user_id,owner_id" });
        return true;
    }

    await admin
        .from("tenant_memberships")
        .delete()
        .eq("user_id", tenantId)
        .eq("owner_id", ownerId);
    return false;
}

export async function listTenantProperties(tenantId: string) {
    const admin = createSupabaseAdminClient();
    const propertyIds = await listTenantPropertyIds(tenantId);

    if (propertyIds.length === 0) return [] as TenantPropertyRow[];

    const { data: properties } = await admin
        .from("properties")
        .select("id,name,address,owner_id")
        .in("id", propertyIds)
        .order("name");

    const rows = (properties ?? []) as Array<{
        id: string;
        name: string;
        address: string;
        owner_id: string;
    }>;

    const ownerIds = Array.from(new Set(rows.map((row) => row.owner_id).filter(Boolean)));
    const { data: owners } = ownerIds.length === 0
        ? { data: [] }
        : await admin
            .from("profiles")
            .select("id,email,full_name")
            .in("id", ownerIds);

    const ownersById = new Map(
        ((owners ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>).map((owner) => [
            owner.id,
            owner,
        ])
    );

    return rows.map((row) => {
        const owner = ownersById.get(row.owner_id);
        return {
            id: row.id,
            name: row.name,
            address: row.address,
            owner_id: row.owner_id,
            owner_name: owner?.full_name ?? null,
            owner_email: owner?.email ?? null,
        } satisfies TenantPropertyRow;
    });
}
