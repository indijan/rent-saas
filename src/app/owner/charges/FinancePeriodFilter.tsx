"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

type PeriodPreset = "CURRENT_MONTH" | "LAST_30_DAYS" | "LAST_3_MONTHS" | "LAST_6_MONTHS" | "LAST_12_MONTHS" | "MAX" | "CUSTOM";

type Props = {
    property?: string;
    status?: string;
    type?: string;
    billing?: string;
    preset: PeriodPreset;
    from: string;
    to: string;
    propertyLabel: string;
};

const PERIOD_PRESET_OPTIONS: Array<{ value: PeriodPreset; label: string }> = [
    { value: "CURRENT_MONTH", label: "Aktuális hónap" },
    { value: "LAST_30_DAYS", label: "Elmúlt hónap" },
    { value: "LAST_3_MONTHS", label: "Elmúlt 3 hónap" },
    { value: "LAST_6_MONTHS", label: "Elmúlt fél év" },
    { value: "LAST_12_MONTHS", label: "Elmúlt 1 év" },
    { value: "MAX", label: "Maximum" },
    { value: "CUSTOM", label: "Egyedi időszak" },
];

function toDateInputValue(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function startOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

function shiftMonths(base: Date, months: number) {
    const next = new Date(base);
    next.setMonth(next.getMonth() + months);
    return next;
}

function startOfCurrentMonth() {
    const now = new Date();
    return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
}

function endOfCurrentMonth() {
    const now = new Date();
    return toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

function previousMonthRange() {
    const now = new Date();
    return {
        from: toDateInputValue(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
}

function canonicalRangeForPreset(preset: PeriodPreset) {
    const today = startOfToday();
    const todayValue = toDateInputValue(today);

    switch (preset) {
        case "LAST_30_DAYS":
            return previousMonthRange();
        case "LAST_3_MONTHS":
            return { from: toDateInputValue(shiftMonths(today, -3)), to: todayValue };
        case "LAST_6_MONTHS":
            return { from: toDateInputValue(shiftMonths(today, -6)), to: todayValue };
        case "LAST_12_MONTHS":
            return { from: toDateInputValue(shiftMonths(today, -12)), to: todayValue };
        case "MAX":
            return { from: "2000-01-01", to: todayValue };
        case "CUSTOM":
            return { from: startOfCurrentMonth(), to: endOfCurrentMonth() };
        default:
            return { from: startOfCurrentMonth(), to: endOfCurrentMonth() };
    }
}

function formatDisplayDate(dateValue: string) {
    return new Intl.DateTimeFormat("hu-HU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date(`${dateValue}T00:00:00`));
}

export default function FinancePeriodFilter({ property, status, type, billing, preset: initialPreset, from: initialFrom, to: initialTo, propertyLabel }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const [preset, setPreset] = useState<PeriodPreset>(initialPreset);
    const [from, setFrom] = useState(initialFrom);
    const [to, setTo] = useState(initialTo);

    const periodLabel = preset === "CUSTOM"
        ? `${formatDisplayDate(from)} - ${formatDisplayDate(to)}`
        : PERIOD_PRESET_OPTIONS.find((option) => option.value === preset)?.label ?? "Időszak";

    const buildHref = (nextPreset: PeriodPreset, nextFrom: string, nextTo: string) => {
        const params = new URLSearchParams();
        if (property) params.set("property", property);
        if (status) params.set("status", status);
        if (type) params.set("type", type);
        if (billing) params.set("billing", billing);
        params.set("preset", nextPreset);
        params.set("from", nextFrom);
        params.set("to", nextTo);
        return `${pathname}?${params.toString()}`;
    };

    const applyPreset = (nextPreset: PeriodPreset, nextFrom: string, nextTo: string) => {
        router.replace(buildHref(nextPreset, nextFrom, nextTo), { scroll: false });
    };

    return (
        <form
            method="GET"
            className="dashboard-period-chip finance-period-chip"
            onSubmit={(event) => {
                event.preventDefault();
                applyPreset("CUSTOM", from, to);
            }}
        >
            {property ? <input type="hidden" name="property" value={property} /> : null}
            {status ? <input type="hidden" name="status" value={status} /> : null}
            {type ? <input type="hidden" name="type" value={type} /> : null}
            {billing ? <input type="hidden" name="billing" value={billing} /> : null}
            <div className="finance-period-chip-meta">
                <span className="finance-period-chip-label">Időszak</span>
                <div className="finance-period-summary">
                    <strong>{periodLabel}</strong>
                    <span>{propertyLabel}</span>
                </div>
            </div>
            <div className={`finance-period-control-row${preset === "CUSTOM" ? " is-custom" : " is-instant"}`}>
                <select
                    name="preset"
                    className="select finance-period-select"
                    value={preset}
                    onChange={(event) => {
                        const nextPreset = event.target.value as PeriodPreset;
                        setPreset(nextPreset);
                        if (nextPreset !== "CUSTOM") {
                            const nextRange = canonicalRangeForPreset(nextPreset);
                            setFrom(nextRange.from);
                            setTo(nextRange.to);
                            applyPreset(nextPreset, nextRange.from, nextRange.to);
                        }
                    }}
                >
                    {PERIOD_PRESET_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
                <div className="finance-period-custom-grid">
                    <input
                        name="from"
                        type="date"
                        className="input input-date finance-period-date"
                        value={from}
                        onChange={(event) => {
                            const nextFrom = event.target.value;
                            setFrom(nextFrom);
                            if (preset !== "CUSTOM") setPreset("CUSTOM");
                        }}
                    />
                    <input
                        name="to"
                        type="date"
                        className="input input-date finance-period-date"
                        value={to}
                        onChange={(event) => {
                            const nextTo = event.target.value;
                            setTo(nextTo);
                            if (preset !== "CUSTOM") setPreset("CUSTOM");
                        }}
                    />
                </div>
            </div>
            {preset === "CUSTOM" ? (
                <div className="finance-period-chip-footer">
                    <button className="btn btn-primary btn-sm finance-period-apply-button" type="submit">Alkalmaz</button>
                </div>
            ) : null}
        </form>
    );
}
