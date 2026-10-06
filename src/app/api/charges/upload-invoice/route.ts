import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { uploadDocumentObject } from "@/lib/documentStorage";
import { getRequestAuthContext } from "@/lib/auth/requestContext";

function safeFileName(value: string) {
    return value.replaceAll(" ", "_").replace(/[^a-zA-Z0-9._-]/g, "");
}

export async function POST(request: Request) {
    const { userId } = await getRequestAuthContext();

    if (!userId) {
        return Response.json({ ok: false, error: "Nincs jogosultság." }, { status: 401 });
    }

    const formData = await request.formData();
    const chargeId = String(formData.get("chargeId") || "").trim();
    const file = formData.get("document");
    const documentFile = file instanceof File ? file : null;

    if (!chargeId || !documentFile || documentFile.size === 0) {
        return Response.json({ ok: false, error: "Hiányzik a díj vagy a dokumentum." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: charge, error: chargeErr } = await admin
        .from("charges")
        .select("owner_id,tenant_id,property_id,status")
        .eq("id", chargeId)
        .eq("owner_id", userId)
        .single();

    if (chargeErr || !charge) {
        return Response.json({ ok: false, error: "Díj nem található." }, { status: 404 });
    }

    if (charge.status === "PAID" || charge.status === "ARCHIVED" || charge.status === "CANCELLED") {
        return Response.json({ ok: false, error: "Ehhez a státuszú díjhoz már nem tölthető fel dokumentum." }, { status: 400 });
    }

    const buffer = Buffer.from(await documentFile.arrayBuffer());
    const safeName = safeFileName(documentFile.name || "invoice.pdf") || "invoice.pdf";
    const path = `${userId}/${chargeId}/${Date.now()}-${safeName}`;

    try {
        await uploadDocumentObject(path, buffer, documentFile.type || "application/pdf");
    } catch {
        return Response.json({ ok: false, error: "A dokumentum feltöltése nem sikerült." }, { status: 500 });
    }

    const { error } = await admin.from("documents").insert({
        owner_id: charge.owner_id,
        tenant_id: charge.tenant_id,
        property_id: charge.property_id,
        charge_id: chargeId,
        bucket_path: path,
        type: "INVOICE",
    });

    if (error) {
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
}
