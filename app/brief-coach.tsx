"use client";
import { useState } from "react";

type Coach = {
  verdict: "ready" | "needs_work";
  vague: { phrase: string; why: string; suggestion: string }[];
  missing: string[];
  price_low: number;
  price_high: number;
  price_reason: string;
  improved_brief: string;
};

/** "Check my brief": AI flags wording the reviewer can't check, missing requirements, and a fair price. */
export function BriefCoach() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Coach | null>(null);
  const field = <T extends HTMLElement>(name: string) => document.querySelector<T>(`[name="${name}"]`);

  async function check() {
    setBusy(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: field<HTMLInputElement>("title")?.value,
          brief: field<HTMLTextAreaElement>("brief")?.value,
          category: field<HTMLSelectElement>("category")?.value,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Something went wrong.");
      else setResult(data);
    } catch {
      setError("Couldn't reach the brief coach. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function applyImproved() {
    const box = field<HTMLTextAreaElement>("brief");
    if (box && result) box.value = result.improved_brief;
    const amount = field<HTMLInputElement>("amount");
    if (amount && result && !amount.value) amount.value = String(Math.round((result.price_low + result.price_high) / 2));
    setResult(null);
  }

  return (
    <div className="rounded-lg border border-line bg-paper p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Not sure the AI can check your brief? Ask it first.</p>
        <button type="button" onClick={check} disabled={busy}
          className="rounded-md border border-ink bg-white px-3 py-1.5 text-sm font-semibold hover:bg-paper disabled:opacity-60">
          {busy ? "Checking your brief…" : "Check my brief"}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      {result && (
        <div className="mt-3 space-y-3 text-sm" aria-live="polite">
          <p className={`font-semibold ${result.verdict === "ready" ? "text-verified" : "text-held"}`}>
            {result.verdict === "ready" ? "Every requirement can be checked. Good to post." : "Some parts can't be checked objectively yet."}
          </p>
          {result.vague.length > 0 && (
            <div>
              <p className="font-medium">Hard to check</p>
              <ul className="mt-1 space-y-1">
                {result.vague.map((v) => (
                  <li key={v.phrase}>“{v.phrase}”: {v.why} <span className="text-muted">Try: {v.suggestion}</span></li>
                ))}
              </ul>
            </div>
          )}
          {result.missing.length > 0 && (
            <div>
              <p className="font-medium">You might also want</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">{result.missing.map((m) => <li key={m}>{m}</li>)}</ul>
            </div>
          )}
          <p><span className="font-medium">Fair budget:</span> ${result.price_low}–${result.price_high}. <span className="text-muted">{result.price_reason}</span></p>
          <div className="rounded-md border border-line bg-white p-3">
            <p className="font-medium">Improved brief</p>
            <p className="mt-1 whitespace-pre-wrap">{result.improved_brief}</p>
            <button type="button" onClick={applyImproved} className="mt-2 text-sm font-semibold text-action underline underline-offset-4">
              Use the improved brief
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
