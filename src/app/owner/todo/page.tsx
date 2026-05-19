import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { formatCurrency } from "@/lib/formatters";
import AppHeader from "@/components/AppHeader";
import { markChargePaid, sendManualChargeReminder } from "@/app/owner/properties/[id]/charges/actions";

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

type Props = {
    searchParams?: Promise<{ status?: string; message?: string }> | { status?: string; message?: string };
};

export default async function OwnerTodoPage({ searchParams }: Props) {
    const { supabase, user, profile } = await requireRole("OWNER");
    const sp = (searchParams instanceof Promise) ? await searchParams : (searchParams ?? {});
    const status = sp.status ? String(sp.status) : "";
    const message = sp.message ? String(sp.message) : "";

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
    const showUnassignedProperties = propertyRows.length >= 10;

    const totalTodoCount = overdueCharges.length + upcomingCharges.length + importDrafts.length + (showUnassignedProperties ? unassignedProperties.length : 0);

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
                            <div className="kpi-value">{showUnassignedProperties ? unassignedProperties.length : "—"}</div>
                        </div>
                    </div>
            </section>

            {message ? (
                <div className={`card ${status === "error" ? "text-red-600" : "text-green-600"}`}>
                    {message}
                </div>
            ) : null}

            <section className="todo-board">
                <article className="card section-stack todo-column">
                    <div className="card-title">Lejárt, nyitott tételek</div>
                    {overdueCharges.length === 0 ? (
                        <p className="muted-note">Nincs lejárt, nyitott tétel.</p>
                    ) : (
                        <div className="todo-stack">
                            {overdueCharges.slice(0, 6).map((charge) => {
                                const property = firstProperty(charge.properties);
                                return (
                                    <article key={charge.id} className="todo-task-card">
                                        <div className="todo-task-head">
                                            <div className="todo-task-copy">
                                                <div className="card-title">{charge.title}</div>
                                                <div className="todo-task-meta">
                                                    <span>{property?.name ?? "Ingatlan nélkül"}</span>
                                                    <span>{formatCurrency(Number(charge.amount), String(charge.currency || "HUF"))}</span>
                                                    <span>{Math.abs(getDayDiff(charge.due_date))} napja lejárt</span>
                                                </div>
                                            </div>
                                            <div className="todo-task-actions">
                                                <form
                                                    action={async () => {
                                                        "use server";
                                                        const res = await markChargePaid(charge.id);
                                                        if (!res.ok) {
                                                            redirect(`/owner/todo?status=error&message=${encodeURIComponent(res.error ?? "Ismeretlen hiba.")}`);
                                                        }
                                                        redirect("/owner/todo?status=success&message=A+t%C3%A9tel+fizetettre+lett+%C3%A1ll%C3%ADtva.");
                                                    }}
                                                >
                                                    <button className="btn btn-primary btn-sm" type="submit">Befizetett</button>
                                                </form>
                                                <form
                                                    action={async () => {
                                                        "use server";
                                                        const res = await sendManualChargeReminder(charge.id);
                                                        if (!res.ok) {
                                                            redirect(`/owner/todo?status=error&message=${encodeURIComponent(res.error ?? "Ismeretlen hiba.")}`);
                                                        }
                                                        redirect("/owner/todo?status=success&message=Bar%C3%A1ti+eml%C3%A9keztet%C5%91+elk%C3%BCldve.");
                                                    }}
                                                >
                                                    <button className="btn btn-secondary btn-sm" type="submit">Baráti emlékeztető</button>
                                                </form>
                                                <Link className="btn btn-ghost btn-sm" href={`/owner/properties/${charge.property_id}/charges`}>
                                                    Részletek
                                                </Link>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </article>

                <article className="card section-stack todo-column">
                    <div className="card-title">Közelgő esedékességek</div>
                    {upcomingCharges.length === 0 ? (
                        <p className="muted-note">Nincs 5 napon belül esedékes tétel.</p>
                    ) : (
                        <div className="todo-link-list">
                            {upcomingCharges.slice(0, 6).map((charge) => {
                                const property = firstProperty(charge.properties);
                                return (
                                    <Link key={charge.id} className="todo-link-card" href={`/owner/properties/${charge.property_id}/charges`}>
                                        {charge.title} · {property?.name ?? "Ingatlan nélkül"} · {formatCurrency(Number(charge.amount), String(charge.currency || "HUF"))} · {charge.due_date}
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </article>

                <article className="card section-stack todo-column">
                    <div className="card-title">Import piszkozatok</div>
                    {importDrafts.length === 0 ? (
                        <p className="muted-note">Nincs ellenőrizendő import piszkozat.</p>
                    ) : (
                        <div className="todo-link-list">
                            {importDrafts.slice(0, 6).map((charge) => (
                                <Link key={charge.id} className="todo-link-card" href={`/owner/properties/${charge.property_id}/charges?status=IMPORT_DRAFT`}>
                                    {charge.title} · {formatCurrency(Number(charge.amount), String(charge.currency || "HUF"))} · publikálás előtt ellenőrizendő
                                </Link>
                            ))}
                        </div>
                    )}
                </article>

                {showUnassignedProperties ? (
                    <article className="card section-stack todo-column">
                        <div className="card-title">Bérlő nélküli ingatlanok</div>
                        {unassignedProperties.length === 0 ? (
                            <p className="muted-note">Minden aktív ingatlanhoz tartozik bérlő.</p>
                        ) : (
                            <div className="todo-link-list">
                                {unassignedProperties.map((property) => (
                                    <Link key={property.id} className="todo-link-card" href={`/owner/properties/${property.id}`}>
                                        {property.name} · bérlő hozzárendelése szükséges
                                    </Link>
                                ))}
                            </div>
                        )}
                    </article>
                ) : null}
            </section>
        </main>
    );
}
