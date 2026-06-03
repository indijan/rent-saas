"use client";

import LoadingOverlay from "@/components/LoadingOverlay";

type Props = {
    active: boolean;
    label?: string;
};

export default function ActionPendingScreen({ active, label = "Művelet folyamatban..." }: Props) {
    return <LoadingOverlay active={active} label={label} />;
}
