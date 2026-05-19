"use client";

import { useEffect, useId, useRef, useState } from "react";

type AddressSuggestion = {
    formatted: string;
    city: string;
    street: string;
    housenumber: string;
};

type Props = {
    name?: string;
    validationName?: string;
    label: string;
    placeholder?: string;
    defaultValue?: string;
};

export default function AddressAutocompleteField({
    name = "address",
    validationName = "address_selected",
    label,
    placeholder,
    defaultValue = "",
}: Props) {
    const listId = useId();
    const rootRef = useRef<HTMLDivElement | null>(null);
    const [query, setQuery] = useState(defaultValue);
    const [selected, setSelected] = useState(Boolean(defaultValue));
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [results, setResults] = useState<AddressSuggestion[]>([]);

    useEffect(() => {
        const controller = new AbortController();

        if (query.trim().length < 3 || selected) {
            setResults([]);
            setBusy(false);
            return () => controller.abort();
        }

        const timeout = window.setTimeout(async () => {
            setBusy(true);
            setError("");
            try {
                const response = await fetch(`/api/address-autocomplete?q=${encodeURIComponent(query)}`, {
                    signal: controller.signal,
                });
                const json = await response.json();
                if (!response.ok || !json?.ok) {
                    throw new Error(json?.error || "A címkereső nem érhető el.");
                }
                setResults(Array.isArray(json.results) ? json.results : []);
                setOpen(true);
            } catch (err) {
                if (controller.signal.aborted) return;
                setResults([]);
                setOpen(false);
                setError(err instanceof Error ? err.message : "A címkereső nem érhető el.");
            } finally {
                if (!controller.signal.aborted) {
                    setBusy(false);
                }
            }
        }, 250);

        return () => {
            controller.abort();
            window.clearTimeout(timeout);
        };
    }, [query, selected]);

    useEffect(() => {
        function handleClick(event: MouseEvent) {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    function chooseSuggestion(suggestion: AddressSuggestion) {
        setQuery(suggestion.formatted);
        setSelected(true);
        setOpen(false);
        setResults([]);
        setError("");
    }

    return (
        <div ref={rootRef} className="field-stack address-field">
            <span className="field-label">{label}</span>
            <input type="hidden" name={name} value={query} />
            <input type="hidden" name={validationName} value={selected ? "1" : "0"} />
            <input
                className="input"
                placeholder={placeholder}
                value={query}
                autoComplete="off"
                aria-autocomplete="list"
                aria-controls={listId}
                onChange={(event) => {
                    setQuery(event.target.value);
                    setSelected(false);
                    setOpen(true);
                }}
                onFocus={() => {
                    if (results.length > 0) {
                        setOpen(true);
                    }
                }}
                required
            />
            <div className="address-field-feedback">
                {busy ? <span className="muted-note">Címek keresése...</span> : null}
                {!busy && selected && query ? <span className="muted-note text-green-600">Kiválasztott cím.</span> : null}
                {!busy && !selected && query.length >= 3 ? <span className="muted-note">Válassz a listából egy pontos címet.</span> : null}
                {error ? <span className="text-sm text-red-600">{error}</span> : null}
            </div>
            {open && results.length > 0 ? (
                <div id={listId} className="address-suggestions" role="listbox">
                    {results.map((suggestion) => (
                        <button
                            key={suggestion.formatted}
                            type="button"
                            className="address-suggestion"
                            onClick={() => chooseSuggestion(suggestion)}
                        >
                            <strong>{suggestion.street || suggestion.formatted}</strong>
                            <span>{suggestion.formatted}</span>
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
