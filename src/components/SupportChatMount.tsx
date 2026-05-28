"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isPublicPath } from "@/lib/publicShell";

const SupportChatWidget = dynamic(() => import("@/components/SupportChatWidget"), {
    ssr: false,
});

export default function SupportChatMount() {
    const pathname = usePathname();
    const isPublicPage = isPublicPath(pathname);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!isPublicPage) {
            return;
        }

        let timeoutId: number | null = null;

        const activate = () => setReady(true);
        const handlePointerDown = () => activate();
        const handleKeyDown = () => activate();

        timeoutId = window.setTimeout(activate, 15000);
        window.addEventListener("pointerdown", handlePointerDown, { once: true, passive: true });
        window.addEventListener("keydown", handleKeyDown, { once: true });

        return () => {
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
            }
            window.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isPublicPage]);

    return isPublicPage && ready ? <SupportChatWidget /> : null;
}
