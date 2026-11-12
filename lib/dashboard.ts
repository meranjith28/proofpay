import { sql } from "./db";
import { CATEGORY_LABELS } from "./templates";
import { isOverdue } from "./rules";
import type { Category } from "./measure";
import type { JobRow } from "@/app/jobs-grid";
import type { User } from "./auth";

const LABELS: Record<string, string> = {
  draft: "Not funded", funding: "Funding", funded: "Open",
  in_progress: "In progress", submitted: "Being checked", needs_revision: "Needs changes",
  disputed: "Client decides", paid: "Paid", refunded: "Refunded",
};

/** Rows for the signed-in user's own jobs, ready for the AG Grid dashboard. */
export async function myJobs(user: User): Promise<{ rows: JobRow[]; totals: { count: number; held: number; paid: number; active: number } }> {
  const jobs = user.role === "client"
    ? await sql`select * from jobs where lower(client_email) = lower(${user.email}) order by updated_at desc`
    : await sql`select * from jobs where lower(freelancer_email) = lower(${user.email}) order by updated_at desc`;
  const latest = await sql`
    select distinct on (job_id) job_id, verdict from submissions
    where job_id = any(${jobs.map((j) => j.id)}) order by job_id, id desc`;
  const verdictBy = new Map(latest.map((s) => [s.job_id, s.verdict as { passed: boolean }[]]));
  const rows: JobRow[] = jobs.map((j) => {
    const items = j.checklist?.items?.length ?? 0;
    const v = verdictBy.get(j.id);
    return {
      id: j.id,
      title: j.title,
      type: CATEGORY_LABELS[j.category as Category] ?? "Writing",
      amount: Number(j.amount),
      status: j.status,
      statusLabel: LABELS[j.status] ?? j.status,
      due: j.due_at ? new Date(j.due_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" }) : null,
      overdue: isOverdue(j as never),
      counterpart: (user.role === "client" ? j.freelancer_email : j.client_email) ?? "Not accepted yet",
      checks: v ? `${v.filter((x) => x.passed).length} of ${items} passed` : `${items} ${items === 1 ? "item" : "items"}`,
      updated: new Date(j.updated_at).toISOString(),
    };
  });
  const sum = (f: (j: (typeof jobs)[number]) => boolean) => jobs.filter(f).reduce((a, j) => a + Number(j.amount), 0);
  return {
    rows,
    totals: {
      count: jobs.length,
      held: sum((j) => ["funded", "in_progress", "submitted", "needs_revision", "disputed"].includes(j.status)),
      paid: sum((j) => j.status === "paid"),
      active: jobs.filter((j) => ["funded", "in_progress", "submitted", "needs_revision", "disputed"].includes(j.status)).length,
    },
  };
}
