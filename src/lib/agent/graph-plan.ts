import { z } from "zod";
import { StateGraph, START, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { retrieve } from "@/lib/rag";
import { safeCalc } from "./tools";

const llm = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
    model: "gpt-4o-mini",
    temperature: 0,
});

export const PlanState = z.object({
    question: z.string(),
    namespace: z.string().default("kb"),
    route: z.enum(["rag", "chat", "math"]).optional(),
    context: z.string().optional(),
    sources: z.array(z.object({ id: z.string(), source: z.string(), score: z.number() })).optional(),
    mathAnswer: z.string().optional(),
});
export type PlanStateT = z.infer<typeof PlanState>;

async function routeNode(state: PlanStateT): Promise<Partial<PlanStateT>> {
    const res = await llm.invoke([
        ["system", `Pick one route: "rag" (questions about docs), "math" (arithmetic), or "chat" (otherwise). Return only the word.`],
        ["user", state.question],
    ]);
    const txt = String(res.content || "").toLowerCase();
    return { route: txt.includes("rag") ? "rag" : txt.includes("math") ? "math" : "chat" };
}

async function retrieveNode(state: PlanStateT): Promise<Partial<PlanStateT>> {
    const hits = await retrieve(state.question, undefined, state.namespace);
    const context = hits.map((h, i) => `# Doc ${i + 1} (${h.source})\n${h.text}`).join("\n\n");
    const sources = hits.slice(0, 3).map(h => ({ id: h.id, source: h.source, score: h.score }));
    return { context, sources };
}

async function mathNode(state: PlanStateT): Promise<Partial<PlanStateT>> {
    return { mathAnswer: safeCalc(state.question) };
}

function branch(state: PlanStateT) {
    return state.route ?? "chat";
}

export const graphPlan = new StateGraph(PlanState)
    .addNode("routeNode", routeNode)
    .addNode("retrieve", retrieveNode)
    .addNode("math", mathNode)
    .addEdge(START, "routeNode")
    .addConditionalEdges("routeNode", branch, {
        rag: "retrieve",
        chat: END,
        math: "math",
    })
    .addEdge("retrieve", END)
    .addEdge("math", END)
    .compile();
