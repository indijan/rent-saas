"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PUBLIC_COOKIE_EVENT } from "@/lib/publicShell";

const MetaPixel = dynamic(() => import("@/components/MetaPixel"), {
    ssr: false,
});

type Props = {
    initialConsent: boolean;
};

export default function PublicAnalyticsMount({ initialConsent }: Props) {
    const pathname = usePathname();
    const [hasConsent, setHasConsent] = useState(initialConsent);
    const [pixelPath, setPixelPath] = useState<string | null>(null);

    useEffect(() => {
        const handleConsent = () => setHasConsent(true);
        window.addEventListener(PUBLIC_COOKIE_EVENT, handleConsent);

        return () => {
            window.removeEventListener(PUBLIC_COOKIE_EVENT, handleConsent);
        };
    }, []);

    useEffect(() => {
        if (!hasConsent) {
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

        if (document.readyState === "complete") {
            schedulePixel();
        } else {
            window.addEventListener("load", schedulePixel, { once: true });
        }

        return () => {
            window.removeEventListener("load", schedulePixel);
            clearPixelTimers();
        };
    }, [hasConsent, pathname]);

    return (
        <>
            {pixelPath === pathname ? <MetaPixel /> : null}
        </>
    );
}
