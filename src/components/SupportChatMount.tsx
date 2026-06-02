"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const SupportChatWidget = dynamic(() => import("@/components/SupportChatWidget"), {
    ssr: false,
});

export default function SupportChatMount() {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let timeoutId: number | null = null;

        const activate = () => setReady(true);
        const handlePointerDown = () => activate();
        const handleKeyDown = () => activate();

        timeoutId = window.setTimeout(activate, 2500);
        window.addEventListener("pointerdown", handlePointerDown, { once: true, passive: true });
        window.addEventListener("keydown", handleKeyDown, { once: true });

        return () => {
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
            }
            window.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    return ready ? <SupportChatWidget /> : null;
}
