import { NextRequest } from "next/server";
import OpenAI from "openai";
import { retrieve } from "@/lib/rag";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
    try {
        const { message, namespace = "kb" } = await req.json();
        if (!message || typeof message !== "string") {
            return new Response("Missing 'message'", { status: 400 });
        }

        const hits = await retrieve(message, undefined, namespace);
        const context = hits.map((h, i) => `# Doc ${i + 1} (${h.source})\n${h.text}`).join("\n\n");

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    const meta = JSON.stringify({ namespace: namespace, sources: hits.slice(0, 3).map(h => ({ id: h.id, source: h.source, score: h.score })) });
                    controller.enqueue(encoder.encode(`__META__${meta}\n`));

                    const system = "You are a helpful assistant. Use the provided context. If not in context, say you don't know.";
                    const user = `Context:\n${context}\n\nQuestion: ${message}\n\nAnswer:`;

                    const completion = await openai.chat.completions.create({
                        model: "gpt-4o-mini",
                        temperature: 0.2,
                        stream: true,
                        messages: [
                            { role: "system", content: system },
                            { role: "user", content: user },
                        ],
                    });

                    for await (const part of completion) {
                        const delta = part.choices?.[0]?.delta?.content;
                        if (delta) controller.enqueue(encoder.encode(delta));
                    }
                } catch (err) {
                    controller.enqueue(encoder.encode(`\n\n[stream error]`));
                    console.error(err);
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        });
    } catch (e: any) {
        console.error(e);
        return new Response(e?.message || "Server error", { status: 500 });
    }
}
