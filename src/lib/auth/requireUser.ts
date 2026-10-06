import { redirect } from "next/navigation";
import { getRequestAuthContext } from "./requestContext";
import { getActiveRoleCookie, resolveActiveRole } from "./context";
import { loadRoleMemberships, resolveAvailableRolesFromMemberships } from "./availableRoles";

export type AppRole = "ADMIN" | "OWNER" | "TENANT";

export async function requireUser() {
    const { supabase, userId } = await getRequestAuthContext();
    if (!userId) redirect("/login");

    const [{ data: profile, error }, roleMemberships] = await Promise.all([
        supabase
            .from("profiles")
            .select("id,email,role,full_name")
            .eq("id", userId)
            .single(),
        loadRoleMemberships(userId),
    ]);

    if (error || !profile) redirect("/login");

    const resolvedRoles = resolveAvailableRolesFromMemberships(profile.role as AppRole, roleMemberships);

    const cookieRole = await getActiveRoleCookie();
    const activeRole = resolveActiveRole(resolvedRoles, cookieRole, profile.role as AppRole);

    return {
        supabase,
        user: { id: userId },
        profile: {
            ...(profile as { id: string; email: string; role: AppRole; full_name: string | null }),
            role: activeRole,
            available_roles: resolvedRoles,
        },
    };
}
