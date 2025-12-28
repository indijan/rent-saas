"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [msg, setMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const run = async () => {
            if (!window.location.hash.includes("access_token")) return;
            const hash = new URLSearchParams(window.location.hash.slice(1));
            const accessToken = hash.get("access_token");
            const refreshToken = hash.get("refresh_token");
            const errorDescription = hash.get("error_description");

            if (errorDescription) {
                setMsg(decodeURIComponent(errorDescription));
                return;
            }

            if (!accessToken || !refreshToken) return;

            setLoading(true);
            await supabaseBrowser.auth.signOut();
            const { error } = await supabaseBrowser.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
            });
            setLoading(false);

            if (error) {
                setMsg(error.message);
                return;
            }

            window.history.replaceState({}, document.title, "/login");
            window.location.replace("/account");
        };

        run();
    }, []);

    async function onLogin(e: React.FormEvent) {
        e.preventDefault();
        setMsg(null);
        setLoading(true);

        let { error } = await supabaseBrowser.auth.signInWithPassword({
            email,
            password,
        });

        if (error?.message?.toLowerCase().includes("refresh token")) {
            await supabaseBrowser.auth.signOut();
            const retry = await supabaseBrowser.auth.signInWithPassword({
                email,
                password,
            });
            error = retry.error;
        }

        setLoading(false);
        if (error) setMsg(error.message);
        else window.location.href = "/";
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-6">
            <form
                onSubmit={onLogin}
                className="card w-full max-w-sm space-y-4"
            >
                <h1>Bejelentkezés</h1>

                <div className="space-y-2">
                    <label className="text-sm">Email</label>
                    <input
                        className="input"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm">Jelszó</label>
                    <input
                        className="input"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>

                <button
                    className="btn btn-primary w-full"
                    disabled={loading}
                    type="submit"
                >
                    {loading ? "Beléptetés..." : "Belépés"}
                </button>

                {msg ? <p className="text-sm text-red-600">{msg}</p> : null}
            </form>
        </main>
    );
}
