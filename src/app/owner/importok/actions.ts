"use server";

import { createHash, randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { extractInvoiceFromBuffer } from "@/app/owner/properties/[id]/charges/actions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { renderImportInvoiceStatusEmail } from "@/lib/email/templates";
import { rotateInboundMailbox } from "@/lib/inboundMailboxes";
import { findOwnerSupplierProfile, issuerFingerprint } from "@/lib/supplierProfiles";
import { processStoredIngestion } from "@/lib/ingestionProcessing";
import { getConfiguredStorageBucketName, removeDocumentObjects, uploadDocumentObject } from "@/lib/documentStorage";
import { createEmailActionToken } from "@/lib/emailActionTokens";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://rentapp.hu";

function safeFileName(value: string) {
    return value.replaceAll(" ", "_").replace(/[^a-zA-Z0-9._-]/g, "");
}

type PropertyRow = {
    id: string;
    name: string;
    tenant_id: string | null;
};

type IngestionRow = {
    id: string;
    owner_id: string;
    source_attachment_name: string | null;
    storage_key: string;
    extracted_data: Record<string, unknown> | null;
    normalized_data: Record<string, unknown> | null;
    created_document_id: string | null;
};

type NormalizedDraftInput = {
    issuer_name: string | null;
    due_date: string;
    gross_amount: number;
    currency: string;
    charge_type: string;
};

async function createDraftFromNormalized(
    supabase: Awaited<ReturnType<typeof requireRole>>["supabase"],
    ownerId: string,
    property: PropertyRow,
    ingestion: IngestionRow,
    normalized: NormalizedDraftInput
) {
    const { data: createdCharge, error: chargeError } = await supabase
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
        return { ok: false as const, error: chargeError?.message || "A draft díj létrehozása nem sikerült." };
    }

    const { data: createdDocument, error: documentError } = await supabase
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
        await supabase.from("charges").delete().eq("id", createdCharge.id).eq("owner_id", ownerId);
        return { ok: false as const, error: documentError?.message || "A dokumentum kapcsolása nem sikerült." };
    }

    return {
        ok: true as const,
        chargeId: createdCharge.id,
        documentId: createdDocument.id,
    };
}

export async function createManualIngestion(formData: FormData) {
    const { supabase, user } = await requireRole("OWNER");
    const admin = createSupabaseAdminClient();

    const propertyId = String(formData.get("property_id") || "").trim();
    const document = formData.get("document");
    const documentFile = document instanceof File ? document : null;

    if (!propertyId) {
        return { ok: false, error: "Válassz ki egy ingatlant." };
    }
    if (!documentFile || documentFile.size === 0) {
        return { ok: false, error: "Tölts fel egy PDF számlát." };
    }
    if (documentFile.type !== "application/pdf") {
        return { ok: false, error: "Csak PDF számla tölthető fel." };
    }

    const { data: property, error: propertyError } = await supabase
        .from("properties")
        .select("id,name,tenant_id")
        .eq("id", propertyId)
        .eq("owner_id", user.id)
        .single();

    if (propertyError || !property) {
        return { ok: false, error: "Az ingatlan nem található." };
    }

    const { data: ownerProfile } = await admin
        .from("profiles")
        .select("email")
        .eq("id", user.id)
        .maybeSingle();

    const buffer = Buffer.from(await documentFile.arrayBuffer());
    const sha256 = createHash("sha256").update(buffer).digest("hex");

    const { data: existingFingerprint, error: fingerprintLookupError } = await supabase
        .from("document_fingerprints")
        .select("id")
        .eq("owner_id", user.id)
        .eq("sha256", sha256)
        .maybeSingle();

    if (fingerprintLookupError) {
        return { ok: false, error: fingerprintLookupError.message };
    }
    if (existingFingerprint) {
        return { ok: false, error: "Ez a számla már fel lett dolgozva ehhez a bérbeadóhoz." };
    }

    const ingestionId = randomUUID();
    const safeName = safeFileName(documentFile.name || "invoice.pdf") || "invoice.pdf";
    const storageKey = `${user.id}/ingestions/${ingestionId}/${Date.now()}-${safeName}`;

    try {
        await uploadDocumentObject(storageKey, buffer, documentFile.type);
    } catch {
        return { ok: false, error: "A dokumentum feltöltése nem sikerült." };
    }

    const { error: ingestionInsertError } = await admin
        .from("document_ingestions")
        .insert({
            id: ingestionId,
            owner_id: user.id,
            source_type: "UPLOAD",
            source_attachment_name: documentFile.name,
            storage_bucket: getConfiguredStorageBucketName(),
            storage_key: storageKey,
            status: "RECEIVED",
        });

    if (ingestionInsertError) {
        await removeDocumentObjects([storageKey]);
        return { ok: false, error: ingestionInsertError.message };
    }

    const extraction = await extractInvoiceFromBuffer(buffer);
    if (!extraction.ok || !extraction.data) {
        await admin
            .from("document_ingestions")
            .update({
                status: "FAILED",
                error_message: extraction.ok ? "Ismeretlen feldolgozási hiba." : extraction.error,
                processed_at: new Date().toISOString(),
            })
            .eq("id", ingestionId)
            .eq("owner_id", user.id);
        revalidatePath("/owner/importok");
        return { ok: false, error: extraction.ok ? "A feldolgozás nem sikerült." : extraction.error };
    }

    const normalized = {
        issuer_name: extraction.data.name,
        due_date: extraction.data.due_date,
        gross_amount: extraction.data.amount,
        currency: extraction.data.currency || "HUF",
        charge_type: extraction.data.type || "OTHER",
        property_id: property.id,
        property_name: property.name,
        document_text: extraction.text,
    };

    if (normalized.issuer_name) {
        const supplierProfile = await findOwnerSupplierProfile(user.id, normalized.issuer_name);
        if (supplierProfile) {
            normalized.currency = normalized.currency || supplierProfile.currency_hint || "HUF";
            normalized.charge_type = normalized.charge_type === "OTHER" && supplierProfile.default_charge_type
                ? supplierProfile.default_charge_type
                : normalized.charge_type;
        }
    }

    if (!normalized.gross_amount || !normalized.due_date) {
        await admin
            .from("document_ingestions")
            .update({
                status: "NEEDS_REVIEW",
                extracted_data: extraction.data,
                normalized_data: normalized,
                confidence: 0.45,
                error_message: "Az összeg vagy az esedékesség nem volt egyértelműen kinyerhető.",
                processed_at: new Date().toISOString(),
            })
            .eq("id", ingestionId)
            .eq("owner_id", user.id);
        if (ownerProfile?.email) {
            await sendEmail(renderImportInvoiceStatusEmail({
                ownerEmail: ownerProfile.email,
                status: "FAILED",
                fileName: documentFile.name,
                provider: normalized.issuer_name,
                amount: normalized.gross_amount ?? null,
                currency: normalized.currency,
                dueDate: normalized.due_date,
                propertyName: property.name,
                error: "Az import beérkezett, de kézi ellenőrzést igényel.",
                openUrl: `${SITE_URL}/owner/importok`,
                reviewUrl: `${SITE_URL}/owner/importok/${ingestionId}`,
            }));
        }
        revalidatePath("/owner/importok");
        return { ok: true, needsReview: true, ingestionId };
    }

    const draftResult = await createDraftFromNormalized(
        supabase,
        user.id,
        property,
        {
            id: ingestionId,
            owner_id: user.id,
            source_attachment_name: documentFile.name,
            storage_key: storageKey,
            extracted_data: extraction.data,
            normalized_data: normalized,
            created_document_id: null,
        },
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
            .eq("owner_id", user.id);
        revalidatePath("/owner/importok");
        return { ok: false, error: draftResult.error };
    }

    await admin
        .from("document_fingerprints")
        .insert({
            owner_id: user.id,
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
            normalized_data: normalized,
            confidence: 0.82,
            created_charge_id: draftResult.chargeId,
            created_document_id: draftResult.documentId,
            processed_at: new Date().toISOString(),
        })
        .eq("id", ingestionId)
        .eq("owner_id", user.id);

    if (ownerProfile?.email) {
        await sendEmail(renderImportInvoiceStatusEmail({
            ownerEmail: ownerProfile.email,
            status: "SUCCESS_DRAFT",
            fileName: documentFile.name,
            provider: normalized.issuer_name,
            amount: normalized.gross_amount,
            currency: normalized.currency,
            dueDate: normalized.due_date,
            propertyName: property.name,
            openUrl: `${SITE_URL}/owner/importok`,
            reviewUrl: `${SITE_URL}/owner/importok/${ingestionId}`,
            publishUrl: `${SITE_URL}/email-action?token=${encodeURIComponent(createEmailActionToken("charge_publish", draftResult.chargeId))}`,
        }));
    }

    revalidatePath("/owner/importok");
    revalidatePath(`/owner/properties/${property.id}/charges`);
    return { ok: true, needsReview: false, chargeId: draftResult.chargeId, ingestionId };
}

export async function finalizeIngestionReview(ingestionId: string, formData: FormData) {
    const { supabase, user } = await requireRole("OWNER");

    const propertyId = String(formData.get("property_id") || "").trim();
    const issuerName = String(formData.get("issuer_name") || "").trim() || null;
    const dueDate = String(formData.get("due_date") || "").trim();
    const amount = Number(String(formData.get("gross_amount") || "").trim());
    const currency = String(formData.get("currency") || "HUF").trim().toUpperCase() || "HUF";
    const chargeType = String(formData.get("charge_type") || "OTHER").trim();
    const notes = String(formData.get("notes") || "").trim() || null;

    if (!propertyId || !dueDate || !Number.isFinite(amount) || amount <= 0) {
        return { ok: false, error: "Az ingatlan, az összeg és az esedékesség kötelező." };
    }

    const [{ data: property, error: propertyError }, { data: ingestion, error: ingestionError }] = await Promise.all([
        supabase
            .from("properties")
            .select("id,name,tenant_id")
            .eq("id", propertyId)
            .eq("owner_id", user.id)
            .single(),
        supabase
            .from("document_ingestions")
            .select("id,owner_id,source_attachment_name,storage_key,extracted_data,normalized_data,created_document_id")
            .eq("id", ingestionId)
            .eq("owner_id", user.id)
            .single(),
    ]);

    if (propertyError || !property) return { ok: false, error: "Az ingatlan nem található." };
    if (ingestionError || !ingestion) return { ok: false, error: "Az import nem található." };

    const draftResult = await createDraftFromNormalized(
        supabase,
        user.id,
        property as PropertyRow,
        ingestion as IngestionRow,
        {
            issuer_name: issuerName,
            due_date: dueDate,
            gross_amount: amount,
            currency,
            charge_type: chargeType,
        }
    );

    if (!draftResult.ok) {
        return { ok: false, error: draftResult.error };
    }

    const finalExtraction = {
        issuer_name: issuerName,
        due_date: dueDate,
        gross_amount: amount,
        currency,
        charge_type: chargeType,
        property_id: property.id,
        property_name: property.name,
    };

    await supabase.from("extraction_reviews").insert({
        ingestion_id: ingestionId,
        reviewed_by: user.id,
        raw_extraction_json: ingestion.extracted_data ?? {},
        final_extraction_json: finalExtraction,
        notes,
    });

    await supabase
        .from("document_ingestions")
        .update({
            status: "DRAFTED",
            normalized_data: finalExtraction,
            confidence: 0.95,
            created_charge_id: draftResult.chargeId,
            created_document_id: draftResult.documentId,
            error_message: null,
            processed_at: new Date().toISOString(),
        })
        .eq("id", ingestionId)
        .eq("owner_id", user.id);

    revalidatePath("/owner/importok");
    revalidatePath(`/owner/importok/${ingestionId}`);
    revalidatePath(`/owner/properties/${property.id}/charges`);
    return { ok: true, chargeId: draftResult.chargeId };
}

export async function saveSupplierProfileFromIngestion(ingestionId: string, formData: FormData) {
    const { supabase, user } = await requireRole("OWNER");

    const issuerName = String(formData.get("issuer_name") || "").trim();
    const propertyId = String(formData.get("default_property_id") || "").trim() || null;
    const chargeType = String(formData.get("charge_type") || "OTHER").trim();
    const currency = String(formData.get("currency") || "HUF").trim().toUpperCase() || "HUF";

    if (!issuerName) {
        return { ok: false, error: "Az issuer neve kötelező a szolgáltatói sablonhoz." };
    }

    if (propertyId) {
        const { data: property, error: propertyError } = await supabase
            .from("properties")
            .select("id")
            .eq("id", propertyId)
            .eq("owner_id", user.id)
            .single();

        if (propertyError || !property) {
            return { ok: false, error: "A kiválasztott alapértelmezett ingatlan nem található." };
        }
    }

    const { data: ingestion, error } = await supabase
        .from("document_ingestions")
        .select("id,normalized_data")
        .eq("id", ingestionId)
        .eq("owner_id", user.id)
        .single();

    if (error || !ingestion) {
        return { ok: false, error: "Az import nem található." };
    }

    const normalized = (ingestion.normalized_data ?? {}) as Record<string, unknown>;
    const fingerprint = issuerFingerprint(issuerName);

    const fieldRules = {
        default_charge_type: chargeType,
        currency_hint: currency,
        sample_due_date: normalized.due_date ?? null,
        sample_amount: normalized.gross_amount ?? null,
    };

    const { error: upsertError } = await supabase
        .from("supplier_profiles")
        .upsert({
            owner_id: user.id,
            issuer_name: issuerName,
            issuer_fingerprint: fingerprint,
            default_property_id: propertyId,
            default_charge_type: chargeType,
            currency_hint: currency,
            field_rules_json: fieldRules,
            is_global: false,
        }, { onConflict: "owner_id,issuer_fingerprint" });

    if (upsertError) {
        return { ok: false, error: upsertError.message };
    }

    revalidatePath(`/owner/importok/${ingestionId}`);
    return { ok: true };
}

export async function reprocessIngestion(ingestionId: string) {
    const { user } = await requireRole("OWNER");
    const admin = createSupabaseAdminClient();

    const { data: ingestion, error } = await admin
        .from("document_ingestions")
        .select("id,owner_id")
        .eq("id", ingestionId)
        .eq("owner_id", user.id)
        .single();

    if (error || !ingestion) {
        return { ok: false, error: "Az import nem található." };
    }

    const result = await processStoredIngestion(ingestionId);
    revalidatePath("/owner/importok");
    revalidatePath(`/owner/importok/${ingestionId}`);
    return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function rotateOwnerInboundMailbox() {
    const { user } = await requireRole("OWNER");

    try {
        await rotateInboundMailbox(user.id);
        revalidatePath("/owner/importok");
        return { ok: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : "A bejövő e-mail-cím cseréje nem sikerült.";
        return { ok: false, error: message };
    }
}
