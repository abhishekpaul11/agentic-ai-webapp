import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export type Route = "rag" | "chat" | "math";

export async function routeIntent(question: string): Promise<Route> {
    const sys = `You are a router. Pick ONE route for the user's query:
        - "rag": if the question asks about uploaded docs, policies, FAQs, manuals, or says "according to the docs".
        - "math": if it is primarily a numeric calculation or expression.
        - "chat": otherwise.
        Return only: rag | math | chat`;

    const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
            { role: "system", content: sys },
            { role: "user", content: question },
        ],
    });

    const out = (res.choices[0]?.message?.content || "").trim().toLowerCase();
    if (out.includes("rag")) return "rag";
    if (out.includes("math")) return "math";
    return "chat";
}
