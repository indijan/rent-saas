export default function Loading() {
    return (
        <div className="route-loading-shell" aria-live="polite" aria-busy="true">
            <div className="route-loading-card route-loading-card-compact">
                <div className="route-loading-mark" aria-hidden="true">
                    R
                </div>
                <div className="route-loading-copy">
                    <span>Betöltés...</span>
                </div>
            </div>
        </div>
    );
}
