"use server";

import { redirect } from "next/navigation";
import { requireUser, type AppRole } from "@/lib/auth/requireUser";
import { routeForRole, setActiveRoleCookie } from "@/lib/auth/context";

export async function chooseRole(role: AppRole) {
    const { profile } = await requireUser();
    if (!profile.available_roles.includes(role)) {
        redirect("/dashboard");
    }

    await setActiveRoleCookie(role);
    redirect(routeForRole(role));
}
