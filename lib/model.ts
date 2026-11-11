import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/**
 * Models to try, in order. If the first is overloaded or slow, the next one is used.
 * Override from Render settings: AI_MODEL (primary) and AI_FALLBACK_MODELS (comma-separated).
 */
function candidates(): string[] {
  if (process.env.AI_PROVIDER === "anthropic") return [process.env.AI_MODEL || "claude-sonnet-4-5"];
  const primary = process.env.AI_MODEL || "gemini-3.8-flash";
  const fallbacks = (process.env.AI_FALLBACK_MODELS || "gemini-flash-latest,gemini-3.5-flash-lite")
    .split(",").map((s) => s.trim()).filter(Boolean);
  return [primary, ...fallbacks.filter((m) => m !== primary)];
}

function build(id: string): LanguageModel {
  return process.env.AI_PROVIDER === "anthropic" ? anthropic(id) : google(id);
}

/** Per-call options: short reasoning keeps Gemini fast; a hard timeout stops endless waits. */
export function callOptions() {
  return {
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(60_000),
    providerOptions: {
      google: { thinkingConfig: { thinkingLevel: (process.env.AI_THINKING || "low") as "minimal" | "low" | "medium" | "high" } },
    },
  };
}

/** Run an AI call, falling back to the next model if one is busy, slow or unavailable. */
export async function withModel<T>(run: (model: LanguageModel) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (const id of candidates()) {
    const started = Date.now();
    try {
      console.log(`[ai] using ${id}`);
      const result = await run(build(id));
      console.log(`[ai] ${id} answered in ${Math.round((Date.now() - started) / 1000)}s`);
      return result;
    } catch (e) {
      lastError = e;
      console.error(`[ai] ${id} failed after ${Math.round((Date.now() - started) / 1000)}s: ${(e as Error)?.message ?? e}`);
    }
  }
  throw lastError;
}
