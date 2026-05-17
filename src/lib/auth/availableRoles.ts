import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AppRole } from "./requireUser";

type MembershipRow = {
    user_id: string;
};

export async function resolveAvailableRoles(userId: string, profileRole: AppRole) {
    const admin = createSupabaseAdminClient();
    let ownerMemberships: MembershipRow[] = [];
    let tenantMemberships: MembershipRow[] = [];

    try {
        if (profileRole === "OWNER") {
            const { error: ownerSyncError } = await admin
                .from("owner_memberships")
                .upsert({ user_id: userId }, { onConflict: "user_id" });
            if (ownerSyncError) throw ownerSyncError;
        }

        const [
            { data: ownerRows, error: ownerMembershipError },
            { data: tenantRows, error: tenantMembershipError },
        ] = await Promise.all([
            admin.from("owner_memberships").select("user_id").eq("user_id", userId),
            admin.from("tenant_memberships").select("user_id").eq("user_id", userId),
        ]);

        if (ownerMembershipError || tenantMembershipError) {
            throw ownerMembershipError || tenantMembershipError;
        }

        ownerMemberships = (ownerRows ?? []) as MembershipRow[];
        tenantMemberships = (tenantRows ?? []) as MembershipRow[];
    } catch {
        // A membership táblák migráció előtt még nem léteznek.
    }

    const availableRoles = new Set<AppRole>();
    if (profileRole === "ADMIN") availableRoles.add("ADMIN");
    if (profileRole === "OWNER" || ownerMemberships.length > 0) availableRoles.add("OWNER");
    if (profileRole === "TENANT" || tenantMemberships.length > 0) availableRoles.add("TENANT");

    const resolvedRoles = Array.from(availableRoles);
    if (resolvedRoles.length === 0) {
        resolvedRoles.push(profileRole);
    }

    return resolvedRoles;
}
