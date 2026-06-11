"use client";

import Link from "next/link";
import { useState } from "react";

type Suggestion = {
    suggestionKey: string;
    propertyId: string;
    propertyName: string | null;
    title: string;
    expectedDate: string;
    lastSeenDate: string;
    daysLate: number;
    cadenceDays: number;
    confidence: "high" | "medium";
};

type Props = {
    ownerId: string;
    suggestions: Suggestion[];
};

const STORAGE_PREFIX = "rentapp-hidden-invoice-suggestions";

function readHiddenSuggestionKeys(storageKey: string) {
    if (typeof window === "undefined") {
        return [] as string[];
    }

    const saved = window.localStorage.getItem(storageKey);
    if (!saved) {
        return [] as string[];
    }

    try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
    } catch {
        window.localStorage.removeItem(storageKey);
        return [] as string[];
    }
}

function formatIsoDate(dateValue: string) {
    return new Intl.DateTimeFormat("hu-HU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date(`${dateValue}T00:00:00`));
}

export default function TodoInvoiceSuggestions({ ownerId, suggestions }: Props) {
    const storageKey = `${STORAGE_PREFIX}:${ownerId}`;
    const [hiddenKeys, setHiddenKeys] = useState<string[]>(() => readHiddenSuggestionKeys(storageKey));
    const visibleSuggestions = suggestions.filter((suggestion) => !hiddenKeys.includes(suggestion.suggestionKey));

    function dismissSuggestion(suggestionKey: string) {
        setHiddenKeys((current) => {
            if (current.includes(suggestionKey)) {
                return current;
            }

            const next = [...current, suggestionKey];
            window.localStorage.setItem(storageKey, JSON.stringify(next));
            return next;
        });
    }

    if (visibleSuggestions.length === 0) {
        return <div className="dashboard-empty-note">Jelenleg nincs nyitott számla tétel javaslat.</div>;
    }

    return (
        <div className="todo-link-list">
            {visibleSuggestions.slice(0, 6).map((suggestion) => (
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
                        <div className="todo-task-meta todo-suggestion-badges">
                            <span className={`dashboard-inline-badge ${suggestion.daysLate > 7 ? "dashboard-inline-badge-red" : "dashboard-inline-badge-amber"}`}>
                                {suggestion.daysLate} nap csúszás
                            </span>
                            <span className={`dashboard-inline-badge ${suggestion.confidence === "high" ? "dashboard-inline-badge-green" : "dashboard-inline-badge-blue"}`}>
                                {suggestion.confidence === "high" ? "Erős minta" : "Közepes minta"}
                            </span>
                        </div>
                    </div>
                    <div className="todo-task-actions todo-suggestion-actions">
                        <Link className="btn btn-primary btn-sm" href={`/owner/charges?property=${suggestion.propertyId}&billing=OWN&compose=manual`}>
                            Tétel rögzítése
                        </Link>
                        <Link className="btn btn-secondary btn-sm" href={`/owner/charges?property=${suggestion.propertyId}&billing=OWN`}>
                            Pénzügyek megnyitása
                        </Link>
                        <button
                            className="btn btn-ghost btn-sm"
                            type="button"
                            onClick={() => dismissSuggestion(suggestion.suggestionKey)}
                        >
                            Elvetés
                        </button>
                    </div>
                </article>
            ))}
        </div>
    );
}
