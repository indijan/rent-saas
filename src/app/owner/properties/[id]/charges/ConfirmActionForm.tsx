"use client";

import { useFormStatus } from "react-dom";
import ActionPendingScreen from "@/components/ActionPendingScreen";

type Props = {
    action: () => Promise<void>;
    confirmMessage: string;
    children: React.ReactNode;
};

function ConfirmActionPendingState() {
    const { pending } = useFormStatus();
    return <ActionPendingScreen active={pending} label="Művelet folyamatban..." />;
}

export default function ConfirmActionForm({ action, confirmMessage, children }: Props) {
    return (
        <form
            action={action}
            onSubmit={(event) => {
                if (!window.confirm(confirmMessage)) {
                    event.preventDefault();
                }
            }}
        >
            {children}
            <ConfirmActionPendingState />
        </form>
    );
}
