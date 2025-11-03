import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import fs from "node:fs";
import { ensureIndex } from "@/lib/pinecone";
import { embedTexts } from "@/lib/embeddings";
import {chunkText} from "@/lib/chunk";

async function main() {
    const dataDir = path.join(process.cwd(), "data");
    const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".md"));

    if (files.length === 0) {
        console.log("No .md files found in /data");
        process.exit(0);
    }

    const index = await ensureIndex();
    const namespace = index.namespace("kb");

    const allChunks: { id: string; text: string; file: string }[] = [];
    for (const file of files) {
        const full = fs.readFileSync(path.join(dataDir, file), "utf8");
        const pieces = chunkText(full);
        pieces.forEach((p, idx) => {
            allChunks.push({
                id: `${file}-${idx}`,
                text: p,
                file,
            });
        });
    }

    const embeddings = await embedTexts(allChunks.map((c) => c.text));

    const vectors = allChunks.map((c, i) => ({
        id: c.id,
        values: embeddings[i],
        metadata: {
            text: c.text,
            source: c.file,
        } as Record<string, any>,
    }));

    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        await namespace.upsert(batch);
        console.log(`Upserted ${Math.min(i + batchSize, vectors.length)} / ${vectors.length}`);
    }

    console.log("Ingestion complete.");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
