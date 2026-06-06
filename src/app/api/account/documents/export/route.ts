import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveRoleCookie } from "@/lib/auth/context";
import { resolveAvailableRoles } from "@/lib/auth/availableRoles";
import { buildZip } from "@/lib/zip";
import { downloadDocumentObject } from "@/lib/documentStorage";
import { listTenantPropertyIds } from "@/lib/propertyTenants";
import { isTenantFacingCharge } from "@/lib/chargeVisibility";

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
        .select("bucket_path,created_at,charge_id")
        .order("created_at", { ascending: false });

    const tenantPropertyIds = activeRole === "TENANT" && availableRoles.length === 1
        ? await listTenantPropertyIds(user.id)
        : [];

    const { data: documents, error } = activeRole === "TENANT" && availableRoles.length === 1
        ? await docsQuery.in("property_id", tenantPropertyIds.length > 0 ? tenantPropertyIds : ["00000000-0000-0000-0000-000000000000"])
        : await docsQuery.eq("owner_id", user.id);

    if (error) {
        return new Response(error.message, { status: 500 });
    }

    const chargeIds = activeRole === "TENANT" && availableRoles.length === 1
        ? Array.from(new Set((documents ?? []).map((doc) => doc.charge_id as string | null).filter(Boolean)))
        : [];
    const { data: linkedCharges } = chargeIds.length === 0
        ? { data: [] as Array<{ id: string; tenant_id: string | null; type: string | null }> }
        : await admin
            .from("charges")
            .select("id,tenant_id,type")
            .in("id", chargeIds);
    const visibleChargeIds = new Set(
        ((linkedCharges ?? []) as Array<{ id: string; tenant_id: string | null; type: string | null }>)
            .filter((charge) => isTenantFacingCharge(charge))
            .map((charge) => charge.id)
    );

    const entries: Array<{ name: string; content: Buffer }> = [];
    let index = 1;

    for (const doc of documents ?? []) {
        const bucketPath = doc.bucket_path as string | null;
        if (!bucketPath) continue;
        if (activeRole === "TENANT" && availableRoles.length === 1) {
            const chargeId = doc.charge_id as string | null;
            if (chargeId && !visibleChargeIds.has(chargeId)) continue;
        }

        try {
            const fileBuffer = await downloadDocumentObject(bucketPath);
            const pathParts = bucketPath.split("/");
            const fileName = pathParts[pathParts.length - 1] || `document-${index}.pdf`;
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
    const fileBase = activeRole === "TENANT" && availableRoles.length === 1 ? "berlo-dokumentumok" : "berbeado-dokumentumok";

    return new Response(zip, {
        status: 200,
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${fileBase}.zip"`,
        },
    });
}
