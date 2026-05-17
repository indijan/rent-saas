import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/requireUser";
import { routeForRole } from "@/lib/auth/context";

export default async function DashboardPage() {
    const { profile } = await requireUser();

    if (profile.available_roles.length > 1) {
        redirect("/valassz-nezetet");
    }

    redirect(routeForRole(profile.role));
}
