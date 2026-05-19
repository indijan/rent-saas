import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import AppHeader from "@/components/AppHeader";
import { getOrCreateInboundMailbox } from "@/lib/inboundMailboxes";
import { createManualIngestion, rotateOwnerInboundMailbox } from "./actions";
import ImportSubmitButton from "./ImportSubmitButton";

type Props = {
    searchParams?: Promise<{ status?: string; message?: string; chargeId?: string; ingestionId?: string }> | { status?: string; message?: string; chargeId?: string; ingestionId?: string };
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
    status: "RECEIVED" | "EXTRACTED" | "NEEDS_REVIEW" | "DRAFTED" | "FAILED" | "PUBLISHED";
    error_message: string | null;
    created_charge_id: string | null;
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

export default async function OwnerImportsPage({ searchParams }: Props) {
    const { supabase, user, profile } = await requireRole("OWNER");
    const sp = searchParams instanceof Promise ? await searchParams : (searchParams ?? {});
    const status = sp.status ? String(sp.status) : "";
    const message = sp.message ? String(sp.message) : "";
    const chargeId = sp.chargeId ? String(sp.chargeId) : "";
    const ingestionId = sp.ingestionId ? String(sp.ingestionId) : "";

    const mailbox = await getOrCreateInboundMailbox(user.id);

    const [{ data: properties, error: propertyError }, { data: ingestions, error: ingestionError }] = await Promise.all([
        supabase
            .from("properties")
            .select("id,name,address")
            .eq("owner_id", user.id)
            .order("name"),
        supabase
            .from("document_ingestions")
            .select("id,source_type,source_attachment_name,status,error_message,created_charge_id,created_at")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false })
            .limit(20),
    ]);

    if (propertyError || ingestionError) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <div className="card">
                    <h1>Importok</h1>
                    <p className="text-red-600">Hiba: {propertyError?.message || ingestionError?.message}</p>
                </div>
            </main>
        );
    }

    const propertyRows = (properties ?? []) as PropertyRow[];
    const ingestionRows = (ingestions ?? []) as IngestionRow[];

    return (
        <main className="app-shell page-enter space-y-4">
            <AppHeader profile={profile} />

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Számlaimport</div>
                        <h1>Importok</h1>
                        <p>
                            Ide érkeznek majd az ownerenkénti egyedi e-mail-címre küldött számlák,
                            és innen tudsz most kézzel is PDF-et feltölteni draft készítéshez.
                        </p>
                        <div className="mt-3">
                            <Link className="btn btn-secondary btn-sm" href="/owner/importok/beallitasok">
                                Import beállítások
                            </Link>
                        </div>
                    </div>
                    <div className="section-stack items-start">
                        <div className="info-strip">
                            <span>Egyedi bejövő cím: {mailbox.email_address}</span>
                            <span>Csak draft jön létre, publikálni később lehet.</span>
                        </div>
                        <div className="form-panel">
                            <div className="section-stack">
                                <div className="card-title">Hogyan működik az e-mailes import?</div>
                                <p className="muted-note">
                                    Ha PDF számlát küldesz erre a címre, a rendszer ingestion rekordot készít, megpróbálja feldolgozni a számlát,
                                    és ha elég biztos az eredmény, draft díjat hoz létre.
                                </p>
                                <div className="feature-list">
                                    <div className="feature-item">Bejövő cím: <strong>{mailbox.email_address}</strong></div>
                                    <div className="feature-item">Több ingatlannál a rendszer elsődlegesen a számla szövegéből, különösen az ingatlan címéből próbál egyeztetni, és ezt egészíti ki az email tárgya, a feladó, az ingatlan neve, címe és a mentett aliasok alapján.</div>
                                    <div className="feature-item">Ha csak egy ingatlan van, automatikusan azt választja.</div>
                                    <div className="feature-item">Ha nem biztos az egyezés, az import ellenőrzendő státuszba kerül, és neked kell jóváhagynod.</div>
                                </div>
                            </div>
                        </div>
                        <form
                            action={async () => {
                                "use server";
                                const res = await rotateOwnerInboundMailbox();
                                if (!res.ok) {
                                    const msg = res.error ?? "Ismeretlen hiba.";
                                    redirect(`/owner/importok?status=error&message=${encodeURIComponent(msg)}`);
                                }
                                redirect("/owner/importok?status=success&message=A+bej%C3%B6v%C5%91+e-mail-c%C3%ADm+lecser%C3%A9lve.");
                            }}
                        >
                            <button className="btn btn-ghost btn-sm" type="submit">
                                E-mail-cím cseréje
                            </button>
                        </form>
                        <p className="muted-note">
                            Élesítés előtt érdemes lecserélni a címet. A korábbi cím utána nem fog többé importot fogadni.
                        </p>
                    </div>
                </div>
            </section>

            {message ? (
                <div className={`card section-stack ${status === "error" ? "text-red-600" : "text-green-600"}`}>
                    <div>{message}</div>
                    {status !== "error" && chargeId ? (
                        <div className="charge-actions">
                            <span className="muted-note">Draft díj azonosító: {chargeId}</span>
                            <Link className="btn btn-secondary btn-sm" href={`/owner/importok/${ingestionId}`}>
                                Import részletei
                            </Link>
                        </div>
                    ) : null}
                    {status !== "error" && !chargeId && ingestionId ? (
                        <div className="charge-actions">
                            <Link className="btn btn-secondary btn-sm" href={`/owner/importok/${ingestionId}`}>
                                Ellenőrzés megnyitása
                            </Link>
                        </div>
                    ) : null}
                </div>
            ) : null}

            <form
                action={async (formData) => {
                    "use server";
                    const res = await createManualIngestion(formData);
                    if (!res.ok) {
                        const msg = res.error ?? "Ismeretlen hiba.";
                        redirect(`/owner/importok?status=error&message=${encodeURIComponent(msg)}`);
                    }
                    if (res.needsReview) {
                        redirect(`/owner/importok?status=success&message=A+sz%C3%A1mla+be%C3%A9rkezett%2C+de+ellen%C5%91rz%C3%A9st+ig%C3%A9nyel.&ingestionId=${encodeURIComponent(res.ingestionId ?? "")}`);
                    }
                    redirect(`/owner/importok?status=success&message=A+sz%C3%A1ml%C3%A1b%C3%B3l+draft+d%C3%ADj+j%C3%B6tt+l%C3%A9tre.&chargeId=${encodeURIComponent(res.chargeId ?? "")}&ingestionId=${encodeURIComponent(res.ingestionId ?? "")}`);
                }}
                className="card form-shell"
            >
                <div className="section-header">
                    <div>
                        <div className="card-title">Kézi PDF feltöltés</div>
                        <p className="muted-note">A feltöltött PDF most már ingestion rekordként fut végig, nem közvetlen dokumentummentéssel.</p>
                    </div>
                </div>
                <div className="form-panel">
                    <div className="form-grid">
                        <label className="field-stack">
                            <span className="field-label">Ingatlan</span>
                            <select name="property_id" className="select" required defaultValue="">
                                <option value="" disabled>Válassz ingatlant...</option>
                                {propertyRows.map((property) => (
                                    <option key={property.id} value={property.id}>
                                        {property.name} · {property.address}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="field-stack">
                            <span className="field-label">PDF számla</span>
                            <input name="document" type="file" accept="application/pdf" className="input" required />
                        </label>
                    </div>
                </div>
                <ImportSubmitButton />
            </form>

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="card-title">Legutóbbi importok</div>
                        <p className="muted-note">Ez még az MVP napló: később külön review oldal és supplier-szabályok jönnek mellé.</p>
                    </div>
                </div>
                {ingestionRows.length === 0 ? (
                    <div className="charge-card">
                        <div className="card-title">Még nincs import.</div>
                    </div>
                ) : (
                    <div className="charge-list">
                        {ingestionRows.map((ingestion) => (
                            <article key={ingestion.id} className="charge-card">
                                <div className="section-header">
                                    <div>
                                        <div className="card-title">{ingestion.source_attachment_name || "Név nélküli csatolmány"}</div>
                                        <div className="charge-meta">
                                            <span>Forrás: {ingestion.source_type === "EMAIL" ? "E-mail" : "Kézi feltöltés"}</span>
                                            <span>{new Date(ingestion.created_at).toLocaleString("hu-HU")}</span>
                                        </div>
                                    </div>
                                    <div className={`status-badge status-${String(ingestion.status).toLowerCase()}`}>
                                        {statusLabel(ingestion.status)}
                                    </div>
                                </div>
                                {ingestion.error_message ? (
                                    <div className="muted-note text-red-600">{ingestion.error_message}</div>
                                ) : null}
                                <div className="charge-actions">
                                    <Link className="btn btn-secondary btn-sm" href={`/owner/importok/${ingestion.id}`}>
                                        Részletek
                                    </Link>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
}
