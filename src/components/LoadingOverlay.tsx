type Props = {
    active?: boolean;
    label?: string;
    sublabel?: string;
    compact?: boolean;
};

export default function LoadingOverlay({
    active = true,
    label = "Betöltés...",
    sublabel = "Kérlek várj, a rendszer éppen dolgozik.",
    compact = false,
}: Props) {
    if (!active) return null;

    return (
        <div className="loading-overlay-shell" aria-live="polite" aria-busy="true">
            <div className={`loading-overlay-card${compact ? " loading-overlay-card-compact" : ""}`}>
                <div className="loading-overlay-spinner" aria-hidden="true" />
                <div className="loading-overlay-copy">
                    <strong>{label}</strong>
                    <span>{sublabel}</span>
                </div>
            </div>
        </div>
    );
}
