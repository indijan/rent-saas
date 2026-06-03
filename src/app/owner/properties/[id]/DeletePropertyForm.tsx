"use client";

import { useState } from "react";

type Props = {
    action: (formData: FormData) => Promise<void>;
    chargeCount: number;
    documentCount: number;
};

export default function DeletePropertyForm({ action, chargeCount, documentCount }: Props) {
    const [confirmation, setConfirmation] = useState("");
    const isReady = confirmation.trim() === "DELETE";

    return (
        <form
            action={action}
            onSubmit={(event) => {
                if (!isReady) {
                    event.preventDefault();
                    return;
                }
                if (!window.confirm("Biztosan törlöd az ingatlant? A kapcsolódó tételek és dokumentumok is végleg törlődnek.")) {
                    event.preventDefault();
                }
            }}
            className="card dashboard-section-card form-shell property-danger-card"
        >
            <div className="card-title">Ingatlan törlése</div>
            <p className="muted-note">
                A törlés végleges. A kapcsolódó {chargeCount} tétel és {documentCount} dokumentum is törlődni fog.
            </p>
            <label className="field-stack">
                <span className="field-label">Írd be, hogy DELETE</span>
                <input
                    className="input"
                    name="delete_confirmation"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="DELETE"
                    required
                />
            </label>
            <button className="btn btn-danger" disabled={!isReady}>
                Törlés
            </button>
            {!isReady ? <p className="muted-note">A törlés csak a pontos `DELETE` megerősítés után indítható.</p> : null}
        </form>
    );
}
