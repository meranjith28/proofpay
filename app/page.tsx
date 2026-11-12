import { redirect } from "next/navigation";
import { sql, migrate } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { myJobs } from "@/lib/dashboard";
import { postJob } from "./actions";
import { SubmitButton } from "./submit-button";
import { MoneyPath } from "./money-path";
import { TemplatePicker } from "./template-picker";
import { JobsGrid } from "./jobs-grid";
import { BriefCoach } from "./brief-coach";
import { TEMPLATES, CATEGORY_LABELS } from "@/lib/templates";

export const dynamic = "force-dynamic";

const STEPS = [
  { title: "Client posts and funds", text: "The brief becomes a numbered acceptance checklist. The client pays through PayPal, and the money is held." },
  { title: "Freelancer delivers", text: "Copy, a design, a cleaned spreadsheet, code or a translation: pasted, or uploaded as a file." },
  { title: "AI checks every item", text: "Each item gets a pass or fail with evidence. Word counts, image sizes, CSV rows and code functions are measured exactly by code." },
  { title: "Money moves itself", text: "If every item passes, the agent confirms the funds with PayPal and pays the freelancer. If not, it lists what to fix." },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  await migrate();
  const user = await currentUser();
  if (user?.role === "freelancer") redirect(`/work${error ? `?error=${encodeURIComponent(error)}` : ""}`);

  const alert = error && <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft p-3 text-sm">{error}</div>;

  if (!user) {
    const [stats] = await sql`
      select count(*)::int as jobs,
             coalesce(sum(amount) filter (where status = 'paid'), 0)::float as paid
      from jobs`;
    return (
      <div className="space-y-14">
        {alert}
        <section className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <h1 className="text-4xl font-bold leading-tight md:text-5xl">Freelance payments that release themselves.</h1>
            <p className="mt-4 max-w-xl text-lg text-muted">
              The client funds the job through PayPal. An AI agent checks the delivered work against the checklist both sides
              agreed on, and pays the freelancer the moment every item passes.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="/login?mode=signup" className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Create an account</a>
              <a href="/login" className="rounded-md border border-ink px-4 py-2 text-sm font-semibold hover:bg-white">Sign in or try a demo</a>
            </div>
            <p className="mt-6 text-sm text-muted">
              <strong className="text-ink">{stats.jobs}</strong> jobs posted · <strong className="text-ink">${Number(stats.paid).toFixed(2)}</strong> paid on proof (PayPal sandbox)
            </p>
          </div>
          <div className="rounded-xl border border-line bg-white p-6">
            <p className="mb-4 text-sm text-muted">Where the money sits while the work is being done</p>
            <MoneyPath amount={25} status="in_progress" />
          </div>
        </section>
        <HowItWorks />
        <section>
          <h2 className="text-2xl font-bold">What can you hire for?</h2>
          <p className="mt-1 text-muted">Any job whose result can be checked against written requirements.</p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.map((t) => (
              <li key={t.category} className="rounded-xl border border-line bg-white p-4">
                <span className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>{t.label}</span>
                <p className="mt-1 text-sm text-muted">{t.blurb}</p>
                <p className="mt-2 text-sm text-muted">Delivered as: {t.submitAs}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  // Signed-in client: their dashboard, then post a job.
  const { rows, totals } = await myJobs(user);
  return (
    <div className="space-y-12">
      {alert}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Your jobs</h1>
            <p className="mt-1 text-muted">Everything you have posted, where the money is, and what each freelancer delivered.</p>
          </div>
          <dl className="flex flex-wrap gap-6 text-sm">
            <Total label="Jobs" value={String(totals.count)} />
            <Total label="Active" value={String(totals.active)} />
            <Total label="Held for you" value={`$${totals.held.toFixed(2)}`} />
            <Total label="Paid on proof" value={`$${totals.paid.toFixed(2)}`} />
          </dl>
        </div>
        <div className="mt-5">
          <JobsGrid rows={rows} counterpartLabel="Freelancer" emptyText="You haven't posted a job yet. Pick a job type below to start." />
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold">Start from a job type</h2>
        <p className="mt-1 text-muted">Pick one to fill the form with a ready-made brief, then adjust it.</p>
        <div className="mt-5"><TemplatePicker templates={TEMPLATES} /></div>
      </section>

      <section className="grid gap-10 md:grid-cols-5">
        <form id="post" action={postJob} className="space-y-4 rounded-xl border border-line bg-white p-6 md:col-span-3">
          <h2 className="text-2xl font-bold">Post a job</h2>
          <Field label="Job type">
            <select name="category" className="input" defaultValue="writing">
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Job title"><input name="title" required className="input" placeholder="Market research summary on EV chargers in India" /></Field>
          <Field label="What should be delivered? Be specific: the AI turns this into the checklist">
            <textarea name="brief" required rows={6} className="input" placeholder="A 2-page summary covering market size, the top 5 players with market share, 3 key risks, and cited sources." />
          </Field>
          <BriefCoach />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Budget in USD"><input name="amount" type="number" min="1" max="500" step="0.01" required className="input" placeholder="25" /></Field>
            <Field label="Due date (optional)"><input name="due_date" type="date" className="input" /></Field>
          </div>
          <p className="text-sm text-muted">You pay from your PayPal account in the next step. Signed in as {user.email}.</p>
          <SubmitButton pending="Posting…" stages={["Reading your brief…", "Writing the acceptance checklist…", "Saving the job…"]}>
            Post job and create checklist
          </SubmitButton>
        </form>
        <aside className="space-y-4 md:col-span-2">
          <HowItWorks compact />
        </aside>
      </section>
    </div>
  );
}

function HowItWorks({ compact = false }: { compact?: boolean }) {
  return (
    <section>
      <h2 className={compact ? "text-xl font-bold" : "text-2xl font-bold"}>How it works</h2>
      <ol className={`mt-4 grid gap-5 ${compact ? "" : "md:grid-cols-4"}`}>
        {STEPS.map((s, i) => (
          <li key={s.title} className="border-t-2 border-ink pt-3">
            <div className="text-sm font-semibold text-muted">Step {i + 1}</div>
            <h3 className="mt-1 text-lg font-bold">{s.title}</h3>
            <p className="mt-1 text-sm text-muted">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
function Total({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-muted">{label}</dt><dd className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{value}</dd></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-sm font-medium">{label}</span>{children}</label>;
}
