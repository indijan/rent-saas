"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCharge } from "./actions";

type Props = {
    propertyId: string;
};

export default function CreateChargeForm({ propertyId }: Props) {
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const formRef = useRef<HTMLFormElement | null>(null);
    const router = useRouter();

    function onSubmit(formData: FormData) {
        setError(null);
        startTransition(async () => {
            const res = await createCharge(propertyId, formData);
            if (!res.ok) {
                setError(res.error || "Nem sikerült a mentés.");
                return;
            }
            formRef.current?.reset();
            router.refresh();
        });
    }

    return (
        <form ref={formRef} action={onSubmit} className="card space-y-3">
            <div className="card-title">Új díj</div>
            <div className="grid gap-3 md:grid-cols-2">
                <input
                    name="title"
                    placeholder="Megnevezés (pl. Januári bérleti díj)"
                    className="input"
                    required
                />
                <select name="type" className="select" defaultValue="RENT">
                    <option value="RENT">RENT</option>
                    <option value="UTILITY">UTILITY</option>
                    <option value="COMMON_COST">COMMON_COST</option>
                    <option value="OTHER">OTHER</option>
                </select>

                <input
                    name="amount"
                    placeholder="Összeg"
                    className="input"
                    type="number"
                    step="0.01"
                    required
                />
                <input
                    name="due_date"
                    className="input"
                    type="date"
                    required
                />
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" name="recurring" />
                Ismétlődő díj (12 hónapra előre)
            </label>

            <button
                type="submit"
                className="btn btn-primary"
                disabled={isPending}
            >
                {isPending ? "Mentés..." : "Létrehozás"}
            </button>
            <p className="text-xs text-gray-600">(MVP: valuta fix HUF, státusz UNPAID.)</p>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
    );
}
