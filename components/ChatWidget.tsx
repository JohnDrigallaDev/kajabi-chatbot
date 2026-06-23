"use client";

import { useEffect, useState } from "react";

type Source = {
    id: string;
    type: string;
    category: string;
    title: string;
    similarity: number;
};

type Message = {
    role: "user" | "assistant";
    content: string;
    sources?: Source[];
};

export default function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content:
                "Hey 👋 Ich bin dein Kurs-Assistent. Stell mir gerne deine Frage zu Dropshipping, Shopify, Gewerbe oder zum Kurs.",
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        window.parent.postMessage(
            {
                type: "KAJABI_CHATBOT_SIZE",
                width: isOpen ? "430px" : "96px",
                height: isOpen ? "640px" : "96px",
            },
            "*"
        );
    }, [isOpen]);

    async function sendMessage() {
        const text = input.trim();

        if (!text || isLoading) return;

        setMessages((prev) => [...prev, { role: "user", content: text }]);
        setInput("");
        setIsLoading(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: text,
                    history: messages.slice(-8),
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Fehler beim Chatbot.");
            }

            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: data.answer,
                    sources: data.sources ?? [],
                },
            ]);
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content:
                        "Sorry, da ist gerade etwas schiefgelaufen. Versuch es bitte gleich nochmal.",
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="fixed bottom-6 right-6 z-50">
            {isOpen && (
                <div className="mb-4 flex h-[520px] w-[360px] flex-col overflow-hidden rounded-3xl border border-black/10 bg-white shadow-2xl">
                    <div className="bg-black px-5 py-4 text-white">
                        <p className="text-sm font-semibold">DSU Kurs-Assistent</p>
                        <p className="text-xs text-white/70">Fragen zum Kurs & Dropshipping</p>
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto bg-neutral-50 p-4">
                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                    message.role === "user"
                                        ? "ml-auto bg-black text-white"
                                        : "mr-auto bg-white text-black shadow-sm"
                                }`}
                            >
                                <p className="whitespace-pre-wrap">{message.content}</p>

                                {message.role === "assistant" &&
                                    message.sources &&
                                    message.sources.length > 0 && (
                                        <div className="mt-3 border-t border-black/10 pt-2 text-xs text-neutral-500">
                                            <p className="mb-1 font-semibold text-neutral-600">
                                                Quellen:
                                            </p>
                                            {message.sources.map((source) => (
                                                <p key={source.id}>• {source.category}</p>
                                            ))}
                                        </div>
                                    )}
                            </div>
                        ))}

                        {isLoading && (
                            <div className="mr-auto rounded-2xl bg-white px-4 py-3 text-sm text-black shadow-sm">
                                Schreibt...
                            </div>
                        )}
                    </div>

                    <div className="border-t bg-white p-3">
                        <div className="flex gap-2">
                            <input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") sendMessage();
                                }}
                                placeholder="Schreib deine Frage..."
                                className="flex-1 rounded-full border px-4 py-3 text-sm text-black placeholder:text-neutral-400 outline-none focus:border-black"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={isLoading}
                                className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                            >
                                Senden
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <button
                onClick={() => setIsOpen((prev) => !prev)}
                className="relative flex h-16 w-16 items-center justify-center rounded-full bg-black text-2xl text-white shadow-2xl transition hover:scale-105"
            >
                <span className="relative">{isOpen ? "×" : "💬"}</span>
            </button>
        </div>
    );
}