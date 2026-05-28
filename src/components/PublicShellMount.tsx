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
    const [noticePath, setNoticePath] = useState<string | null>(null);
    const [pixelPath, setPixelPath] = useState<string | null>(null);

    useEffect(() => {
        if (!isPublicPage) return;

        const hasCookieConsent = window.localStorage.getItem(PUBLIC_COOKIE_NOTICE_KEY) === "1";
        let noticeTimeoutId: number | null = null;
        let pixelTimeoutId: number | null = null;
        let pixelIdleId: number | null = null;

        const enablePixel = () => setPixelPath(pathname);
        const handleConsent = () => {
            setNoticePath(null);
            enablePixel();
        };

        if (hasCookieConsent) {
            if (typeof window.requestIdleCallback === "function") {
                pixelIdleId = window.requestIdleCallback(enablePixel, { timeout: 2500 });
            } else {
                pixelTimeoutId = window.setTimeout(enablePixel, 1200);
            }
        } else {
            noticeTimeoutId = window.setTimeout(() => {
                setNoticePath(pathname);
            }, 2200);
        }

        window.addEventListener(PUBLIC_COOKIE_EVENT, handleConsent);

        return () => {
            if (noticeTimeoutId !== null) {
                window.clearTimeout(noticeTimeoutId);
            }
            if (pixelTimeoutId !== null) {
                window.clearTimeout(pixelTimeoutId);
            }
            if (pixelIdleId !== null && typeof window.cancelIdleCallback === "function") {
                window.cancelIdleCallback(pixelIdleId);
            }
            window.removeEventListener(PUBLIC_COOKIE_EVENT, handleConsent);
        };
    }, [isPublicPage, pathname]);

    const showCookieNotice = isPublicPage && noticePath === pathname;
    const enableMetaPixel = isPublicPage && pixelPath === pathname;

    return (
        <>
            {enableMetaPixel ? <MetaPixel /> : null}
            {showCookieNotice ? <PublicCookieNotice /> : null}
        </>
    );
}
