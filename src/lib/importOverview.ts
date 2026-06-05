import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type IngestionStatus = "RECEIVED" | "EXTRACTED" | "NEEDS_REVIEW" | "DRAFTED" | "FAILED" | "PUBLISHED";
type ChargeStatus = "UNPAID" | "PAID" | "ARCHIVED" | "CANCELLED" | "IMPORT_DRAFT";

type IngestionRow = {
    id: string;
    source_type: "EMAIL" | "UPLOAD";
    source_attachment_name: string | null;
    status: IngestionStatus;
    error_message: string | null;
    created_charge_id: string | null;
    created_at: string;
    normalized_data: { property_id?: string | null } | null;
};

type ChargeRow = {
    id: string;
    status: ChargeStatus;
    property_id: string;
    title: string;
    amount: number | string;
    currency: string | null;
};

export type ImportOverviewRow = {
    ingestionId: string;
    sourceType: "EMAIL" | "UPLOAD";
    sourceAttachmentName: string | null;
    createdAt: string;
    errorMessage: string | null;
    createdChargeId: string | null;
    chargeStatus: ChargeStatus | null;
    chargeTitle: string | null;
    amount: number | null;
    currency: string | null;
    propertyId: string | null;
    state: "received" | "processing" | "review" | "draft" | "published" | "failed";
    stateLabel: string;
    toneClass: string;
    openHref: string;
    reviewHref: string;
    chargeHref: string | null;
    canPublish: boolean;
    needsOwnerAction: boolean;
};

function getPropertyId(row: IngestionRow, charge: ChargeRow | null) {
    const normalizedPropertyId = row.normalized_data?.property_id;
    if (typeof normalizedPropertyId === "string" && normalizedPropertyId.trim()) {
        return normalizedPropertyId;
    }
    return charge?.property_id ?? null;
}

function toAmount(value: number | string | null | undefined) {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : null;
}

function deriveState(row: IngestionRow, charge: ChargeRow | null) {
    if (row.status === "FAILED") {
        return {
            state: "failed" as const,
            stateLabel: "Hibás",
            toneClass: "dashboard-inline-badge-red",
            canPublish: false,
            needsOwnerAction: false,
        };
    }

    if (row.status === "RECEIVED") {
        return {
            state: "received" as const,
            stateLabel: "Beérkezett",
            toneClass: "dashboard-inline-badge-blue",
            canPublish: false,
            needsOwnerAction: false,
        };
    }

    if (row.status === "EXTRACTED") {
        return {
            state: "processing" as const,
            stateLabel: "Feldolgozás alatt",
            toneClass: "dashboard-inline-badge-amber",
            canPublish: false,
            needsOwnerAction: false,
        };
    }

    if (row.status === "NEEDS_REVIEW") {
        return {
            state: "review" as const,
            stateLabel: "Ellenőrzésre vár",
            toneClass: "dashboard-inline-badge-purple",
            canPublish: false,
            needsOwnerAction: true,
        };
    }

    if (charge?.status === "IMPORT_DRAFT") {
        return {
            state: "draft" as const,
            stateLabel: "Piszkozat publikálásra vár",
            toneClass: "dashboard-inline-badge-purple",
            canPublish: true,
            needsOwnerAction: true,
        };
    }

    if (row.status === "PUBLISHED" || charge?.status === "UNPAID" || charge?.status === "PAID" || charge?.status === "ARCHIVED") {
        return {
            state: "published" as const,
            stateLabel: "Publikált",
            toneClass: "dashboard-inline-badge-green",
            canPublish: false,
            needsOwnerAction: false,
        };
    }

    return {
        state: "published" as const,
        stateLabel: "Draft elkészült",
        toneClass: "dashboard-inline-badge-green",
        canPublish: false,
        needsOwnerAction: false,
    };
}

export async function getOwnerImportOverview(ownerId: string, options?: { propertyId?: string | null; limit?: number }) {
    const admin = createSupabaseAdminClient();
    const limit = options?.limit ?? 50;

    const { data: ingestions, error: ingestionError } = await admin
        .from("document_ingestions")
        .select("id,source_type,source_attachment_name,status,error_message,created_charge_id,created_at,normalized_data")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false });

    if (ingestionError) {
        throw new Error(ingestionError.message);
    }

    const ingestionRows = (ingestions ?? []) as IngestionRow[];
    const chargeIds = Array.from(new Set(ingestionRows.map((row) => row.created_charge_id).filter((value): value is string => Boolean(value))));

    const { data: charges, error: chargeError } = chargeIds.length === 0
        ? { data: [] as ChargeRow[], error: null }
        : await admin
            .from("charges")
            .select("id,status,property_id,title,amount,currency")
            .in("id", chargeIds);

    if (chargeError) {
        throw new Error(chargeError.message);
    }

    const chargeById = new Map(((charges ?? []) as ChargeRow[]).map((charge) => [charge.id, charge]));

    const rows = ingestionRows
        .map((row) => {
            const charge = row.created_charge_id ? chargeById.get(row.created_charge_id) ?? null : null;
            const propertyId = getPropertyId(row, charge);

            if (options?.propertyId && propertyId !== options.propertyId) {
                return null;
            }

            const derived = deriveState(row, charge);
            const chargeHref = charge && propertyId
                ? `/owner/charges?property=${encodeURIComponent(propertyId)}&status=IMPORT_DRAFT#charge-${charge.id}`
                : null;
            const reviewHref = `/owner/importok/${row.id}`;

            return {
                ingestionId: row.id,
                sourceType: row.source_type,
                sourceAttachmentName: row.source_attachment_name,
                createdAt: row.created_at,
                errorMessage: row.error_message,
                createdChargeId: row.created_charge_id,
                chargeStatus: charge?.status ?? null,
                chargeTitle: charge?.title ?? null,
                amount: toAmount(charge?.amount),
                currency: charge?.currency ?? null,
                propertyId,
                state: derived.state,
                stateLabel: derived.stateLabel,
                toneClass: derived.toneClass,
                openHref: derived.state === "draft" && chargeHref ? chargeHref : reviewHref,
                reviewHref,
                chargeHref,
                canPublish: derived.canPublish,
                needsOwnerAction: derived.needsOwnerAction,
            } satisfies ImportOverviewRow;
        })
        .filter((row): row is ImportOverviewRow => Boolean(row));

    return {
        rows: rows.slice(0, limit),
        receivedCount: rows.filter((row) => row.state === "received").length,
        processingCount: rows.filter((row) => row.state === "processing").length,
        reviewCount: rows.filter((row) => row.needsOwnerAction).length,
        completedCount: rows.filter((row) => row.state === "published").length,
        actionRows: rows.filter((row) => row.needsOwnerAction),
    };
}
