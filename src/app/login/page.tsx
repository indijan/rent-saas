"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [msg, setMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [resetSending, setResetSending] = useState(false);

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
            else window.location.href = "/dashboard";
    }

    async function onResetPassword() {
        if (!email.trim()) {
            setMsg("Add meg az e-mail-címed a jelszó-visszaállításhoz.");
            return;
        }

        setMsg(null);
        setResetSending(true);
        const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/account?status=success&message=Add+meg+az+új+jelszavad.")}`;
        const { error } = await supabaseBrowser.auth.resetPasswordForEmail(email.trim(), {
            redirectTo,
        });
        setResetSending(false);

        if (error) {
            setMsg(error.message);
            return;
        }

        setMsg("Kiküldtem a jelszó-visszaállító e-mailt.");
    }

    return (
        <main className="auth-shell page-enter">
            <div className="auth-frame">
                <section className="auth-hero">
                    <div className="eyebrow">Rentapp</div>
                    <h1>Átlátható bérbeadás, rendezett díjkezelés.</h1>
                    <p>
                        A tulajdonosi és bérlői felületet közös nevezőre hozzuk:
                        mi aktív, mi közeleg, mi lejárt és mi lett már rendezve.
                    </p>
                    <div className="kpi-grid" style={{ marginTop: 24 }}>
                        <div className="kpi-card" style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.12)" }}>
                            <div className="kpi-label" style={{ color: "rgba(239,246,255,0.72)" }}>Tulajdonosi nézet</div>
                            <div className="kpi-value" style={{ color: "#eff6ff" }}>Díjak, ingatlanok, bérlők</div>
                        </div>
                        <div className="kpi-card" style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.12)" }}>
                            <div className="kpi-label" style={{ color: "rgba(239,246,255,0.72)" }}>Bérlői nézet</div>
                            <div className="kpi-value" style={{ color: "#eff6ff" }}>Esedékesség, dokumentumok, állapotok</div>
                        </div>
                    </div>
                </section>

                <form
                    onSubmit={onLogin}
                    className="auth-card form-shell"
                >
                    <div>
                        <div className="eyebrow">Belépés</div>
                        <h1>Jelentkezz be</h1>
                        <p className="muted-note">A saját szerepköröd szerinti felületre irányítunk tovább.</p>
                    </div>

                    <div className="form-panel">
                        <div className="form-grid">
                            <label className="field-stack">
                                <span className="field-label">Email</span>
                                <input
                                    className="input"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </label>

                            <label className="field-stack">
                                <span className="field-label">Jelszó</span>
                                <input
                                    className="input"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </label>
                        </div>
                    </div>

                    <button
                        className="btn btn-primary w-full"
                        disabled={loading}
                        type="submit"
                    >
                        {loading ? "Beléptetés..." : "Belépés"}
                    </button>

                    <button
                        className="btn btn-secondary w-full"
                        disabled={resetSending || loading}
                        type="button"
                        onClick={onResetPassword}
                    >
                        {resetSending ? "Küldés..." : "Elfelejtett jelszó"}
                    </button>

                    {msg ? <p className="text-sm text-red-600">{msg}</p> : null}
                </form>
            </div>
        </main>
    );
}
