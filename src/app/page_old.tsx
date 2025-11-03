"use client";
import { useState } from "react";

export default function Page_old() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<{ id: string; source: string; score: number }[]>([]);

  async function ask() {
    if (!q.trim()) return;
    setLoading(true);
    setAnswer(null);
    setSources([]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: q }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok) {
        setAnswer(data.answer);
        setSources(data.sources || []);
      } else {
        setAnswer(`Error: ${data.error || "Unknown"}`);
      }
    } catch (e: any) {
      setAnswer(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-bold mb-4">RAG Chatbot (Pinecone + OpenAI)</h1>
        <div className="flex gap-2">
          <input
              className="flex-1 border rounded px-3 py-2"
              placeholder="Ask a question about your docs..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
          />
          <button
              onClick={ask}
              disabled={loading}
              className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? "Thinking..." : "Ask"}
          </button>
        </div>

        {answer && (
            <div className="mt-6 space-y-3">
              <div className="p-4 border rounded">
                <div className="font-semibold mb-1">Answer</div>
                <div className="whitespace-pre-wrap">{answer}</div>
              </div>
              {sources.length > 0 && (
                  <div className="p-4 border rounded">
                    <div className="font-semibold mb-2">Top sources</div>
                    <ul className="list-disc ml-5">
                      {sources.map((s, i) => (
                          <li key={s.id}>
                            <span className="font-mono text-sm">{s.source}</span>{" "}
                            <span className="text-xs text-gray-500">(score {s.score.toFixed(3)})</span>
                          </li>
                      ))}
                    </ul>
                  </div>
              )}
            </div>
        )}
      </main>
  );
}