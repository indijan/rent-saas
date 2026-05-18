"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function AuthRecoveryListener() {
    useEffect(() => {
        const run = async () => {
            if (typeof window === "undefined") return;
            if (!window.location.hash.includes("access_token")) return;

            const hash = new URLSearchParams(window.location.hash.slice(1));
            const accessToken = hash.get("access_token");
            const refreshToken = hash.get("refresh_token");
            const errorDescription = hash.get("error_description");
            const flowType = hash.get("type");

            if (errorDescription) {
                const message = encodeURIComponent(decodeURIComponent(errorDescription));
                window.location.replace(`/login?status=error&message=${message}`);
                return;
            }

            if (!accessToken || !refreshToken) return;

            await supabaseBrowser.auth.signOut();
            const { error } = await supabaseBrowser.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
            });

            if (error) {
                const message = encodeURIComponent(error.message);
                window.location.replace(`/login?status=error&message=${message}`);
                return;
            }

            window.history.replaceState({}, document.title, window.location.pathname + window.location.search);

            if (flowType === "recovery") {
                window.location.replace("/account?status=success&message=Add+meg+az+új+jelszavad.");
                return;
            }

            window.location.replace("/account");
        };

        run();
    }, []);

    return null;
}
