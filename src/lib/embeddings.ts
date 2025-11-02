import OpenAI from "openai";

let _client: OpenAI | null = null;

function getOpenAI() {
    if (!_client) {
        const key = process.env.OPENAI_API_KEY;
        if (!key) {
            throw new Error("OPENAI_API_KEY is not set");
        }
        _client = new OpenAI({ apiKey: key });
    }
    return _client;
}

const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536 dims

export async function embedTexts(texts: string[]) {
    const openai = getOpenAI()
    const res = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts,
    });
    return res.data.map((d) => d.embedding);
}