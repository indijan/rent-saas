import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import AppHeader from "@/components/AppHeader";
import { finalizeIngestionReview, reprocessIngestion, saveSupplierProfileFromIngestion } from "../actions";

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
    const sp = searchParams instanceof Promise ? await searchParams : (searchParams ?? {});
    const status = sp.status ? String(sp.status) : "";
    const message = sp.message ? String(sp.message) : "";

    const [{ data: ingestion, error: ingestionError }, { data: properties, error: propertyError }] = await Promise.all([
        supabase
            .from("document_ingestions")
            .select("id,source_type,source_attachment_name,storage_key,status,error_message,created_charge_id,extracted_data,normalized_data,confidence,created_at")
            .eq("id", id)
            .eq("owner_id", user.id)
            .single(),
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
    const normalized = (ingestionRow.normalized_data ?? {}) as Record<string, unknown>;
    const extracted = (ingestionRow.extracted_data ?? {}) as Record<string, unknown>;
    const selectedPropertyId = asString(normalized.property_id);
    const { data: previewData } = await supabase.storage
        .from("documents")
        .createSignedUrl(ingestionRow.storage_key, 60 * 60);
    const previewUrl = previewData?.signedUrl ?? "";

    return (
        <main className="app-shell page-enter space-y-4">
            <AppHeader profile={profile} />

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <Link className="link text-sm" href="/owner/importok">
                            ← Vissza az importokhoz
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
                        <div className="feature-item">Típus: {asString(normalized.charge_type) || "OTHER"}</div>
                        <div className="feature-item">
                            Ajánlott ingatlan: {selectedPropertyId ? propertyLabel(propertyRows, selectedPropertyId) : "-"}
                        </div>
                        <div className="feature-item">Ingatlan egyezés oka: {asString(normalized.property_match_reason) || "-"}</div>
                        <div className="feature-item">
                            Feldolgozási bizalom: {typeof ingestionRow.confidence === "number" ? `${Math.round(ingestionRow.confidence * 100)}%` : "-"}
                        </div>
                        <div className="feature-item">Storage kulcs: {ingestionRow.storage_key}</div>
                    </div>
                    {ingestionRow.error_message ? (
                        <p className="muted-note text-red-600">{ingestionRow.error_message}</p>
                    ) : null}
                </article>

                <article className="card section-stack">
                    <div className="card-title">Nyers AI válasz</div>
                    <pre className="overflow-x-auto rounded-xl border border-black/10 bg-slate-50 p-3 text-xs text-slate-700">
                        {JSON.stringify(extracted, null, 2)}
                    </pre>
                </article>
            </section>

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="card-title">PDF előnézet</div>
                        <p className="muted-note">A preview signed URL-lel érhető el, így az import ellenőrzése közben is meg tudod nyitni a dokumentumot.</p>
                    </div>
                    {previewUrl ? (
                        <a className="btn btn-secondary" href={previewUrl} target="_blank" rel="noreferrer">
                            PDF megnyitása
                        </a>
                    ) : null}
                </div>
                {previewUrl ? (
                    <iframe
                        src={previewUrl}
                        title="Számla PDF előnézet"
                        className="min-h-[720px] w-full rounded-xl border border-black/10 bg-white"
                    />
                ) : (
                    <p className="muted-note">A preview jelenleg nem érhető el ehhez a dokumentumhoz.</p>
                )}
            </section>

            <form
                action={async () => {
                    "use server";
                    const res = await reprocessIngestion(ingestionRow.id);
                    if (!res.ok) {
                        const msg = res.error ?? "Ismeretlen hiba.";
                        redirect(`/owner/importok/${ingestionRow.id}?status=error&message=${encodeURIComponent(msg)}`);
                    }
                    redirect(`/owner/importok/${ingestionRow.id}?status=success&message=Az+import+%C3%BAjrafeldolgoz%C3%A1sa+lefutott.`);
                }}
                className="card form-shell"
            >
                <div className="section-header">
                    <div>
                        <div className="card-title">Újrafeldolgozás</div>
                        <p className="muted-note">Ha közben mentettél szolgáltatói sablont vagy javult a parser, innen újrafuttatható az import.</p>
                    </div>
                </div>
                <button className="btn btn-secondary" type="submit">
                    Import újrafeldolgozása
                </button>
            </form>

            <form
                action={async (formData) => {
                    "use server";
                    const res = await finalizeIngestionReview(ingestionRow.id, formData);
                    if (!res.ok) {
                        const msg = res.error ?? "Ismeretlen hiba.";
                        redirect(`/owner/importok/${ingestionRow.id}?status=error&message=${encodeURIComponent(msg)}`);
                    }
                    redirect(`/owner/importok/${ingestionRow.id}?status=success&message=A+draft+d%C3%ADj+l%C3%A9trej%C3%B6tt.`);
                }}
                className="card form-shell"
            >
                <div className="section-header">
                    <div>
                        <div className="card-title">Draft létrehozása review után</div>
                        <p className="muted-note">Itt javíthatod a mezőket, majd létrehozhatod a draft díjat.</p>
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
                            <span className="field-label">Típus</span>
                            <select name="charge_type" className="select" defaultValue={asString(normalized.charge_type, "OTHER")}>
                                <option value="RENT">Bérleti díj</option>
                                <option value="UTILITY">Rezsi</option>
                                <option value="COMMON_COST">Közös költség</option>
                                <option value="OTHER">Egyéb</option>
                            </select>
                        </label>
                    </div>
                    <label className="field-stack">
                        <span className="field-label">Megjegyzés</span>
                        <textarea name="notes" className="input textarea" placeholder="Miért kellett javítani vagy mit tanultunk ebből a számlából?" />
                    </label>
                </div>
                <button className="btn btn-primary" type="submit">
                    Draft díj létrehozása
                </button>
            </form>

            <form
                action={async (formData) => {
                    "use server";
                    const res = await saveSupplierProfileFromIngestion(ingestionRow.id, formData);
                    if (!res.ok) {
                        const msg = res.error ?? "Ismeretlen hiba.";
                        redirect(`/owner/importok/${ingestionRow.id}?status=error&message=${encodeURIComponent(msg)}`);
                    }
                    redirect(`/owner/importok/${ingestionRow.id}?status=success&message=A+szolg%C3%A1ltat%C3%B3i+sablon+elmentve.`);
                }}
                className="card form-shell"
            >
                <div className="section-header">
                    <div>
                        <div className="card-title">Szolgáltatói sablon mentése</div>
                        <p className="muted-note">Ez még egyszerű issuer-alapú sablon. A későbbi extraction profil erre épül majd rá.</p>
                    </div>
                </div>
                <div className="form-panel">
                    <div className="form-grid">
                        <label className="field-stack">
                            <span className="field-label">Issuer neve</span>
                            <input name="issuer_name" className="input" defaultValue={asString(normalized.issuer_name)} required />
                        </label>
                        <label className="field-stack">
                            <span className="field-label">Alapértelmezett ingatlan</span>
                            <select name="default_property_id" className="select" defaultValue={selectedPropertyId}>
                                <option value="">Nincs rögzítve</option>
                                {propertyRows.map((property) => (
                                    <option key={property.id} value={property.id}>
                                        {property.name} · {property.address}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="field-stack">
                            <span className="field-label">Alap típus</span>
                            <select name="charge_type" className="select" defaultValue={asString(normalized.charge_type, "OTHER")}>
                                <option value="RENT">Bérleti díj</option>
                                <option value="UTILITY">Rezsi</option>
                                <option value="COMMON_COST">Közös költség</option>
                                <option value="OTHER">Egyéb</option>
                            </select>
                        </label>
                        <label className="field-stack">
                            <span className="field-label">Valuta</span>
                            <input name="currency" className="input" defaultValue={asString(normalized.currency, "HUF")} required />
                        </label>
                    </div>
                </div>
                <button className="btn btn-secondary" type="submit">
                    Szolgáltatói sablon mentése
                </button>
            </form>
        </main>
    );
}
