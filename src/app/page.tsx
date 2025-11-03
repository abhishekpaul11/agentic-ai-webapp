"use client";
import { useRef, useState } from "react";

type SourceMeta = { id: string; source: string; score: number };

export default function Page() {
    const [namespace, setNamespace] = useState("kb");
    const [answer, setAnswer] = useState("");
    const [loading, setLoading] = useState(false);
    const [sources, setSources] = useState<SourceMeta[]>([]);
    const [input, setInput] = useState("");
    const fileRef = useRef<HTMLInputElement | null>(null);

    async function uploadDoc() {
        const file = fileRef.current?.files?.[0];
        if (!file) return alert("Choose a file");
        const fd = new FormData();
        fd.append("file", file);
        fd.append("namespace", namespace);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) return alert(data.error || "Upload failed");
        alert(`Uploaded ${data.file} (${data.chunks} chunks) to namespace '${data.namespace}'`);
    }

    async function ask() {
        if (!input.trim()) return;
        setAnswer("");
        setSources([]);
        setLoading(true);

        const res = await fetch("/api/langchain-agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: input, namespace: namespace }),
        });

        if (!res.body) {
            setLoading(false);
            setAnswer(`Error: no stream body`);
            return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let isFirst = true;
        let metaProcessed = false;

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);

            // First chunk contains meta header line
            if (isFirst) {
                isFirst = false;
                const nl = chunk.indexOf("\n");
                if (nl >= 0 && chunk.startsWith("__META__")) {
                    const metaJson = chunk.substring("__META__".length, nl);
                    try {
                        const meta = JSON.parse(metaJson);
                        if (meta?.sources) setSources(meta.sources);
                    } catch {}
                    setAnswer(prev => prev + chunk.slice(nl + 1));
                    metaProcessed = true;
                    continue;
                }
            }

            // If meta didn’t arrive as a full line (rare), ignore; rest is tokens
            setAnswer(prev => prev + chunk);
        }

        setLoading(false);
    }

    return (
        <main className="mx-auto max-w-2xl p-6 space-y-6">
            <h1 className="text-2xl font-bold">RAG Chatbot (Upload + Streaming)</h1>

            <input
                className="border rounded px-2 py-1"
                value={namespace}
                onChange={(e) => setNamespace(e.target.value)}
                placeholder="namespace (e.g., kb or user123)"
            />

            <section className="p-4 border rounded space-y-3">
                <div className="font-semibold">Upload document</div>
                <div className="flex items-center gap-3">
                    <input ref={fileRef} type="file" accept=".pdf,.md,.txt"/>
                    <button onClick={uploadDoc} className="bg-black text-white px-3 py-2 rounded">
                        Upload
                    </button>
                </div>
                <div className="text-sm text-gray-600">
                    Supported: PDF, Markdown (.md), Text (.txt)
                </div>
            </section>

            <section className="p-4 border rounded space-y-3">
                <div className="flex gap-2">
                    <input
                        className="flex-1 border rounded px-3 py-2"
                        placeholder="Ask about your uploaded docs…"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && ask()}
                    />
                    <button
                        onClick={ask}
                        disabled={loading}
                        className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
                    >
                        {loading ? "Thinking…" : "Ask"}
                    </button>
                </div>

                <div className="p-3 border rounded min-h-24 whitespace-pre-wrap">
                    {answer || (loading ? "…" : "Ask something")}
                </div>

                {sources.length > 0 && (
                    <div className="p-3 border rounded">
                        <div className="font-semibold mb-2">Top sources</div>
                        <ul className="list-disc ml-6">
                            {sources.map((s) => (
                                <li key={s.id}>
                                    <span className="font-mono text-sm">{s.source}</span>{" "}
                                    <span className="text-xs text-gray-500">(score {s.score.toFixed(3)})</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </section>
        </main>
    );
}