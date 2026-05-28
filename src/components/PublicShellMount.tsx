"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PUBLIC_COOKIE_EVENT, PUBLIC_COOKIE_NOTICE_KEY, isPublicPath } from "@/lib/publicShell";

const PublicCookieNotice = dynamic(() => import("@/components/PublicCookieNotice"), {
    ssr: false,
});

const MetaPixel = dynamic(() => import("@/components/MetaPixel"), {
    ssr: false,
});

export default function PublicShellMount() {
    const pathname = usePathname();
    const isPublicPage = isPublicPath(pathname);
    const [hasConsent, setHasConsent] = useState(() => {
        if (typeof window === "undefined") return false;
        return window.localStorage.getItem(PUBLIC_COOKIE_NOTICE_KEY) === "1";
    });
    const [pixelPath, setPixelPath] = useState<string | null>(null);

    useEffect(() => {
        if (!isPublicPage) {
            return;
        }

        let pixelTimeoutId: number | null = null;
        let pixelIdleId: number | null = null;

        const clearPixelTimers = () => {
            if (pixelTimeoutId !== null) {
                window.clearTimeout(pixelTimeoutId);
            }
            if (pixelIdleId !== null && typeof window.cancelIdleCallback === "function") {
                window.cancelIdleCallback(pixelIdleId);
            }
        };

        const enablePixel = () => setPixelPath(pathname);
        const schedulePixel = () => {
            clearPixelTimers();
            if (typeof window.requestIdleCallback === "function") {
                pixelIdleId = window.requestIdleCallback(enablePixel, { timeout: 4000 });
            } else {
                pixelTimeoutId = window.setTimeout(enablePixel, 2500);
            }
        };

        const handleConsent = () => {
            setHasConsent(true);
            schedulePixel();
        };

        if (hasConsent) {
            if (document.readyState === "complete") {
                schedulePixel();
            } else {
                window.addEventListener("load", schedulePixel, { once: true });
            }
        }

        window.addEventListener(PUBLIC_COOKIE_EVENT, handleConsent);

        return () => {
            window.removeEventListener("load", schedulePixel);
            clearPixelTimers();
            window.removeEventListener(PUBLIC_COOKIE_EVENT, handleConsent);
        };
    }, [hasConsent, isPublicPage, pathname]);

    const showCookieNotice = isPublicPage && hasConsent === false;
    const enableMetaPixel = isPublicPage && pixelPath === pathname;

    return (
        <>
            {enableMetaPixel ? <MetaPixel /> : null}
            {showCookieNotice ? <PublicCookieNotice /> : null}
        </>
    );
}
