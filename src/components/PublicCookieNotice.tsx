"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PUBLIC_COOKIE_NOTICE_KEY, isPublicPath } from "@/lib/publicShell";

const COOKIE_EVENT = "rentapp:cookie-notice-dismissed";

export default function PublicCookieNotice() {
    const pathname = usePathname();
    const [dismissed, setDismissed] = useState(() => {
        if (typeof window === "undefined") return true;
        return window.localStorage.getItem(PUBLIC_COOKIE_NOTICE_KEY) === "1";
    });
    const isPublicPage = isPublicPath(pathname);

    function closeNotice() {
        window.localStorage.setItem(PUBLIC_COOKIE_NOTICE_KEY, "1");
        window.dispatchEvent(new Event(COOKIE_EVENT));
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
