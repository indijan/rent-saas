"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PUBLIC_COOKIE_NOTICE_KEY, isPublicPath } from "@/lib/publicShell";

declare global {
    interface Window {
        fbq?: (...args: unknown[]) => void;
    }
}

const META_PIXEL_ID = "398423612455658";
const COOKIE_EVENT = "rentapp:cookie-notice-dismissed";

export default function MetaPixel() {
    const pathname = usePathname();
    const [enabled, setEnabled] = useState(false);
    const initializedRef = useRef(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        function syncConsent() {
            const hasConsent = isPublicPath(pathname) && window.localStorage.getItem(PUBLIC_COOKIE_NOTICE_KEY) === "1";
            setEnabled(hasConsent);
        }

        syncConsent();
        window.addEventListener("storage", syncConsent);
        window.addEventListener(COOKIE_EVENT, syncConsent);

        return () => {
            window.removeEventListener("storage", syncConsent);
            window.removeEventListener(COOKIE_EVENT, syncConsent);
        };
    }, [pathname]);

    useEffect(() => {
        if (!enabled) return;

        if (!initializedRef.current) {
            initializedRef.current = true;
            return;
        }

        if (typeof window.fbq === "function") {
            window.fbq("track", "PageView");
        }
    }, [enabled, pathname]);

    if (!enabled) return null;

    return (
        <>
            <Script id="meta-pixel-base" strategy="afterInteractive">
                {`
                    !function(f,b,e,v,n,t,s)
                    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                    n.queue=[];t=b.createElement(e);t.async=!0;
                    t.src=v;s=b.getElementsByTagName(e)[0];
                    s.parentNode.insertBefore(t,s)}(window, document,'script',
                    'https://connect.facebook.net/en_US/fbevents.js');
                    fbq('init', '${META_PIXEL_ID}');
                    fbq('track', 'PageView');
                `}
            </Script>
            <noscript
                dangerouslySetInnerHTML={{
                    __html: `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1" alt="" />`,
                }}
            />
        </>
    );
}
