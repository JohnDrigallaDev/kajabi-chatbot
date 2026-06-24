"use client";

import { useEffect, useRef, useState } from "react";
import {
    ArrowUp,
    BookOpen,
    ChevronDown,
    ChevronRight,
    Expand,
    RotateCcw,
    Shrink,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Source = {
    id: string;
    type: string;
    category: string;
    title: string;
    content?: string;
    tags?: string[];
    similarity: number;
};

type Message = {
    role: "user" | "assistant";
    content: string;
    sources?: Source[];
};

const STORAGE_KEY = "dsu-ai-chat-history";
const MAX_STORED_MESSAGES = 30;

const INITIAL_MESSAGE = `👋 Willkommen bei der **Dropshipping University Platinum**.

Ich bin **DSU AI** und helfe dir bei Fragen rund um Shopify, Produktrecherche, Werbung, Gewerbe, Steuern allgemein und Kursinhalte.

Frag mich einfach los.`;

const INITIAL_MESSAGES: Message[] = [
    {
        role: "assistant",
        content: INITIAL_MESSAGE,
    },
];

function loadStoredMessages(): Message[] {
    if (typeof window === "undefined") return INITIAL_MESSAGES;

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return INITIAL_MESSAGES;

        const parsed = JSON.parse(raw) as Message[];

        if (!Array.isArray(parsed) || parsed.length === 0) {
            return INITIAL_MESSAGES;
        }

        return parsed;
    } catch {
        return INITIAL_MESSAGES;
    }
}

function saveStoredMessages(messages: Message[]) {
    if (typeof window === "undefined") return;

    const cleanMessages = messages
        .filter((message) => message.content.trim().length > 0)
        .slice(-MAX_STORED_MESSAGES);

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanMessages));
}

export default function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [openSourceIds, setOpenSourceIds] = useState<string[]>([]);
    const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isStorageReady, setIsStorageReady] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        setMessages(loadStoredMessages());
        setIsStorageReady(true);
    }, []);

    useEffect(() => {
        if (!isStorageReady || isLoading) return;

        saveStoredMessages(messages);
    }, [messages, isLoading, isStorageReady]);

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
                height: isOpen ? (isMobile ? "100dvh" : "640px") : "128px",
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

    function resetConversation() {
        setMessages(INITIAL_MESSAGES);
        setOpenSourceIds([]);
        window.localStorage.removeItem(STORAGE_KEY);
    }

    function toggleSource(sourceId: string) {
        setOpenSourceIds((prev) =>
            prev.includes(sourceId)
                ? prev.filter((id) => id !== sourceId)
                : [...prev, sourceId]
        );
    }

    function getSourceTypeLabel(type: string) {
        if (type === "faq") return "FAQ";
        if (type === "course_content") return "Kursinhalt";
        if (type === "general_info") return "Info";
        return type;
    }

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
                    className={`mb-4 flex h-[520px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-3xl border border-black/10 bg-white shadow-2xl transition-[width] duration-200 max-sm:pointer-events-auto max-sm:h-[100dvh] max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:border-0 max-sm:shadow-none ${
                        isExpanded ? "w-[550px]" : "w-[360px]"
                    }`}
                >
                    <div className="flex items-center justify-between bg-black px-5 py-4 text-white">
                        <div>
                            <p className="text-sm font-semibold">DSU AI</p>
                            <p className="text-xs text-white/70">
                                Dropshipping University Assistant
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={resetConversation}
                                aria-label="Chat zurücksetzen"
                                className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
                            >
                                <RotateCcw size={16} strokeWidth={2.2} />
                            </button>

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
                        {messages.map((message, index) => {
                            const isLatestStreamingMessage =
                                isLoading &&
                                index === messages.length - 1 &&
                                message.role === "assistant";

                            return (
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
                                        message.content.trim().length > 0 &&
                                        !isLatestStreamingMessage &&
                                        message.sources &&
                                        message.sources.length > 0 && (
                                            <div className="mt-3 rounded-2xl border border-black/10 bg-neutral-50 p-3 text-xs text-neutral-600">
                                                <p className="mb-2 font-semibold text-neutral-800">
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <BookOpen
                                                            size={14}
                                                            strokeWidth={2.2}
                                                        />
                                                        Verwendete Quellen (
                                                        {message.sources.length})
                                                    </span>
                                                </p>

                                                <div className="space-y-2">
                                                    {message.sources.map((source) => {
                                                        const isSourceOpen =
                                                            openSourceIds.includes(
                                                                source.id
                                                            );

                                                        return (
                                                            <div
                                                                key={source.id}
                                                                className="rounded-xl border border-black/5 bg-white"
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        toggleSource(
                                                                            source.id
                                                                        )
                                                                    }
                                                                    className="flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-neutral-50"
                                                                >
                                                                    <span className="mt-0.5 text-neutral-400">
                                                                        {isSourceOpen ? (
                                                                            <ChevronDown
                                                                                size={14}
                                                                            />
                                                                        ) : (
                                                                            <ChevronRight
                                                                                size={14}
                                                                            />
                                                                        )}
                                                                    </span>

                                                                    <span className="min-w-0">
                                                                        <span className="block font-semibold text-neutral-800">
                                                                            {source.title}
                                                                        </span>
                                                                        <span className="block text-[11px] text-neutral-500">
                                                                            {
                                                                                source.category
                                                                            }{" "}
                                                                            ·{" "}
                                                                            {getSourceTypeLabel(
                                                                                source.type
                                                                            )}
                                                                        </span>
                                                                    </span>
                                                                </button>

                                                                {isSourceOpen && (
                                                                    <div className="border-t border-black/5 px-3 py-2 text-[11px] leading-relaxed text-neutral-600">
                                                                        {source.content && (
                                                                            <p className="mb-2">
                                                                                {
                                                                                    source.content
                                                                                }
                                                                            </p>
                                                                        )}

                                                                        {source.tags &&
                                                                            source.tags
                                                                                .length >
                                                                            0 && (
                                                                                <div className="flex flex-wrap gap-1">
                                                                                    {source.tags.map(
                                                                                        (
                                                                                            tag
                                                                                        ) => (
                                                                                            <span
                                                                                                key={`${source.id}-${tag}`}
                                                                                                className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500"
                                                                                            >
                                                                                                {
                                                                                                    tag
                                                                                                }
                                                                                            </span>
                                                                                        )
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                </div>
                            );
                        })}

                        <div ref={messagesEndRef} />
                    </div>

                    <div className="border-t bg-white p-3 max-sm:pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
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