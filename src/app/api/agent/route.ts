import { NextRequest } from "next/server";
import OpenAI from "openai";
import { routeIntent } from "@/lib/agent/router";
import { safeCalc } from "@/lib/agent/tools";
import { retrieve } from "@/lib/rag";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
    try {
        const { message, namespace = "kb" } = await req.json();
        if (!message) return new Response("Missing 'message'", { status: 400 });

        const route = await routeIntent(message);

        let preface = "";
        let sources: any[] = [];
        if (route === "rag") {
            const hits = await retrieve(message, undefined, namespace);
            sources = hits.slice(0, 3).map(h => ({ id: h.id, source: h.source, score: h.score }));
            const context = hits.map((h, i) => `# Doc ${i + 1} (${h.source})\n${h.text}`).join("\n\n");
            preface = `Use this context if relevant:\n${context}\n\n`;
        }

        if (route === "math") {
            const ans = safeCalc(message);
            const payload = JSON.stringify({ route, answer: ans, sources: [] });
            return new Response(payload, { headers: { "Content-Type": "application/json" } });
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    controller.enqueue(encoder.encode(`__META__${JSON.stringify({ route, sources, namespace })}\n`));

                    const completion = await openai.chat.completions.create({
                        model: "gpt-4o-mini",
                        temperature: 0.2,
                        stream: true,
                        messages: [
                            { role: "system", content: "You are a helpful assistant. If context is provided, ground answers in it and say 'I don't know' if not found." },
                            { role: "user", content: `${route === "rag" ? preface : ""}Question: ${message}\nAnswer:` },
                        ],
                    });

                    for await (const part of completion) {
                        const delta = part.choices?.[0]?.delta?.content;
                        if (delta) controller.enqueue(encoder.encode(delta));
                    }
                } catch (e) {
                    controller.enqueue(encoder.encode("\n[stream error]\n"));
                    console.error(e);
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" },
        });
    } catch (e: any) {
        console.error(e);
        return new Response(e?.message || "Server error", { status: 500 });
    }
}