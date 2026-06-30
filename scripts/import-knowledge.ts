import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

type KnowledgeItem = {
    id: string;
    type: "faq" | "course_content" | "general_info";
    category: string;
    module?: string;
    moduleNumber?: number;
    lesson?: string;
    title: string;
    content: string;
    tags: string[];
};

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase Umgebungsvariablen fehlen.");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function createEmbedding(item: KnowledgeItem) {
    const text = `
Titel: ${item.title}
Typ: ${item.type}
Kategorie: ${item.category}
Inhalt: ${item.content}
Tags: ${item.tags.join(", ")}
`;

    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
    });

    return response.data[0].embedding;
}

async function main() {
    const knowledgePath = path.join(process.cwd(), "data", "knowledge.json");
    const raw = fs.readFileSync(knowledgePath, "utf8");
    const items = JSON.parse(raw) as KnowledgeItem[];

    for (const item of items) {
        console.log(`Importiere: ${item.id}`);

        const embedding = await createEmbedding(item);

        const { error } = await supabase.from("knowledge").upsert({
            id: item.id,
            type: item.type,
            category: item.category,
            module: item.module,
            moduleNumber: item.moduleNumber,
            lesson: item.lesson,
            title: item.title,
            content: item.content,
            tags: item.tags,
            embedding,
            updated_at: new Date().toISOString(),
        });

        if (error) {
            console.error(`Fehler bei ${item.id}:`, error);
            continue;
        }

        console.log(`Gespeichert: ${item.id}`);
    }

    console.log("Fertig.");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
