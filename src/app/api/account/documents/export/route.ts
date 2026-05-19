import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveRoleCookie } from "@/lib/auth/context";
import { resolveAvailableRoles } from "@/lib/auth/availableRoles";
import { buildZip } from "@/lib/zip";
import { downloadDocumentObject } from "@/lib/documentStorage";

function safeFileName(value: string) {
    return value.replaceAll(" ", "_").replace(/[^a-zA-Z0-9._-]/g, "");
}

export async function GET() {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return new Response("Nincs jogosultság.", { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
        return new Response("A profil nem található.", { status: 404 });
    }

    const availableRoles = await resolveAvailableRoles(user.id, profile.role);
    const cookieRole = await getActiveRoleCookie();
    const activeRole = cookieRole && availableRoles.includes(cookieRole) ? cookieRole : availableRoles[0];
    const admin = createSupabaseAdminClient();

    const docsQuery = admin
        .from("documents")
        .select("bucket_path,created_at")
        .order("created_at", { ascending: false });

    const { data: documents, error } = activeRole === "TENANT" && availableRoles.length === 1
        ? await docsQuery.eq("tenant_id", user.id)
        : await docsQuery.eq("owner_id", user.id);

    if (error) {
        return new Response(error.message, { status: 500 });
    }

    const entries: Array<{ name: string; content: Buffer }> = [];
    let index = 1;

    for (const doc of documents ?? []) {
        const bucketPath = doc.bucket_path as string | null;
        if (!bucketPath) continue;

        try {
            const fileBuffer = await downloadDocumentObject(bucketPath);
            const fileName = bucketPath.split("/").at(-1) || `document-${index}.pdf`;
            const safeName = `${String(index).padStart(3, "0")}-${safeFileName(fileName)}`;
            entries.push({
                name: safeName,
                content: fileBuffer,
            });
            index += 1;
        } catch {
            continue;
        }
    }

    if (entries.length === 0) {
        return new Response("Nincs letölthető dokumentum.", { status: 404 });
    }

    const zip = buildZip(entries);
    const fileBase = activeRole === "TENANT" && availableRoles.length === 1 ? "tenant-dokumentumok" : "owner-dokumentumok";

    return new Response(zip, {
        status: 200,
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${fileBase}.zip"`,
        },
    });
}
