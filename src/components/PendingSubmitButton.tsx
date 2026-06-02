"use client";

import { useFormStatus } from "react-dom";
import ActionPendingScreen from "@/components/ActionPendingScreen";

type Props = {
    label: string;
    pendingLabel?: string;
    className?: string;
    disabled?: boolean;
};

export default function PendingSubmitButton({ label, pendingLabel, className, disabled = false }: Props) {
    const { pending } = useFormStatus();

    return (
        <>
            <button
                type="submit"
                className={className}
                disabled={disabled || pending}
                aria-disabled={disabled || pending}
            >
                {pending ? (pendingLabel || `${label}...`) : label}
            </button>
            <ActionPendingScreen active={pending} label={pendingLabel || `${label}...`} />
        </>
    );
}
