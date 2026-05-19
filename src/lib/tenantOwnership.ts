import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AuthUserWithOwnerMeta = {
    id: string;
    app_metadata?: {
        owner_id?: string;
    };
};

export async function listOwnerTenantIds(ownerId: string) {
    const admin = createSupabaseAdminClient();
    const ids = new Set<string>();
    try {
        const { data: memberships, error } = await admin
            .from("tenant_memberships")
            .select("user_id")
            .eq("owner_id", ownerId);
        if (error) throw error;

        (memberships ?? []).forEach((membership) => {
            const userId = membership.user_id as string | null;
            if (userId) ids.add(userId);
        });
    } catch {
        // A tábla migráció előtt még nem biztos, hogy létezik.
    }

    let page = 1;
    const perPage = 200;

    while (true) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
        if (error) throw error;

        const users = (data?.users ?? []) as AuthUserWithOwnerMeta[];
        users
            .filter((user) => user.app_metadata?.owner_id === ownerId)
            .forEach((user) => ids.add(user.id));

        if (users.length < perPage) break;
        page += 1;
    }

    const { data: properties, error } = await admin
        .from("properties")
        .select("tenant_id")
        .eq("owner_id", ownerId)
        .not("tenant_id", "is", null);
    if (error) throw error;

    (properties ?? []).forEach((property) => {
        const tenantId = property.tenant_id as string | null;
        if (tenantId) ids.add(tenantId);
    });

    try {
        const { data: propertyTenants, error: propertyTenantError } = await admin
            .from("property_tenants")
            .select("tenant_id")
            .eq("owner_id", ownerId);
        if (propertyTenantError) throw propertyTenantError;

        (propertyTenants ?? []).forEach((row) => {
            const tenantId = row.tenant_id as string | null;
            if (tenantId) ids.add(tenantId);
        });
    } catch {
        // A tábla migráció előtt még nem biztos, hogy létezik.
    }

    return Array.from(ids);
}

export async function isTenantOwnedByOwner(ownerId: string, tenantId: string) {
    const ids = await listOwnerTenantIds(ownerId);
    return ids.includes(tenantId);
}

export async function listAllTenantIds() {
    const admin = createSupabaseAdminClient();
    const ids = new Set<string>();

    try {
        const { data: memberships, error } = await admin
            .from("tenant_memberships")
            .select("user_id");
        if (error) throw error;

        (memberships ?? []).forEach((membership) => {
            const userId = membership.user_id as string | null;
            if (userId) ids.add(userId);
        });
    } catch {
        // A tábla migráció előtt még nem biztos, hogy létezik.
    }

    const { data: properties, error: propertiesError } = await admin
        .from("properties")
        .select("tenant_id")
        .not("tenant_id", "is", null);
    if (propertiesError) throw propertiesError;

    (properties ?? []).forEach((property) => {
        const tenantId = property.tenant_id as string | null;
        if (tenantId) ids.add(tenantId);
    });

    try {
        const { data: propertyTenants, error: propertyTenantError } = await admin
            .from("property_tenants")
            .select("tenant_id");
        if (propertyTenantError) throw propertyTenantError;

        (propertyTenants ?? []).forEach((row) => {
            const tenantId = row.tenant_id as string | null;
            if (tenantId) ids.add(tenantId);
        });
    } catch {
        // A tábla migráció előtt még nem biztos, hogy létezik.
    }

    const { data: charges, error: chargesError } = await admin
        .from("charges")
        .select("tenant_id")
        .not("tenant_id", "is", null);
    if (chargesError) throw chargesError;

    (charges ?? []).forEach((charge) => {
        const tenantId = charge.tenant_id as string | null;
        if (tenantId) ids.add(tenantId);
    });

    return Array.from(ids);
}
