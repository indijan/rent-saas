"use client";

import Link from "next/link";
import { useState } from "react";
import { PUBLIC_COOKIE_EVENT, PUBLIC_COOKIE_NOTICE_KEY } from "@/lib/publicShell";

type Props = {
    initialDismissed: boolean;
};

export default function PublicCookieNotice({ initialDismissed }: Props) {
    const [dismissed, setDismissed] = useState(initialDismissed);

    function closeNotice() {
        window.localStorage.setItem(PUBLIC_COOKIE_NOTICE_KEY, "1");
        document.cookie = `${PUBLIC_COOKIE_NOTICE_KEY}=1; path=/; max-age=31536000; samesite=lax`;
        window.dispatchEvent(new Event(PUBLIC_COOKIE_EVENT));
        setDismissed(true);
    }

    if (dismissed) return null;

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
