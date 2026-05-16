import Link from "next/link";
import { requireRole } from "@/lib/auth/requireRole";
import { formatCurrency } from "@/lib/formatters";
import AppHeader from "@/components/AppHeader";

type ChargeTodoRow = {
    id: string;
    title: string;
    amount: number | string;
    currency: string | null;
    due_date: string;
    status: "UNPAID" | "PAID" | "ARCHIVED" | "CANCELLED" | "IMPORT_DRAFT";
    property_id: string;
    properties?: { name: string | null } | { name: string | null }[] | null;
};

type PropertyTodoRow = {
    id: string;
    name: string;
    tenant_id: string | null;
    status: string;
};

function firstProperty(value: ChargeTodoRow["properties"]) {
    return Array.isArray(value) ? value[0] : value;
}

function getDayDiff(dateValue: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(`${dateValue}T00:00:00`);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function OwnerTodoPage() {
    const { supabase, user, profile } = await requireRole("OWNER");

    const [{ data: charges, error: chargeError }, { data: properties, error: propertyError }] = await Promise.all([
        supabase
            .from("charges")
            .select("id,title,amount,currency,due_date,status,property_id,properties(name)")
            .eq("owner_id", user.id)
            .in("status", ["UNPAID", "IMPORT_DRAFT"]),
        supabase
            .from("properties")
            .select("id,name,tenant_id,status")
            .eq("owner_id", user.id),
    ]);

    if (chargeError || propertyError) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <div className="card">
                    <h1>Teendők</h1>
                    <p className="text-red-600">Hiba: {chargeError?.message || propertyError?.message}</p>
                </div>
            </main>
        );
    }

    const chargeRows = (charges ?? []) as ChargeTodoRow[];
    const propertyRows = (properties ?? []) as PropertyTodoRow[];

    const overdueCharges = chargeRows.filter((charge) => charge.status === "UNPAID" && getDayDiff(charge.due_date) < 0);
    const upcomingCharges = chargeRows.filter((charge) => charge.status === "UNPAID" && getDayDiff(charge.due_date) >= 0 && getDayDiff(charge.due_date) <= 5);
    const importDrafts = chargeRows.filter((charge) => charge.status === "IMPORT_DRAFT");
    const unassignedProperties = propertyRows.filter((property) => !property.tenant_id && property.status === "ACTIVE");

    const totalTodoCount = overdueCharges.length + upcomingCharges.length + importDrafts.length + unassignedProperties.length;

    return (
        <main className="app-shell page-enter space-y-4">
            <AppHeader profile={profile} />

            <section className="card section-stack">
                <div className="section-header">
                    <div>
                        <div className="eyebrow">Menedzsment nézet</div>
                        <h1>Teendők</h1>
                        <p>Ez az oldal azt gyűjti össze, mivel kell most ténylegesen foglalkoznod bérbeadóként.</p>
                    </div>
                    <div className="info-strip">
                        <span>Nyitott feladatok: {totalTodoCount}</span>
                        <span>Elmaradás, közelgő esedékesség, piszkozat, bérlő nélküli ingatlan.</span>
                    </div>
                </div>

                <div className="kpi-grid stagger">
                    <div className="kpi-card">
                        <div className="kpi-label">Lejárt tételek</div>
                        <div className="kpi-value">{overdueCharges.length}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Közelgő esedékesség</div>
                        <div className="kpi-value">{upcomingCharges.length}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Import piszkozatok</div>
                        <div className="kpi-value">{importDrafts.length}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Bérlő nélküli aktív ingatlan</div>
                        <div className="kpi-value">{unassignedProperties.length}</div>
                    </div>
                </div>
            </section>

            <section className="grid">
                <article className="card section-stack">
                    <div className="card-title">Lejárt, nyitott tételek</div>
                    {overdueCharges.length === 0 ? (
                        <p className="muted-note">Nincs lejárt, nyitott tétel.</p>
                    ) : (
                        <div className="feature-list">
                            {overdueCharges.slice(0, 6).map((charge) => {
                                const property = firstProperty(charge.properties);
                                return (
                                    <Link key={charge.id} className="feature-item" href={`/owner/properties/${charge.property_id}/charges`}>
                                        {charge.title} · {property?.name ?? "Ingatlan nélkül"} · {formatCurrency(Number(charge.amount), String(charge.currency || "HUF"))} · {Math.abs(getDayDiff(charge.due_date))} napja lejárt
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </article>

                <article className="card section-stack">
                    <div className="card-title">Közelgő esedékességek</div>
                    {upcomingCharges.length === 0 ? (
                        <p className="muted-note">Nincs 5 napon belül esedékes tétel.</p>
                    ) : (
                        <div className="feature-list">
                            {upcomingCharges.slice(0, 6).map((charge) => {
                                const property = firstProperty(charge.properties);
                                return (
                                    <Link key={charge.id} className="feature-item" href={`/owner/properties/${charge.property_id}/charges`}>
                                        {charge.title} · {property?.name ?? "Ingatlan nélkül"} · {formatCurrency(Number(charge.amount), String(charge.currency || "HUF"))} · {charge.due_date}
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </article>

                <article className="card section-stack">
                    <div className="card-title">Import piszkozatok</div>
                    {importDrafts.length === 0 ? (
                        <p className="muted-note">Nincs ellenőrizendő import piszkozat.</p>
                    ) : (
                        <div className="feature-list">
                            {importDrafts.slice(0, 6).map((charge) => (
                                <Link key={charge.id} className="feature-item" href={`/owner/properties/${charge.property_id}/charges?status=IMPORT_DRAFT`}>
                                    {charge.title} · {formatCurrency(Number(charge.amount), String(charge.currency || "HUF"))} · publikálás előtt ellenőrizendő
                                </Link>
                            ))}
                        </div>
                    )}
                </article>

                <article className="card section-stack">
                    <div className="card-title">Bérlő nélküli ingatlanok</div>
                    {unassignedProperties.length === 0 ? (
                        <p className="muted-note">Minden aktív ingatlanhoz tartozik bérlő.</p>
                    ) : (
                        <div className="feature-list">
                            {unassignedProperties.map((property) => (
                                <Link key={property.id} className="feature-item" href={`/owner/properties/${property.id}`}>
                                    {property.name} · bérlő hozzárendelése szükséges
                                </Link>
                            ))}
                        </div>
                    )}
                </article>
            </section>
        </main>
    );
}
