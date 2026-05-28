"use client";

import { usePathname, useSearchParams } from "next/navigation";
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
    const searchParams = useSearchParams();
    const [pendingFromPath, setPendingFromPath] = useState<string | null>(null);
    const isPublicPage = isPublicPath(pathname);
    const searchKey = searchParams.toString();

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

            setPendingFromPath(currentPath);
        };

        const handleSubmit = (event: SubmitEvent) => {
            if (!(event.target instanceof HTMLFormElement)) return;

            const method = (event.target.getAttribute("method") || "get").toUpperCase();
            if (method !== "GET") return;

            const action = event.target.getAttribute("action");
            const url = new URL(action || window.location.href, window.location.href);
            if (url.origin !== window.location.origin) return;

            setPendingFromPath(`${window.location.pathname}${window.location.search}`);
        };

        window.addEventListener("click", handleClick, true);
        window.addEventListener("submit", handleSubmit, true);

        return () => {
            window.removeEventListener("click", handleClick, true);
            window.removeEventListener("submit", handleSubmit, true);
        };
    }, [isPublicPage]);

    const currentPath = `${pathname}${searchKey ? `?${searchKey}` : ""}`;
    const visible = !isPublicPage && pendingFromPath !== null && currentPath === pendingFromPath;

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
