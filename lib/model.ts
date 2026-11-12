import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import { groq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

type Candidate = { provider: "groq" | "google" | "anthropic"; id: string };

/**
 * Models to try, in order. If one is busy, slow or unavailable, the next is used.
 * Providers are included only when their API key is set in Render:
 *   GROQ_API_KEY → Groq (fast, free tier)   GOOGLE_GENERATIVE_AI_API_KEY → Gemini
 *   ANTHROPIC_API_KEY → Claude
 * AI_MODELS can override the whole list, e.g. "groq:openai/gpt-oss-120b,google:gemini-3.8-flash".
 */
function candidates(): Candidate[] {
  if (process.env.AI_MODELS) {
    return process.env.AI_MODELS.split(",").map((s) => {
      const [provider, ...rest] = s.trim().split(":");
      return { provider: provider as Candidate["provider"], id: rest.join(":") };
    });
  }
  const list: Candidate[] = [];
  if (process.env.ANTHROPIC_API_KEY) list.push({ provider: "anthropic", id: "claude-sonnet-4-5" });
  if (process.env.GROQ_API_KEY) {
    list.push({ provider: "groq", id: "openai/gpt-oss-120b" }, { provider: "groq", id: "llama-3.3-70b-versatile" });
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    list.push(
      { provider: "google", id: process.env.AI_MODEL || "gemini-3.8-flash" },
      { provider: "google", id: "gemini-flash-latest" },
      { provider: "google", id: "gemini-3.5-flash-lite" },
    );
  }
  return list;
}

function build(c: Candidate): LanguageModel {
  if (c.provider === "groq") return groq(c.id);
  if (c.provider === "anthropic") return anthropic(c.id);
  return google(c.id);
}

/** Per-call options: short reasoning keeps answers fast; a hard timeout stops endless waits. */
export function callOptions() {
  return {
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(60_000),
    providerOptions: {
      google: { thinkingConfig: { thinkingLevel: (process.env.AI_THINKING || "low") as "minimal" | "low" | "medium" | "high" } },
      groq: { strictJsonSchema: false },
    },
  };
}

/** Run an AI call, falling back to the next model if one fails. */
export async function withModel<T>(
  run: (model: LanguageModel) => Promise<T>,
  opts: { needsFiles?: boolean; independent?: boolean } = {},
): Promise<T> {
  let lastError: unknown = new Error("No AI provider key is configured");
  // Groq models here read text only; images and PDFs go straight to Gemini or Claude.
  let list = candidates().filter((c) => !(opts.needsFiles && c.provider === "groq"));
  // A second opinion should come from a different model than the first review.
  if (opts.independent && list.length > 1) list = [...list.slice(1), list[0]];
  for (const c of list) {
    const started = Date.now();
    const name = `${c.provider}:${c.id}`;
    try {
      console.log(`[ai] using ${name}`);
      const result = await run(build(c));
      console.log(`[ai] ${name} answered in ${Math.round((Date.now() - started) / 1000)}s`);
      return result;
    } catch (e) {
      lastError = e;
      console.error(`[ai] ${name} failed after ${Math.round((Date.now() - started) / 1000)}s: ${(e as Error)?.message ?? e}`);
    }
  }
  throw lastError;
}
