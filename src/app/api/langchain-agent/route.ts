import { NextRequest } from "next/server";
import OpenAI from "openai";
import { graphPlan } from "@/lib/agent/graph-plan";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
    try {
        const { message, namespace = "kb" } = await req.json();
        if (!message) return new Response("Missing 'message'", { status: 400 });

        const planned = await graphPlan.invoke({ question: message, namespace });

        if (planned.route === "math") {
            return new Response(
                JSON.stringify({ route: "math", answer: planned.mathAnswer || "Invalid expression", sources: [] }),
                { headers: { "Content-Type": "application/json" } }
            );
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    controller.enqueue(
                        encoder.encode(
                            `__META__${JSON.stringify({
                                route: planned.route,
                                namespace,
                                sources: planned.sources ?? [],
                            })}\n`
                        )
                    );

                    const system = "You are a helpful assistant. Use provided context if present; say you don't know if not in context.";
                    const user =
                        (planned.context ? `Context:\n${planned.context}\n\n` : "") +
                        `Question: ${message}\nAnswer:`;

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
                    controller.enqueue(encoder.encode("\n[stream error]\n"));
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