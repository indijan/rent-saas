import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AppRole } from "./requireUser";

type MembershipRow = {
    user_id: string;
};

export type RoleMemberships = {
    owners: MembershipRow[];
    tenants: MembershipRow[];
};

export async function loadRoleMemberships(userId: string): Promise<RoleMemberships> {
    const admin = createSupabaseAdminClient();
    try {
        const [
            { data: ownerRows, error: ownerMembershipError },
            { data: tenantRows, error: tenantMembershipError },
        ] = await Promise.all([
            admin.from("owner_memberships").select("user_id").eq("user_id", userId).limit(1),
            admin.from("tenant_memberships").select("user_id").eq("user_id", userId).limit(1),
        ]);

        if (ownerMembershipError || tenantMembershipError) {
            throw ownerMembershipError || tenantMembershipError;
        }

        return {
            owners: (ownerRows ?? []) as MembershipRow[],
            tenants: (tenantRows ?? []) as MembershipRow[],
        };
    } catch {
        // A membership táblák migráció előtt még nem léteznek.
        return { owners: [], tenants: [] };
    }
}

export function resolveAvailableRolesFromMemberships(profileRole: AppRole, memberships: RoleMemberships) {
    const availableRoles = new Set<AppRole>();
    if (profileRole === "ADMIN") availableRoles.add("ADMIN");
    if (profileRole === "OWNER" || memberships.owners.length > 0) availableRoles.add("OWNER");
    if (profileRole === "TENANT" || memberships.tenants.length > 0) availableRoles.add("TENANT");

    const resolvedRoles = Array.from(availableRoles);
    if (resolvedRoles.length === 0) {
        resolvedRoles.push(profileRole);
    }

    return resolvedRoles;
}

export async function resolveAvailableRoles(userId: string, profileRole: AppRole) {
    return resolveAvailableRolesFromMemberships(profileRole, await loadRoleMemberships(userId));
}
