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

    return Array.from(ids);
}

export async function isTenantOwnedByOwner(ownerId: string, tenantId: string) {
    const ids = await listOwnerTenantIds(ownerId);
    return ids.includes(tenantId);
}
