"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { updateCharge } from "@/app/owner/properties/[id]/charges/actions";
import ActionPendingScreen from "@/components/ActionPendingScreen";
import { FORWARDED_CHARGE_TYPE_OPTIONS, OWN_EXPENSE_CHARGE_TYPE_OPTIONS, isOwnOnlyChargeType } from "@/lib/chargeTypes";

type EditableCharge = {
    id: string;
    title: string;
    type: string;
    amount: number | string;
    currency: string | null;
    due_date: string;
    tenant_id: string | null;
    status: string;
    recurring_group?: string | null;
};

type Props = {
    charge: EditableCharge;
    mobileLabel?: string;
};

function inferBillingMode(charge: EditableCharge) {
    return !charge.tenant_id && charge.type !== "RENT" ? "OWN_EXPENSE" : "FORWARDED";
}

export default function FinanceChargeEditor({ charge, mobileLabel }: Props) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [billingMode, setBillingMode] = useState<"FORWARDED" | "OWN_EXPENSE">(inferBillingMode(charge));
    const [selectedType, setSelectedType] = useState<string>(charge.type);
    const [message, setMessage] = useState<string | null>(null);
    const [isError, setIsError] = useState(false);
    const [isPending, startTransition] = useTransition();
    const isLocked = charge.status !== "UNPAID" && charge.status !== "IMPORT_DRAFT";
    const availableTypes = billingMode === "OWN_EXPENSE" ? OWN_EXPENSE_CHARGE_TYPE_OPTIONS : FORWARDED_CHARGE_TYPE_OPTIONS;
    const selectedTypeRequiresOwnExpense = isOwnOnlyChargeType(selectedType);

    function closeEditor() {
        setIsOpen(false);
        setMessage(null);
        setIsError(false);
        setBillingMode(inferBillingMode(charge));
        setSelectedType(charge.type);
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setMessage(null);
        setIsError(false);
        const formData = new FormData(event.currentTarget);

        startTransition(async () => {
            const res = await updateCharge(charge.id, formData);
            if (!res.ok) {
                setIsError(true);
                setMessage(res.error ?? "A mentés nem sikerült.");
                return;
            }

            setIsError(false);
            setMessage("A tétel adatai elmentve.");
            router.refresh();
            closeEditor();
        });
    }

    if (isLocked) {
        return (
            <button
                type="button"
                className={mobileLabel ? "dashboard-icon-button finance-mobile-action-button" : "dashboard-icon-button"}
                aria-label="Szerkesztés letiltva"
                title="Csak aktív vagy piszkozat tétel szerkeszthető"
                data-tooltip="Csak aktív vagy piszkozat tétel szerkeszthető"
                disabled
            >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 20h4l10-10-4-4L4 16v4Z" />
                    <path d="m12.5 5.5 4 4" />
                </svg>
                {mobileLabel ? <span>{mobileLabel}</span> : null}
            </button>
        );
    }

    return (
        <>
            <button
                type="button"
                className={mobileLabel ? "dashboard-icon-button finance-mobile-action-button" : "dashboard-icon-button"}
                aria-label="Tétel szerkesztése"
                title="Tétel szerkesztése"
                data-tooltip="Tétel szerkesztése"
                onClick={() => setIsOpen(true)}
            >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 20h4l10-10-4-4L4 16v4Z" />
                    <path d="m12.5 5.5 4 4" />
                </svg>
                {mobileLabel ? <span>{mobileLabel}</span> : null}
            </button>

            {isOpen ? (
                <div className="dashboard-modal-overlay" role="presentation" onClick={closeEditor}>
                    <div className="dashboard-modal-panel finance-composer-panel" role="dialog" aria-modal="true" aria-labelledby={`finance-editor-${charge.id}`} onClick={(event) => event.stopPropagation()}>
                        <div className="dashboard-modal-header">
                            <div>
                                <div className="dashboard-modal-kicker">Pénzügyek</div>
                                <h2 id={`finance-editor-${charge.id}`}>Tétel szerkesztése</h2>
                            </div>
                            <button type="button" className="dashboard-modal-close" onClick={closeEditor} aria-label="Bezárás">×</button>
                        </div>

                        <form className="dashboard-stack" onSubmit={handleSubmit}>
                            <div className="dashboard-form-grid">
                                <label className="field-stack">
                                    <span className="field-label">Tétel típusa</span>
                                    <select
                                        name="billing_mode"
                                        className="select"
                                        value={billingMode}
                                        onChange={(event) => {
                                            const nextMode = event.target.value as "FORWARDED" | "OWN_EXPENSE";
                                            setBillingMode(nextMode);
                                            const nextAvailableTypes = nextMode === "OWN_EXPENSE" ? OWN_EXPENSE_CHARGE_TYPE_OPTIONS : FORWARDED_CHARGE_TYPE_OPTIONS;
                                            if (!nextAvailableTypes.some((item) => item.value === selectedType)) {
                                                setSelectedType(nextAvailableTypes[0]?.value ?? "OTHER");
                                            }
                                        }}
                                    >
                                        <option value="FORWARDED" disabled={selectedTypeRequiresOwnExpense}>Továbbított költség</option>
                                        <option value="OWN_EXPENSE">Saját költség</option>
                                    </select>
                                    {selectedTypeRequiresOwnExpense ? <span className="muted-note">Az Adó típus csak saját költségként rögzíthető.</span> : null}
                                </label>
                                <label className="field-stack">
                                    <span className="field-label">Kategória</span>
                                    <select
                                        key={billingMode}
                                        name="type"
                                        className="select"
                                        value={availableTypes.some((item) => item.value === selectedType) ? selectedType : availableTypes[0]?.value}
                                        onChange={(event) => {
                                            const nextType = event.target.value;
                                            setSelectedType(nextType);
                                            if (isOwnOnlyChargeType(nextType) && billingMode !== "OWN_EXPENSE") {
                                                setBillingMode("OWN_EXPENSE");
                                            }
                                        }}
                                    >
                                        {availableTypes.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="field-stack finance-composer-field-wide">
                                    <span className="field-label">Megnevezés</span>
                                    <input name="title" className="input" defaultValue={charge.title} required />
                                </label>
                                <label className="field-stack">
                                    <span className="field-label">Esedékesség</span>
                                    <input name="due_date" className="input" type="date" defaultValue={charge.due_date} required />
                                </label>
                                <label className="field-stack">
                                    <span className="field-label">Összeg</span>
                                    <input name="amount" className="input" defaultValue={String(charge.amount)} required />
                                </label>
                                {charge.recurring_group ? (
                                    <label className="field-stack finance-composer-field-wide finance-recurring-toggle">
                                        <span className="field-label">Ismétlődő sorozat</span>
                                        <span className="finance-recurring-checkbox">
                                            <input type="checkbox" name="apply_to_future" />
                                            <span>A jövőbeni tételeket is módosítsa</span>
                                        </span>
                                        <span className="muted-note">Ha nincs bepipálva, csak ez az egy tétel frissül.</span>
                                    </label>
                                ) : null}
                            </div>

                            <input type="hidden" name="currency" value={charge.currency || "HUF"} />

                            <div className="dashboard-modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={closeEditor}>Mégse</button>
                                <button type="submit" className="btn btn-primary" disabled={isPending}>
                                    {isPending ? "Mentés..." : "Módosítás mentése"}
                                </button>
                            </div>
                            {message ? <p className={`text-sm ${isError ? "text-red-600" : "text-green-600"}`}>{message}</p> : null}
                        </form>
                        <ActionPendingScreen active={isPending} label="Módosítás mentése..." />
                    </div>
                </div>
            ) : null}
        </>
    );
}
