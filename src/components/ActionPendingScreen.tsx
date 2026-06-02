"use client";

type Props = {
    active: boolean;
    label?: string;
};

export default function ActionPendingScreen({ active, label = "Művelet folyamatban..." }: Props) {
    if (!active) return null;

    return (
        <div className="action-pending-screen" aria-live="polite" aria-busy="true">
            <div className="action-pending-card">
                <div className="action-pending-spinner" aria-hidden="true" />
                <strong>{label}</strong>
                <span>Kérlek várj, a rendszer éppen dolgozik.</span>
            </div>
        </div>
    );
}
