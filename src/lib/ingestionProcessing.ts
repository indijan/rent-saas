import { createHash } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { renderImportInvoiceStatusEmail } from "@/lib/email/templates";
import { findOwnerSupplierProfile } from "@/lib/supplierProfiles";
import { suggestOwnerPropertyForIngestion } from "@/lib/propertyMatching";
import { extractInvoiceFromBuffer } from "@/app/owner/properties/[id]/charges/actions";
import { downloadDocumentObject } from "@/lib/documentStorage";
import { createEmailActionToken } from "@/lib/emailActionTokens";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://rentapp.hu";

type IngestionRecord = {
    id: string;
    owner_id: string;
    source_attachment_name: string | null;
    source_email_from: string | null;
    source_email_subject: string | null;
    storage_bucket: string;
    storage_key: string;
    normalized_data: Record<string, unknown> | null;
};

type PropertyRow = {
    id: string;
    name: string;
    tenant_id: string | null;
};

type DraftCreateResult =
    | { ok: true; chargeId: string; documentId: string }
    | { ok: false; error: string };

async function createDraftFromNormalized(
    ownerId: string,
    property: PropertyRow,
    ingestion: IngestionRecord,
    normalized: {
        issuer_name: string | null;
        due_date: string;
        gross_amount: number;
        currency: string;
        charge_type: string;
    }
): Promise<DraftCreateResult> {
    const admin = createSupabaseAdminClient();

    const { data: createdCharge, error: chargeError } = await admin
        .from("charges")
        .insert({
            property_id: property.id,
            owner_id: ownerId,
            tenant_id: property.tenant_id,
            type: normalized.charge_type,
            title: normalized.issuer_name || ingestion.source_attachment_name?.replace(/\.pdf$/i, "") || "Importált számla",
            amount: normalized.gross_amount,
            currency: normalized.currency,
            due_date: normalized.due_date,
            status: "IMPORT_DRAFT",
        })
        .select("id")
        .single();

    if (chargeError || !createdCharge) {
        return { ok: false, error: chargeError?.message || "A draft díj létrehozása nem sikerült." };
    }

    const { data: createdDocument, error: documentError } = await admin
        .from("documents")
        .insert({
            owner_id: ownerId,
            tenant_id: property.tenant_id,
            property_id: property.id,
            charge_id: createdCharge.id,
            bucket_path: ingestion.storage_key,
            type: "INVOICE",
        })
        .select("id")
        .single();

    if (documentError || !createdDocument) {
        await admin.from("charges").delete().eq("id", createdCharge.id).eq("owner_id", ownerId);
        return { ok: false, error: documentError?.message || "A dokumentum kapcsolása nem sikerült." };
    }

    return {
        ok: true,
        chargeId: createdCharge.id,
        documentId: createdDocument.id,
    };
}

export async function processStoredIngestion(ingestionId: string) {
    const admin = createSupabaseAdminClient();
    const { data: ingestion, error: ingestionError } = await admin
        .from("document_ingestions")
        .select("id,owner_id,source_attachment_name,source_email_from,source_email_subject,storage_bucket,storage_key,normalized_data")
        .eq("id", ingestionId)
        .single();

    if (ingestionError || !ingestion) {
        return { ok: false as const, error: ingestionError?.message || "Az import nem található." };
    }

    const ingestionRow = ingestion as IngestionRecord;
    const { data: ownerProfile } = await admin
        .from("profiles")
        .select("email")
        .eq("id", ingestionRow.owner_id)
        .maybeSingle();

    let buffer: Buffer;
    try {
        buffer = await downloadDocumentObject(ingestionRow.storage_key);
    } catch (error) {
        const message = error instanceof Error ? error.message : "A dokumentum letöltése nem sikerült.";
        await admin
            .from("document_ingestions")
            .update({
                status: "FAILED",
                error_message: message,
                processed_at: new Date().toISOString(),
            })
            .eq("id", ingestionId)
            .eq("owner_id", ingestionRow.owner_id);
        return { ok: false as const, error: message };
    }
    const extraction = await extractInvoiceFromBuffer(buffer);

    if (!extraction.ok || !extraction.data) {
        await admin
            .from("document_ingestions")
            .update({
                status: "FAILED",
                error_message: extraction.ok ? "A feldolgozás nem sikerült." : extraction.error,
                processed_at: new Date().toISOString(),
            })
            .eq("id", ingestionId)
            .eq("owner_id", ingestionRow.owner_id);
        if (ownerProfile?.email) {
            await sendEmail(renderImportInvoiceStatusEmail({
                ownerEmail: ownerProfile.email,
                status: "FAILED",
                fileName: ingestionRow.source_attachment_name,
                error: extraction.ok ? "A feldolgozás nem sikerült." : extraction.error,
                openUrl: `${SITE_URL}/owner/importok`,
                reviewUrl: `${SITE_URL}/owner/importok/${ingestionId}`,
            }));
        }
        return { ok: false as const, error: extraction.ok ? "A feldolgozás nem sikerült." : extraction.error };
    }

    const normalizedData = (ingestionRow.normalized_data ?? {}) as Record<string, unknown>;
    const propertyId = typeof normalizedData.property_id === "string" && normalizedData.property_id.trim()
        ? normalizedData.property_id
        : null;

    const propertyHint = typeof normalizedData.property_hint === "string" && normalizedData.property_hint.trim()
        ? normalizedData.property_hint
        : null;

    const normalized = {
        issuer_name: extraction.data.name,
        due_date: extraction.data.due_date,
        gross_amount: extraction.data.amount,
        currency: extraction.data.currency || "HUF",
        charge_type: extraction.data.type || "OTHER",
        property_id: propertyId,
        property_hint: propertyHint,
    };

    if (normalized.issuer_name) {
        const supplierProfile = await findOwnerSupplierProfile(ingestionRow.owner_id, normalized.issuer_name);
        if (supplierProfile) {
            normalized.currency = normalized.currency || supplierProfile.currency_hint || "HUF";
            normalized.charge_type = normalized.charge_type === "OTHER" && supplierProfile.default_charge_type
                ? supplierProfile.default_charge_type
                : normalized.charge_type;
            normalized.property_id = normalized.property_id || supplierProfile.default_property_id || null;
        }
    }

    let suggestedProperty:
        | Awaited<ReturnType<typeof suggestOwnerPropertyForIngestion>>
        | null = null;

    if (!normalized.property_id) {
        suggestedProperty = await suggestOwnerPropertyForIngestion({
            ownerId: ingestionRow.owner_id,
            attachmentName: ingestionRow.source_attachment_name,
            sourceEmailSubject: ingestionRow.source_email_subject,
            sourceEmailFrom: ingestionRow.source_email_from,
            propertyHint: normalized.property_hint,
            documentText: extraction.text,
        });

        if (suggestedProperty) {
            normalized.property_id = suggestedProperty.property.id;
        }
    }

    if (!normalized.gross_amount || !normalized.due_date || !normalized.property_id) {
        await admin
            .from("document_ingestions")
            .update({
                status: "NEEDS_REVIEW",
                extracted_data: extraction.data,
                normalized_data: {
                    ...normalized,
                    property_match_reason: suggestedProperty?.reason ?? null,
                },
                confidence: normalized.property_id ? 0.45 : (suggestedProperty?.confidence ?? 0.35),
                error_message: normalized.property_id
                    ? "Az összeg vagy az esedékesség nem volt egyértelműen kinyerhető."
                    : "A számla beérkezett, de ingatlanhoz rendelés és ellenőrzés szükséges.",
                processed_at: new Date().toISOString(),
            })
            .eq("id", ingestionId)
            .eq("owner_id", ingestionRow.owner_id);
        if (ownerProfile?.email) {
            await sendEmail(renderImportInvoiceStatusEmail({
                ownerEmail: ownerProfile.email,
                status: "FAILED",
                fileName: ingestionRow.source_attachment_name,
                provider: normalized.issuer_name,
                amount: normalized.gross_amount ?? null,
                currency: normalized.currency,
                dueDate: normalized.due_date,
                error: normalized.property_id
                    ? "Az import beérkezett, de kézi ellenőrzést igényel."
                    : "Az import beérkezett, de nincs hozzárendelt ingatlan.",
                openUrl: `${SITE_URL}/owner/importok`,
                reviewUrl: `${SITE_URL}/owner/importok/${ingestionId}`,
            }));
        }
        return { ok: true as const, needsReview: true };
    }

    const { data: property, error: propertyError } = await admin
        .from("properties")
        .select("id,name,tenant_id")
        .eq("id", normalized.property_id)
        .eq("owner_id", ingestionRow.owner_id)
        .single();

    if (propertyError || !property) {
        await admin
            .from("document_ingestions")
            .update({
                status: "FAILED",
                extracted_data: extraction.data,
                normalized_data: normalized,
                confidence: 0.4,
                error_message: "Az importált számlához tartozó ingatlan nem található.",
                processed_at: new Date().toISOString(),
            })
            .eq("id", ingestionId)
            .eq("owner_id", ingestionRow.owner_id);
        return { ok: false as const, error: "Az importált számlához tartozó ingatlan nem található." };
    }

    const draftResult = await createDraftFromNormalized(
        ingestionRow.owner_id,
        property as PropertyRow,
        ingestionRow,
        {
            issuer_name: normalized.issuer_name,
            due_date: normalized.due_date,
            gross_amount: normalized.gross_amount,
            currency: normalized.currency,
            charge_type: normalized.charge_type,
        }
    );

    if (!draftResult.ok) {
        await admin
            .from("document_ingestions")
            .update({
                status: "FAILED",
                extracted_data: extraction.data,
                normalized_data: normalized,
                confidence: 0.7,
                error_message: draftResult.error,
                processed_at: new Date().toISOString(),
            })
            .eq("id", ingestionId)
            .eq("owner_id", ingestionRow.owner_id);
        return { ok: false as const, error: draftResult.error };
    }

    const sha256 = createHash("sha256").update(buffer).digest("hex");
    await admin
        .from("document_fingerprints")
        .insert({
            owner_id: ingestionRow.owner_id,
            sha256,
            issuer_name: normalized.issuer_name,
            gross_amount: normalized.gross_amount,
            due_date: normalized.due_date,
            document_id: draftResult.documentId,
        });

    await admin
        .from("document_ingestions")
        .update({
            status: "DRAFTED",
            extracted_data: extraction.data,
            normalized_data: {
                ...normalized,
                property_name: property.name,
                property_match_reason: suggestedProperty?.reason ?? null,
            },
            confidence: 0.82,
            created_charge_id: draftResult.chargeId,
            created_document_id: draftResult.documentId,
            error_message: null,
            processed_at: new Date().toISOString(),
        })
        .eq("id", ingestionId)
        .eq("owner_id", ingestionRow.owner_id);

    if (ownerProfile?.email) {
        await sendEmail(renderImportInvoiceStatusEmail({
            ownerEmail: ownerProfile.email,
            status: "SUCCESS_DRAFT",
            fileName: ingestionRow.source_attachment_name,
            provider: normalized.issuer_name,
            amount: normalized.gross_amount,
            currency: normalized.currency,
            dueDate: normalized.due_date,
            propertyName: property.name,
            openUrl: `${SITE_URL}/owner/importok`,
            reviewUrl: `${SITE_URL}/owner/importok/${ingestionId}`,
            chargeUrl: `${SITE_URL}/owner/properties/${property.id}/charges/${draftResult.chargeId}`,
            publishUrl: `${SITE_URL}/email-action?token=${encodeURIComponent(createEmailActionToken("charge_publish", draftResult.chargeId))}`,
        }));
    }

    return { ok: true as const, needsReview: false, chargeId: draftResult.chargeId };
}
