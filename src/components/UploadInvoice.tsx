"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ActionPendingScreen from "@/components/ActionPendingScreen";

type Props = {
    chargeId: string;
    variant?: "button" | "icon" | "mobile";
};

function UploadSimpleIcon() {
    return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 15V6.5" />
            <path d="m8.75 9.75 3.25-3.25 3.25 3.25" />
            <path d="M6.5 17.5h11" />
            <path d="M8 20h8" />
        </svg>
    );
}

export default function UploadInvoice({ chargeId, variant = "button" }: Props) {
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

    if (variant === "icon" || variant === "mobile") {
        return (
            <>
                <div className="dashboard-inline-upload">
                    <label
                        className={variant === "mobile" ? "dashboard-icon-button finance-mobile-action-button" : "dashboard-icon-button"}
                        aria-label={busy ? "Feltöltés..." : "Dokumentum feltöltése"}
                        title={busy ? "Feltöltés..." : "Dokumentum feltöltése"}
                        data-tooltip={busy ? "Feltöltés..." : "Dokumentum feltöltése"}
                    >
                        <UploadSimpleIcon />
                        {variant === "mobile" ? <span>{busy ? "Feltöltés..." : "Feltöltés"}</span> : null}
                        <input
                            type="file"
                            accept="application/pdf,image/*"
                            className="hidden"
                            onChange={onPickFile}
                            disabled={busy}
                        />
                    </label>
                    {msg ? <span className="dashboard-inline-upload-message">{msg}</span> : null}
                </div>
                <ActionPendingScreen active={busy} label="Dokumentum feltöltése..." />
            </>
        );
    }

    return (
        <>
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
            <ActionPendingScreen active={busy} label="Dokumentum feltöltése..." />
        </>
    );
}
