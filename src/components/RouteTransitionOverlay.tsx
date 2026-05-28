"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isPublicPath } from "@/lib/publicShell";

function shouldHandleAnchor(target: EventTarget | null) {
    if (!(target instanceof Element)) return null;

    const anchor = target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return null;
    if (anchor.target && anchor.target !== "_self") return null;
    if (anchor.hasAttribute("download")) return null;

    return anchor;
}

export default function RouteTransitionOverlay() {
    const pathname = usePathname();
    const [pendingFromPath, setPendingFromPath] = useState<string | null>(null);
    const isPublicPage = isPublicPath(pathname);

    useEffect(() => {
        if (isPublicPage) {
            return;
        }

        const handleClick = (event: MouseEvent) => {
            if (
                event.defaultPrevented
                || event.button !== 0
                || event.metaKey
                || event.ctrlKey
                || event.shiftKey
                || event.altKey
            ) {
                return;
            }

            const anchor = shouldHandleAnchor(event.target);
            if (!anchor) return;

            const href = anchor.getAttribute("href");
            if (!href || href.startsWith("#")) return;

            const url = new URL(anchor.href, window.location.href);
            if (url.origin !== window.location.origin) return;

            const nextPath = `${url.pathname}${url.search}`;
            const currentPath = `${window.location.pathname}${window.location.search}`;
            if (nextPath === currentPath) return;

            setPendingFromPath(window.location.pathname);
        };

        window.addEventListener("click", handleClick, true);

        return () => {
            window.removeEventListener("click", handleClick, true);
        };
    }, [isPublicPage]);

    const visible = !isPublicPage && pendingFromPath !== null && pathname === pendingFromPath;

    if (!visible) return null;

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
