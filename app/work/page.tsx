import { sql, migrate } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { myJobs } from "@/lib/dashboard";
import { CATEGORY_LABELS } from "@/lib/templates";
import type { Category } from "@/lib/measure";
import { TrackRecord } from "../track-record";
import { JobsGrid } from "../jobs-grid";

export const dynamic = "force-dynamic";

const due = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" }) : null;

export default async function FindWork({ searchParams }: { searchParams: Promise<{ type?: string; error?: string }> }) {
  await migrate();
  const user = await currentUser();
  const { type, error } = await searchParams;
  const freelancer = user?.role === "freelancer";
  const open = await sql`
    select id, title, amount, category, due_at, checklist from jobs
    where status = 'funded' and freelancer_email is null ${type ? sql`and category = ${type}` : sql``}
    order by created_at desc limit 100`;
  // Recently taken jobs stay visible as "Accepted" so the board feels alive, but they can't be opened.
  const taken = await sql`
    select id, title, amount, category from jobs
    where freelancer_email is not null and status in ('in_progress','submitted','needs_revision','disputed')
    ${type ? sql`and category = ${type}` : sql``}
    order by updated_at desc limit 6`;
  const mine = freelancer ? await myJobs(user!) : null;
  const types = Object.entries(CATEGORY_LABELS) as [Category, string][];

  return (
    <div className="space-y-12">
      {error && <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft p-3 text-sm">{error}</div>}

      <section className="grid gap-8 md:grid-cols-5">
        <div className="md:col-span-3">
          <h1 className="text-4xl font-bold">Find work</h1>
          <p className="mt-3 max-w-xl text-lg text-muted">
            Every job here is already funded. The money is held by ProofPay, and the checklist tells you exactly what
            “done” means before you start.
          </p>
          {!freelancer && (
            <p className="mt-4 text-sm">
              {user ? "You're signed in as a client. " : ""}
              <a href="/login" className="font-semibold text-action underline underline-offset-4">Sign in as a freelancer</a> to accept jobs.
            </p>
          )}
        </div>
        {freelancer && (
          <div className="rounded-xl border border-line bg-white p-5 md:col-span-2">
            <h2 className="font-bold">Your track record</h2>
            <p className="mb-3 text-sm text-muted">Clients see this when you accept their job.</p>
            <TrackRecord email={user!.email} />
          </div>
        )}
      </section>

      <section className="space-y-5">
        <nav aria-label="Filter by job type" className="flex flex-wrap gap-2">
          <Chip href="/work" active={!type}>All types</Chip>
          {types.map(([key, label]) => <Chip key={key} href={`/work?type=${key}`} active={type === key}>{label}</Chip>)}
        </nav>

        {open.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-muted">
            No funded jobs {type ? "of this type " : ""}are open right now. Check back soon.
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {open.map((j) => (
              <li key={j.id} className="rounded-xl border border-line bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-muted">{CATEGORY_LABELS[j.category as Category] ?? "Writing"}</span>
                    <h2 className="mt-0.5 text-lg font-bold">{j.title}</h2>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>${Number(j.amount).toFixed(2)}</div>
                    <div className="text-xs text-held">Funds held</div>
                  </div>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-muted">
                  {(j.checklist?.items ?? []).slice(0, 3).map((it: { id: number; requirement: string }) => <li key={it.id}>✓ {it.requirement}</li>)}
                  {(j.checklist?.items?.length ?? 0) > 3 && <li>+ {j.checklist.items.length - 3} more requirements</li>}
                </ul>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-muted">{due(j.due_at) ? `Due ${due(j.due_at)}` : "No deadline"}</span>
                  {freelancer ? (
                    <a href={`/jobs/${j.id}`} className="rounded-md bg-action px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">View and accept</a>
                  ) : (
                    <span className="text-sm text-muted">Freelancers can accept</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {taken.length > 0 && (
          <div>
            <h2 className="mt-6 text-lg font-bold">Recently accepted</h2>
            <ul className="mt-3 grid gap-3 md:grid-cols-3">
              {taken.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white/60 p-4 text-muted">
                  <span className="min-w-0 truncate">{j.title}</span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Accepted</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {mine && (
        <section id="mine">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Your work</h2>
              <p className="mt-1 text-muted">Jobs you accepted, their checklist results and payouts.</p>
            </div>
            <p className="text-sm text-muted">
              Earned on proof: <strong className="text-ink">${mine.totals.paid.toFixed(2)}</strong> · In progress: <strong className="text-ink">{mine.totals.active}</strong>
            </p>
          </div>
          <div className="mt-5">
            <JobsGrid rows={mine.rows} counterpartLabel="Client" emptyText="You haven't accepted a job yet. Pick one above." />
          </div>
        </section>
      )}
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <a href={href} aria-current={active ? "page" : undefined}
      className={`rounded-full border px-3 py-1 text-sm ${active ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}>
      {children}
    </a>
  );
}
