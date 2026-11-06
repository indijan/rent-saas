import { createHash } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

export type ExactDocumentMatch = {
    documentId: string | null;
    chargeId: string | null;
    propertyId: string | null;
    issuerName: string | null;
    grossAmount: number | null;
    dueDate: string | null;
};

export function sha256Document(buffer: Buffer) {
    return createHash("sha256").update(buffer).digest("hex");
}

export async function findExactDocumentMatch(admin: SupabaseAdmin, ownerId: string, buffer: Buffer) {
    const sha256 = sha256Document(buffer);
    const { data: fingerprint, error: fingerprintError } = await admin
        .from("document_fingerprints")
        .select("document_id,issuer_name,gross_amount,due_date")
        .eq("owner_id", ownerId)
        .eq("sha256", sha256)
        .maybeSingle();

    if (fingerprintError) return { ok: false as const, error: fingerprintError.message, sha256 };
    if (!fingerprint) return { ok: true as const, sha256, duplicate: null };

    const documentId = typeof fingerprint.document_id === "string" ? fingerprint.document_id : null;
    const { data: document, error: documentError } = documentId
        ? await admin
            .from("documents")
            .select("id,charge_id,property_id")
            .eq("id", documentId)
            .eq("owner_id", ownerId)
            .maybeSingle()
        : { data: null, error: null };

    if (documentError) return { ok: false as const, error: documentError.message, sha256 };

    return {
        ok: true as const,
        sha256,
        duplicate: {
            documentId,
            chargeId: typeof document?.charge_id === "string" ? document.charge_id : null,
            propertyId: typeof document?.property_id === "string" ? document.property_id : null,
            issuerName: typeof fingerprint.issuer_name === "string" ? fingerprint.issuer_name : null,
            grossAmount: typeof fingerprint.gross_amount === "number" ? fingerprint.gross_amount : null,
            dueDate: typeof fingerprint.due_date === "string" ? fingerprint.due_date : null,
        } satisfies ExactDocumentMatch,
    };
}

export async function saveDocumentFingerprint(
    admin: SupabaseAdmin,
    input: {
        ownerId: string;
        sha256: string;
        documentId: string;
        issuerName?: string | null;
        grossAmount?: number | null;
        dueDate?: string | null;
    }
) {
    const { error } = await admin
        .from("document_fingerprints")
        .upsert({
            owner_id: input.ownerId,
            sha256: input.sha256,
            document_id: input.documentId,
            issuer_name: input.issuerName ?? null,
            gross_amount: input.grossAmount ?? null,
            due_date: input.dueDate ?? null,
        }, { onConflict: "owner_id,sha256", ignoreDuplicates: true });

    if (error) throw new Error(error.message || "A dokumentum ujjlenyomatának mentése nem sikerült.");
}
