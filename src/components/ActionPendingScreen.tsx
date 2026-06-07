"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import LoadingOverlay from "@/components/LoadingOverlay";

type Props = {
    active: boolean;
    label?: string;
};

export default function ActionPendingScreen({ active, label = "Művelet folyamatban..." }: Props) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const currentUrl = `${pathname}?${searchParams.toString()}`;
    const timeoutRef = useRef<number | null>(null);
    const [visible, setVisible] = useState(active);

    useEffect(() => {
        let frameId: number | null = null;

        if (!active) {
            frameId = window.requestAnimationFrame(() => {
                setVisible(false);
            });
            if (timeoutRef.current) {
                window.clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            return () => {
                if (frameId) window.cancelAnimationFrame(frameId);
            };
        }

        frameId = window.requestAnimationFrame(() => {
            setVisible(true);
        });
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = window.setTimeout(() => {
            setVisible(false);
            timeoutRef.current = null;
        }, 15000);

        return () => {
            if (frameId) {
                window.cancelAnimationFrame(frameId);
            }
            if (timeoutRef.current) {
                window.clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, [active]);

    useEffect(() => {
        const frameId = window.requestAnimationFrame(() => {
            setVisible(false);
            if (timeoutRef.current) {
                window.clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [currentUrl]);

    return <LoadingOverlay active={visible} label={label} compact />;
}
