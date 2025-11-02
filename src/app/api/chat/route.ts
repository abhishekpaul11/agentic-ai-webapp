import { NextRequest, NextResponse } from "next/server";
import { answerWithRAG } from "@/lib/rag";

export async function POST(req: NextRequest) {
    try {
        const { message } = await req.json();
        if (!message || typeof message !== "string") {
            return NextResponse.json({ error: "Missing 'message' string" }, { status: 400 });
        }

        const { answer, sources } = await answerWithRAG(message);
        return NextResponse.json({ answer, sources });
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
    }
}
