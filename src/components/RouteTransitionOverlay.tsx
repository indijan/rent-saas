"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import LoadingOverlay from "@/components/LoadingOverlay";

function isPlainLeftClick(event: MouseEvent) {
    return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export default function RouteTransitionOverlay() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [pending, setPending] = useState(false);
    const timeoutRef = useRef<number | null>(null);
    const currentUrl = `${pathname}?${searchParams.toString()}`;

    useEffect(() => {
        const frameId = window.requestAnimationFrame(() => {
            setPending(false);
            if (timeoutRef.current) {
                window.clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [currentUrl]);

    useEffect(() => {
        const startPending = () => {
            setPending(true);
            if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
            timeoutRef.current = window.setTimeout(() => {
                setPending(false);
                timeoutRef.current = null;
            }, 15000);
        };

        const handleClick = (event: MouseEvent) => {
            if (!isPlainLeftClick(event)) return;
            const target = event.target instanceof Element ? event.target.closest("a") : null;
            if (!(target instanceof HTMLAnchorElement)) return;
            if (target.target && target.target !== "_self") return;
            if (target.hasAttribute("download")) return;

            const href = target.getAttribute("href");
            if (!href || href.startsWith("#")) return;

            const nextUrl = new URL(target.href, window.location.href);
            if (nextUrl.origin !== window.location.origin) return;
            if (nextUrl.pathname.endsWith("/export")) return;

            const nextState = `${nextUrl.pathname}${nextUrl.search}`;
            const currentState = `${window.location.pathname}${window.location.search}`;
            if (nextState === currentState) return;

            startPending();
        };

        const handleSubmit = (event: Event) => {
            const form = event.target instanceof HTMLFormElement ? event.target : null;
            if (!form) return;
            const method = (form.method || "get").toLowerCase();
            if (method !== "get") return;
            const actionUrl = new URL(form.action || window.location.href, window.location.href);
            if (actionUrl.origin !== window.location.origin) return;
            if (actionUrl.pathname !== window.location.pathname) return;

            const nextUrl = new URL(actionUrl.toString());
            const formData = new FormData(form);
            nextUrl.search = "";
            formData.forEach((value, key) => {
                if (typeof value === "string" && value) nextUrl.searchParams.set(key, value);
            });
            const nextState = `${nextUrl.pathname}${nextUrl.search}`;
            const currentState = `${window.location.pathname}${window.location.search}`;
            if (nextState === currentState) return;
            startPending();
        };

        window.addEventListener("click", handleClick, true);
        window.addEventListener("submit", handleSubmit, true);

        return () => {
            window.removeEventListener("click", handleClick, true);
            window.removeEventListener("submit", handleSubmit, true);
            if (timeoutRef.current) {
                window.clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return <LoadingOverlay active={pending} label="Betöltés..." sublabel="A következő nézet előkészítése folyamatban van." compact />;
}
