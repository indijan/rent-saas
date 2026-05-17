"use client";

import { useState, useTransition, type FormEvent } from "react";
import { updateCharge } from "./actions";

type Props = {
    charge: {
        id: string;
        title: string;
        type: string;
        amount: number | string;
        currency: string | null;
        due_date: string;
    };
};

export default function EditChargeForm({ charge }: Props) {
    const [message, setMessage] = useState<string | null>(null);
    const [isError, setIsError] = useState(false);
    const [isPending, startTransition] = useTransition();

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
        });
    }

    return (
        <details className="w-full rounded-xl border border-black/10 bg-white/60 p-3">
            <summary className="btn btn-secondary btn-sm cursor-pointer">
                Tétel szerkesztése
            </summary>
            <form onSubmit={handleSubmit} className="mt-3 grid gap-2 md:grid-cols-2">
                <input
                    name="title"
                    defaultValue={charge.title}
                    className="input"
                    required
                />
                <select
                    name="type"
                    defaultValue={charge.type}
                    className="select"
                >
                    <option value="RENT">Bérleti díj</option>
                    <option value="UTILITY">Rezsi</option>
                    <option value="COMMON_COST">Közös költség</option>
                    <option value="OTHER">Egyéb</option>
                </select>
                <input
                    name="amount"
                    defaultValue={String(charge.amount)}
                    className="input"
                    type="text"
                    required
                />
                <input
                    name="due_date"
                    defaultValue={charge.due_date}
                    className="input"
                    type="date"
                    required
                />
                <input
                    name="currency"
                    defaultValue={charge.currency || "HUF"}
                    className="input"
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={isPending}>
                    {isPending ? "Mentés..." : "Mentés státuszmódosítás nélkül"}
                </button>
                <div className="muted-note">A mentés csak a mezőket frissíti, a státuszt nem.</div>
                {message ? (
                    <div className={`text-sm ${isError ? "text-red-600" : "text-green-600"}`}>{message}</div>
                ) : null}
            </form>
        </details>
    );
}
