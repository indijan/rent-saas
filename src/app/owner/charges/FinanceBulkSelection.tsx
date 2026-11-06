"use client";

import { createContext, useContext, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { applyBulkChargeAction } from "@/app/owner/properties/[id]/charges/actions";
import { isExpenseCharge } from "@/lib/ownerFinance";
import type { FinanceChargeStatus } from "@/lib/ownerFinance";
import type { ChargeType } from "@/lib/chargeTypes";

type BulkOperation = "mark-paid" | "archive";

type FinanceBulkItem = {
    id: string;
    status: FinanceChargeStatus;
    tenant_id: string | null;
    type: ChargeType;
};

type SelectionContextValue = {
    selectedIds: Set<string>;
    selectableIds: Set<string>;
    toggle: (id: string) => void;
    selectableCount: number;
    totalCount: number;
    allSelected: boolean;
    selectAll: () => void;
};

const MAX_BULK_SELECTION = 500;
const FinanceSelectionContext = createContext<SelectionContextValue | null>(null);

function useFinanceSelection() {
    const context = useContext(FinanceSelectionContext);
    if (!context) throw new Error("Finance selection components require FinanceBulkSelection.");
    return context;
}

function canMarkPaid(item: FinanceBulkItem) {
    return item.status === "UNPAID" && !isExpenseCharge(item);
}

function canArchive(item: FinanceBulkItem) {
    return isExpenseCharge(item) ? item.status === "UNPAID" : item.status === "PAID";
}

function isSelectionKey(event: KeyboardEvent<HTMLElement>) {
    return event.key === "Enter" || event.key === " ";
}

function isInteractiveTarget(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest("a,button,input,select,textarea,form,[data-no-row-select]"));
}

export function FinanceBulkSelection({
    items,
    totalCount = items.length,
    children,
}: {
    items: FinanceBulkItem[];
    totalCount?: number;
    children: ReactNode;
}) {
    const selectableItems = items.slice(0, MAX_BULK_SELECTION);
    const selectableIds = new Set(selectableItems.map((item) => item.id));
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [confirmation, setConfirmation] = useState<BulkOperation | null>(null);
    const [feedback, setFeedback] = useState("");
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const toggle = (id: string) => {
        if (!selectableIds.has(id) || isPending) return;
        setConfirmation(null);
        setFeedback("");
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectedItems = selectableItems.filter((item) => selectedIds.has(item.id));
    const payableCount = selectedItems.filter(canMarkPaid).length;
    const archivableCount = selectedItems.filter(canArchive).length;
    const allSelected = selectableItems.length > 0 && selectedIds.size === selectableItems.length;

    const selectAll = () => {
        setConfirmation(null);
        setFeedback("");
        setSelectedIds(allSelected ? new Set() : new Set(selectableItems.map((item) => item.id)));
    };

    const executeOperation = () => {
        if (!confirmation || selectedItems.length === 0) return;
        const operation = confirmation;
        startTransition(async () => {
            try {
                const result = await applyBulkChargeAction(selectedItems.map((item) => item.id), operation);
                if (!result.ok) {
                    setFeedback(result.error);
                    setConfirmation(null);
                    return;
                }

                const label = operation === "mark-paid" ? "fizetettnek jelölve" : "archiválva";
                const skipped = result.skippedCount > 0 ? ` ${result.skippedCount} nem megfelelő státuszú tétel kimaradt.` : "";
                setFeedback(`${result.updatedCount} tétel ${label}.${skipped}`);
                setSelectedIds(new Set());
                setConfirmation(null);
                router.refresh();
                window.setTimeout(() => setFeedback(""), 5000);
            } catch {
                setFeedback("A tömeges művelet most nem sikerült. Próbáld újra.");
                setConfirmation(null);
            }
        });
    };

    const contextValue = {
        selectedIds,
        selectableIds,
        toggle,
        selectableCount: selectableItems.length,
        totalCount,
        allSelected,
        selectAll,
    };

    return (
        <FinanceSelectionContext.Provider value={contextValue}>
            {children}

            {selectedItems.length > 0 || feedback ? (
                <div className="finance-bulk-actionbar" role="toolbar" aria-label="Tömeges műveletek">
                    <div className="finance-bulk-selection-summary" aria-live="polite">
                        {selectedItems.length > 0 ? (
                            <>
                                <span className="finance-bulk-selection-count">{selectedItems.length}</span>
                                <span>tétel kijelölve</span>
                                <small>A művelet csak az alkalmas státuszú kijelöltekre fut.</small>
                                {feedback ? <span className="finance-bulk-feedback">{feedback}</span> : null}
                            </>
                        ) : <span className="finance-bulk-feedback">{feedback}</span>}
                    </div>
                    <div className="finance-bulk-action-buttons">
                        {confirmation ? (
                            <>
                                <span className="finance-bulk-confirm-copy">
                                    {confirmation === "mark-paid"
                                        ? `${payableCount} tétel fizetettnek jelölése?`
                                        : `${archivableCount} tétel archiválása?`}
                                </span>
                                <button type="button" className="finance-bulk-confirm-button" onClick={executeOperation} disabled={isPending}>
                                    {isPending ? "Feldolgozás…" : "Megerősítés"}
                                </button>
                                <button type="button" className="finance-bulk-cancel-button" onClick={() => setConfirmation(null)} disabled={isPending}>
                                    Mégse
                                </button>
                            </>
                        ) : (
                            <>
                                {payableCount > 0 ? (
                                    <button type="button" className="finance-bulk-primary-button" onClick={() => setConfirmation("mark-paid")} disabled={isPending}>
                                        Fizetettnek jelölés <span>{payableCount}</span>
                                    </button>
                                ) : null}
                                {archivableCount > 0 ? (
                                    <button type="button" className="finance-bulk-secondary-button" onClick={() => setConfirmation("archive")} disabled={isPending}>
                                        Archiválás <span>{archivableCount}</span>
                                    </button>
                                ) : null}
                                {payableCount === 0 && archivableCount === 0 ? (
                                    <span className="finance-bulk-no-actions">Ehhez a kijelöléshez nincs elérhető tömeges művelet.</span>
                                ) : null}
                                <button
                                    type="button"
                                    className="finance-bulk-clear-button"
                                    onClick={() => {
                                        setSelectedIds(new Set());
                                        setConfirmation(null);
                                    }}
                                    disabled={isPending}
                                >
                                    Kijelölés törlése
                                </button>
                            </>
                        )}
                    </div>
                </div>
            ) : null}
        </FinanceSelectionContext.Provider>
    );
}

export function FinanceBulkSelectAllButton() {
    const { selectableCount, totalCount, allSelected, selectAll } = useFinanceSelection();
    if (selectableCount === 0) return null;

    return (
        <div className="finance-bulk-select-all">
            <span>
                {totalCount > MAX_BULK_SELECTION
                    ? `${selectableCount} / ${totalCount} tétel jelölhető egyszerre`
                    : `${totalCount} tétel a szűrt listában`}
            </span>
            <button type="button" className="finance-bulk-select-button" onClick={selectAll}>
                {allSelected ? "Kijelölés törlése" : `Mind kijelölése (${selectableCount})`}
            </button>
        </div>
    );
}

export function FinanceSelectableTableRow({
    id,
    className = "",
    children,
}: {
    id: string;
    className?: string;
    children: ReactNode;
}) {
    const { selectedIds, selectableIds, toggle } = useFinanceSelection();
    const selectable = selectableIds.has(id);
    const selected = selectedIds.has(id);

    return (
        <tr
            className={`${className}${selectable ? " finance-row-selectable" : ""}${selected ? " finance-row-selected" : ""}`.trim()}
            aria-selected={selected}
            aria-description={selectable ? (selected ? "Kijelölve" : "Kattintással kijelölhető") : undefined}
            tabIndex={selectable ? 0 : undefined}
            onClick={(event) => {
                if (selectable && !isInteractiveTarget(event.target)) toggle(id);
            }}
            onKeyDown={(event) => {
                if (selectable && event.target === event.currentTarget && isSelectionKey(event)) {
                    event.preventDefault();
                    toggle(id);
                }
            }}
        >
            {children}
        </tr>
    );
}

export function FinanceSelectableCard({
    id,
    className = "",
    children,
}: {
    id: string;
    className?: string;
    children: ReactNode;
}) {
    const { selectedIds, selectableIds, toggle } = useFinanceSelection();
    const selectable = selectableIds.has(id);
    const selected = selectedIds.has(id);

    return (
        <article
            className={`${className}${selectable ? " finance-card-selectable" : ""}${selected ? " finance-card-selected" : ""}`.trim()}
            aria-label={selectable ? (selected ? "Kijelölve. Enterrel vagy szóközzel megszüntethető." : "Kattintással, Enterrel vagy szóközzel kijelölhető.") : undefined}
            tabIndex={selectable ? 0 : undefined}
            onClick={(event) => {
                if (selectable && !isInteractiveTarget(event.target)) toggle(id);
            }}
            onKeyDown={(event) => {
                if (selectable && event.target === event.currentTarget && isSelectionKey(event)) {
                    event.preventDefault();
                    toggle(id);
                }
            }}
        >
            {children}
        </article>
    );
}
