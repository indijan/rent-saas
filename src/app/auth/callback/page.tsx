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
            const hash = window.location.hash.startsWith("#")
                ? new URLSearchParams(window.location.hash.slice(1))
                : new URLSearchParams();
            const accessToken = hash.get("access_token");
            const refreshToken = hash.get("refresh_token");
            const errorDescription = hash.get("error_description");

            let authError: string | null = null;
            if (errorDescription) {
                authError = decodeURIComponent(errorDescription);
            } else if (code) {
                const { error } = await supabaseBrowser.auth.exchangeCodeForSession(code);
                authError = error?.message ?? null;
            } else if (accessToken && refreshToken) {
                const { error } = await supabaseBrowser.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });
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
