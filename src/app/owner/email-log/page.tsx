import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { requireRole } from "@/lib/auth/requireRole";
import {
    getEmailLogCategoryLabel,
    getEmailLogStatusLabel,
    getEmailLogStatusTone,
    listOwnerEmailLogsLast30Days,
} from "@/lib/emailLogs";

function readMetaString(meta: Record<string, unknown> | null | undefined, key: string) {
    const value = meta?.[key];
    return typeof value === "string" && value.trim() ? value : null;
}

function readMetaNumber(meta: Record<string, unknown> | null | undefined, key: string) {
    const value = meta?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildChargeHref(propertyId: string | null, chargeId: string | null) {
    if (!propertyId) return null;
    if (chargeId) {
        return `/owner/charges?property=${encodeURIComponent(propertyId)}#charge-${encodeURIComponent(chargeId)}`;
    }
    return `/owner/charges?property=${encodeURIComponent(propertyId)}`;
}

export default async function OwnerEmailLogPage() {
    const { user, profile } = await requireRole("OWNER");
    const logs = await listOwnerEmailLogsLast30Days(user.id);

    const deliveredCount = logs.filter((row) => row.status === "DELIVERED").length;
    const acceptedCount = logs.filter((row) => row.status === "ACCEPTED").length;
    const failedCount = logs.filter((row) => row.status === "FAILED" || row.status === "BOUNCED" || row.status === "COMPLAINED" || row.status === "REJECTED").length;
    const autoReminderCount = logs.filter((row) => row.category === "DUE_SOON_REMINDER").length;

    return (
        <main className="app-shell page-enter">
            <AppHeader profile={profile} />

            <div className="dashboard-stack">
                <section className="dashboard-page-header">
                    <div>
                        <h1>Levelezési log</h1>
                        <p>Az elmúlt 30 nap összes, bérlőknek kiküldött levele egy helyen.</p>
                    </div>
                </section>

                <section className="dashboard-kpi-grid">
                    <article className="card dashboard-kpi-card dashboard-kpi-card-compact">
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Összes levél</div>
                            <div className="dashboard-kpi-value">{logs.length}</div>
                            <div className="muted-note">30 napos ablak</div>
                        </div>
                    </article>
                    <article className="card dashboard-kpi-card dashboard-kpi-card-compact">
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Automata értesítő</div>
                            <div className="dashboard-kpi-value">{autoReminderCount}</div>
                            <div className="muted-note">Lejárat előtti levelek</div>
                        </div>
                    </article>
                    <article className="card dashboard-kpi-card dashboard-kpi-card-compact">
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Kézbesítve</div>
                            <div className="dashboard-kpi-value">{deliveredCount}</div>
                            <div className="muted-note">SES visszajelzés alapján</div>
                        </div>
                    </article>
                    <article className="card dashboard-kpi-card dashboard-kpi-card-compact">
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Elfogadva / hiba</div>
                            <div className="dashboard-kpi-value">{acceptedCount} / {failedCount}</div>
                            <div className="muted-note">Elfogadott vagy hibás küldések</div>
                        </div>
                    </article>
                </section>

                <section className="card dashboard-section-card">
                    <div className="card-title">Mit jelent a státusz?</div>
                    <p className="muted-note">
                        A <strong>SES elfogadta</strong> azt jelenti, hogy a Rentapp átadta a levelet az Amazon SES-nek.
                        A <strong>Kézbesítve</strong>, <strong>Visszapattant</strong> és egyéb végleges állapotok akkor töltődnek fel,
                        ha az SES események is vissza vannak kötve a rendszerbe.
                    </p>
                </section>

                <section className="card dashboard-section-card finance-table-shell">
                    <div className="dashboard-section-head">
                        <div>
                            <div className="card-title">Kiküldött levelek</div>
                            <p className="muted-note">Bérlői értesítések, meghívók és emlékeztetők időrendben.</p>
                        </div>
                    </div>

                    {logs.length === 0 ? (
                        <p className="dashboard-empty-note">Az elmúlt 30 napban még nem ment ki bérlői e-mail.</p>
                    ) : (
                        <>
                            <div className="finance-table-scroll">
                                <table className="dashboard-data-table">
                                    <thead>
                                        <tr>
                                            <th>Dátum</th>
                                            <th>Levél</th>
                                            <th>Címzett</th>
                                            <th>Kapcsolódás</th>
                                            <th>Állapot</th>
                                            <th>Művelet</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.map((row) => {
                                            const meta = row.meta ?? {};
                                            const tenantName = readMetaString(meta, "tenantName");
                                            const propertyName = readMetaString(meta, "propertyName");
                                            const chargeTitle = readMetaString(meta, "chargeTitle");
                                            const dueDate = readMetaString(meta, "dueDate");
                                            const amount = readMetaNumber(meta, "amount");
                                            const currency = readMetaString(meta, "currency") ?? "HUF";
                                            const chargeHref = buildChargeHref(row.property_id, row.charge_id);

                                            return (
                                                <tr key={row.id}>
                                                    <td>{new Date(row.created_at).toLocaleString("hu-HU")}</td>
                                                    <td>
                                                        <div className="dashboard-table-main">
                                                            <strong>{getEmailLogCategoryLabel(row.category)}</strong>
                                                            <span className="dashboard-table-subtitle">{row.subject}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="dashboard-table-main">
                                                            <strong>{tenantName || row.recipient_email}</strong>
                                                            <span className="dashboard-table-subtitle">{row.recipient_email}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="dashboard-table-main">
                                                            <strong>{propertyName || "Nincs ingatlan"}</strong>
                                                            <span className="dashboard-table-subtitle">
                                                                {chargeTitle || "Nincs tétel"}
                                                                {dueDate ? ` · ${dueDate}` : ""}
                                                                {amount !== null ? ` · ${amount.toLocaleString("hu-HU")} ${currency}` : ""}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="dashboard-table-main">
                                                            <span className={`dashboard-inline-badge ${getEmailLogStatusTone(row.status)}`}>
                                                                {getEmailLogStatusLabel(row.status)}
                                                            </span>
                                                            <span className="dashboard-table-subtitle">
                                                                {row.error_message || (row.provider_message_id ? `SES: ${row.provider_message_id}` : "Nincs SES azonosító")}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="dashboard-table-actions dashboard-table-actions-wrap">
                                                            {chargeHref ? (
                                                                <Link className="btn btn-secondary btn-sm" href={chargeHref}>
                                                                    Megnyitás
                                                                </Link>
                                                            ) : (
                                                                <span className="muted-note">Nincs kapcsolódó tétel</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="dashboard-mobile-record-list">
                                {logs.map((row) => {
                                    const meta = row.meta ?? {};
                                    const tenantName = readMetaString(meta, "tenantName");
                                    const propertyName = readMetaString(meta, "propertyName");
                                    const chargeTitle = readMetaString(meta, "chargeTitle");
                                    const dueDate = readMetaString(meta, "dueDate");
                                    const amount = readMetaNumber(meta, "amount");
                                    const currency = readMetaString(meta, "currency") ?? "HUF";
                                    const chargeHref = buildChargeHref(row.property_id, row.charge_id);

                                    return (
                                        <article key={`${row.id}-mobile`} className="dashboard-mobile-record-card">
                                            <div className="dashboard-mobile-record-head">
                                                <div className="dashboard-table-main">
                                                    <strong>{getEmailLogCategoryLabel(row.category)}</strong>
                                                    <span className="dashboard-table-subtitle">{row.subject}</span>
                                                </div>
                                                <span className={`dashboard-inline-badge ${getEmailLogStatusTone(row.status)}`}>
                                                    {getEmailLogStatusLabel(row.status)}
                                                </span>
                                            </div>
                                            <div className="dashboard-mobile-record-meta">
                                                <div>
                                                    <small>Címzett</small>
                                                    <strong>{tenantName || row.recipient_email}</strong>
                                                </div>
                                                <div>
                                                    <small>Dátum</small>
                                                    <strong>{new Date(row.created_at).toLocaleString("hu-HU")}</strong>
                                                </div>
                                                <div>
                                                    <small>Kapcsolódás</small>
                                                    <strong>{propertyName || "Nincs ingatlan"}</strong>
                                                </div>
                                                <div>
                                                    <small>Tétel</small>
                                                    <strong>
                                                        {chargeTitle || "Nincs tétel"}
                                                        {dueDate ? ` · ${dueDate}` : ""}
                                                        {amount !== null ? ` · ${amount.toLocaleString("hu-HU")} ${currency}` : ""}
                                                    </strong>
                                                </div>
                                            </div>
                                            <div className="dashboard-mobile-record-footer">
                                                <span className="dashboard-table-subtitle">
                                                    {row.error_message || (row.provider_message_id ? `SES: ${row.provider_message_id}` : "Nincs SES azonosító")}
                                                </span>
                                                <div className="dashboard-mobile-record-actions">
                                                    {chargeHref ? (
                                                        <Link className="btn btn-secondary btn-sm" href={chargeHref}>
                                                            Megnyitás
                                                        </Link>
                                                    ) : (
                                                        <span className="muted-note">Nincs kapcsolódó tétel</span>
                                                    )}
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </section>
            </div>
        </main>
    );
}
