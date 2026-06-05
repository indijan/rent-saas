import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { formatCurrency } from "@/lib/formatters";
import AppHeader from "@/components/AppHeader";
import DesignIcon from "@/components/dashboard/DesignIcon";
import PendingSubmitButton from "@/components/PendingSubmitButton";
import { markChargePaid, publishCharge, sendManualChargeReminder } from "@/app/owner/properties/[id]/charges/actions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildMissingInvoiceSuggestions } from "@/lib/invoiceSuggestions";
import { getOwnerImportOverview } from "@/lib/importOverview";

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

type ExpenseHistoryRow = {
    id: string;
    owner_id: string;
    property_id: string;
    tenant_id: string | null;
    title: string;
    type: "UTILITY" | "INSURANCE" | "COMMON_COST" | "RENOVATION" | "TAX" | "OTHER" | "RENT";
    due_date: string;
    status: string;
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
    chargeHref?: string | null;
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

function formatIsoDate(dateValue: string) {
    return new Intl.DateTimeFormat("hu-HU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date(`${dateValue}T00:00:00`));
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
    const historyFromDate = new Date();
    historyFromDate.setDate(historyFromDate.getDate() - 400);
    const historyFrom = historyFromDate.toISOString().slice(0, 10);
    const todayIso = new Date().toISOString().slice(0, 10);

    const [{ data: charges, error: chargeError }, { data: properties, error: propertyError }, { data: exitRequests }, { data: expenseHistoryRows, error: expenseHistoryError }, importOverview] = await Promise.all([
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
        supabase
            .from("charges")
            .select("id,owner_id,property_id,tenant_id,title,type,due_date,status,properties(name)")
            .eq("owner_id", user.id)
            .is("tenant_id", null)
            .neq("type", "RENT")
            .gte("due_date", historyFrom),
        getOwnerImportOverview(user.id, { limit: 50 }),
    ]);

    if (chargeError || propertyError || expenseHistoryError) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <div className="card">
                    <h1>Feladatok</h1>
                    <p className="text-red-600">Hiba: {chargeError?.message || propertyError?.message || expenseHistoryError?.message}</p>
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
    const importRows = importOverview.actionRows;
    const completedCharges = chargeRows.filter((charge) => charge.status === "PAID" && charge.paid_at).slice(0, 8);
    const pendingExitRequests = (exitRequests ?? []) as ExitRequestRow[];
    const invoiceSuggestions = buildMissingInvoiceSuggestions((expenseHistoryRows ?? []) as ExpenseHistoryRow[], todayIso);
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
        ...importRows.map((importRow) => {
            const property = propertyRows.find((row) => row.id === importRow.propertyId);
            return {
                id: `import-${importRow.ingestionId}`,
                label: importRow.state === "draft" ? "Import piszkozat publikálásra vár" : "Import ellenőrzés szükséges",
                description: importRow.chargeTitle || importRow.sourceAttachmentName || "Importált számla",
                propertyLabel: property?.name || "Ingatlan nélkül",
                counterparty: importRow.state === "draft" ? "Import piszkozat" : "AI import",
                deadlineLabel: importRow.state === "draft" ? "Piszkozat kész" : "Ma",
                deadlineSubLabel: importRow.state === "draft" ? "Publikálás szükséges" : "Review szükséges",
                priority: "high",
                state: "progress",
                actionHref: importRow.reviewHref,
                amountLabel: importRow.amount !== null ? formatCurrency(importRow.amount, importRow.currency || "HUF") : undefined,
                actionType: "import",
                chargeId: importRow.canPublish ? (importRow.createdChargeId ?? undefined) : undefined,
                chargeHref: importRow.chargeHref,
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
                description: "Válaszra váró bérlői kezdeményezés.",
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
                    <Link className="card dashboard-kpi-card dashboard-kpi-card-compact" href="/owner/importok">
                        <DesignIcon name="import_review_var" alt="Import review" tone="design-icon-badge-purple" />
                        <div className="dashboard-kpi-copy">
                            <div className="dashboard-kpi-title">Import review</div>
                            <div className="dashboard-kpi-value">{importRows.length}</div>
                                <div className="muted-note">Review vagy publikálás</div>
                        </div>
                    </Link>
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

                <section className="card dashboard-section-card">
                    <div className="dashboard-section-head">
                        <div>
                            <div className="card-title">Számla tétel javaslatok</div>
                            <p>A rendszer a korábbi saját költség minták alapján jelzi, ha egy szokásos számla most hiányozhat.</p>
                        </div>
                        <span className="dashboard-inline-badge dashboard-inline-badge-amber">{invoiceSuggestions.length} nyitott jelzés</span>
                    </div>

                    {invoiceSuggestions.length === 0 ? (
                        <div className="dashboard-empty-note">Jelenleg nincs olyan visszatérő saját költség, amelynél kimaradt számlára utaló mintát látnánk.</div>
                    ) : (
                        <div className="todo-link-list">
                            {invoiceSuggestions.slice(0, 6).map((suggestion) => (
                                <article key={suggestion.suggestionKey} className="todo-link-card">
                                    <div className="todo-task-head">
                                        <div className="todo-task-copy">
                                            <strong>{suggestion.title}</strong>
                                            <span className="dashboard-table-subtitle">
                                                Lehetségesen hiányzó saját költség tétel. Ellenőrizd, hogy nem maradt-e el a rögzítés.
                                            </span>
                                        </div>
                                        <div className="todo-task-meta">
                                            <span>{suggestion.propertyName || "Ingatlan nélkül"}</span>
                                            <span>Várt időpont: {formatIsoDate(suggestion.expectedDate)}</span>
                                            <span>Utolsó hasonló: {formatIsoDate(suggestion.lastSeenDate)}</span>
                                            <span>Kb. {suggestion.cadenceDays} naponta</span>
                                        </div>
                                        <div className="todo-task-meta">
                                            <span className={`dashboard-inline-badge ${suggestion.daysLate > 7 ? "dashboard-inline-badge-red" : "dashboard-inline-badge-amber"}`}>
                                                {suggestion.daysLate} nap csúszás
                                            </span>
                                            <span className={`dashboard-inline-badge ${suggestion.confidence === "high" ? "dashboard-inline-badge-green" : "dashboard-inline-badge-blue"}`}>
                                                {suggestion.confidence === "high" ? "Erős minta" : "Közepes minta"}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="todo-task-actions">
                                        <Link className="btn btn-primary btn-sm" href={`/owner/charges?property=${suggestion.propertyId}&billing=OWN&compose=manual`}>
                                            Tétel rögzítése
                                        </Link>
                                        <Link className="btn btn-secondary btn-sm" href={`/owner/charges?property=${suggestion.propertyId}&billing=OWN`}>
                                            Pénzügyek megnyitása
                                        </Link>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>

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
                        <div className="muted-note">Aktív ingatlan bérlő nélkül: {unassignedProperties.length}</div>
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
                                                {task.actionType === "import" && task.chargeId ? (
                                                    <form
                                                        action={async () => {
                                                            "use server";
                                                            const res = await publishCharge(task.chargeId!);
                                                            if (!res.ok) {
                                                                redirect(`/owner/todo?status=error&message=${encodeURIComponent(res.error ?? "Ismeretlen hiba.")}`);
                                                            }
                                                            redirect("/owner/todo?status=success&message=Az+import+piszkozat+publik%C3%A1lva+lett.");
                                                        }}
                                                    >
                                                        <PendingSubmitButton className="btn btn-primary btn-sm" label="Publikálás" pendingLabel="Publikálás..." />
                                                    </form>
                                                ) : null}
                                                {task.actionType === "import" && task.chargeHref ? (
                                                    <Link className="btn btn-secondary btn-sm" href={task.chargeHref}>
                                                        Piszkozat
                                                    </Link>
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

                    <div className="todo-mobile-list">
                        {visibleRows.length === 0 ? (
                            <div className="dashboard-empty-note">Nincs feladat ebben a nézetben.</div>
                        ) : (
                            visibleRows.map((task) => (
                                <article key={`${task.id}-mobile`} className="todo-task-card todo-mobile-card">
                                    <div className="todo-task-head">
                                        <div className="todo-task-copy">
                                            <strong>{task.label}</strong>
                                            <span className="dashboard-table-subtitle">{task.description}{task.amountLabel ? ` · ${task.amountLabel}` : ""}</span>
                                        </div>
                                        <div className="todo-task-meta">
                                            <span>{task.propertyLabel}</span>
                                            <span>{task.counterparty}</span>
                                            <span>{task.deadlineLabel}</span>
                                            <span>{task.deadlineSubLabel}</span>
                                        </div>
                                        <div className="todo-task-meta">
                                            <span className={`dashboard-inline-badge ${priorityTone(task.priority)}`}>
                                                {task.priority === "high" ? "Magas" : task.priority === "medium" ? "Közepes" : "Alacsony"}
                                            </span>
                                            <span className={`dashboard-inline-badge ${stateTone(task.state)}`}>
                                                {task.state === "done" ? "Elvégezve" : task.state === "progress" ? "Folyamatban" : "Nyitott"}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="todo-task-actions todo-mobile-actions">
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
                                </article>
                            ))
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}
