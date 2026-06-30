import OpenAI from "openai";
import knowledgeItems from "@/data/knowledge.json";
import { supabase } from "./supabase";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export type KnowledgeSearchResult = {
    id: string;
    type: string;
    category: string;
    module?: string;
    module_number?: number;
    moduleNumber?: number;
    lesson?: string;
    title: string;
    content: string;
    tags: string[];
    similarity: number;
};

type KnowledgeMetadata = {
    id: string;
    module?: string;
    moduleNumber?: number;
    lesson?: string;
};

const knowledgeMetadataById = new Map(
    (knowledgeItems as KnowledgeMetadata[]).map((item) => [item.id, item])
);

function withKnowledgeMetadata(item: KnowledgeSearchResult) {
    const metadata = knowledgeMetadataById.get(item.id);

    return {
        ...item,
        module: item.module ?? metadata?.module,
        moduleNumber:
            item.moduleNumber ?? item.module_number ?? metadata?.moduleNumber,
        lesson: item.lesson ?? metadata?.lesson,
    };
}

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

    const results = ((data ?? []) as KnowledgeSearchResult[]).map(
        withKnowledgeMetadata
    );

    return results.filter((item) => item.similarity >= 0.25);
}
