"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const STORAGE_KEY = "rentapp-public-cookie-notice-dismissed";
const PUBLIC_PATHS = new Set([
    "/",
    "/funkciok",
    "/hasznalati-dij",
    "/gyik",
    "/berbeadoi-regisztracio",
    "/otletlada",
    "/aszf",
]);

export default function PublicCookieNotice() {
    const pathname = usePathname();
    const [dismissed, setDismissed] = useState(() => {
        if (typeof window === "undefined") return true;
        return window.localStorage.getItem(STORAGE_KEY) === "1";
    });
    const isPublicPage = PUBLIC_PATHS.has(pathname);

    function closeNotice() {
        window.localStorage.setItem(STORAGE_KEY, "1");
        setDismissed(true);
    }

    if (!isPublicPage || dismissed) return null;

    return (
        <aside className="cookie-notice" aria-label="Cookie tájékoztató">
            <div className="cookie-notice-copy">
                <strong>Cookie tájékoztató</strong>
                <p>
                    Sütiket használunk az alapműködéshez és forgalomméréshez.
                    Részletek az <Link href="/aszf">ÁSZF-ben</Link>.
                </p>
            </div>
            <div className="cookie-notice-actions">
                <button
                    type="button"
                    className="cookie-notice-close"
                    onClick={closeNotice}
                    aria-label="Cookie tájékoztató bezárása"
                >
                    OK
                </button>
            </div>
        </aside>
    );
}
