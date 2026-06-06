import { EXPENSE_CATEGORY_CONFIG, type ChargeType } from "@/lib/chargeTypes";

export type FinanceChargeStatus = "UNPAID" | "PAID" | "ARCHIVED" | "CANCELLED" | "IMPORT_DRAFT";

export type FinanceChargeLike = {
    amount: number | string;
    status: FinanceChargeStatus;
    due_date: string;
    tenant_id: string | null;
    type: ChargeType;
};

function toAmount(value: number | string) {
    return Number(value) || 0;
}

function startOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

function monthStart(dateValue: string) {
    const date = new Date(`${dateValue}T00:00:00`);
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthEnd(dateValue: string) {
    const date = new Date(`${dateValue}T00:00:00`);
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function toDateInputValue(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function monthDiffInclusive(fromValue: string, toValue: string) {
    const start = monthStart(fromValue);
    const end = monthStart(toValue);
    return ((end.getFullYear() - start.getFullYear()) * 12) + (end.getMonth() - start.getMonth()) + 1;
}

export function isExpenseCharge(charge: Pick<FinanceChargeLike, "tenant_id" | "type">) {
    return !charge.tenant_id && charge.type !== "RENT";
}

export function isRecoveredForwardedExpenseCharge(charge: Pick<FinanceChargeLike, "tenant_id" | "type" | "status">) {
    return !!charge.tenant_id
        && charge.type !== "RENT"
        && (charge.status === "PAID" || charge.status === "ARCHIVED");
}

export function isRecognizedRevenueCharge(charge: Pick<FinanceChargeLike, "tenant_id" | "type" | "status">) {
    return !isExpenseCharge(charge) && (charge.status === "PAID" || charge.status === "ARCHIVED");
}

export function expenseAmountForSummary(charge: Pick<FinanceChargeLike, "tenant_id" | "type" | "status" | "amount">) {
    if (charge.status === "CANCELLED") return 0;
    if (isExpenseCharge(charge) || isRecoveredForwardedExpenseCharge(charge)) {
        return toAmount(charge.amount);
    }
    return 0;
}

export function revenueAmountForSummary(charge: Pick<FinanceChargeLike, "tenant_id" | "type" | "status" | "amount">) {
    if (charge.status === "CANCELLED" || !isRecognizedRevenueCharge(charge)) return 0;
    return toAmount(charge.amount);
}

export function openReceivableAmount(charge: Pick<FinanceChargeLike, "tenant_id" | "type" | "status" | "amount">) {
    if (charge.status !== "UNPAID" || isExpenseCharge(charge)) return 0;
    return toAmount(charge.amount);
}

export function overdueReceivableAmount(charge: Pick<FinanceChargeLike, "tenant_id" | "type" | "status" | "amount" | "due_date">) {
    const overdue = !isExpenseCharge(charge) && charge.status === "UNPAID" && new Date(`${charge.due_date}T00:00:00`).getTime() < startOfToday().getTime();
    return overdue ? toAmount(charge.amount) : 0;
}

export function summarizeFinanceRows<T extends FinanceChargeLike>(rows: T[]) {
    const revenue = rows.reduce((sum, charge) => sum + revenueAmountForSummary(charge), 0);
    const expense = rows.reduce((sum, charge) => sum + expenseAmountForSummary(charge), 0);
    const openReceivables = rows.reduce((sum, charge) => sum + openReceivableAmount(charge), 0);
    const overdueReceivables = rows.reduce((sum, charge) => sum + overdueReceivableAmount(charge), 0);
    const overdueCount = rows.filter((charge) => overdueReceivableAmount(charge) > 0).length;
    return {
        revenue,
        expense,
        profit: revenue - expense,
        openReceivables,
        overdueReceivables,
        overdueCount,
    };
}

export function buildRecentTrendSeries<T extends FinanceChargeLike>(rows: T[], endValue: string, months = 6) {
    const anchor = monthStart(endValue);
    return Array.from({ length: months }, (_, index) => {
        const date = new Date(anchor.getFullYear(), anchor.getMonth() - ((months - 1) - index), 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const net = rows.reduce((sum, charge) => {
            if (charge.status === "CANCELLED" || !charge.due_date.startsWith(key)) return sum;
            return sum + revenueAmountForSummary(charge) - expenseAmountForSummary(charge);
        }, 0);
        return {
            key,
            label: new Intl.DateTimeFormat("hu-HU", { month: "short" }).format(date).replace(".", ""),
            net,
        };
    });
}

export function buildCustomTrendSeries<T extends FinanceChargeLike>(rows: T[], fromValue: string, toValue: string, maxMonths = 12) {
    const months = Math.max(1, Math.min(monthDiffInclusive(fromValue, toValue), maxMonths));
    const start = monthStart(fromValue);
    const end = monthStart(toValue);
    const firstMonth = months === monthDiffInclusive(fromValue, toValue)
        ? start
        : new Date(end.getFullYear(), end.getMonth() - (months - 1), 1);

    return Array.from({ length: months }, (_, index) => {
        const date = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + index, 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const net = rows.reduce((sum, charge) => {
            if (charge.status === "CANCELLED" || !charge.due_date.startsWith(key)) return sum;
            return sum + revenueAmountForSummary(charge) - expenseAmountForSummary(charge);
        }, 0);
        return {
            key,
            label: new Intl.DateTimeFormat("hu-HU", { month: "short" }).format(date).replace(".", ""),
            net,
        };
    });
}

export function buildRecentTrendWindow(endValue: string, months = 6) {
    const anchor = monthStart(endValue);
    return {
        from: toDateInputValue(new Date(anchor.getFullYear(), anchor.getMonth() - (months - 1), 1)),
        to: toDateInputValue(monthEnd(endValue)),
    };
}

export function buildExpenseCategoryTotals<T extends FinanceChargeLike>(rows: T[]) {
    return EXPENSE_CATEGORY_CONFIG.map((item) => ({
        label: item.label,
        color: item.color,
        value: rows
            .filter((row) => {
                if (row.status === "CANCELLED") return false;
                if (!isExpenseCharge(row) && !isRecoveredForwardedExpenseCharge(row)) return false;
                if (item.type === "OTHER_EXPENSES") {
                    return !["UTILITY", "COMMON_COST", "INSURANCE", "RENOVATION", "TAX", "OTHER"].includes(row.type);
                }
                return row.type === item.type;
            })
            .reduce((sum, row) => sum + toAmount(row.amount), 0),
    }));
}
