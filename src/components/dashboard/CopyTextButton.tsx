"use client";

import { useState } from "react";

type Props = {
    text: string;
    label?: string;
};

export default function CopyTextButton({ text, label = "Másolás" }: Props) {
    const [copied, setCopied] = useState(false);

    return (
        <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={async () => {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
            }}
        >
            {copied ? "Kimásolva" : label}
        </button>
    );
}
