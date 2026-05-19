"use client";

import { useEffect, useMemo, useState } from "react";

type ChatMessage = {
    role: "user" | "assistant";
    content: string;
};

const starterPrompts = [
    "Hogyan működik a számlaimport?",
    "Mit lát a bérlő és mit a bérbeadó?",
    "Mit tegyek, ha nem működik a jelszó-visszaállítás?",
    "Hogyan tudok dokumentumot letölteni?",
];

const fallbackLinks = {
    whatsapp: "https://wa.me/64275665850",
    messenger: "https://m.me/indijanmac",
};

export default function SupportChatWidget() {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [bubbleHint, setBubbleHint] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    useEffect(() => {
        if (open) return;

        const interval = window.setInterval(() => {
            setBubbleHint(true);
            window.setTimeout(() => setBubbleHint(false), 2000);
        }, 9000);

        return () => window.clearInterval(interval);
    }, [open]);

    const hasConversation = messages.length > 0;
    const quickActions = useMemo(() => starterPrompts.filter((prompt) => !messages.some((message) => message.content === prompt)), [messages]);

    async function sendMessage(text: string) {
        const trimmed = text.trim();
        if (!trimmed || loading) return;

        const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
        setMessages(nextMessages);
        setInput("");
        setLoading(true);

        try {
            const res = await fetch("/api/support-chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ messages: nextMessages }),
            });

            const json = await res.json();
            if (!res.ok) {
                throw new Error(json?.error || "Az asszisztens jelenleg nem érhető el.");
            }

            setMessages((current) => [
                ...current,
                {
                    role: "assistant",
                    content: String(json.answer || "Most nem tudtam válaszolni."),
                },
            ]);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Az asszisztens jelenleg nem érhető el.";
            setMessages((current) => [
                ...current,
                {
                    role: "assistant",
                    content:
                        `${message}\n\nKözvetlen segítség:\nWhatsApp: ${fallbackLinks.whatsapp}\nMessenger: ${fallbackLinks.messenger}`,
                },
            ]);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className={`support-chat ${open ? "support-chat-open" : ""}`}>
            {open ? (
                <section className="support-panel page-enter" aria-label="Rentapp asszisztens">
                    <div className="support-panel-header">
                        <div>
                            <div className="eyebrow">Rentapp asszisztens</div>
                            <h3>Kérdezz az appról</h3>
                        </div>
                        <button className="support-icon-button" type="button" onClick={() => setOpen(false)} aria-label="Chat bezárása">
                            ×
                        </button>
                    </div>

                    <div className="support-panel-subtitle">
                        Funkciók, díjkezelés, import, jelszó-visszaállítás, bérlői és bérbeadói használat.
                    </div>

                    {!hasConversation ? (
                        <section className="support-intro-card">
                            <p className="support-intro-copy">
                                Segítek az app használatában, az importokban, a díjakban, a szerepkörökben és a jelszó-visszaállításban.
                            </p>
                            <div className="support-prompts">
                                {quickActions.map((prompt) => (
                                    <button
                                        key={prompt}
                                        type="button"
                                        className="support-prompt"
                                        onClick={() => void sendMessage(prompt)}
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {hasConversation ? (
                        <div className="support-messages">
                            {messages.map((message, index) => (
                                <article
                                    key={`${message.role}-${index}`}
                                    className={`support-message ${message.role === "assistant" ? "support-message-assistant" : "support-message-user"}`}
                                >
                                    <p>{message.content}</p>
                                </article>
                            ))}

                            {loading ? (
                                <div className="support-typing">
                                    <span />
                                    <span />
                                    <span />
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    <form
                        className="support-form"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void sendMessage(input);
                        }}
                    >
                        <textarea
                            className="textarea support-input"
                            placeholder="Írd be a kérdésedet az appról..."
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            rows={3}
                        />
                        <div className="support-form-actions">
                            <a className="support-link" href={fallbackLinks.whatsapp} target="_blank" rel="noreferrer">
                                WhatsApp
                            </a>
                            <a className="support-link" href={fallbackLinks.messenger} target="_blank" rel="noreferrer">
                                Messenger
                            </a>
                            <button className="btn btn-primary" type="submit" disabled={loading || !input.trim()}>
                                {loading ? "Válasz készül..." : "Küldés"}
                            </button>
                        </div>
                    </form>
                </section>
            ) : (
                <button
                    type="button"
                    className="support-bubble"
                    onClick={() => setOpen(true)}
                    aria-label="Rentapp asszisztens megnyitása"
                >
                    <span className={`support-bubble-orb ${bubbleHint ? "support-bubble-orb-hint" : ""}`}>
                        {bubbleHint ? "?" : "R"}
                    </span>
                </button>
            )}
        </div>
    );
}
