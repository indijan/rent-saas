"use client";

type Props = {
    action: () => Promise<void>;
    confirmMessage: string;
    children: React.ReactNode;
};

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
        </form>
    );
}
