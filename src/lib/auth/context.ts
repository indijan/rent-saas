import { cookies } from "next/headers";
import type { AppRole } from "./requireUser";

export const ACTIVE_ROLE_COOKIE = "rentapp_active_role";

export async function getActiveRoleCookie() {
    const store = await cookies();
    return store.get(ACTIVE_ROLE_COOKIE)?.value as AppRole | undefined;
}

export async function setActiveRoleCookie(role: AppRole) {
    const store = await cookies();
    store.set(ACTIVE_ROLE_COOKIE, role, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30,
    });
}

export function routeForRole(role: AppRole) {
    if (role === "ADMIN") return "/admin/berbeadok";
    if (role === "OWNER") return "/owner/properties";
    return "/tenant/charges";
}
