import { randomUUID } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { renderImportInvoiceStatusEmail } from "@/lib/email/templates";
import { getConfiguredStorageBucketName, removeDocumentObjects, uploadDocumentObject } from "@/lib/documentStorage";
import { processStoredIngestion } from "@/lib/ingestionProcessing";

function safeFileName(value: string) {
    return value.replaceAll(" ", "_").replace(/[^a-zA-Z0-9._-]/g, "");
}

export async function POST(request: Request) {
    const secret = process.env.IMPORT_SECRET;
    const auth = request.headers.get("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
    if (!secret || token !== secret) {
        return new Response("Nincs jogosultság.", { status: 401 });
    }

    const propertyId = process.env.IMPORT_PROPERTY_ID;
    const ownerEmail = process.env.IMPORT_OWNER_EMAIL;
    if (!propertyId || !ownerEmail) {
        return new Response("Hiányos importbeállítás.", { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
        return new Response("Hiányzik a fájl.", { status: 400 });
    }
    if (file.type !== "application/pdf") {
        return new Response("Csak PDF tölthető fel.", { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: property, error: propertyError } = await admin
        .from("properties")
        .select("id,name,owner_id")
        .eq("id", propertyId)
        .single();

    if (propertyError || !property) {
        await sendEmail(renderImportInvoiceStatusEmail({
            ownerEmail,
            status: "FAILED",
            fileName: file.name,
            error: "Az ingatlan nem található.",
        }));
        return new Response("Az ingatlan nem található.", { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ingestionId = randomUUID();
    const safeName = safeFileName(file.name || "invoice.pdf") || "invoice.pdf";
    const storageKey = `${property.owner_id}/ingestions/${ingestionId}/${Date.now()}-${safeName}`;

    try {
        await uploadDocumentObject(storageKey, buffer, file.type);
    } catch {
        await sendEmail(renderImportInvoiceStatusEmail({
            ownerEmail,
            status: "FAILED",
            fileName: file.name,
            error: "A fájl feltöltése sikertelen volt.",
        }));
        return new Response("A fájl feltöltése sikertelen volt.", { status: 500 });
    }

    const { error: ingestionInsertError } = await admin
        .from("document_ingestions")
        .insert({
            id: ingestionId,
            owner_id: property.owner_id,
            source_type: "UPLOAD",
            source_attachment_name: file.name,
            storage_bucket: getConfiguredStorageBucketName(),
            storage_key: storageKey,
            status: "RECEIVED",
            normalized_data: {
                property_id: property.id,
                property_name: property.name,
                import_mode: "FORWARDED",
            },
        });

    if (ingestionInsertError) {
        await removeDocumentObjects([storageKey]);
        await sendEmail(renderImportInvoiceStatusEmail({
            ownerEmail,
            status: "FAILED",
            fileName: file.name,
            error: ingestionInsertError.message,
        }));
        return new Response("Az import létrehozása sikertelen volt.", { status: 500 });
    }

    let result: Awaited<ReturnType<typeof processStoredIngestion>>;
    try {
        result = await processStoredIngestion(ingestionId);
    } catch (error) {
        const message = error instanceof Error ? error.message : "A feldolgozás nem sikerült.";
        await admin
            .from("document_ingestions")
            .update({
                status: "FAILED",
                error_message: message,
                processed_at: new Date().toISOString(),
            })
            .eq("id", ingestionId)
            .eq("owner_id", property.owner_id);
        await sendEmail(renderImportInvoiceStatusEmail({
            ownerEmail,
            status: "FAILED",
            fileName: file.name,
            error: message,
        }));
        return new Response(JSON.stringify({ ok: false, error: message, ingestionId }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }

    if (!result.ok) {
        return new Response(JSON.stringify({ ok: false, error: result.error, ingestionId }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({
        ok: true,
        ingestionId,
        chargeId: "chargeId" in result ? result.chargeId ?? null : null,
        needsReview: result.needsReview ?? false,
    }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}
