"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function AuthCallbackPage() {
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const run = async () => {
            const params = new URLSearchParams(window.location.search);
            const next = params.get("next") || "/account";
            const code = params.get("code");

            let authError: string | null = null;
            if (code) {
                const { error } = await supabaseBrowser.auth.exchangeCodeForSession(code);
                authError = error?.message ?? null;
            } else {
                const { error } = await supabaseBrowser.auth.getSession();
                authError = error?.message ?? null;
            }

            if (authError) {
                setError(authError);
                return;
            }

            window.location.replace(next);
        };

        run();
    }, []);

    return (
        <main className="min-h-screen flex items-center justify-center p-6">
            <div className="card w-full max-w-sm space-y-3">
                <h1>Beléptetés...</h1>
                <p className="text-sm text-gray-600">
                    Folyamatban a fiók aktiválása.
                </p>
                {error ? (
                    <p className="text-sm text-red-600">
                        Hiba: {error}
                    </p>
                ) : null}
            </div>
        </main>
    );
}
