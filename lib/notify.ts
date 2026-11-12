/**
 * Notifications through Zapier.
 * The app posts one small JSON event to a Zapier "Catch Hook" URL; a Zap then sends the email
 * (or Slack/WhatsApp message) to `to`. Optional and best-effort: if ZAPIER_WEBHOOK_URL is not set
 * or Zapier is down, the app carries on exactly as before.
 */
export type NotifyEvent =
  | "job_funded" | "job_accepted" | "work_paid" | "payment_received"
  | "changes_needed" | "second_opinion_ready" | "job_refunded";

export async function notify(
  event: NotifyEvent,
  msg: { to: string | null | undefined; subject: string; message: string; jobId: string; jobTitle: string; amount?: number },
) {
  const hook = process.env.ZAPIER_WEBHOOK_URL;
  if (!hook || !msg.to) return;
  const appUrl = process.env.APP_URL ?? "";
  const body = {
    event,
    to: msg.to,
    subject: msg.subject,
    message: `${msg.message}\n\nOpen the job: ${appUrl}/jobs/${msg.jobId}\n\nProofPay (PayPal sandbox demo)`,
    job_id: msg.jobId,
    job_title: msg.jobTitle,
    job_url: `${appUrl}/jobs/${msg.jobId}`,
    amount_usd: msg.amount ?? null,
    sent_at: new Date().toISOString(),
  };
  try {
    const res = await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    console.log(`[zapier] ${event} -> ${msg.to}: ${res.status}`);
  } catch (e) {
    console.error(`[zapier] ${event} not sent`, (e as Error)?.message);
  }
}
