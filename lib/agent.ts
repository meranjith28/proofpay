import { generateText, tool, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { sql, logEvent } from "./db";
import { payFreelancer, refundClient } from "./paypal";

function model() {
  return process.env.AI_PROVIDER === "anthropic" ? anthropic("claude-sonnet-4-5") : google("gemini-2.5-flash");
}

/**
 * Settlement agent: after verification, decides and executes the payment outcome
 * by calling PayPal tools itself. Hard guards live inside the tools, not the prompt,
 * so the model cannot pay out a job that did not pass.
 */
export async function settleJob(jobId: string) {
  const [job] = await sql`select * from jobs where id = ${jobId}`;
  const [sub] = await sql`select * from submissions where job_id = ${jobId} order by id desc limit 1`;
  if (!job || !sub) throw new Error("Job or submission not found");

  const tools = {
    release_payment: tool({
      description: "Pay the freelancer via PayPal Payouts. Only valid when every checklist item passed.",
      inputSchema: z.object({ note: z.string().describe("Short note to the freelancer explaining the payment") }),
      execute: async ({ note }) => {
        if (sub.overall !== "pass") return { ok: false, error: "Refused: submission did not pass verification" };
        if (job.payout_batch_id) return { ok: false, error: "Already paid" };
        const payout = await payFreelancer(jobId, job.freelancer_email, Number(job.amount), note);
        await sql`update jobs set status = 'paid', payout_batch_id = ${payout.batchId}, updated_at = now() where id = ${jobId}`;
        await logEvent(jobId, "paypal", "payout_sent", payout);
        return { ok: true, ...payout };
      },
    }),
    request_revision: tool({
      description: "Send the work back to the freelancer listing exactly which checklist items are missing.",
      inputSchema: z.object({ message: z.string().describe("Clear list of what is missing and how to fix it") }),
      execute: async ({ message }) => {
        await sql`update jobs set status = 'needs_revision', updated_at = now() where id = ${jobId}`;
        await logEvent(jobId, "agent", "revision_requested", { message });
        return { ok: true };
      },
    }),
  };

  const result = await generateText({
    model: model(),
    tools,
    stopWhen: stepCountIs(4),
    system:
      "You are the settlement agent of an escrow platform. Based on the verification result, " +
      "call exactly one tool: release_payment if overall is 'pass', otherwise request_revision " +
      "with a specific, friendly list of the failed items. Then reply with one sentence summarising what you did.",
    prompt: `Job: ${job.title} ($${job.amount})\nVerification:\n${JSON.stringify({ overall: sub.overall, items: sub.verdict }, null, 2)}`,
  });
  await logEvent(jobId, "agent", "settlement_summary", { text: result.text });
  return result.text;
}

/** Cancel a funded job and return the client's money. Human-triggered, executed by the platform. */
export async function cancelAndRefund(jobId: string) {
  const [job] = await sql`select * from jobs where id = ${jobId}`;
  if (!job?.paypal_capture_id) throw new Error("Nothing to refund");
  if (job.payout_batch_id) throw new Error("Freelancer already paid; cannot refund");
  const refund = await refundClient(jobId, job.paypal_capture_id);
  await sql`update jobs set status = 'refunded', refund_id = ${refund.refundId}, updated_at = now() where id = ${jobId}`;
  await logEvent(jobId, "paypal", "refund_issued", refund);
}
