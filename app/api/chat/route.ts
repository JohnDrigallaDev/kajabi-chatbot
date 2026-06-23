import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { searchKnowledge } from "@/lib/vector-search";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const ChatMessageSchema = z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(1500),
});

const ChatRequestSchema = z.object({
    message: z.string().min(2).max(1000),
    history: z.array(ChatMessageSchema).max(10).optional(),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = ChatRequestSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
        }

        const userMessage = parsed.data.message.trim();
        const history = parsed.data.history ?? [];

        const searchResults = await searchKnowledge(userMessage);

        const context = searchResults
            .map((item, index) => {
                return `
Quelle ${index + 1}
ID: ${item.id}
Typ: ${item.type}
Kategorie: ${item.category}
Titel: ${item.title}
Inhalt: ${item.content}
Tags: ${item.tags.join(", ")}
Ähnlichkeit: ${item.similarity}
`;
            })
            .join("\n---\n");

        const systemPrompt = `
Du bist ein hilfreicher KI-Assistent für den Dropshipping-Kurs von Manjeet Singh Sangha.

Regeln:
- Antworte kurz, klar, praktisch und freundlich.
- Nutze zuerst die bereitgestellten Kurs-/FAQ-Informationen.
- Wenn keine passenden Informationen gefunden wurden, gib allgemeine Orientierung, aber sage ehrlich, dass du dazu keine konkrete Kursquelle gefunden hast.
- Bei rechtlichen, steuerlichen, finanziellen oder gewerblichen Themen immer kurz erwähnen: "Das ist keine Rechts- oder Steuerberatung."
- Erfinde keine konkreten Kursinhalte, Module, Garantien oder Versprechen.
- Keine langen Romane. Maximal 6 kurze Absätze.
- Antworte auf Deutsch.
`;

        const recentHistory = history.slice(-6).map((message) => ({
            role: message.role,
            content: message.content,
        }));

        const response = await openai.responses.create({
            model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
            input: [
                {
                    role: "system",
                    content: systemPrompt,
                },
                ...recentHistory,
                {
                    role: "user",
                    content: `
Relevante Kurs-/Wissensinformationen:
${context || "Keine direkt passenden Informationen gefunden."}

Aktuelle Frage:
${userMessage}
`,
                },
            ],
            max_output_tokens: 500,
        });

        return NextResponse.json({
            answer: response.output_text,
            sources: searchResults.map((item) => ({
                id: item.id,
                type: item.type,
                category: item.category,
                title: item.title,
                similarity: item.similarity,
            })),
        });
    } catch (error) {
        console.error("Chat API error:", error);

        return NextResponse.json(
            { error: "Der Chatbot ist gerade nicht erreichbar." },
            { status: 500 }
        );
    }
}