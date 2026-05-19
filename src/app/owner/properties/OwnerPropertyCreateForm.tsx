"use client";

import AddressAutocompleteField from "@/components/AddressAutocompleteField";

type Props = {
    action: (formData: FormData) => Promise<void>;
};

export default function OwnerPropertyCreateForm({ action }: Props) {
    return (
        <form action={action} className="card form-shell">
            <div className="section-header">
                <div>
                    <div className="card-title">Új ingatlan felvétele</div>
                    <p className="muted-note">Az új ingatlan automatikusan aktív státuszban jön létre.</p>
                </div>
            </div>
            <div className="form-panel">
                <div className="form-grid">
                    <label className="field-stack">
                        <span className="field-label">Megnevezés</span>
                        <input
                            name="name"
                            placeholder="Pl. Belvárosi lakás"
                            className="input"
                            required
                        />
                    </label>
                    <AddressAutocompleteField
                        label="Cím"
                        placeholder="Kezdd el beírni a címet..."
                    />
                </div>
            </div>
            <button className="btn btn-primary">
                Ingatlan létrehozása
            </button>
        </form>
    );
}
