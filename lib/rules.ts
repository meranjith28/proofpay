/** Refund rule: before anyone accepts, or after a missed deadline. Never while a freelancer is working on time. */
export function canRefund(job: { status: string; due_at: Date | null; paypal_capture_id: string | null; payout_batch_id: string | null }) {
  if (!job.paypal_capture_id || job.payout_batch_id) return false;
  if (job.status === "funded") return true;
  const overdue = !!job.due_at && new Date(job.due_at).getTime() < Date.now();
  return overdue && ["in_progress", "needs_revision"].includes(job.status);
}

/** A job is overdue when its due date has passed and the work has not been paid. */
export function isOverdue(job: { status: string; due_at: Date | null }) {
  return !!job.due_at && new Date(job.due_at).getTime() < Date.now() && !['paid', 'refunded'].includes(job.status);
}
