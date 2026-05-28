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
        let idleId: number | null = null;

        const activate = () => setReady(true);

        if (typeof window.requestIdleCallback === "function") {
            idleId = window.requestIdleCallback(activate, { timeout: 4000 });
        } else {
            timeoutId = window.setTimeout(activate, 1800);
        }

        return () => {
            if (idleId !== null && typeof window.cancelIdleCallback === "function") {
                window.cancelIdleCallback(idleId);
            }
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
            }
        };
    }, []);

    return ready ? <SupportChatWidget /> : null;
}
