"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useState } from "react";

const SupportChatPanel = dynamic(() => import("@/components/SupportChatPanel"), {
    ssr: false,
});

export default function SupportChatWidget() {
    const [open, setOpen] = useState(false);
    const [bubbleHint, setBubbleHint] = useState(false);

    useEffect(() => {
        if (open) return;

        const interval = window.setInterval(() => {
            setBubbleHint(true);
            window.setTimeout(() => setBubbleHint(false), 2000);
        }, 9000);

        return () => window.clearInterval(interval);
    }, [open]);

    return (
        <div className={`support-chat ${open ? "support-chat-open" : ""}`}>
            {open ? (
                <SupportChatPanel onClose={() => setOpen(false)} />
            ) : (
                <button
                    type="button"
                    className="support-bubble"
                    onClick={() => setOpen(true)}
                    aria-label="Rentapp asszisztens megnyitása"
                >
                    <span className={`support-bubble-orb ${bubbleHint ? "support-bubble-orb-hint" : ""}`}>
                        <span className="support-bubble-aura" aria-hidden="true" />
                        <span className="support-bubble-core">
                            <Image src="/rentapp-logo.png" alt="" width={32} height={32} className="support-bubble-logo" />
                        </span>
                        <span className="support-bubble-badge" aria-hidden="true">
                            {bubbleHint ? "AI" : "+"}
                        </span>
                    </span>
                </button>
            )}
        </div>
    );
}
