"use client";

import { useState, useTransition } from "react";

type Props = {
    eyebrow?: string;
    title: string;
    description: string;
    pageContext: string;
    defaultEmail?: string;
    defaultName?: string | null;
    lockIdentity?: boolean;
};

export default function IdeaBoxForm({
    eyebrow,
    title,
    description,
    pageContext,
    defaultEmail = "",
    defaultName = "",
    lockIdentity = false,
}: Props) {
    const [pending, startTransition] = useTransition();
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
    const [message, setMessage] = useState("");
    const [email, setEmail] = useState(defaultEmail);
    const [fullName, setFullName] = useState(defaultName ?? "");
    const [featureName, setFeatureName] = useState("");
    const [details, setDetails] = useState("");

    return (
        <section className="card form-shell idea-box-shell">
            <div className="section-stack">
                <div>
                    {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
                    <h2>{title}</h2>
                    <p>{description}</p>
                </div>

                {message ? (
                    <div className={status === "error" ? "text-red-600" : "text-green-600"}>
                        {message}
                    </div>
                ) : null}

                <form
                    className="section-stack"
                    onSubmit={(event) => {
                        event.preventDefault();
                        setMessage("");
                        setStatus("idle");

                        const form = new FormData();
                        form.set("page_context", pageContext);
                        form.set("email", email);
                        form.set("full_name", fullName);
                        form.set("feature_name", featureName);
                        form.set("description", details);

                        startTransition(async () => {
                            const res = await fetch("/api/idea-submissions", {
                                method: "POST",
                                body: form,
                            });
                            const json = await res.json().catch(() => null);

                            if (!res.ok || !json?.ok) {
                                setStatus("error");
                                setMessage(json?.error || "Az ötlet elküldése nem sikerült.");
                                return;
                            }

                            setStatus("success");
                            setMessage("Köszönjük, az ötleted megérkezett.");
                            setFeatureName("");
                            setDetails("");
                        });
                    }}
                >
                    <div className="form-grid">
                        <label className="field-stack">
                            <span className="field-label">Funkció megnevezése</span>
                            <input
                                className="input"
                                name="feature_name"
                                placeholder="Például: Tömeges számlapublikálás"
                                required
                                value={featureName}
                                onChange={(event) => setFeatureName(event.target.value)}
                            />
                        </label>
                        <label className="field-stack">
                            <span className="field-label">E-mail-cím</span>
                            <input
                                className="input"
                                name="email"
                                type="email"
                                required
                                readOnly={lockIdentity}
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                            />
                        </label>
                    </div>

                    <div className="form-grid">
                        <label className="field-stack">
                            <span className="field-label">Név</span>
                            <input
                                className="input"
                                name="full_name"
                                placeholder="Opcionális"
                                readOnly={lockIdentity && Boolean(defaultName)}
                                value={fullName}
                                onChange={(event) => setFullName(event.target.value)}
                            />
                        </label>
                    </div>

                    <label className="field-stack">
                        <span className="field-label">Leírás</span>
                        <textarea
                            className="textarea"
                            name="description"
                            placeholder="Írd le, mire lenne szükséged, mi működik rosszul, vagy min változtatnál."
                            rows={6}
                            required
                            value={details}
                            onChange={(event) => setDetails(event.target.value)}
                        />
                    </label>

                    <div className="charge-actions">
                        <button className="btn btn-primary" type="submit" disabled={pending}>
                            {pending ? "Küldés folyamatban..." : "Ötlet elküldése"}
                        </button>
                        <span className="muted-note">
                            Ha többen is jelzik ugyanazt az igényt, külön díj nélkül belefejlesztjük.
                        </span>
                    </div>
                </form>
            </div>
        </section>
    );
}
