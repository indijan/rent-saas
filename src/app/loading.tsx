export default function Loading() {
    return (
        <div className="route-loading-shell" aria-live="polite" aria-busy="true">
            <div className="route-loading-card">
                <div className="route-loading-mark" aria-hidden="true">
                    R
                </div>
                <div className="route-loading-copy">
                    <strong>Rentapp</strong>
                    <span>Töltés folyamatban...</span>
                </div>
            </div>
        </div>
    );
}
