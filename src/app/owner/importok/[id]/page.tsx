import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import AppHeader from "@/components/AppHeader";
import { finalizeIngestionReview } from "../actions";
import { publishCharge } from "@/app/owner/properties/[id]/charges/actions";
import { createDocumentSignedUrl } from "@/lib/documentStorage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import PendingSubmitButton from "@/components/PendingSubmitButton";
import PdfPreview from "@/components/PdfPreview";
import { ALL_CHARGE_TYPE_OPTIONS, getChargeTypeLabel } from "@/lib/chargeTypes";
import { getImportModeLabel, IMPORT_MODE_OPTIONS } from "@/lib/importModes";

type Props = {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ status?: string; message?: string }> | { status?: string; message?: string };
};

type PropertyRow = {
    id: string;
    name: string;
    address: string;
};

type IngestionRow = {
    id: string;
    source_type: "EMAIL" | "UPLOAD";
    source_attachment_name: string | null;
    storage_key: string;
    status: "RECEIVED" | "EXTRACTED" | "NEEDS_REVIEW" | "DRAFTED" | "FAILED" | "PUBLISHED";
    error_message: string | null;
    created_charge_id: string | null;
    extracted_data: Record<string, unknown> | null;
    normalized_data: Record<string, unknown> | null;
    confidence: number | null;
    created_at: string;
};

type ChargeRow = {
    id: string;
    status: "UNPAID" | "PAID" | "ARCHIVED" | "CANCELLED" | "IMPORT_DRAFT";
};

function statusLabel(status: IngestionRow["status"]) {
    switch (status) {
        case "RECEIVED":
            return "Beérkezett";
        case "EXTRACTED":
            return "Kinyerve";
        case "NEEDS_REVIEW":
            return "Ellenőrzendő";
        case "DRAFTED":
            return "Draft létrejött";
        case "FAILED":
            return "Hibás";
        case "PUBLISHED":
            return "Publikált";
        default:
            return status;
    }
}

function asString(value: unknown, fallback = "") {
    return typeof value === "string" ? value : fallback;
}

function asNumberString(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "string" && value.trim()) return value;
    return "";
}

function propertyLabel(properties: PropertyRow[], propertyId: string) {
    const property = properties.find((item) => item.id === propertyId);
    return property ? `${property.name} · ${property.address}` : propertyId;
}

export default async function OwnerImportDetailPage({ params, searchParams }: Props) {
    const { id } = await params;
    const { supabase, user, profile } = await requireRole("OWNER");
    const admin = createSupabaseAdminClient();
    const sp = searchParams instanceof Promise ? await searchParams : (searchParams ?? {});
    const status = sp.status ? String(sp.status) : "";
    const message = sp.message ? String(sp.message) : "";

    const [{ data: ingestion, error: ingestionError }, { data: properties, error: propertyError }] = await Promise.all([
        admin
            .from("document_ingestions")
            .select("id,source_type,source_attachment_name,storage_key,status,error_message,created_charge_id,extracted_data,normalized_data,confidence,created_at")
            .eq("id", id)
            .eq("owner_id", user.id)
            .limit(1)
            .maybeSingle(),
        supabase
            .from("properties")
            .select("id,name,address")
            .eq("owner_id", user.id)
            .order("name"),
    ]);

    if (ingestionError || !ingestion || propertyError) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <div className="card">
                    <h1>Import részletei</h1>
                    <p className="text-red-600">Hiba: {ingestionError?.message || propertyError?.message || "Az import nem található."}</p>
                </div>
            </main>
        );
    }

    const ingestionRow = ingestion as IngestionRow;
    const propertyRows = (properties ?? []) as PropertyRow[];
    const { data: createdCharge } = ingestionRow.created_charge_id
        ? await admin
            .from("charges")
            .select("id,status")
            .eq("id", ingestionRow.created_charge_id)
            .eq("owner_id", user.id)
            .maybeSingle()
        : { data: null as ChargeRow | null };
    const normalized = (ingestionRow.normalized_data ?? {}) as Record<string, unknown>;
    const selectedPropertyId = asString(normalized.property_id);
    const chargeLink = ingestionRow.created_charge_id && selectedPropertyId
        ? `/owner/charges?property=${selectedPropertyId}${createdCharge?.status === "IMPORT_DRAFT" ? "&status=IMPORT_DRAFT" : ""}#charge-${ingestionRow.created_charge_id}`
        : "/owner/importok";
    let previewUrl = "";
    try {
        previewUrl = await createDocumentSignedUrl(ingestionRow.storage_key, 60 * 60);
    } catch {
        previewUrl = "";
    }
    return (
        <main className="app-shell page-enter space-y-4">
            <AppHeader profile={profile} />

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <Link className="link text-sm" href={chargeLink}>
                            ← {ingestionRow.created_charge_id ? "Vissza a piszkozathoz" : "Vissza az importokhoz"}
                        </Link>
                        <div className="eyebrow">Import részletei</div>
                        <h1>{ingestionRow.source_attachment_name || "Név nélküli csatolmány"}</h1>
                        <p className="muted-note">
                            {ingestionRow.source_type === "EMAIL" ? "E-mailből érkezett" : "Kézi feltöltés"} · {new Date(ingestionRow.created_at).toLocaleString("hu-HU")}
                        </p>
                    </div>
                    <div className={`status-badge status-${String(ingestionRow.status).toLowerCase()}`}>
                        {statusLabel(ingestionRow.status)}
                    </div>
                </div>
                {createdCharge?.status === "IMPORT_DRAFT" ? (
                    <div className="dashboard-table-actions">
                        <Link className="btn btn-secondary btn-sm" href={chargeLink}>
                            Piszkozat megnyitása
                        </Link>
                        <form
                            action={async () => {
                                "use server";
                                const res = await publishCharge(createdCharge.id);
                                if (!res.ok) {
                                    redirect(`/owner/importok/${ingestionRow.id}?status=error&message=${encodeURIComponent(res.error ?? "Ismeretlen hiba.")}`);
                                }
                                redirect(`/owner/importok/${ingestionRow.id}?status=success&message=A+piszkozat+publik%C3%A1lva+lett.`);
                            }}
                        >
                            <PendingSubmitButton className="btn btn-primary btn-sm" label="Publikálás" pendingLabel="Publikálás..." />
                        </form>
                    </div>
                ) : null}
            </section>

            {message ? (
                <div className={`card ${status === "error" ? "text-red-600" : "text-green-600"}`}>
                    {message}
                </div>
            ) : null}

            <section className="grid">
                <article className="card section-stack">
                    <div className="card-title">Kinyert adatok</div>
                    <div className="feature-list">
                        <div className="feature-item">Issuer: {asString(normalized.issuer_name) || "-"}</div>
                        <div className="feature-item">Összeg: {asNumberString(normalized.gross_amount) || "-"}</div>
                        <div className="feature-item">Valuta: {asString(normalized.currency) || "HUF"}</div>
                        <div className="feature-item">Esedékesség: {asString(normalized.due_date) || "-"}</div>
                        <div className="feature-item">Típus: {getChargeTypeLabel(asString(normalized.charge_type, "OTHER"))}</div>
                        <div className="feature-item">Import mód: {getImportModeLabel(asString(normalized.import_mode, "FORWARDED"))}</div>
                        <div className="feature-item">
                            Ajánlott ingatlan: {selectedPropertyId ? propertyLabel(propertyRows, selectedPropertyId) : "-"}
                        </div>
                        <div className="feature-item">Ingatlan egyezés oka: {asString(normalized.property_match_reason) || "-"}</div>
                        <div className="feature-item">
                            Feldolgozási bizalom: {typeof ingestionRow.confidence === "number" ? `${Math.round(ingestionRow.confidence * 100)}%` : "-"}
                        </div>
                    </div>
                    {ingestionRow.error_message ? (
                        <p className="muted-note text-red-600">{ingestionRow.error_message}</p>
                    ) : null}
                </article>
            </section>

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="card-title">PDF előnézet</div>
                        <p className="muted-note">A preview signed URL-lel érhető el, így ellenőrzés közben is meg tudod nyitni a dokumentumot.</p>
                    </div>
                    {previewUrl ? (
                        <a className="btn btn-secondary" href={previewUrl} target="_blank" rel="noreferrer">
                            PDF megnyitása
                        </a>
                    ) : null}
                </div>
                {previewUrl ? (
                    <details className="document-preview-shell">
                        <summary className="document-preview-toggle">
                            PDF előnézet lenyitása
                        </summary>
                        <div className="document-preview-body">
                            <PdfPreview url={previewUrl} />
                        </div>
                    </details>
                ) : (
                    <p className="muted-note">A preview jelenleg nem érhető el ehhez a dokumentumhoz.</p>
                )}
            </section>

            <form
                action={async (formData) => {
                    "use server";
                    const res = await finalizeIngestionReview(ingestionRow.id, formData);
                    if (!res.ok) {
                        const msg = res.error ?? "Ismeretlen hiba.";
                        redirect(`/owner/importok/${ingestionRow.id}?status=error&message=${encodeURIComponent(msg)}`);
                    }
                    redirect(`/owner/charges?property=${res.propertyId}&status=IMPORT_DRAFT#charge-${res.chargeId}`);
                }}
                className="card form-shell"
            >
                <div className="section-header">
                    <div>
                        <div className="card-title">{ingestionRow.created_charge_id ? "Piszkozat adatainak javítása" : "Draft létrehozása review után"}</div>
                        <p className="muted-note">
                            Itt javíthatod a mezőket, majd {ingestionRow.created_charge_id ? "a meglévő piszkozatot frissítheted." : "létrehozhatod a draft díjat."}
                        </p>
                    </div>
                </div>
                <div className="form-panel">
                    <div className="form-grid">
                        <label className="field-stack">
                            <span className="field-label">Ingatlan</span>
                            <select name="property_id" className="select" defaultValue={selectedPropertyId} required>
                                <option value="" disabled>Válassz ingatlant...</option>
                                {propertyRows.map((property) => (
                                    <option key={property.id} value={property.id}>
                                        {property.name} · {property.address}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="field-stack">
                            <span className="field-label">Issuer neve</span>
                            <input name="issuer_name" className="input" defaultValue={asString(normalized.issuer_name)} />
                        </label>
                        <label className="field-stack">
                            <span className="field-label">Összeg</span>
                            <input name="gross_amount" className="input" type="number" step="0.01" defaultValue={asNumberString(normalized.gross_amount)} required />
                        </label>
                        <label className="field-stack">
                            <span className="field-label">Valuta</span>
                            <input name="currency" className="input" defaultValue={asString(normalized.currency, "HUF")} required />
                        </label>
                        <label className="field-stack">
                            <span className="field-label">Esedékesség</span>
                            <input name="due_date" className="input" type="date" defaultValue={asString(normalized.due_date)} required />
                        </label>
                        <label className="field-stack">
                            <span className="field-label">Import mód</span>
                            <select name="import_mode" className="select" defaultValue={asString(normalized.import_mode, "FORWARDED")}>
                                {IMPORT_MODE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </label>
                        <label className="field-stack">
                            <span className="field-label">Típus</span>
                            <select name="charge_type" className="select" defaultValue={asString(normalized.charge_type, "OTHER")}>
                                {ALL_CHARGE_TYPE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <label className="field-stack">
                        <span className="field-label">Megjegyzés</span>
                        <textarea name="notes" className="input textarea" placeholder="Opcionális belső megjegyzés a javításhoz." />
                    </label>
                </div>
                <PendingSubmitButton
                    className="btn btn-primary"
                    label={ingestionRow.created_charge_id ? "Draft díj módosítása" : "Draft díj létrehozása"}
                    pendingLabel={ingestionRow.created_charge_id ? "Draft módosítása folyamatban..." : "Draft létrehozása folyamatban..."}
                />
            </form>
        </main>
    );
}
