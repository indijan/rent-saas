import { NextResponse } from "next/server";
import { getRequestAuthContext } from "@/lib/auth/requestContext";
import { resolveAvailableRoles } from "@/lib/auth/availableRoles";
import type { AppRole } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function toDateInputValue(date: Date) {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export async function GET() {
    const { userId } = await getRequestAuthContext();
    if (!userId) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

    if (profileError || !profile) return NextResponse.json({ error: "A profil nem található." }, { status: 403 });
    const roles = await resolveAvailableRoles(userId, profile.role as AppRole);
    if (!roles.includes("OWNER")) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });

    const dueThrough = new Date();
    dueThrough.setHours(0, 0, 0, 0);
    dueThrough.setDate(dueThrough.getDate() + 7);

    const [dueTasks, importDrafts, importReviews, exitRequests] = await Promise.all([
        admin.from("charges").select("id", { count: "exact", head: true })
            .eq("owner_id", userId).eq("status", "UNPAID").lte("due_date", toDateInputValue(dueThrough)),
        admin.from("charges").select("id", { count: "exact", head: true })
            .eq("owner_id", userId).eq("status", "IMPORT_DRAFT"),
        admin.from("document_ingestions").select("id", { count: "exact", head: true })
            .eq("owner_id", userId).eq("status", "NEEDS_REVIEW"),
        admin.from("tenant_exit_requests").select("id", { count: "exact", head: true })
            .eq("owner_id", userId).eq("status", "PENDING"),
    ]);

    const error = dueTasks.error || importDrafts.error || importReviews.error || exitRequests.error;
    if (error) return NextResponse.json({ error: "A teendők száma nem tölthető be." }, { status: 500 });

    const count = (dueTasks.count ?? 0)
        + (importDrafts.count ?? 0)
        + (importReviews.count ?? 0)
        + (exitRequests.count ?? 0);

    return NextResponse.json({ count }, { headers: { "Cache-Control": "private, no-store" } });
}
