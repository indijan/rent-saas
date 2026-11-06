import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { removeDocumentObjects, uploadDocumentObject } from "@/lib/documentStorage";
import { getRequestAuthContext } from "@/lib/auth/requestContext";
import { findExactDocumentMatch, saveDocumentFingerprint } from "@/lib/documentFingerprints";

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
    const isPdf = documentFile.type === "application/pdf" || documentFile.name.toLowerCase().endsWith(".pdf");
    const fingerprint = isPdf ? await findExactDocumentMatch(admin, userId, buffer) : null;
    if (fingerprint && !fingerprint.ok) {
        return Response.json({ ok: false, error: "A PDF-egyezés nem ellenőrizhető." }, { status: 500 });
    }
    if (fingerprint?.ok && fingerprint.duplicate) {
        return Response.json({
            ok: false,
            error: "Ez a PDF byte-ra megegyezik egy már rögzített számlával.",
            duplicateDocumentId: fingerprint.duplicate.documentId,
        }, { status: 409 });
    }

    const safeName = safeFileName(documentFile.name || "invoice.pdf") || "invoice.pdf";
    const path = `${userId}/${chargeId}/${Date.now()}-${safeName}`;

    try {
        await uploadDocumentObject(path, buffer, documentFile.type || "application/pdf");
    } catch {
        return Response.json({ ok: false, error: "A dokumentum feltöltése nem sikerült." }, { status: 500 });
    }

    const { data: createdDocument, error } = await admin.from("documents").insert({
        owner_id: charge.owner_id,
        tenant_id: charge.tenant_id,
        property_id: charge.property_id,
        charge_id: chargeId,
        bucket_path: path,
        type: "INVOICE",
    }).select("id").single();

    if (error || !createdDocument) {
        await removeDocumentObjects([path]);
        return Response.json({ ok: false, error: error?.message || "A dokumentum mentése nem sikerült." }, { status: 500 });
    }

    if (fingerprint?.ok) {
        try {
            await saveDocumentFingerprint(admin, {
                ownerId: userId,
                sha256: fingerprint.sha256,
                documentId: createdDocument.id,
            });
        } catch {
            await admin.from("documents").delete().eq("id", createdDocument.id).eq("owner_id", userId);
            await removeDocumentObjects([path]);
            return Response.json({ ok: false, error: "A számla ujjlenyomatának mentése nem sikerült." }, { status: 500 });
        }
    }

    return Response.json({ ok: true });
}
