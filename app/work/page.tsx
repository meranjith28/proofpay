import { sql, migrate } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { myJobs } from "@/lib/dashboard";
import { CATEGORY_LABELS } from "@/lib/templates";
import type { Category } from "@/lib/measure";
import { TrackRecord } from "../track-record";
import { JobsGrid } from "../jobs-grid";
import { CategoryIcon, IconArrow, IconCheck, IconClock, IconLock } from "../icons";

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
  const asked = freelancer
    ? new Set((await sql`select job_id from job_requests where lower(freelancer_email) = lower(${user!.email})`).map((r) => r.job_id as string))
    : new Set<string>();
  const mine = freelancer ? await myJobs(user!) : null;
  const types = Object.entries(CATEGORY_LABELS) as [Category, string][];

  return (
    <div className="space-y-12">
      {error && <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm">{error}</div>}

      <section className="band hero-grid -mt-10 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-6 py-12 md:grid-cols-5">
          <div className="md:col-span-3">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-white/80">
              <IconLock className="h-3.5 w-3.5 text-mint" />
              {open.length} funded {open.length === 1 ? "job" : "jobs"} open right now
            </p>
            <h1 className="mt-4 text-4xl font-extrabold md:text-5xl">Find work</h1>
            <p className="mt-3 max-w-xl text-lg text-white/75">
              Every job here is already funded. The money is held by ProofPay, and the checklist tells you exactly what
              “done” means before you start.
            </p>
            {!freelancer && (
              <p className="mt-4 text-sm text-white/80">
                {user ? "You're signed in as a client. " : ""}
                <a href="/login" className="font-semibold text-white underline underline-offset-4">Sign in as a freelancer</a> to request jobs.
              </p>
            )}
          </div>
          {freelancer && (
            <div className="rounded-2xl bg-white p-5 text-ink shadow-lift md:col-span-2">
              <h2 className="text-lg font-bold">Your track record</h2>
              <p className="mb-3 text-sm text-muted">Clients see this when you request their job.</p>
              <TrackRecord email={user!.email} />
            </div>
          )}
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-bold">Open jobs</h2>
          <nav aria-label="Filter by job type" className="flex flex-wrap gap-1.5">
            <Chip href="/work" active={!type}>All types</Chip>
            {types.map(([key, label]) => <Chip key={key} href={`/work?type=${key}`} active={type === key}>{label}</Chip>)}
          </nav>
        </div>

        {open.length === 0 ? (
          <div className="card border-dashed p-10 text-center">
            <p className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>No funded jobs {type ? "of this type " : ""}are open right now</p>
            <p className="mt-1 text-muted">New jobs appear here the moment a client funds them.</p>
            {type && <a href="/work" className="btn btn-ghost mt-4">Show all types</a>}
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {open.map((j) => (
              <li key={j.id} className="card flex flex-col p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift">
                <div className="flex items-start gap-3.5">
                  <span className="icon-tile"><CategoryIcon category={j.category} /></span>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-muted">{CATEGORY_LABELS[j.category as Category] ?? "Writing"}</span>
                    <h3 className="text-lg font-bold leading-snug">{j.title}</h3>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="num text-2xl font-bold">${Number(j.amount).toFixed(2)}</div>
                    <div className="inline-flex items-center gap-1 text-xs font-semibold text-held"><IconLock className="h-3 w-3" />Funds held</div>
                  </div>
                </div>
                <ul className="mt-4 space-y-1.5 rounded-xl bg-paper p-3.5 text-sm">
                  {(j.checklist?.items ?? []).slice(0, 3).map((it: { id: number; requirement: string }) => (
                    <li key={it.id} className="flex gap-2"><IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-verified" /><span className="min-w-0">{it.requirement}</span></li>
                  ))}
                  {(j.checklist?.items?.length ?? 0) > 3 && <li className="pl-6 text-muted">and {j.checklist.items.length - 3} more requirements</li>}
                </ul>
                <div className="mt-auto flex items-center justify-between pt-4">
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted"><IconClock className="h-4 w-4" />{due(j.due_at) ? `Due ${due(j.due_at)}` : "No deadline"}</span>
                  {freelancer ? (
                    asked.has(j.id)
                      ? <a href={`/jobs/${j.id}`} className="btn btn-ghost px-3.5 py-2"><IconCheck className="h-4 w-4 text-verified" />Requested: waiting for the client</a>
                      : <a href={`/jobs/${j.id}`} className="btn btn-primary px-3.5 py-2">View and request <IconArrow className="h-4 w-4" /></a>
                  ) : (
                    <span className="text-sm text-muted">Freelancers can request</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {taken.length > 0 && (
          <div>
            <h2 className="mt-8 text-lg font-bold">Recently assigned</h2>
            <ul className="mt-3 grid gap-3 md:grid-cols-3">
              {taken.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white/60 p-4 text-muted">
                  <span className="min-w-0 truncate">{j.title}</span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Assigned</span>
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
              <p className="mt-1 text-muted">Jobs assigned to you, their checklist results and payouts.</p>
            </div>
            <dl className="flex gap-3">
              <div className="card px-4 py-2.5"><dt className="text-xs text-muted">Earned on proof</dt><dd className="num text-xl font-bold text-verified">${mine.totals.paid.toFixed(2)}</dd></div>
              <div className="card px-4 py-2.5"><dt className="text-xs text-muted">In progress</dt><dd className="num text-xl font-bold">{mine.totals.active}</dd></div>
            </dl>
          </div>
          <div className="mt-5">
            <JobsGrid rows={mine.rows} counterpartLabel="Client" emptyText="No jobs assigned to you yet. Request one above." />
          </div>
        </section>
      )}
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <a href={href} aria-current={active ? "page" : undefined}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${active ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:border-ink hover:text-ink"}`}>
      {children}
    </a>
  );
}
