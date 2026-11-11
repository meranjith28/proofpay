import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";

/**
 * The AI model used everywhere. Change it from Render's settings (AI_MODEL)
 * without touching code, e.g. when a provider retires a model version.
 */
export function model() {
  if (process.env.AI_PROVIDER === "anthropic") {
    return anthropic(process.env.AI_MODEL || "claude-sonnet-4-5");
  }
  return google(process.env.AI_MODEL || "gemini-3.8-flash");
}
