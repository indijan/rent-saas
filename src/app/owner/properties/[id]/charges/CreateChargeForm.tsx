"use client";

import Link from "next/link";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createCharge } from "./actions";
import { formatCurrency } from "@/lib/formatters";

type Props = {
    propertyId: string;
};

export default function CreateChargeForm({ propertyId }: Props) {
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const formRef = useRef<HTMLFormElement | null>(null);
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [type, setType] = useState("RENT");
    const [amount, setAmount] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [currency, setCurrency] = useState("HUF");

    function onSubmit(formData: FormData) {
        setError(null);
        setSuccess(null);
        startTransition(async () => {
            try {
                const res = await createCharge(propertyId, formData);
                if (!res.ok) {
                    const msg = res.error || "ismeretlen backend hiba";
                    setError(msg);
                    return;
                }
                formRef.current?.reset();
                setTitle("");
                setType("RENT");
                setAmount("");
                setDueDate("");
                setCurrency("HUF");
                setSuccess("A díj sikeresen létrejött.");
                router.refresh();
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                setError(`Váratlan mentési hiba: ${message}`);
            }
        });
    }

    function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
    }

    return (
        <form ref={formRef} onSubmit={handleSubmit} className="card form-shell">
            <div className="section-header">
                <div>
                    <div className="eyebrow">Új tétel rögzítése</div>
                    <div className="card-title">Új díj létrehozása</div>
                    <p className="muted-note">Kézzel vagy PDF alapján is feltöltheted. A rögzített tétel aktív, nem fizetett státuszban jön létre.</p>
                </div>
                <div className="info-strip">
                    <span>Valuta: {currency}</span>
                    <span>{amount && currency
                        ? `Formázott összeg: ${formatCurrency(Number(amount.replace(/[^\d,.-]/g, "").replace(",", ".")), currency)}`
                        : "Az összeg itt rögtön ellenőrizhető."}</span>
                </div>
            </div>

            <div className="form-panel form-shell">
                <div className="card-title">Alapadatok</div>
                <div className="form-grid">
                    <label className="field-stack">
                        <span className="field-label">Megnevezés</span>
                        <input
                            name="title"
                            placeholder="Pl. Júniusi bérleti díj"
                            className="input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                    </label>

                    <label className="field-stack">
                        <span className="field-label">Típus</span>
                        <select
                            name="type"
                            className="select"
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                        >
                            <option value="RENT">Bérleti díj</option>
                            <option value="UTILITY">Rezsi</option>
                            <option value="COMMON_COST">Közös költség</option>
                            <option value="OTHER">Egyéb</option>
                        </select>
                    </label>

                    <label className="field-stack">
                        <span className="field-label">Összeg</span>
                        <input
                            name="amount"
                            placeholder="Pl. 49 760"
                            className="input"
                            type="text"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                    </label>

                    <label className="field-stack">
                        <span className="field-label">Esedékesség</span>
                        <input
                            name="due_date"
                            className="input"
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            required
                        />
                    </label>
                </div>
            </div>

            <div className="form-panel form-shell">
                <div className="card-title">PDF import</div>
                <div className="info-strip">
                    <span>A PDF alapú számlaimport most már külön ingestion folyon keresztül megy.</span>
                    <span>Ha számlából akarsz draftot készíteni, azt az Importok oldalon indítsd.</span>
                </div>
                <div className="charge-actions">
                    <Link className="btn btn-secondary" href="/owner/importok">
                        Importok megnyitása
                    </Link>
                </div>
            </div>

            <div className="form-panel form-shell">
                <div className="card-title">Ismétlődés</div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" name="recurring" />
                    Ismétlődő díj 12 hónapra előre
                </label>
                <p className="muted-note">Tipikusan bérleti díjhoz vagy fix rezsihez hasznos.</p>
            </div>

            <input type="hidden" name="currency" value={currency} />

            <div className="charge-actions">
                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isPending}
                >
                    {isPending ? "Mentés..." : "Díj létrehozása"}
                </button>
                {error ? <p className="text-sm text-red-600">{error}</p> : null}
                {success ? <p className="text-sm text-green-600">{success}</p> : null}
            </div>
        </form>
    );
}
