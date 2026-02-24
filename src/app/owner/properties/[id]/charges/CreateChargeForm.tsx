"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createCharge, extractInvoiceData } from "./actions";
import { formatCurrency } from "@/lib/formatters";

type Props = {
    propertyId: string;
};

export default function CreateChargeForm({ propertyId }: Props) {
    const [error, setError] = useState<string | null>(null);
    const [debug, setDebug] = useState<string>("idle");
    const [clickCount, setClickCount] = useState(0);
    const [aiMessage, setAiMessage] = useState<string>("");
    const [aiBusy, setAiBusy] = useState(false);
    const [isPending, startTransition] = useTransition();
    const formRef = useRef<HTMLFormElement | null>(null);
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [type, setType] = useState("RENT");
    const [amount, setAmount] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [currency, setCurrency] = useState("HUF");

    async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setAiMessage("");
        setAiBusy(true);
        setError(null);

        try {
            const fd = new FormData();
            fd.append("document", file);
            const res = await extractInvoiceData(fd);
            if (!res.ok) {
                setAiMessage(res.error || "AI feldolgozás sikertelen.");
                return;
            }

            if (!res.ok || !("data" in res)) {
                setAiMessage(res.error || "AI feldolgozás sikertelen.");
                return;
            }
            const data = res.data;
            const hasAny =
                data?.amount !== null && data?.amount !== undefined ||
                Boolean(data?.due_date) ||
                Boolean(data?.type) ||
                Boolean(data?.currency) ||
                Boolean(data?.name);
            if (!hasAny) {
                setAiMessage("AI nem talált kitölthető adatot a PDF-ben.");
                return;
            }
            if (data?.amount !== null && data?.amount !== undefined) {
                setAmount(String(data.amount));
            }
            if (data?.due_date) setDueDate(data.due_date);
            if (data?.type) setType(data.type);
            if (data?.currency) setCurrency(data.currency);
            if (data?.name) setTitle(data.name);
            setAiMessage("AI kitöltés kész ✅");
        } catch (err: any) {
            setAiMessage(`AI hiba: ${err?.message ?? String(err)}`);
        } finally {
            setAiBusy(false);
        }
    }

    function onSubmit(formData: FormData) {
        setError(null);
        setDebug("submit started");
        startTransition(async () => {
            try {
                const res = await createCharge(propertyId, formData);
                if (!res.ok) {
                    const msg = res.error || "ismeretlen backend hiba";
                    setError(msg);
                    setDebug(`server responded: not ok (${msg})`);
                    return;
                }
                formRef.current?.reset();
                setTitle("");
                setType("RENT");
                setAmount("");
                setDueDate("");
                setCurrency("HUF");
                setAiMessage("");
                setDebug("server responded: ok");
                router.refresh();
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                setError(`Váratlan mentési hiba: ${message}`);
                setDebug(`exception: ${message}`);
            }
        });
    }

    function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
    }

    return (
        <form ref={formRef} onSubmit={handleSubmit} className="card space-y-3">
            <div className="card-title">Új díj</div>
            <div className="grid gap-3 md:grid-cols-2">
                <input
                    name="title"
                    placeholder="Megnevezés (pl. Januári bérleti díj)"
                    className="input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                />
                <select
                    name="type"
                    className="select"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                >
                    <option value="RENT">RENT</option>
                    <option value="UTILITY">UTILITY</option>
                    <option value="COMMON_COST">COMMON_COST</option>
                    <option value="OTHER">OTHER</option>
                </select>

                <input
                    name="amount"
                    placeholder="Összeg"
                    className="input"
                    type="text"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                />
                <input
                    name="due_date"
                    className="input"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                />
            </div>

            <div className="grid gap-2 md:grid-cols-2">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="file" name="document" accept="application/pdf" onChange={onPickFile} />
                    <span>{aiBusy ? "AI feldolgozás..." : "PDF számla feltöltése (AI kitöltés)"}</span>
                </label>
                <div className="text-xs text-gray-600">
                    {amount && currency
                        ? `Formázott összeg: ${formatCurrency(Number(amount.replace(/[^\d,.-]/g, "").replace(",", ".")), currency)}`
                        : "Valuta formázás automatikus."}
                </div>
            </div>

            {aiMessage ? <p className="text-xs text-gray-600">{aiMessage}</p> : null}
            <input type="hidden" name="currency" value={currency} />

            <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" name="recurring" />
                Ismétlődő díj (12 hónapra előre)
            </label>

            <button
                type="submit"
                className="btn btn-primary"
                disabled={isPending}
                onClick={() => {
                    setClickCount((prev) => prev + 1);
                    setDebug("button clicked");
                }}
            >
                {isPending ? "Mentés..." : "Létrehozás"}
            </button>
            <p className="text-xs text-gray-600">(MVP: valuta fix HUF, státusz UNPAID.)</p>
            <p className="text-xs text-gray-600">Debug: {debug} | clicks: {clickCount}</p>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
    );
}
