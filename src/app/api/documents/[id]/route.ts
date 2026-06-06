import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveAvailableRoles } from "@/lib/auth/availableRoles";
import { downloadDocumentObject } from "@/lib/documentStorage";
import { listTenantPropertyIds } from "@/lib/propertyTenants";
import type { AppRole } from "@/lib/auth/requireUser";
import { isTenantFacingCharge } from "@/lib/chargeVisibility";

type Params = {
    params: Promise<{ id: string }>;
};

function inferContentType(path: string) {
    const lower = path.toLowerCase();
    if (lower.endsWith(".pdf")) return "application/pdf";
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".webp")) return "image/webp";
    return "application/octet-stream";
}

function renderMissingDocumentPage(message: string) {
    return `<!doctype html>
<html lang="hu">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dokumentum nem érhető el</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top left, rgba(37,99,235,.18), transparent 32%),
          linear-gradient(180deg, #08101f 0%, #0f172a 100%);
        color: #eff6ff;
        font-family: system-ui, sans-serif;
      }
      .panel {
        width: min(560px, calc(100vw - 32px));
        padding: 28px;
        border-radius: 24px;
        background: rgba(15, 23, 42, 0.86);
        border: 1px solid rgba(148, 163, 184, 0.22);
        box-shadow: 0 24px 80px rgba(2, 8, 23, 0.42);
      }
      h1 { margin: 0 0 12px; font-size: 1.5rem; }
      p { margin: 0; line-height: 1.6; color: #cbd5e1; }
    </style>
  </head>
  <body>
    <section class="panel">
      <h1>Ez a dokumentum most nem érhető el.</h1>
      <p>${message}</p>
    </section>
  </body>
</html>`;
}

export async function GET(_request: Request, { params }: Params) {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const [{ data: profile, error: profileError }, { data: document, error: documentError }] = await Promise.all([
        admin.from("profiles").select("role").eq("id", user.id).single(),
        admin.from("documents").select("id,bucket_path,owner_id,tenant_id,property_id,charge_id").eq("id", id).maybeSingle(),
    ]);

    if (profileError || !profile?.role) {
        return new NextResponse("Forbidden", { status: 403 });
    }
    if (documentError || !document?.bucket_path) {
        return new NextResponse("Not found", { status: 404 });
    }

    const roles = await resolveAvailableRoles(user.id, profile.role as AppRole);
    const propertyIds = roles.includes("TENANT") ? await listTenantPropertyIds(user.id) : [];
    const { data: linkedCharge } = document.charge_id
        ? await admin
            .from("charges")
            .select("tenant_id,type")
            .eq("id", document.charge_id)
            .maybeSingle()
        : { data: null };
    const tenantCanAccessByProperty = roles.includes("TENANT")
        && Boolean(document.property_id ? propertyIds.includes(document.property_id) : false)
        && (!linkedCharge || isTenantFacingCharge(linkedCharge));
    const canAccess = roles.includes("ADMIN")
        || (roles.includes("OWNER") && document.owner_id === user.id)
        || (roles.includes("TENANT") && (
            document.tenant_id === user.id
            || tenantCanAccessByProperty
        ));

    if (!canAccess) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const buffer = await downloadDocumentObject(document.bucket_path);
        const fileName = document.bucket_path.split("/").pop() || "dokumentum";
        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                "Content-Type": inferContentType(document.bucket_path),
                "Content-Disposition": `inline; filename="${fileName.replace(/"/g, "")}"`,
                "Cache-Control": "private, max-age=300",
            },
        });
    } catch {
        return new NextResponse(
            renderMissingDocumentPage("A fájl nyoma megvan a rendszerben, de maga az állomány nem található a tárhelyen. Érdemes újra feltölteni a dokumentumot ehhez a tételhez."),
            {
                status: 404,
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                    "Cache-Control": "no-store",
                },
            }
        );
    }
}
