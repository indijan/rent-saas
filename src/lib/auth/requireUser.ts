import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveRoleCookie, resolveActiveRole } from "./context";
import { resolveAvailableRoles } from "./availableRoles";

export type AppRole = "ADMIN" | "OWNER" | "TENANT";

export async function requireUser() {
    const supabase = await createSupabaseServerClient();

    let user = null;
    try {
        const result = await supabase.auth.getUser();
        user = result.data.user;
    } catch {
        redirect("/login");
    }
    if (!user) redirect("/login");

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("id,email,role,full_name")
        .eq("id", user.id)
        .single();

    if (error || !profile) redirect("/login");

    const resolvedRoles = await resolveAvailableRoles(user.id, profile.role as AppRole);

    const cookieRole = await getActiveRoleCookie();
    const activeRole = resolveActiveRole(resolvedRoles, cookieRole, profile.role as AppRole);

    return {
        supabase,
        user,
        profile: {
            ...(profile as { id: string; email: string; role: AppRole; full_name: string | null }),
            role: activeRole,
            available_roles: resolvedRoles,
        },
    };
}
