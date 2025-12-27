"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [msg, setMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

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
