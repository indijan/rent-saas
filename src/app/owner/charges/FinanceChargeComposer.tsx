"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createCharge } from "@/app/owner/properties/[id]/charges/actions";
import { createManualIngestion } from "@/app/owner/importok/actions";
import ActionPendingScreen from "@/components/ActionPendingScreen";
import DesignIcon from "@/components/dashboard/DesignIcon";
import { FORWARDED_CHARGE_TYPE_OPTIONS, OWN_EXPENSE_CHARGE_TYPE_OPTIONS, isOwnOnlyChargeType } from "@/lib/chargeTypes";

type PropertyOption = {
    id: string;
    name: string;
    address?: string;
};

type Props = {
    properties: PropertyOption[];
    selectedPropertyId?: string;
    triggerVariant?: "button" | "card";
    triggerLabel?: string;
    defaultMode?: ComposerMode;
    autoOpen?: boolean;
    closeHref?: string;
};

type ComposerMode = "manual" | "upload";
type BillingMode = "FORWARDED" | "OWN_EXPENSE";

function toDateInputValue(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function lastDayOfCurrentMonth() {
    const now = new Date();
    return toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

function CloseIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6 18 18" />
            <path d="M18 6 6 18" />
        </svg>
    );
}

export default function FinanceChargeComposer({
    properties,
    selectedPropertyId = "",
    triggerVariant = "button",
    triggerLabel,
    defaultMode = "manual",
    autoOpen = false,
    closeHref,
}: Props) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(autoOpen);
    const [mode, setMode] = useState<ComposerMode>(defaultMode);
    const [billingMode, setBillingMode] = useState<BillingMode>("FORWARDED");
    const [selectedType, setSelectedType] = useState<string>("RENT");
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurringCount, setRecurringCount] = useState("12");
    const [manualError, setManualError] = useState<string | null>(null);
    const [manualSuccess, setManualSuccess] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const defaultPropertyId = selectedPropertyId || properties[0]?.id || "";
    const availableTypes = useMemo(
        () => (billingMode === "OWN_EXPENSE" ? OWN_EXPENSE_CHARGE_TYPE_OPTIONS : FORWARDED_CHARGE_TYPE_OPTIONS),
        [billingMode]
    );
    const selectedTypeRequiresOwnExpense = isOwnOnlyChargeType(selectedType);

    function propertyLabel(property: PropertyOption) {
        return property.address ? `${property.name} · ${property.address}` : property.name;
    }

    function closeComposer() {
        setIsOpen(false);
        setManualError(null);
        setManualSuccess(null);
        setUploadError(null);
        setUploadSuccess(null);
        setMode(defaultMode);
        setBillingMode("FORWARDED");
        setSelectedType("RENT");
        setIsRecurring(false);
        setRecurringCount("12");
        if (closeHref) {
            router.replace(closeHref, { scroll: false });
        }
    }

    function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setManualError(null);
        setManualSuccess(null);

        const formData = new FormData(event.currentTarget);
        const propertyId = String(formData.get("property_id") || "").trim();

        if (!propertyId) {
            setManualError("Válassz ki egy ingatlant.");
            return;
        }

        startTransition(async () => {
            try {
                const res = await createCharge(propertyId, formData);
                if (!res.ok) {
                    setManualError(res.error || "A tétel létrehozása nem sikerült.");
                    return;
                }
                setManualSuccess("A tétel létrejött.");
                router.refresh();
                closeComposer();
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                setManualError(`Mentési hiba: ${message}`);
            }
        });
    }

    function handleUploadSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setUploadError(null);
        setUploadSuccess(null);

        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
            try {
                const res = await createManualIngestion(formData);
                if (!res.ok) {
                    setUploadError(res.error || "A feltöltés nem sikerült.");
                    return;
                }
                const successMessage = res.needsReview
                    ? "A számla beérkezett, de ellenőrzést igényel."
                    : "A számlából import piszkozat jött létre.";
                setUploadSuccess(successMessage);
                closeComposer();
                if (res.nextHref) {
                    router.push(res.nextHref);
                    return;
                }
                router.refresh();
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                setUploadError(`Feltöltési hiba: ${message}`);
            }
        });
    }

    return (
        <>
            {triggerVariant === "card" ? (
                <button type="button" className="quick-action-card quick-action-card-button" onClick={() => setIsOpen(true)}>
                    <DesignIcon
                        name={defaultMode === "upload" ? "szamla_importalasa" : "uj_dij_rogzitese"}
                        alt={defaultMode === "upload" ? "Számla feltöltése" : "Új díj rögzítése"}
                        tone={defaultMode === "upload" ? "design-icon-badge-blue" : "design-icon-badge-green"}
                    />
                    <strong>{triggerLabel || (defaultMode === "upload" ? "Számla feltöltése" : "Új díj rögzítése")}</strong>
                </button>
            ) : (
                <button type="button" className="btn btn-primary finance-create-button" onClick={() => setIsOpen(true)}>
                    <span>{triggerLabel || "+ Új tétel rögzítése"}</span>
                    <span className="finance-create-button-caret" aria-hidden="true">▾</span>
                </button>
            )}

            {isOpen ? (
                <div className="dashboard-modal-overlay" role="presentation" onClick={closeComposer}>
                    <div className="dashboard-modal-panel finance-composer-panel" role="dialog" aria-modal="true" aria-labelledby="finance-composer-title" onClick={(event) => event.stopPropagation()}>
                        <div className="dashboard-modal-header">
                            <div>
                                <div className="dashboard-modal-kicker">Pénzügyek</div>
                                <h2 id="finance-composer-title">Új tétel vagy PDF feltöltés</h2>
                            </div>
                            <button type="button" className="dashboard-modal-close" onClick={closeComposer} aria-label="Bezárás">
                                <CloseIcon />
                            </button>
                        </div>

                        <div className="finance-composer-mode-switch" role="tablist" aria-label="Mód kiválasztása">
                            <button type="button" className={`finance-composer-mode${mode === "manual" ? " is-active" : ""}`} onClick={() => setMode("manual")}>
                                Új tétel
                            </button>
                            <button type="button" className={`finance-composer-mode${mode === "upload" ? " is-active" : ""}`} onClick={() => setMode("upload")}>
                                PDF feltöltés
                            </button>
                        </div>

                        {mode === "manual" ? (
                            <form className="dashboard-stack" onSubmit={handleManualSubmit}>
                                <div className="dashboard-form-grid">
                                    <label className="field-stack">
                                        <span className="field-label">Ingatlan</span>
                                        <select name="property_id" className="select" defaultValue={defaultPropertyId} required>
                                            <option value="" disabled>Válassz ingatlant</option>
                                            {properties.map((property) => (
                                                <option key={property.id} value={property.id}>{propertyLabel(property)}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="field-stack">
                                        <span className="field-label">Tétel típusa</span>
                                        <select
                                            name="billing_mode"
                                            className="select"
                                            value={billingMode}
                                            onChange={(event) => {
                                                const nextMode = event.target.value as BillingMode;
                                                setBillingMode(nextMode);
                                                const nextAvailableTypes = nextMode === "OWN_EXPENSE" ? OWN_EXPENSE_CHARGE_TYPE_OPTIONS : FORWARDED_CHARGE_TYPE_OPTIONS;
                                                if (!nextAvailableTypes.some((option) => option.value === selectedType)) {
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
                                            value={availableTypes.some((option) => option.value === selectedType) ? selectedType : availableTypes[0]?.value}
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
                                    <label className="field-stack">
                                        <span className="field-label">Esedékesség</span>
                                        <input name="due_date" className="input" type="date" defaultValue={lastDayOfCurrentMonth()} required />
                                    </label>
                                    <label className="field-stack finance-composer-field-wide">
                                        <span className="field-label">Megnevezés</span>
                                        <input name="title" className="input" placeholder="Pl. MVM Next májusi számla" required />
                                    </label>
                                    <label className="field-stack finance-composer-field-wide">
                                        <span className="field-label">Megjegyzés</span>
                                        <textarea name="notes" className="input textarea" rows={3} placeholder="Opcionális megjegyzés a tételhez." />
                                    </label>
                                    <label className="field-stack">
                                        <span className="field-label">Összeg</span>
                                        <input name="amount" className="input" placeholder="Pl. 28 500" required />
                                    </label>
                                    <label className="field-stack finance-composer-field-wide">
                                        <span className="field-label">Számla / dokumentum</span>
                                        <input name="document" type="file" accept="application/pdf" className="input" />
                                        <span className="muted-note">Opcionális. A manuálisan rögzített tételhez PDF dokumentumot csatol.</span>
                                    </label>
                                    <label className="field-stack finance-composer-field-wide finance-recurring-toggle">
                                        <span className="field-label">Ismétlődés</span>
                                        <span className="finance-recurring-checkbox">
                                            <input
                                                type="checkbox"
                                                name="recurring"
                                                checked={isRecurring}
                                                onChange={(event) => setIsRecurring(event.target.checked)}
                                            />
                                            <span>Ismétlődő tétel</span>
                                        </span>
                                        {isRecurring ? (
                                            <div className="field-stack">
                                                <span className="field-label">Ismétlődések száma</span>
                                                <input
                                                    name="recurring_count"
                                                    className="input"
                                                    type="number"
                                                    min="2"
                                                    max="60"
                                                    inputMode="numeric"
                                                    value={recurringCount}
                                                    onChange={(event) => setRecurringCount(event.target.value)}
                                                    required
                                                />
                                            </div>
                                        ) : null}
                                        <span className="muted-note">Tipikusan bérleti díjhoz vagy fix havi költséghez hasznos.</span>
                                    </label>
                                </div>

                                <input type="hidden" name="currency" value="HUF" />

                                <div className="dashboard-modal-actions">
                                    <button type="button" className="btn btn-secondary" onClick={closeComposer}>Mégse</button>
                                    <button type="submit" className="btn btn-primary" disabled={isPending}>
                                        {isPending ? "Mentés..." : "Tétel létrehozása"}
                                    </button>
                                </div>
                                {manualError ? <p className="text-sm text-red-600">{manualError}</p> : null}
                                {manualSuccess ? <p className="text-sm text-green-600">{manualSuccess}</p> : null}
                            </form>
                        ) : (
                            <form className="dashboard-stack" onSubmit={handleUploadSubmit}>
                                <div className="dashboard-form-grid">
                                    <label className="field-stack">
                                        <span className="field-label">Ingatlan</span>
                                        <select name="property_id" className="select" defaultValue={defaultPropertyId} required>
                                            <option value="" disabled>Válassz ingatlant</option>
                                            {properties.map((property) => (
                                                <option key={property.id} value={property.id}>{propertyLabel(property)}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="field-stack">
                                        <span className="field-label">Import típus</span>
                                        <select name="import_mode" className="select" defaultValue={billingMode} onChange={(event) => setBillingMode(event.target.value as BillingMode)}>
                                            <option value="FORWARDED">Továbbított költség</option>
                                            <option value="OWN_EXPENSE">Saját költség</option>
                                        </select>
                                    </label>
                                </div>

                                <label className="field-stack">
                                    <span className="field-label">PDF számla</span>
                                    <div className="dashboard-upload-dropzone finance-composer-dropzone">
                                        <strong>Húzd ide a PDF-et</strong>
                                        <div className="muted-note">vagy válaszd ki manuálisan</div>
                                        <input name="document" type="file" accept="application/pdf" className="input" required />
                                    </div>
                                </label>

                                <div className="dashboard-modal-actions">
                                    <button type="button" className="btn btn-secondary" onClick={closeComposer}>Mégse</button>
                                    <button type="submit" className="btn btn-primary" disabled={isPending}>
                                        {isPending ? "Feldolgozás..." : "Feldolgozás indítása"}
                                    </button>
                                </div>
                                {uploadError ? <p className="text-sm text-red-600">{uploadError}</p> : null}
                                {uploadSuccess ? <p className="text-sm text-green-600">{uploadSuccess}</p> : null}
                            </form>
                        )}
                        <ActionPendingScreen active={isPending} label={mode === "manual" ? "Tétel mentése..." : "Számla feldolgozása..."} />
                    </div>
                </div>
            ) : null}
        </>
    );
}
