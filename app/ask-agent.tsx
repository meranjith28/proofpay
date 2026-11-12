"use client";
import { useState } from "react";

const SUGGESTIONS: Record<"client" | "freelancer", string[]> = {
  client: ["Where is my money right now?", "Why was this job paid?", "What did the freelancer miss?"],
  freelancer: ["What do I still need to fix?", "When will I get paid?", "Why did item 2 fail?"],
};

/** Chat box on each job, for the client and freelancer only. The agent can explain, never move money. */
export function AskAgent({ jobId, role }: { jobId: string; role: "client" | "freelancer" }) {
  const [q, setQ] = useState("");
  const [log, setLog] = useState<{ q: string; a: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Something went wrong.");
      else { setLog((l) => [...l, { q: question, a: data.answer }]); setQ(""); }
    } catch {
      setError("Couldn't reach the agent. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <h2 className="text-xl font-bold">Ask the agent</h2>
      <p className="mb-3 text-sm text-muted">Questions about this job, answered from its record and live PayPal status. It can explain, not move money.</p>
      {log.length > 0 && (
        <ol className="mb-3 space-y-3 text-sm" aria-live="polite">
          {log.map((m, i) => (
            <li key={i} className="space-y-1">
              <p className="font-semibold">{m.q}</p>
              <p className="rounded-md bg-paper p-3">{m.a}</p>
            </li>
          ))}
        </ol>
      )}
      <div className="mb-3 flex flex-wrap gap-2">
        {SUGGESTIONS[role].map((s) => (
          <button key={s} type="button" onClick={() => ask(s)} disabled={busy}
            className="rounded-full border border-line px-3 py-1 text-xs hover:border-ink disabled:opacity-60">{s}</button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about this job" aria-label="Ask about this job" className="input" />
        <button disabled={busy} className="shrink-0 rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Thinking…" : "Ask"}
        </button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}
