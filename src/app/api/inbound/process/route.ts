import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { processStoredIngestion } from "@/lib/ingestionProcessing";
import { downloadDocumentObject } from "@/lib/documentStorage";
import { extractInvoiceFromBuffer } from "@/app/owner/properties/[id]/charges/actions";
import { renderUnknownInboundInvoiceEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/resend";
import { createInboundApprovalToken } from "@/lib/inboundApprovalTokens";
import { suggestPropertyAcrossOwnersForIngestion } from "@/lib/propertyMatching";
import { getOrCreateInboundMailbox, getSharedInboundEmail } from "@/lib/inboundMailboxes";
import { resolveAvailableRoles } from "@/lib/auth/availableRoles";

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

type MailboxLookup = {
    ownerId: string;
    emailAddress: string;
    isShared: boolean;
};

function normalizeSenderEmail(value: string | undefined) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return "";
    const match = raw.match(/<([^>]+)>/);
    return (match?.[1] || raw).trim();
}

async function resolveOwnerMailbox(admin: ReturnType<typeof createSupabaseAdminClient>, recipient: string, from: string): Promise<MailboxLookup | null> {
    const { data: directMailbox } = await admin
        .from("inbound_mailboxes")
        .select("owner_id,email_address,is_active")
        .eq("email_address", recipient)
        .maybeSingle();

    if (directMailbox?.is_active) {
        return {
            ownerId: directMailbox.owner_id as string,
            emailAddress: directMailbox.email_address as string,
            isShared: false,
        };
    }

    const sharedEmail = getSharedInboundEmail();
    if (!sharedEmail || recipient !== sharedEmail) {
        return null;
    }

    const senderEmail = normalizeSenderEmail(from);
    if (!senderEmail) {
        return {
            ownerId: "",
            emailAddress: sharedEmail,
            isShared: true,
        };
    }

    const { data: senderProfile } = await admin
        .from("profiles")
        .select("id,email,role")
        .eq("email", senderEmail)
        .maybeSingle();

    if (!senderProfile) {
        return {
            ownerId: "",
            emailAddress: sharedEmail,
            isShared: true,
        };
    }

    const roles = await resolveAvailableRoles(senderProfile.id as string, senderProfile.role as "ADMIN" | "OWNER" | "TENANT");
    if (!roles.includes("OWNER")) {
        return {
            ownerId: "",
            emailAddress: sharedEmail,
            isShared: true,
        };
    }

    const mailbox = await getOrCreateInboundMailbox(senderProfile.id as string);
    return {
        ownerId: senderProfile.id as string,
        emailAddress: mailbox.email_address,
        isShared: true,
    };
}

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
    const mailbox = await resolveOwnerMailbox(admin, recipient, body.from || "");
    if (!mailbox) {
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
            .eq("owner_id", mailbox.ownerId || "00000000-0000-0000-0000-000000000000")
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

        let ownerId = mailbox.ownerId;
        let presetPropertyId: string | null = attachment.propertyId || null;
        let pendingApproval = false;

        if (!ownerId && mailbox.isShared) {
            try {
                const buffer = await downloadDocumentObject(storageKey);
                const extraction = await extractInvoiceFromBuffer(buffer);
                const suggested = await suggestPropertyAcrossOwnersForIngestion({
                    attachmentName: fileName,
                    sourceEmailSubject: body.subject,
                    sourceEmailFrom: body.from,
                    propertyHint: attachment.propertyId || null,
                    documentText: extraction.ok ? extraction.text : "",
                });

                if (suggested?.ownerId) {
                    ownerId = suggested.ownerId;
                    presetPropertyId = suggested.property.id;
                    pendingApproval = true;
                }
            } catch {
                // Ha a fallback felismerés sem megy, lent visszaadunk egy áttekinthető skip reason-t.
            }
        }

        if (!ownerId) {
            processed.push({
                fileName,
                skipped: true,
                reason: "A rendszer nem tudta beazonosítani a bérbeadót a feladó vagy a számla alapján.",
            });
            continue;
        }

        const { data: created, error: insertError } = await admin
            .from("document_ingestions")
            .insert({
                owner_id: ownerId,
                source_type: "EMAIL",
                source_message_id: body.messageId || null,
                source_email_from: body.from || null,
                source_email_subject: body.subject || null,
                source_attachment_name: fileName,
                storage_bucket: attachment.storageBucket || "documents",
                storage_key: storageKey,
                normalized_data: presetPropertyId ? { property_id: presetPropertyId } : {},
                status: pendingApproval ? "NEEDS_REVIEW" : "RECEIVED",
            })
            .select("id,source_attachment_name,status")
            .single();

        if (insertError?.code === "23505") {
            const { data: concurrentExisting, error: concurrentError } = await admin
                .from("document_ingestions")
                .select("id,source_attachment_name,status")
                .eq("owner_id", ownerId)
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
        if (pendingApproval) {
            const { data: ownerProfile } = await admin
                .from("profiles")
                .select("email,full_name")
                .eq("id", ownerId)
                .maybeSingle();

            const { data: property } = presetPropertyId
                ? await admin
                    .from("properties")
                    .select("name")
                    .eq("id", presetPropertyId)
                    .maybeSingle()
                : { data: null };

            if (ownerProfile?.email) {
                const approveToken = createInboundApprovalToken("approve", created.id);
                const rejectToken = createInboundApprovalToken("reject", created.id);
                const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rentapp.hu";

                await sendEmail(renderUnknownInboundInvoiceEmail({
                    ownerEmail: ownerProfile.email,
                    ownerName: ownerProfile.full_name ?? null,
                    sourceEmailFrom: body.from || null,
                    fileName,
                    propertyName: property?.name ?? null,
                    approveUrl: `${siteUrl}/email-inbound-action?token=${encodeURIComponent(approveToken)}`,
                    rejectUrl: `${siteUrl}/email-inbound-action?token=${encodeURIComponent(rejectToken)}`,
                    reviewUrl: `${siteUrl}/owner/importok/${created.id}`,
                }));
            }

            processed.push({
                id: created.id,
                fileName,
                skipped: false,
                reason: "A feladó nem volt ismert, ezért a rendszer jóváhagyást kért a feltételezett bérbeadótól.",
            });
            continue;
        }

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
