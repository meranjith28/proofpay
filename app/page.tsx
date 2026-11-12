import { sql, migrate } from "@/lib/db";
import { postJob } from "./actions";
import { StatusBadge } from "./status";
import { SubmitButton } from "./submit-button";
import { MoneyPath } from "./money-path";
import { DemoFill } from "./demo-fill";

export const dynamic = "force-dynamic";

const STEPS = [
  { title: "Client posts and funds", text: "The brief becomes a numbered acceptance checklist. The client pays through PayPal, and the money is held." },
  { title: "Freelancer delivers", text: "The freelancer accepts the job and submits the work: pasted text, a PDF or an image." },
  { title: "AI checks every item", text: "Each checklist item gets a pass or fail with quoted evidence. Counts are measured exactly by code, not guessed." },
  { title: "Money moves itself", text: "If every item passes, the agent confirms the funds with PayPal and pays the freelancer. If not, it lists what to fix." },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  await migrate();
  const jobs = await sql`select id, title, amount, status, created_at from jobs order by created_at desc limit 50`;
  const paid = jobs.filter((j) => j.status === "paid");
  const held = jobs.filter((j) => ["funded", "in_progress", "submitted", "needs_revision"].includes(j.status));

  return (
    <div className="space-y-14">
      {error && <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft p-3 text-sm text-danger">{error}</div>}

      <section className="grid items-center gap-10 md:grid-cols-2">
        <div>
          <h1 className="text-4xl font-bold leading-tight md:text-5xl">Freelance payments that release themselves.</h1>
          <p className="mt-4 max-w-xl text-lg text-muted">
            The client funds the job through PayPal. An AI agent checks the delivered work against the checklist both sides
            agreed on, and pays the freelancer the moment every item passes.
          </p>
          <div className="mt-6 flex flex-wrap gap-6 text-sm">
            <span><strong className="text-2xl">{jobs.length}</strong> <span className="text-muted">jobs posted</span></span>
            <span><strong className="text-2xl">${held.reduce((s, j) => s + Number(j.amount), 0).toFixed(2)}</strong> <span className="text-muted">held right now</span></span>
            <span><strong className="text-2xl">${paid.reduce((s, j) => s + Number(j.amount), 0).toFixed(2)}</strong> <span className="text-muted">paid on proof</span></span>
          </div>
        </div>
        <div className="rounded-xl border border-line bg-white p-6">
          <p className="mb-4 text-sm text-muted">Where the money sits while the work is being done</p>
          <MoneyPath amount={25} status="in_progress" />
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold">How it works</h2>
        <ol className="mt-5 grid gap-6 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-t-2 border-ink pt-3">
              <div className="text-sm font-semibold text-muted">Step {i + 1}</div>
              <h3 className="mt-1 text-lg font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-10 md:grid-cols-5">
        <form action={postJob} className="space-y-4 rounded-xl border border-line bg-white p-6 md:col-span-3">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-2xl font-bold">Post a job</h2>
            <DemoFill />
          </div>
          <Field label="Job title"><input name="title" required className="input" placeholder="Market research summary on EV chargers in India" /></Field>
          <Field label="What should be delivered? Be specific: the AI turns this into the checklist">
            <textarea name="brief" required rows={6} className="input" placeholder="A 2-page summary covering market size, the top 5 players with market share, 3 key risks, and cited sources." />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Budget in USD"><input name="amount" type="number" min="1" max="500" step="0.01" required className="input" placeholder="25" /></Field>
            <Field label="Your PayPal email (client)"><input name="client_email" type="email" required className="input" placeholder="you@example.com" /></Field>
          </div>
          <SubmitButton pending="Posting…" stages={["Reading your brief…", "Writing the acceptance checklist…", "Saving the job…"]}>
            Post job and create checklist
          </SubmitButton>
        </form>

        <div className="md:col-span-2">
          <h2 className="mb-3 text-2xl font-bold">Recent jobs</h2>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted">No jobs yet. Post one, or use “Fill in an example job”.</p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line bg-white">
              {jobs.map((j) => (
                <li key={j.id}>
                  <a href={`/jobs/${j.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-paper">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{j.title}</span>
                      <span className="mt-1 inline-block"><StatusBadge status={j.status} /></span>
                    </span>
                    <span className="shrink-0 font-semibold">${Number(j.amount).toFixed(2)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-sm font-medium">{label}</span>{children}</label>;
}
