"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
    chargeId: string;
};

export default function UploadInvoice({ chargeId }: Props) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string>("");

    async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setBusy(true);
        setMsg("");

        try {
            const formData = new FormData();
            formData.append("chargeId", chargeId);
            formData.append("document", file);

            const response = await fetch("/api/charges/upload-invoice", {
                method: "POST",
                body: formData,
            });

            const json = await response.json();
            if (!response.ok || !json?.ok) {
                throw new Error(json?.error || "Dokumentum mentés sikertelen.");
            }

            setMsg("Feltöltve ✅");
            e.target.value = ""; // reset
            router.refresh();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            setMsg(`Hiba: ${message}`);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="flex items-center gap-3">
            <label className="btn btn-secondary btn-sm">
                {busy ? "Feltöltés..." : "Számla feltöltése"}
                <input
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={onPickFile}
                    disabled={busy}
                />
            </label>

            {msg ? <span className="text-xs text-gray-600">{msg}</span> : null}
        </div>
    );
}
