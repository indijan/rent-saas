"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ChatMessage = {
    role: "user" | "assistant";
    content: string;
};

type Props = {
    onClose: () => void;
};

type SupportView = "actions" | "chat";

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

const ownerCockpitSections = [
    {
        title: "Pénzügyek",
        actions: [
            { label: "Új tétel", href: "/owner/charges?compose=manual" },
            { label: "PDF import", href: "/owner/charges?compose=upload" },
            { label: "Pénzügyek", href: "/owner/charges" },
        ],
    },
    {
        title: "Ingatlan",
        actions: [
            { label: "Új ingatlan", href: "/owner/properties" },
            { label: "Ingatlanok", href: "/owner/properties" },
        ],
    },
    {
        title: "Bérlők",
        actions: [
            { label: "Új bérlő", href: "/owner/tenants" },
            { label: "Bérlők", href: "/owner/tenants" },
        ],
    },
    {
        title: "Profil és támogatás",
        actions: [
            { label: "Profil", href: "/account" },
            { label: "Ötletláda", href: "/account#otletlada" },
            { label: "Kapcsolat", href: "/account#kapcsolat" },
        ],
    },
];

export default function SupportChatPanel({ onClose }: Props) {
    const pathname = usePathname();
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const showOwnerCockpit = pathname.startsWith("/owner");
    const [activeView, setActiveView] = useState<SupportView>(() => (pathname.startsWith("/owner") ? "actions" : "chat"));

    const hasConversation = messages.length > 0;
    const quickActions = useMemo(() => starterPrompts.filter((prompt) => !messages.some((message) => message.content === prompt)), [messages]);

    useEffect(() => {
        if (!showOwnerCockpit && activeView !== "chat") {
            setActiveView("chat");
        }
    }, [activeView, showOwnerCockpit]);

    useEffect(() => {
        if (activeView !== "chat") return;
        const textarea = document.querySelector<HTMLTextAreaElement>(".support-input");
        textarea?.focus();
    }, [activeView]);

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
        <section className={`support-panel page-enter support-panel-${activeView}`} aria-label="Rentapp asszisztens">
            <div className="support-panel-header">
                <div>
                    <div className="eyebrow">Rentapp asszisztens</div>
                    <h3>{showOwnerCockpit && activeView === "actions" ? "Válassz útvonalat" : "Kérdezz az appról"}</h3>
                </div>
                <button className="support-icon-button" type="button" onClick={onClose} aria-label="Chat bezárása">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M6 6l12 12" />
                        <path d="M18 6 6 18" />
                    </svg>
                </button>
            </div>

            <div className="support-panel-subtitle">
                {showOwnerCockpit && activeView === "actions"
                    ? "Először döntsd el, hogy gyors műveletet indítasz vagy beszélgetést kezdesz az asszisztenssel."
                    : showOwnerCockpit
                        ? "Kérdezz az owner workflowkról, importokról, díjakról vagy bármi másról."
                        : "Funkciók, díjkezelés, import, jelszó-visszaállítás, bérlői és bérbeadói használat."}
            </div>

            {showOwnerCockpit ? (
                <div className="support-mode-switch" role="tablist" aria-label="Asszisztens mód választása">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeView === "actions"}
                        className={`support-mode-button${activeView === "actions" ? " is-active" : ""}`}
                        onClick={() => setActiveView("actions")}
                    >
                        Műveletek
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeView === "chat"}
                        className={`support-mode-button${activeView === "chat" ? " is-active" : ""}`}
                        onClick={() => setActiveView("chat")}
                    >
                        Chat
                    </button>
                </div>
            ) : null}

            <div className="support-panel-body">
                {showOwnerCockpit && activeView === "actions" ? (
                    <section className="support-cockpit">
                        <div className="support-cockpit-header">
                            <strong>Műveleti központ</strong>
                            <span>Gyors belépés a gyakori owner műveletekhez.</span>
                        </div>
                        <div className="support-cockpit-sections">
                            {ownerCockpitSections.map((section) => (
                                <div key={section.title} className="support-cockpit-section">
                                    <div className="support-cockpit-title">{section.title}</div>
                                    <div className="support-cockpit-actions">
                                        {section.actions.map((action) => (
                                            <Link key={action.href + action.label} className="support-cockpit-link" href={action.href} onClick={onClose}>
                                                {action.label}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                ) : (
                    <>
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
                                            onClick={() => {
                                                setActiveView("chat");
                                                void sendMessage(prompt);
                                            }}
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
                    </>
                )}
            </div>

            {activeView === "chat" ? (
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
            ) : null}
        </section>
    );
}
