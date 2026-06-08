"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const SupportChatWidget = dynamic(() => import("@/components/SupportChatWidget"), {
    ssr: false,
});

export default function SupportChatMount() {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (ready) return;

        let timeoutId: number | null = null;

        const activate = () => setReady(true);
        const handlePointerDown = () => activate();
        const handleKeyDown = () => activate();
        const scheduleActivation = () => {
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (document.hidden) return;
            timeoutId = window.setTimeout(activate, 2500);
        };
        const handleVisibilityChange = () => {
            if (document.hidden) {
                if (timeoutId !== null) {
                    window.clearTimeout(timeoutId);
                    timeoutId = null;
                }
                return;
            }
            scheduleActivation();
        };

        scheduleActivation();
        window.addEventListener("pointerdown", handlePointerDown, { once: true, passive: true });
        window.addEventListener("keydown", handleKeyDown, { once: true });
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
            }
            window.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [ready]);

    return ready ? <SupportChatWidget /> : null;
}
