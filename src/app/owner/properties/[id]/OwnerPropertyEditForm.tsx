"use client";

import AddressAutocompleteField from "@/components/AddressAutocompleteField";

type Props = {
    action: (formData: FormData) => Promise<void>;
    name: string;
    address: string;
    status: string;
};

export default function OwnerPropertyEditForm({ action, name, address, status }: Props) {
    return (
        <form action={action} className="card form-shell">
            <div className="section-header">
                <div>
                    <div className="card-title">Ingatlan szerkesztése</div>
                    <p className="muted-note">Az alapadatok és az aktív állapot innen módosítható.</p>
                </div>
            </div>
            <div className="form-panel">
                <div className="form-grid">
                    <label className="field-stack">
                        <span className="field-label">Megnevezés</span>
                        <input
                            name="name"
                            className="input"
                            defaultValue={name}
                            required
                        />
                    </label>
                    <AddressAutocompleteField
                        label="Cím"
                        defaultValue={address}
                        placeholder="Kezdd el beírni a címet..."
                    />
                    <label className="field-stack">
                        <span className="field-label">Státusz</span>
                        <select
                            name="status"
                            className="select"
                            defaultValue={status}
                        >
                            <option value="ACTIVE">Aktív</option>
                            <option value="INACTIVE">Inaktív</option>
                        </select>
                    </label>
                </div>
            </div>
            <button className="btn btn-primary">
                Módosítás mentése
            </button>
        </form>
    );
}
