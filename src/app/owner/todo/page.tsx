import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { formatCurrency } from "@/lib/formatters";
import AppHeader from "@/components/AppHeader";
import DesignIcon from "@/components/dashboard/DesignIcon";
import PendingSubmitButton from "@/components/PendingSubmitButton";
import { markChargePaid, sendManualChargeReminder } from "@/app/owner/properties/[id]/charges/actions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ChargeTodoRow = {
    id: string;
    title: string;
    amount: number | string;
    currency: string | null;
    due_date: string;
    status: "UNPAID" | "PAID" | "ARCHIVED" | "CANCELLED" | "IMPORT_DRAFT";
    paid_at: string | null;
    property_id: string;
    properties?: { name: string | null } | { name: string | null }[] | null;
};

type PropertyTodoRow = {
    id: string;
    name: string;
    tenant_id: string | null;
    status: string;
};

type ExitRequestRow = {
    id: string;
    tenant_id: string | null;
    property_id: string | null;
    created_at: string;
    properties?: { name: string | null } | { name: string | null }[] | null;
};

type TaskView = "all" | "high" | "medium" | "low" | "done";

type TaskRow = {
    id: string;
    label: string;
    description: string;
    propertyLabel: string;
    counterparty: string;
    deadlineLabel: string;
    deadlineSubLabel: string;
    priority: "high" | "medium" | "low";
    state: "open" | "progress" | "done";
    actionHref: string;
    amountLabel?: string;
    actionType: "charge" | "import" | "exit" | "done";
    chargeId?: string;
};

function firstProperty(value: ChargeTodoRow["properties"] | ExitRequestRow["properties"]) {
    return Array.isArray(value) ? value[0] : value;
}

function getDayDiff(dateValue: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(`${dateValue}T00:00:00`);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function taskViewLabel(view: TaskView) {
    switch (view) {
        case "high":
            return "Magas";
        case "medium":
            return "Közepes";
        case "low":
            return "Alacsony";
        case "done":
            return "Elvégzett";
        default:
            return "Összes";
    }
}

function priorityTone(priority: TaskRow["priority"]) {
    if (priority === "high") return "dashboard-inline-badge-red";
    if (priority === "medium") return "dashboard-inline-badge-amber";
    return "dashboard-inline-badge-blue";
}

function stateTone(state: TaskRow["state"]) {
    if (state === "done") return "dashboard-task-status-done";
    if (state === "progress") return "dashboard-task-status-progress";
    return "dashboard-task-status-open";
}

type Props = {
    searchParams?: Promise<{ status?: string; message?: string; view?: string }> | { status?: string; message?: string; view?: string };
};

export default async function OwnerTodoPage({ searchParams }: Props) {
    const { supabase, user, profile } = await requireRole("OWNER");
    const admin = createSupabaseAdminClient();
    const sp = searchParams instanceof Promise ? await searchParams : (searchParams ?? {});
    const status = sp.status ? String(sp.status) : "";
    const message = sp.message ? String(sp.message) : "";
    const selectedView = (["all", "high", "medium", "low", "done"].includes(String(sp.view || "")) ? String(sp.view) : "all") as TaskView;

    const [{ data: charges, error: chargeError }, { data: properties, error: propertyError }, { data: exitRequests }] = await Promise.all([
        supabase
            .from("charges")
            .select("id,title,amount,currency,due_date,status,paid_at,property_id,properties(name)")
            .eq("owner_id", user.id)
            .in("status", ["UNPAID", "IMPORT_DRAFT", "PAID"]),
        supabase
            .from("properties")
            .select("id,name,tenant_id,status")
            .eq("owner_id", user.id),
        admin
            .from("tenant_exit_requests")
            .select("id,tenant_id,property_id,created_at,properties(name)")
            .eq("owner_id", user.id)
            .eq("status", "PENDING")
            .order("created_at", { ascending: true }),
    ]);

    if (chargeError || propertyError) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <div className="card">
                    <h1>Feladatok</h1>
                    <p className="text-red-600">Hiba: {chargeError?.message || propertyError?.message}</p>
                </div>
            </main>
        );
    }

    const chargeRows = (charges ?? []) as ChargeTodoRow[];
    const propertyRows = (properties ?? []) as PropertyTodoRow[];
    const propertyIds = propertyRows.map((property) => property.id);
    const { data: propertyTenantRows } = propertyIds.length === 0
        ? { data: [] as Array<{ property_id: string; tenant_id: string }> }
        : await admin
            .from("property_tenants")
            .select("property_id,tenant_id")
            .in("property_id", propertyIds)
            .eq("owner_id", user.id);

    const tenantIds = Array.from(
        new Set(
            (propertyTenantRows ?? [])
                .map((row) => row.tenant_id as string | null)
                .filter((tenantId): tenantId is string => Boolean(tenantId))
        )
    );

    const { data: tenantProfiles } = tenantIds.length === 0
        ? { data: [] as Array<{ id: string; full_name: string | null; email: string | null }> }
        : await admin
            .from("profiles")
            .select("id,full_name,email")
            .in("id", tenantIds);

    const tenantNamesById = new Map(
        (tenantProfiles ?? []).map((tenant) => [
            tenant.id,
            tenant.full_name || tenant.email || "Ismeretlen bérlő",
        ])
    );

    const tenantNamesByPropertyId = new Map<string, string[]>();
    (propertyTenantRows ?? []).forEach((row) => {
        const propertyId = row.property_id as string | null;
        const tenantId = row.tenant_id as string | null;
        if (!propertyId || !tenantId) return;
        const label = tenantNamesById.get(tenantId);
        if (!label) return;
        const current = tenantNamesByPropertyId.get(propertyId) ?? [];
        if (!current.includes(label)) current.push(label);
        tenantNamesByPropertyId.set(propertyId, current);
    });

    const assignedPropertyIds = new Set((propertyTenantRows ?? []).map((row) => row.property_id as string).filter(Boolean));
    const overdueCharges = chargeRows.filter((charge) => charge.status === "UNPAID" && getDayDiff(charge.due_date) < 0);
    const upcomingCharges = chargeRows.filter((charge) => charge.status === "UNPAID" && getDayDiff(charge.due_date) >= 0 && getDayDiff(charge.due_date) <= 7);
    const importDrafts = chargeRows.filter((charge) => charge.status === "IMPORT_DRAFT");
    const completedCharges = chargeRows.filter((charge) => charge.status === "PAID" && charge.paid_at).slice(0, 8);
    const pendingExitRequests = (exitRequests ?? []) as ExitRequestRow[];
    const unassignedProperties = propertyRows.filter((property) => !assignedPropertyIds.has(property.id) && !property.tenant_id && property.status === "ACTIVE");

    const taskRows: TaskRow[] = [
        ...overdueCharges.map((charge) => {
            const property = firstProperty(charge.properties);
            const tenantNames = tenantNamesByPropertyId.get(charge.property_id) ?? [];
            const days = Math.abs(getDayDiff(charge.due_date));
            return {
                id: `overdue-${charge.id}`,
                label: charge.title,
                description: "Bérleti díj vagy költség lejárt, utánkövetést igényel.",
                propertyLabel: property?.name || "Ingatlan nélkül",
                counterparty: tenantNames.join(", ") || "Bérlő nincs hozzárendelve",
                deadlineLabel: `${days} napja lejárt`,
                deadlineSubLabel: charge.due_date,
                priority: "high",
                state: "open",
                actionHref: `/owner/charges?property=${charge.property_id}`,
                amountLabel: formatCurrency(Number(charge.amount), charge.currency || "HUF"),
                actionType: "charge",
                chargeId: charge.id,
            } satisfies TaskRow;
        }),
        ...importDrafts.map((charge) => {
            const property = firstProperty(charge.properties);
            return {
                id: `import-${charge.id}`,
                label: "Import ellenőrzés szükséges",
                description: charge.title,
                propertyLabel: property?.name || "Ingatlan nélkül",
                counterparty: "AI import",
                deadlineLabel: "Ma",
                deadlineSubLabel: "Review szükséges",
                priority: "high",
                state: "progress",
                actionHref: `/owner/charges?property=${charge.property_id}&status=IMPORT_DRAFT`,
                amountLabel: formatCurrency(Number(charge.amount), charge.currency || "HUF"),
                actionType: "import",
            } satisfies TaskRow;
        }),
        ...upcomingCharges.map((charge) => {
            const property = firstProperty(charge.properties);
            const tenantNames = tenantNamesByPropertyId.get(charge.property_id) ?? [];
            const days = getDayDiff(charge.due_date);
            return {
                id: `upcoming-${charge.id}`,
                label: charge.title,
                description: "Közelgő esedékesség, érdemes előre kommunikálni.",
                propertyLabel: property?.name || "Ingatlan nélkül",
                counterparty: tenantNames.join(", ") || "Bérlő nincs hozzárendelve",
                deadlineLabel: `${days} nap múlva`,
                deadlineSubLabel: charge.due_date,
                priority: "medium",
                state: "open",
                actionHref: `/owner/charges?property=${charge.property_id}`,
                amountLabel: formatCurrency(Number(charge.amount), charge.currency || "HUF"),
                actionType: "charge",
            } satisfies TaskRow;
        }),
        ...pendingExitRequests.map((request) => {
            const property = firstProperty(request.properties);
            const tenantName = request.tenant_id ? tenantNamesById.get(request.tenant_id) ?? "Bérlő" : "Bérlő";
            return {
                id: `exit-${request.id}`,
                label: "Kilépési kérelem",
                description: "Válaszra váró tenant kezdeményezés.",
                propertyLabel: property?.name || "Ingatlan nélkül",
                counterparty: tenantName,
                deadlineLabel: "Beérkezett",
                deadlineSubLabel: new Date(request.created_at).toLocaleDateString("hu-HU"),
                priority: "low",
                state: "open",
                actionHref: "/owner/tenants",
                actionType: "exit",
            } satisfies TaskRow;
        }),
        ...completedCharges.map((charge) => {
            const property = firstProperty(charge.properties);
            const tenantNames = tenantNamesByPropertyId.get(charge.property_id) ?? [];
            return {
                id: `done-${charge.id}`,
                label: `${charge.title} befizetve`,
                description: "A bérlő rendezte a tételt.",
                propertyLabel: property?.name || "Ingatlan nélkül",
                counterparty: tenantNames.join(", ") || "Bérlő",
                deadlineLabel: "Rendezve",
                deadlineSubLabel: charge.paid_at ? new Date(charge.paid_at).toLocaleDateString("hu-HU") : charge.due_date,
                priority: "low",
                state: "done",
                actionHref: `/owner/charges?property=${charge.property_id}`,
                amountLabel: formatCurrency(Number(charge.amount), charge.currency || "HUF"),
                actionType: "done",
            } satisfies TaskRow;
        }),
    ];

    const visibleRows = taskRows.filter((task) => {
        if (selectedView === "all") return task.state !== "done";
        if (selectedView === "done") return task.state === "done";
        return task.priority === selectedView && task.state !== "done";
    });

    return (
        <main className="app-shell page-enter">
            <AppHeader profile={profile} />

            <div className="dashboard-stack">
                <section className="dashboard-page-header">
                    <div>
                        <h1>Feladatok</h1>
                        <p>Az operatív központ: minden emberi döntést igénylő esemény egy listában.</p>
                    </div>
                </section>

                <section className="dashboard-kpi-grid">
                    <article className="card dashboard-kpi-card dashboard-kpi-card-compact">
                        <DesignIcon name="lejart_dij" alt="Lejárt tételek" tone="design-icon-badge-danger" />
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Lejárt tételek</div>
                            <div className="dashboard-kpi-value">{overdueCharges.length}</div>
                            <div className="muted-note">Azonnali utánkövetés</div>
                        </div>
                    </article>
                    <article className="card dashboard-kpi-card dashboard-kpi-card-compact">
                        <DesignIcon name="kozelgo_feladatok" alt="Közelgő esedékességek" tone="design-icon-badge-amber" />
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Közelgő esedékességek</div>
                            <div className="dashboard-kpi-value">{upcomingCharges.length}</div>
                            <div className="muted-note">7 napon belül</div>
                        </div>
                    </article>
                    <article className="card dashboard-kpi-card dashboard-kpi-card-compact">
                        <DesignIcon name="import_review_var" alt="Import review" tone="design-icon-badge-purple" />
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Import review</div>
                            <div className="dashboard-kpi-value">{importDrafts.length}</div>
                            <div className="muted-note">Piszkozat ellenőrzések</div>
                        </div>
                    </article>
                    <article className="card dashboard-kpi-card dashboard-kpi-card-compact">
                        <DesignIcon name="kilepesi_kerelem_folyamatban" alt="Kilépési kérelmek" tone="design-icon-badge-blue" />
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Kilépési kérelmek</div>
                            <div className="dashboard-kpi-value">{pendingExitRequests.length}</div>
                            <div className="muted-note">Nyitott kérelmek</div>
                        </div>
                    </article>
                </section>

                {message ? (
                    <section className="card dashboard-section-card">
                        <div className={status === "error" ? "text-red-600" : "text-green-600"}>{message}</div>
                    </section>
                ) : null}

                <section className="card dashboard-section-card finance-table-shell">
                    <div className="dashboard-toolbar">
                        <div className="dashboard-pill-row">
                            {(["all", "high", "medium", "low", "done"] as TaskView[]).map((view) => {
                                const count = view === "all"
                                    ? taskRows.filter((task) => task.state !== "done").length
                                    : view === "done"
                                        ? taskRows.filter((task) => task.state === "done").length
                                        : taskRows.filter((task) => task.priority === view && task.state !== "done").length;
                                return (
                                    <Link key={view} href={`/owner/todo?view=${view}`} className={`dashboard-filter-pill${selectedView === view ? " is-active" : ""}`}>
                                        {taskViewLabel(view)}
                                        <span className="dashboard-inline-badge dashboard-inline-badge-red">{count}</span>
                                    </Link>
                                );
                            })}
                        </div>
                        <div className="muted-note">Aktív ingatlan tenant nélkül: {unassignedProperties.length}</div>
                    </div>

                    <div className="finance-table-scroll">
                        <table className="dashboard-data-table dashboard-task-table">
                            <thead>
                                <tr>
                                    <th>Feladat</th>
                                    <th>Ingatlan / Bérlő</th>
                                    <th>Határidő</th>
                                    <th>Prioritás</th>
                                    <th>Státusz</th>
                                    <th>Műveletek</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleRows.map((task) => (
                                    <tr key={task.id}>
                                        <td>
                                            <div className="dashboard-table-main">
                                                <strong>{task.label}</strong>
                                                <span className="dashboard-table-subtitle">{task.description}{task.amountLabel ? ` · ${task.amountLabel}` : ""}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="dashboard-table-main">
                                                <strong>{task.propertyLabel}</strong>
                                                <span className="dashboard-table-subtitle">{task.counterparty}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="dashboard-table-main">
                                                <strong>{task.deadlineLabel}</strong>
                                                <span className="dashboard-table-subtitle">{task.deadlineSubLabel}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`dashboard-inline-badge ${priorityTone(task.priority)}`}>
                                                {task.priority === "high" ? "Magas" : task.priority === "medium" ? "Közepes" : "Alacsony"}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`dashboard-inline-badge ${stateTone(task.state)}`}>
                                                {task.state === "done" ? "Elvégezve" : task.state === "progress" ? "Folyamatban" : "Nyitott"}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="dashboard-table-actions">
                                                {task.actionType === "charge" && task.chargeId ? (
                                                    <>
                                                        <form
                                                            action={async () => {
                                                                "use server";
                                                                const res = await markChargePaid(task.chargeId!);
                                                                if (!res.ok) {
                                                                    redirect(`/owner/todo?status=error&message=${encodeURIComponent(res.error ?? "Ismeretlen hiba.")}`);
                                                                }
                                                                redirect("/owner/todo?status=success&message=A+t%C3%A9tel+fizetettre+lett+%C3%A1ll%C3%ADtva.");
                                                            }}
                                                        >
                                                            <PendingSubmitButton className="btn btn-primary btn-sm" label="Befizetett" pendingLabel="Mentés..." />
                                                        </form>
                                                        <form
                                                            action={async () => {
                                                                "use server";
                                                                const res = await sendManualChargeReminder(task.chargeId!);
                                                                if (!res.ok) {
                                                                    redirect(`/owner/todo?status=error&message=${encodeURIComponent(res.error ?? "Ismeretlen hiba.")}`);
                                                                }
                                                                redirect("/owner/todo?status=success&message=Bar%C3%A1ti+eml%C3%A9keztet%C5%91+elk%C3%BCldve.");
                                                            }}
                                                        >
                                                            <PendingSubmitButton className="btn btn-secondary btn-sm" label="Emlékeztető" pendingLabel="Küldés..." />
                                                        </form>
                                                    </>
                                                ) : null}
                                                <Link className="btn btn-secondary btn-sm" href={task.actionHref}>
                                                    Megnyitás
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {visibleRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="dashboard-empty-note">Nincs feladat ebben a nézetben.</td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </main>
    );
}
