import {Pinecone} from "@pinecone-database/pinecone";

export function pineconeClient() {
    const apiKey = process.env.PINECONE_API_KEY!;
    return new Pinecone({ apiKey });
}

export async function ensureIndex() {
    const client = pineconeClient();
    const indexName = process.env.PINECONE_INDEX!;
    const dims = Number(process.env.PINECONE_DIMENSIONS || 1536);

    const existing = await client.listIndexes();
    if (!existing.indexes?.find((i) => i.name === indexName)) {
        await client.createIndex({
            name: indexName,
            dimension: dims,
            metric: "cosine",
            spec: { serverless: { cloud: 'aws', region: "us-east-1" } },
        });
    }
    return client.index(indexName);
}
