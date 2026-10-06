import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AuthUserWithOwnerMeta = {
    id: string;
    app_metadata?: {
        owner_id?: string;
    };
};

function isMissingTableError(error: unknown, table: string) {
    if (!error || typeof error !== "object") return false;
    const value = error as { code?: string; message?: string };
    if (value.code === "42P01" || value.code === "PGRST205") return true;
    const message = String(value.message || "").toLowerCase();
    return message.includes(table)
        && (message.includes("does not exist") || message.includes("could not find the table") || message.includes("schema cache"));
}

export async function listOwnerTenantIds(ownerId: string) {
    const admin = createSupabaseAdminClient();
    const ids = new Set<string>();
    const [membershipResult, propertyTenantResult] = await Promise.all([
        admin
            .from("tenant_memberships")
            .select("user_id")
            .eq("owner_id", ownerId),
        admin
            .from("property_tenants")
            .select("tenant_id")
            .eq("owner_id", ownerId),
    ]);

    if (!membershipResult.error) {
        (membershipResult.data ?? []).forEach((membership) => {
            const userId = membership.user_id as string | null;
            if (userId) ids.add(userId);
        });
    } else {
        if (!isMissingTableError(membershipResult.error, "tenant_memberships")) {
            throw membershipResult.error;
        }

        // Only scan Auth users during a pre-membership-schema rollout.
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
    }

    if (!propertyTenantResult.error) {
        (propertyTenantResult.data ?? []).forEach((row) => {
            const tenantId = row.tenant_id as string | null;
            if (tenantId) ids.add(tenantId);
        });
    } else {
        if (!isMissingTableError(propertyTenantResult.error, "property_tenants")) {
            throw propertyTenantResult.error;
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
    }

    return Array.from(ids);
}

export async function isTenantOwnedByOwner(ownerId: string, tenantId: string) {
    const admin = createSupabaseAdminClient();
    const { data: membership, error: membershipError } = await admin
        .from("tenant_memberships")
        .select("user_id")
        .eq("owner_id", ownerId)
        .eq("user_id", tenantId)
        .maybeSingle();

    if (!membershipError) {
        if (membership) return true;

        const [propertyTenantResult, legacyPropertyResult] = await Promise.all([
            admin
                .from("property_tenants")
                .select("property_id")
                .eq("owner_id", ownerId)
                .eq("tenant_id", tenantId)
                .limit(1),
            admin
                .from("properties")
                .select("id")
                .eq("owner_id", ownerId)
                .eq("tenant_id", tenantId)
                .limit(1),
        ]);

        if (propertyTenantResult.error && legacyPropertyResult.error) {
            throw propertyTenantResult.error;
        }

        return Boolean(propertyTenantResult.data?.length || legacyPropertyResult.data?.length);
    }

    if (!isMissingTableError(membershipError, "tenant_memberships")) throw membershipError;

    // Preserve the legacy metadata fallback only if the membership table is unavailable.
    const ids = await listOwnerTenantIds(ownerId);
    return ids.includes(tenantId);
}

export async function listAllTenantIds() {
    const admin = createSupabaseAdminClient();
    const ids = new Set<string>();
    let usedPropertyTenantMemberships = false;

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

    try {
        const { data: propertyTenants, error: propertyTenantError } = await admin
            .from("property_tenants")
            .select("tenant_id");
        if (propertyTenantError) throw propertyTenantError;
        usedPropertyTenantMemberships = true;

        (propertyTenants ?? []).forEach((row) => {
            const tenantId = row.tenant_id as string | null;
            if (tenantId) ids.add(tenantId);
        });
    } catch {
        // A tábla migráció előtt még nem biztos, hogy létezik.
    }

    if (!usedPropertyTenantMemberships) {
        const { data: properties, error: propertiesError } = await admin
            .from("properties")
            .select("tenant_id")
            .not("tenant_id", "is", null);
        if (propertiesError) throw propertiesError;

        (properties ?? []).forEach((property) => {
            const tenantId = property.tenant_id as string | null;
            if (tenantId) ids.add(tenantId);
        });
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
