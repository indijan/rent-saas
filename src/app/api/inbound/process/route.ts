import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { processStoredIngestion } from "@/lib/ingestionProcessing";

type InboundAttachment = {
    fileName: string;
    storageBucket?: string;
    storageKey: string;
    propertyId?: string;
    contentType?: string;
};

type InboundProcessPayload = {
    recipient: string;
    messageId?: string;
    from?: string;
    subject?: string;
    attachments: InboundAttachment[];
};

export async function POST(request: Request) {
    const secret = process.env.INBOUND_PROCESS_SECRET;
    const auth = request.headers.get("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";

    if (!secret || token !== secret) {
        return new Response("Nincs jogosultság.", { status: 401 });
    }

    const body = await request.json() as InboundProcessPayload;
    const recipient = String(body.recipient || "").trim().toLowerCase();
    if (!recipient) {
        return new Response("Hiányzik a címzett.", { status: 400 });
    }
    if (!Array.isArray(body.attachments) || body.attachments.length === 0) {
        return new Response("Nincs feldolgozható csatolmány.", { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: mailbox, error: mailboxError } = await admin
        .from("inbound_mailboxes")
        .select("owner_id,email_address,is_active")
        .eq("email_address", recipient)
        .maybeSingle();

    if (mailboxError) {
        return new Response(mailboxError.message, { status: 500 });
    }
    if (!mailbox || !mailbox.is_active) {
        return new Response("A postafiók nem található vagy inaktív.", { status: 404 });
    }

    const processed: Array<{ id?: string; fileName: string; skipped?: boolean; reason?: string; result?: Awaited<ReturnType<typeof processStoredIngestion>> }> = [];
    const createdIngestions: Array<{ id: string; source_attachment_name: string | null; status: string }> = [];

    for (const attachment of body.attachments) {
        const fileName = String(attachment.fileName || "").trim();
        const storageKey = String(attachment.storageKey || "").trim();
        const contentType = String(attachment.contentType || "").trim().toLowerCase();

        if (!fileName || !storageKey) {
            processed.push({
                fileName: fileName || "ismeretlen",
                skipped: true,
                reason: "Hiányzik a fájlnév vagy a storage kulcs.",
            });
            continue;
        }

        const isPdf = fileName.toLowerCase().endsWith(".pdf") || contentType === "application/pdf";
        if (!isPdf) {
            processed.push({
                fileName,
                skipped: true,
                reason: "Nem PDF csatolmány, ezért kimarad.",
            });
            continue;
        }

        let existingQuery = admin
            .from("document_ingestions")
            .select("id,source_attachment_name,status")
            .eq("owner_id", mailbox.owner_id)
            .eq("source_type", "EMAIL")
            .eq("storage_key", storageKey);

        if (body.messageId) {
            existingQuery = existingQuery.eq("source_message_id", body.messageId);
        }

        const { data: existing, error: existingError } = await existingQuery.maybeSingle();
        if (existingError) {
            return new Response(existingError.message, { status: 500 });
        }

        if (existing) {
            processed.push({
                id: existing.id,
                fileName: existing.source_attachment_name || fileName,
                skipped: true,
                reason: "Ez a csatolmány már be lett olvasva.",
            });
            continue;
        }

        const { data: created, error: insertError } = await admin
            .from("document_ingestions")
            .insert({
                owner_id: mailbox.owner_id,
                source_type: "EMAIL",
                source_message_id: body.messageId || null,
                source_email_from: body.from || null,
                source_email_subject: body.subject || null,
                source_attachment_name: fileName,
                storage_bucket: attachment.storageBucket || "documents",
                storage_key: storageKey,
                normalized_data: attachment.propertyId ? { property_id: attachment.propertyId } : {},
                status: "RECEIVED",
            })
            .select("id,source_attachment_name,status")
            .single();

        if (insertError?.code === "23505") {
            const { data: concurrentExisting, error: concurrentError } = await admin
                .from("document_ingestions")
                .select("id,source_attachment_name,status")
                .eq("owner_id", mailbox.owner_id)
                .eq("source_type", "EMAIL")
                .eq("storage_key", storageKey)
                .maybeSingle();

            if (concurrentError) {
                return new Response(concurrentError.message, { status: 500 });
            }

            processed.push({
                id: concurrentExisting?.id,
                fileName,
                skipped: true,
                reason: "A csatolmány párhuzamos feldolgozásban már létrejött.",
            });
            continue;
        }

        if (insertError || !created) {
            return new Response(insertError?.message || "Az import létrehozása nem sikerült.", { status: 500 });
        }

        createdIngestions.push(created);
        processed.push({
            id: created.id,
            fileName,
            result: await processStoredIngestion(created.id),
        });
    }

    return new Response(JSON.stringify({ ok: true, ingestions: createdIngestions, processed }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}
