"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const SupportChatPanel = dynamic(() => import("@/components/SupportChatPanel"), {
    ssr: false,
});

export default function SupportChatWidget() {
    const [open, setOpen] = useState(false);
    const [bubbleHint, setBubbleHint] = useState(false);
    const hintTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        if (open) {
            const frameId = window.requestAnimationFrame(() => {
                setBubbleHint(false);
            });
            if (hintTimeoutRef.current !== null) {
                window.clearTimeout(hintTimeoutRef.current);
                hintTimeoutRef.current = null;
            }
            return () => window.cancelAnimationFrame(frameId);
        }

        const triggerHint = () => {
            if (document.hidden) return;
            setBubbleHint(true);
            if (hintTimeoutRef.current !== null) {
                window.clearTimeout(hintTimeoutRef.current);
            }
            hintTimeoutRef.current = window.setTimeout(() => {
                setBubbleHint(false);
                hintTimeoutRef.current = null;
            }, 2000);
        };

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                return;
            }
            if (hintTimeoutRef.current !== null) {
                window.clearTimeout(hintTimeoutRef.current);
                hintTimeoutRef.current = null;
            }
            setBubbleHint(false);
        };

        const interval = window.setInterval(triggerHint, 9000);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            if (hintTimeoutRef.current !== null) {
                window.clearTimeout(hintTimeoutRef.current);
                hintTimeoutRef.current = null;
            }
        };
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
