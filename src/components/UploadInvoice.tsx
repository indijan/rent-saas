"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ActionPendingScreen from "@/components/ActionPendingScreen";

type Props = {
    chargeId: string;
    variant?: "button" | "icon" | "mobile";
};

function UploadCloudIcon() {
    return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V8" />
            <path d="m8.5 11.5 3.5-3.5 3.5 3.5" />
            <path d="M7 18.5h9" />
            <path d="M7 18.5A4.5 4.5 0 1 1 8.4 9.72 5.5 5.5 0 0 1 18.5 12.5 3.5 3.5 0 0 1 17 19H7" />
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
                        <UploadCloudIcon />
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
