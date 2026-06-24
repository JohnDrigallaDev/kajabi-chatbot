"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Expand, Shrink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
    const [isExpanded, setIsExpanded] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content:
                "Hey 👋 Ich bin dein Kurs-Assistent. Stell mir gerne deine Frage zu Dropshipping, Shopify, Gewerbe oder zum Kurs.",
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const isMobile = window.matchMedia("(max-width: 640px)").matches;

        window.parent.postMessage(
            {
                type: "KAJABI_CHATBOT_SIZE",
                width: isOpen
                    ? isMobile
                        ? "100vw"
                        : isExpanded
                            ? "620px"
                            : "430px"
                    : "128px",
                height: isOpen ? (isMobile ? "100vh" : "640px") : "128px",
            },
            "*"
        );
    }, [isOpen, isExpanded]);

    useEffect(() => {
        if (!isOpen) return;

        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "end",
        });
    }, [messages, isLoading, isOpen]);

    function parseSseChunk(chunk: string) {
        const events = chunk.split("\n\n").filter(Boolean);

        return events.map((eventBlock) => {
            const eventLine = eventBlock
                .split("\n")
                .find((line) => line.startsWith("event: "));
            const dataLine = eventBlock
                .split("\n")
                .find((line) => line.startsWith("data: "));

            if (!eventLine || !dataLine) return null;

            return {
                event: eventLine.replace("event: ", "").trim(),
                data: JSON.parse(dataLine.replace("data: ", "").trim()),
            };
        });
    }

    async function sendMessage() {
        const text = input.trim();

        if (!text || isLoading) return;

        const assistantMessageIndex = messages.length + 1;

        setMessages((prev) => [
            ...prev,
            { role: "user", content: text },
            { role: "assistant", content: "", sources: [] },
        ]);
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

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || "Fehler beim Chatbot.");
            }

            if (!res.body) {
                throw new Error("Keine Antwort vom Chatbot erhalten.");
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                const parts = buffer.split("\n\n");
                buffer = parts.pop() ?? "";

                for (const part of parts) {
                    const parsedEvents = parseSseChunk(part + "\n\n");

                    for (const parsed of parsedEvents) {
                        if (!parsed) continue;

                        if (parsed.event === "sources") {
                            setMessages((prev) =>
                                prev.map((message, index) =>
                                    index === assistantMessageIndex
                                        ? {
                                            ...message,
                                            sources: parsed.data.sources ?? [],
                                        }
                                        : message
                                )
                            );
                        }

                        if (parsed.event === "delta") {
                            setMessages((prev) =>
                                prev.map((message, index) =>
                                    index === assistantMessageIndex
                                        ? {
                                            ...message,
                                            content:
                                                message.content +
                                                (parsed.data.text ?? ""),
                                        }
                                        : message
                                )
                            );
                        }

                        if (parsed.event === "error") {
                            throw new Error(
                                parsed.data.error ||
                                "Der Chatbot ist gerade nicht erreichbar."
                            );
                        }
                    }
                }
            }
        } catch (error) {
            setMessages((prev) =>
                prev.map((message, index) =>
                    index === assistantMessageIndex
                        ? {
                            ...message,
                            content:
                                error instanceof Error
                                    ? error.message
                                    : "Sorry, da ist gerade etwas schiefgelaufen. Versuch es bitte gleich nochmal.",
                        }
                        : message
                )
            );
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 max-sm:inset-0 max-sm:bottom-auto max-sm:right-auto max-sm:pointer-events-none">
            {isOpen && (
                <div
                    className={`mb-4 flex h-[520px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-3xl border border-black/10 bg-white shadow-2xl transition-[width] duration-200 max-sm:pointer-events-auto max-sm:h-screen max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:border-0 max-sm:shadow-none ${
                        isExpanded ? "w-[550px]" : "w-[360px]"
                    }`}
                >
                    <div className="flex items-center justify-between bg-black px-5 py-4 text-white">
                        <div>
                            <p className="text-sm font-semibold">DSU Kurs-Assistent</p>
                            <p className="text-xs text-white/70">
                                Fragen zum Kurs & Dropshipping
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsExpanded((prev) => !prev)}
                                aria-label={
                                    isExpanded
                                        ? "Chat verkleinern"
                                        : "Chat vergrößern"
                                }
                                className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white max-sm:hidden"
                            >
                                {isExpanded ? (
                                    <Shrink size={17} strokeWidth={2.2} />
                                ) : (
                                    <Expand size={17} strokeWidth={2.2} />
                                )}
                            </button>

                            <button
                                onClick={() => setIsOpen(false)}
                                aria-label="Chat schließen"
                                className="hidden h-9 w-9 items-center justify-center rounded-full text-2xl font-light text-white/80 transition hover:bg-white/10 hover:text-white max-sm:flex"
                            >
                                ×
                            </button>
                        </div>
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
                                {message.content ? (
                                    <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-2 prose-ol:my-2 prose-li:my-0">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {message.content}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1">
                                        <span className="typing-dot" />
                                        <span className="typing-dot typing-dot-delay-1" />
                                        <span className="typing-dot typing-dot-delay-2" />
                                    </div>
                                )}

                                {message.role === "assistant" &&
                                    message.sources &&
                                    message.sources.length > 0 && (
                                        <div className="mt-3 border-t border-black/10 pt-2 text-xs text-neutral-500">
                                            <p className="mb-1 font-semibold text-neutral-600">
                                                Quellen:
                                            </p>
                                            {message.sources.map((source) => (
                                                <p key={source.id}>
                                                    • {source.category}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                            </div>
                        ))}

                        <div ref={messagesEndRef} />
                    </div>

                    <div className="border-t bg-white p-3">
                        <div className="flex items-center gap-2 rounded-3xl border border-black/10 bg-neutral-50 px-3 py-2 shadow-sm">
                            <input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") sendMessage();
                                }}
                                placeholder="Nachricht senden..."
                                className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-black placeholder:text-neutral-400 outline-none"
                            />

                            <button
                                onClick={sendMessage}
                                disabled={isLoading || input.trim().length === 0}
                                aria-label="Nachricht senden"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-lg font-semibold text-white transition hover:scale-105 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-white"
                            >
                                <ArrowUp size={18} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <button
                onClick={() => setIsOpen((prev) => !prev)}
                aria-label={isOpen ? "Chat schließen" : "Chat öffnen"}
                className={`dsu-ai-button max-sm:pointer-events-auto max-sm:fixed max-sm:bottom-4 max-sm:right-4 ${
                    isOpen ? "dsu-ai-button-open max-sm:hidden" : ""
                }`}
            >
                <span className="dsu-ai-orbit dsu-ai-orbit-one" />
                <span className="dsu-ai-orbit dsu-ai-orbit-two" />

                <span className="dsu-ai-inner">
                    {isOpen ? (
                        <span className="dsu-ai-close">×</span>
                    ) : (
                        <img
                            src="/dsu_chatbot_logo.webp"
                            alt="DSU AI Chatbot"
                            className="dsu-ai-image"
                        />
                    )}
                </span>
            </button>
        </div>
    );
}