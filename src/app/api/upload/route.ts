import { NextRequest, NextResponse } from "next/server";
import { ensureIndex } from "@/lib/pinecone";
import { embedTexts } from "@/lib/embeddings";
import { chunkText } from "@/lib/chunk";
import { createRequire } from "module";

export const runtime = "nodejs";

const require = createRequire(import.meta.url);
const pdfParse: (b: Buffer) => Promise<{ text: string; numpages: number }> = require("pdf-parse");

async function readFileAsText(file: File): Promise<{ text: string; meta: Record<string, any> }> {
    const name = file.name || "upload";
    const type = file.type || "";

    if (name.endsWith(".pdf") || type === "application/pdf") {
        const buf = Buffer.from(await file.arrayBuffer());
        const res = await pdfParse(buf);
        return { text: res.text || "", meta: { pages: res.numpages ?? undefined } };
    }

    // .md / .txt fallback
    const text = await file.text();
    return { text, meta: {} };
}

export async function POST(req: NextRequest) {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ error: "Server mis-config: OPENAI_API_KEY missing" }, { status: 500 });
        }

        const form = await req.formData();
        const file = form.get("file");
        const namespaceName = (form.get("namespace") as string) || "kb";

        if (!(file instanceof File)) {
            return NextResponse.json({ error: "Missing file" }, { status: 400 });
        }

        const { text, meta } = await readFileAsText(file);
        if (!text.trim()) {
            return NextResponse.json({ error: "No extractable text" }, { status: 400 });
        }

        const chunks = chunkText(text);
        const embeddings = await embedTexts(chunks);

        const index = await ensureIndex();
        const ns = index.namespace(namespaceName);

        const vectors = chunks.map((t, i) => ({
            id: `${file.name}-${i}`,
            values: embeddings[i],
            metadata: {
                text: t,
                source: file.name,
                ...meta,
            } as Record<string, any>,
        }));

        // upsert in batches
        const B = 100;
        for (let i = 0; i < vectors.length; i += B) {
            await ns.upsert(vectors.slice(i, i + B));
        }

        return NextResponse.json({ ok: true, chunks: vectors.length, namespace: namespaceName, file: file.name });
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: e?.message || "Upload failed" }, { status: 500 });
    }
}
