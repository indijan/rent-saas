import { redirect } from "next/navigation";
import { AppRole, requireUser } from "./requireUser";

export async function requireRole(role: AppRole) {
    const ctx = await requireUser();
    if (ctx.profile.role !== role) redirect("/");
    return ctx;
}

export async function requireAnyRole(roles: AppRole[]) {
    const ctx = await requireUser();
    if (!roles.includes(ctx.profile.role)) redirect("/");
    return ctx;
}