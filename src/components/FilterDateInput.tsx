"use client";

import { useState } from "react";

type Props = {
    name: string;
    defaultValue?: string;
    placeholder: string;
    className?: string;
};

export default function FilterDateInput({ name, defaultValue = "", placeholder, className = "" }: Props) {
    const [value, setValue] = useState(defaultValue);
    const [isDateMode, setIsDateMode] = useState(Boolean(defaultValue));

    return (
        <input
            name={name}
            type={isDateMode ? "date" : "text"}
            value={value}
            placeholder={placeholder}
            inputMode="numeric"
            className={className}
            onFocus={() => setIsDateMode(true)}
            onBlur={() => {
                if (!value) setIsDateMode(false);
            }}
            onChange={(event) => {
                const nextValue = event.target.value;
                setValue(nextValue);
                if (!nextValue) setIsDateMode(false);
            }}
        />
    );
}
