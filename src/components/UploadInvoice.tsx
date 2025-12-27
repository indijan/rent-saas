"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { createInvoiceDocument } from "@/components/UploadInvoiceActions";

type Props = {
    chargeId: string;
};

export default function UploadInvoice({ chargeId }: Props) {
    const supabase = supabaseBrowser;
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string>("");

    async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setBusy(true);
        setMsg("");

        try {
            const { data: userRes, error: userErr } = await supabase.auth.getUser();
            if (userErr) throw userErr;
            const user = userRes.user;
            if (!user) throw new Error("Nincs bejelentkezett user.");

            // Tárolási útvonal: ownerId/chargeId/timestamp-filename
            const safeName = file.name.replaceAll(" ", "_");
            const path = `${user.id}/${chargeId}/${Date.now()}-${safeName}`;

            const { error: upErr } = await supabase.storage
                .from("documents")
                .upload(path, file, { upsert: false });

            if (upErr) throw upErr;

            const res = await createInvoiceDocument(chargeId, path);
            if (!res.ok) throw new Error(res.error || "Dokumentum mentés sikertelen.");

            setMsg("Feltöltve ✅");
            e.target.value = ""; // reset
        } catch (err: any) {
            setMsg(`Hiba: ${err?.message ?? String(err)}`);
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
