import {pineconeClient} from "./pinecone";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const GENERATION_MODEL = "gpt-4o-mini";

export async function retrieve(query: string, topK = Number(process.env.RAG_TOP_K || 6)) {
    const client = pineconeClient();
    const indexName = process.env.PINECONE_INDEX!;
    const index = client.index(indexName).namespace("kb");

    // embed the query
    const emb = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
    });

    const res = await index.query({
        vector: emb.data[0].embedding,
        topK,
        includeMetadata: true,
    });

    return res.matches?.map((m) => ({
        id: m.id!,
        score: m.score!,
        text: (m.metadata?.text as string) || "",
        source: (m.metadata?.source as string) || "",
    })) ?? [];
}

export async function answerWithRAG(userQuestion: string) {
    const hits = await retrieve(userQuestion);
    const context = hits
        .map((h, i) => `# Doc ${i + 1} (score ${h.score.toFixed(3)}, ${h.source})\n${h.text}`)
        .join("\n\n");

    const system = [
        "You are a helpful assistant.",
        "Use the provided context to answer the user concisely.",
        "If the answer isn't in context, say you don't know.",
    ].join(" ");

    const prompt = `Context:\n${context}\n\nQuestion: ${userQuestion}\n\nAnswer:`;

    const chat = await openai.chat.completions.create({
        model: GENERATION_MODEL,
        messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
        ],
        temperature: 0.2,
    });

    const answer = chat.choices[0]?.message?.content ?? "";
    return { answer, sources: hits.slice(0, 3) };
}
