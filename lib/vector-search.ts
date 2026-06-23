import OpenAI from "openai";
import { supabase } from "./supabase";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export type KnowledgeSearchResult = {
    id: string;
    type: string;
    category: string;
    title: string;
    content: string;
    tags: string[];
    similarity: number;
};

export async function searchKnowledge(query: string) {
    const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
    });

    const embedding = embeddingResponse.data[0].embedding;

    const { data, error } = await supabase.rpc("match_knowledge", {
        query_embedding: embedding,
        match_count: 5,
    });

    if (error) {
        throw error;
    }

    const results = (data ?? []) as KnowledgeSearchResult[];

    return results.filter((item) => item.similarity >= 0.25);
}