import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import AppHeader from "@/components/AppHeader";
import DesignIcon from "@/components/dashboard/DesignIcon";
import CopyTextButton from "@/components/dashboard/CopyTextButton";
import { getOrCreateInboundMailbox, getOwnExpenseInboundEmail, getSharedInboundEmail } from "@/lib/inboundMailboxes";
import { getOwnerImportOverview } from "@/lib/importOverview";
import { createManualIngestion, rotateOwnerInboundMailbox } from "./actions";
import ImportSubmitButton from "./ImportSubmitButton";
import PdfDropzone from "@/components/PdfDropzone";

type Props = {
    searchParams?: Promise<{ status?: string; message?: string; chargeId?: string; ingestionId?: string }> | { status?: string; message?: string; chargeId?: string; ingestionId?: string };
};

type PropertyRow = {
    id: string;
    name: string;
    address: string;
};

export default async function OwnerImportsPage({ searchParams }: Props) {
    const { supabase, user, profile } = await requireRole("OWNER");
    const sp = searchParams instanceof Promise ? await searchParams : (searchParams ?? {});
    const status = sp.status ? String(sp.status) : "";
    const message = sp.message ? String(sp.message) : "";
    const chargeId = sp.chargeId ? String(sp.chargeId) : "";
    const ingestionId = sp.ingestionId ? String(sp.ingestionId) : "";

    const mailbox = await getOrCreateInboundMailbox(user.id);
    const usingSharedInbox = mailbox.email_address === getSharedInboundEmail();
    const ownExpenseEmail = getOwnExpenseInboundEmail();

    const [{ data: properties, error: propertyError }, importOverview] = await Promise.all([
        supabase
            .from("properties")
            .select("id,name,address")
            .eq("owner_id", user.id)
            .order("name"),
        getOwnerImportOverview(user.id, { limit: 24 }),
    ]);

    if (propertyError) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <div className="card">
                    <h1>Importok</h1>
                    <p className="text-red-600">Hiba: {propertyError.message}</p>
                </div>
            </main>
        );
    }

    const propertyRows = (properties ?? []) as PropertyRow[];
    const ingestionRows = importOverview.rows;
    const actionRows = importOverview.actionRows;

    return (
        <main className="app-shell page-enter">
            <AppHeader profile={profile} />

            <div className="dashboard-stack">
                <section className="dashboard-page-header">
                    <div>
                        <h1>Importok</h1>
                        <p>Automatikus számlafeldolgozás és manuális PDF feltöltés egy operatív nézetben.</p>
                    </div>
                </section>

                <section className="dashboard-kpi-grid">
                    <article className="card dashboard-kpi-card dashboard-kpi-card-compact">
                        <DesignIcon name="beerkezett" alt="Beérkezett" tone="design-icon-badge-blue" />
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Beérkezett</div>
                            <div className="dashboard-kpi-value">{importOverview.receivedCount}</div>
                            <div className="muted-note">Új dokumentumok</div>
                        </div>
                    </article>
                    <article className="card dashboard-kpi-card dashboard-kpi-card-compact">
                        <DesignIcon name="feldolgozas_alatt" alt="Feldolgozás alatt" tone="design-icon-badge-amber" />
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Feldolgozás alatt</div>
                            <div className="dashboard-kpi-value">{importOverview.processingCount}</div>
                            <div className="muted-note">AI kinyerés folyamatban</div>
                        </div>
                    </article>
                    <article className="card dashboard-kpi-card dashboard-kpi-card-compact">
                        <DesignIcon name="Ellenoryesre_var" alt="Ellenőrzésre vár" tone="design-icon-badge-purple" />
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Ellenőrzésre vár</div>
                            <div className="dashboard-kpi-value">{importOverview.reviewCount}</div>
                            <div className="muted-note">Kézi döntés vagy publikálás kell</div>
                        </div>
                    </article>
                    <article className="card dashboard-kpi-card dashboard-kpi-card-compact">
                        <DesignIcon name="sikeresen_feldolgozva" alt="Sikeresen feldolgozva" tone="design-icon-badge-green" />
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Sikeresen feldolgozva</div>
                            <div className="dashboard-kpi-value">{importOverview.completedCount}</div>
                            <div className="muted-note">Publikált tételek</div>
                        </div>
                    </article>
                </section>

                {message ? (
                    <section className="card dashboard-section-card">
                        <div className={status === "error" ? "text-red-600" : "text-green-600"}>{message}</div>
                        {status !== "error" && chargeId ? (
                            <div className="dashboard-table-actions">
                                <span className="muted-note">Draft díj azonosító: {chargeId}</span>
                                <Link className="btn btn-secondary btn-sm" href={`/owner/importok/${ingestionId}`}>
                                    Import megnyitása
                                </Link>
                            </div>
                        ) : null}
                        {status !== "error" && !chargeId && ingestionId ? (
                            <div className="dashboard-table-actions">
                                <Link className="btn btn-secondary btn-sm" href={`/owner/importok/${ingestionId}`}>
                                    Ellenőrzés megnyitása
                                </Link>
                            </div>
                        ) : null}
                    </section>
                ) : null}

                <section className="dashboard-split-grid">
                    <article className="card dashboard-section-card">
                        <div className="dashboard-section-head">
                            <div>
                                <div className="card-title">Import cím</div>
                                <p className="muted-note">Az erre küldött PDF-ekből ingestion rekord és draft tétel készül.</p>
                            </div>
                            <Link className="btn btn-secondary btn-sm" href="/owner/importok/beallitasok">
                                Import beállítások
                            </Link>
                        </div>

                        <div className="dashboard-list">
                            <div className="dashboard-list-item">
                                <div className="dashboard-list-main">
                                    <DesignIcon name="szamla_importalasa" alt="Számla import" tone="design-icon-badge-blue" />
                                    <div className="dashboard-list-copy">
                                        <strong>{mailbox.email_address}</strong>
                                        <span>{usingSharedInbox ? "Továbbított költségek közös inboxa" : "Továbbított költségek saját inboxa"}</span>
                                    </div>
                                </div>
                                <CopyTextButton text={mailbox.email_address} />
                            </div>
                            <div className="dashboard-list-item">
                                <div className="dashboard-list-main">
                                    <DesignIcon name="kiadas" alt="Saját költség inbox" tone="design-icon-badge-amber" />
                                    <div className="dashboard-list-copy">
                                        <strong>{ownExpenseEmail}</strong>
                                        <span>Saját költség számlák dedikált inboxa</span>
                                    </div>
                                </div>
                                <CopyTextButton text={ownExpenseEmail} />
                            </div>
                        </div>

                        {!usingSharedInbox ? (
                            <form
                                action={async () => {
                                    "use server";
                                    const res = await rotateOwnerInboundMailbox();
                                    if (!res.ok) {
                                        redirect(`/owner/importok?status=error&message=${encodeURIComponent(res.error ?? "Ismeretlen hiba.")}`);
                                    }
                                    redirect("/owner/importok?status=success&message=A+bej%C3%B6v%C5%91+c%C3%ADm+lecser%C3%A9lve.");
                                }}
                            >
                                <button className="btn btn-ghost btn-sm" type="submit">E-mail-cím cseréje</button>
                            </form>
                        ) : null}

                        <div className="card dashboard-section-card">
                            <div className="card-title">Import pipeline</div>
                            <div className="dashboard-pill-row">
                                <span className="dashboard-filter-pill is-active">1. Beérkezett</span>
                                <span className="dashboard-filter-pill">2. Feldolgozás</span>
                                <span className="dashboard-filter-pill">3. Ellenőrzés</span>
                                <span className="dashboard-filter-pill">4. Kész</span>
                            </div>
                            <p className="muted-note">A review státuszú tételeknél emberi jóváhagyásra van szükség, minden más lépés automatikusan fut.</p>
                        </div>
                    </article>

                    <article className="card dashboard-section-card">
                        <div className="dashboard-section-head">
                            <div>
                                <div className="card-title">Kézi PDF feltöltés</div>
                                <p className="muted-note">Továbbított költség és saját költség mód is támogatott.</p>
                            </div>
                        </div>

                        <form
                            action={async (formData) => {
                                "use server";
                                const res = await createManualIngestion(formData);
                                if (!res.ok) {
                                    redirect(`/owner/importok?status=error&message=${encodeURIComponent(res.error ?? "Ismeretlen hiba.")}`);
                                }
                                if (res.nextHref) {
                                    redirect(res.nextHref);
                                }
                                if (res.needsReview) {
                                    redirect(`/owner/importok/${encodeURIComponent(res.ingestionId ?? "")}?status=success&message=A+sz%C3%A1mla+be%C3%A9rkezett%2C+de+ellen%C5%91rz%C3%A9st+ig%C3%A9nyel.`);
                                }
                                redirect(`/owner/importok/${encodeURIComponent(res.ingestionId ?? "")}?status=success&message=A+sz%C3%A1ml%C3%A1b%C3%B3l+import+piszkozat+j%C3%B6tt+l%C3%A9tre.`);
                            }}
                            className="dashboard-stack"
                        >
                            {propertyRows.length === 0 ? (
                                <div className="dashboard-upload-dropzone">
                                    <strong>Először hozz létre egy ingatlant.</strong>
                                    <div className="muted-note">A manuális import csak kiválasztott ingatlanhoz indítható.</div>
                                    <Link className="btn btn-secondary" href="/owner/properties">Ingatlanok megnyitása</Link>
                                </div>
                            ) : null}
                            <div className="dashboard-form-grid">
                                <label className="field-stack">
                                    <span className="field-label">Ingatlan</span>
                                    <select name="property_id" className="select" required defaultValue="" disabled={propertyRows.length === 0}>
                                        <option value="" disabled>Válassz ingatlant</option>
                                        {propertyRows.map((property) => (
                                            <option key={property.id} value={property.id}>
                                                {property.name} · {property.address}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="field-stack">
                                    <span className="field-label">Import típus</span>
                                    <select name="import_mode" className="select" defaultValue="FORWARDED">
                                        <option value="FORWARDED">Továbbított költség</option>
                                        <option value="OWN_EXPENSE">Saját költség</option>
                                    </select>
                                </label>
                            </div>

                            <label className="field-stack">
                                <span className="field-label">PDF számla</span>
                                <PdfDropzone className="dashboard-upload-dropzone" required disabled={propertyRows.length === 0}>
                                    <DesignIcon name="szamla_importalasa" alt="PDF feltöltés" tone="design-icon-badge-blue" />
                                    <div>
                                        <strong>Húzd ide a PDF-et</strong>
                                        <div className="muted-note">vagy válaszd ki manuálisan</div>
                                    </div>
                                </PdfDropzone>
                            </label>

                            {propertyRows.length > 0 ? <ImportSubmitButton /> : null}
                        </form>
                    </article>
                </section>

                <section className="dashboard-split-grid">
                    <article className="card dashboard-section-card">
                        <div className="dashboard-section-head">
                            <div>
                                <div className="card-title">Beavatkozást igénylő importok</div>
                                <p className="muted-note">Itt jelenik meg minden review vagy még nem publikált importpiszkozat.</p>
                            </div>
                            <Link className="btn btn-secondary btn-sm" href="/owner/importok">
                                Összes megtekintése
                            </Link>
                        </div>

                        {actionRows.length === 0 ? (
                            <p className="dashboard-empty-note">Nincs nyitott import review vagy publikálásra váró piszkozat.</p>
                        ) : (
                            <div className="dashboard-list">
                                {actionRows.slice(0, 6).map((ingestion) => (
                                    <div key={ingestion.ingestionId} className="dashboard-list-item">
                                        <div className="dashboard-list-main">
                                            <DesignIcon name="import_review_var" alt="Import review" tone="design-icon-badge-purple" />
                                            <div className="dashboard-list-copy">
                                                <strong>{ingestion.sourceAttachmentName || ingestion.chargeTitle || "Név nélküli dokumentum"}</strong>
                                                <span>{new Date(ingestion.createdAt).toLocaleString("hu-HU")}</span>
                                                <span>{ingestion.state === "draft" ? "A piszkozat elkészült, még publikálnod kell." : "A rendszer emberi ellenőrzést kér."}</span>
                                            </div>
                                        </div>
                                        <div className="dashboard-table-actions">
                                            {ingestion.chargeHref ? (
                                                <Link className="btn btn-secondary btn-sm" href={ingestion.chargeHref}>
                                                    Piszkozat megnyitása
                                                </Link>
                                            ) : null}
                                            <Link className="btn btn-secondary btn-sm" href={ingestion.reviewHref}>
                                                {ingestion.state === "draft" ? "Import megnyitása" : "Felülvizsgálat"}
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </article>

                    <article className="card dashboard-section-card">
                        <div className="card-title">Import működés</div>
                        <div className="dashboard-list">
                            <div className="dashboard-list-item">
                                <div className="dashboard-list-main">
                                    <DesignIcon name="beerkezett" alt="Automatikus feldolgozás" tone="design-icon-badge-blue" />
                                    <div className="dashboard-list-copy">
                                        <strong>Automatikus feldolgozás</strong>
                                        <span>E-mailből vagy manuális feltöltésből induló pipeline.</span>
                                    </div>
                                </div>
                            </div>
                            <div className="dashboard-list-item">
                                <div className="dashboard-list-main">
                                    <DesignIcon name="kiadas" alt="Saját költség" tone="design-icon-badge-amber" />
                                    <div className="dashboard-list-copy">
                                        <strong>Saját költség mód</strong>
                                        <span>Bérlő nélküli draft tétel jön létre, ha ezt választod feltöltéskor.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </article>
                </section>

                <section className="card dashboard-section-card finance-table-shell">
                    <div className="dashboard-section-head">
                        <div>
                            <div className="card-title">Legutóbbi importok</div>
                            <p className="muted-note">Az utolsó 24 ingestion rekord státusszal és gyors megnyitással.</p>
                        </div>
                    </div>

                    {ingestionRows.length === 0 ? (
                        <p className="dashboard-empty-note">Még nincs import.</p>
                    ) : (
                        <>
                            <div className="finance-table-scroll">
                                <table className="dashboard-data-table">
                                    <thead>
                                        <tr>
                                            <th>Dokumentum</th>
                                            <th>Forrás</th>
                                            <th>Dátum</th>
                                            <th>Státusz</th>
                                            <th>Művelet</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ingestionRows.map((ingestion) => (
                                            <tr key={ingestion.ingestionId}>
                                                <td>
                                                    <div className="dashboard-table-main">
                                                        <strong>{ingestion.sourceAttachmentName || ingestion.chargeTitle || "Név nélküli csatolmány"}</strong>
                                                        {ingestion.errorMessage ? <span className="dashboard-table-subtitle text-red-600">{ingestion.errorMessage}</span> : null}
                                                    </div>
                                                </td>
                                                <td>{ingestion.sourceType === "EMAIL" ? "E-mail" : "Kézi feltöltés"}</td>
                                                <td>{new Date(ingestion.createdAt).toLocaleString("hu-HU")}</td>
                                                <td>
                                                    <span className={`dashboard-inline-badge ${ingestion.toneClass}`}>
                                                        {ingestion.stateLabel}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="dashboard-table-actions dashboard-table-actions-wrap">
                                                        {ingestion.chargeHref ? (
                                                            <Link className="btn btn-secondary btn-sm" href={ingestion.chargeHref}>
                                                                Piszkozat
                                                            </Link>
                                                        ) : null}
                                                        <Link className="btn btn-secondary btn-sm" href={ingestion.reviewHref}>
                                                            Megnyitás
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="dashboard-mobile-record-list">
                                {ingestionRows.map((ingestion) => (
                                    <article key={`${ingestion.ingestionId}-mobile`} className="dashboard-mobile-record-card">
                                        <div className="dashboard-mobile-record-head">
                                            <div className="dashboard-table-main">
                                                <strong>{ingestion.sourceAttachmentName || ingestion.chargeTitle || "Név nélküli csatolmány"}</strong>
                                                {ingestion.errorMessage ? <span className="dashboard-table-subtitle text-red-600">{ingestion.errorMessage}</span> : null}
                                            </div>
                                            <span className={`dashboard-inline-badge ${ingestion.toneClass}`}>
                                                {ingestion.stateLabel}
                                            </span>
                                        </div>
                                        <div className="dashboard-mobile-record-meta">
                                            <div>
                                                <small>Forrás</small>
                                                <strong>{ingestion.sourceType === "EMAIL" ? "E-mail" : "Kézi feltöltés"}</strong>
                                            </div>
                                            <div>
                                                <small>Dátum</small>
                                                <strong>{new Date(ingestion.createdAt).toLocaleString("hu-HU")}</strong>
                                            </div>
                                        </div>
                                        <div className="dashboard-mobile-record-actions">
                                            {ingestion.chargeHref ? (
                                                <Link className="btn btn-secondary btn-sm" href={ingestion.chargeHref}>
                                                    Piszkozat
                                                </Link>
                                            ) : null}
                                            <Link className="btn btn-secondary btn-sm" href={ingestion.reviewHref}>
                                                Megnyitás
                                            </Link>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </>
                    )}
                </section>
            </div>
        </main>
    );
}
