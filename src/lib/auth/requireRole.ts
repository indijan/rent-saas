import { redirect } from "next/navigation";
import { AppRole, requireUser } from "./requireUser";

export async function requireRole(role: AppRole) {
    const ctx = await requireUser();
    if (!ctx.profile.available_roles.includes(role)) redirect("/dashboard");
    return {
        ...ctx,
        profile: {
            ...ctx.profile,
            role,
        },
    };
}

export async function requireAnyRole(roles: AppRole[]) {
    const ctx = await requireUser();
    const matchedRole = roles.find((role) => ctx.profile.available_roles.includes(role));
    if (!matchedRole) redirect("/dashboard");
    return {
        ...ctx,
        profile: {
            ...ctx.profile,
            role: matchedRole,
        },
    };
}
