"use client";

import { useFormStatus } from "react-dom";

export default function ImportSubmitButton() {
    const { pending } = useFormStatus();

    return (
        <div className="section-stack items-start">
            <button className="btn btn-primary" type="submit" disabled={pending}>
                {pending ? "Feldolgozás folyamatban..." : "Feldolgozás indítása"}
            </button>
            {pending ? (
                <p className="muted-note">A számla feldolgozása elindult. Ne nyomd meg újra a gombot.</p>
            ) : null}
        </div>
    );
}
