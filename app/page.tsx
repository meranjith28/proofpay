import { sql, migrate } from "@/lib/db";
import { postJob } from "./actions";
import { StatusBadge } from "./status";
import { SubmitButton } from "./submit-button";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  await migrate();
  const jobs = await sql`select id, title, amount, status, created_at from jobs order by created_at desc limit 50`;
  const paid = jobs.filter((j) => j.status === "paid");

  return (
    <div className="space-y-10">
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</div>}
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">Get paid the moment the work is proven.</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Clients fund jobs through PayPal. An AI agent turns the brief into an acceptance checklist, checks the
          delivered work item by item, and releases payment automatically when every requirement is met.
        </p>
        <div className="mt-6 grid grid-cols-3 gap-4">
          <Stat label="Jobs posted" value={jobs.length} />
          <Stat label="Verified & paid" value={paid.length} />
          <Stat label="Paid out" value={`$${paid.reduce((s, j) => s + Number(j.amount), 0).toFixed(2)}`} />
        </div>
      </section>

      <section className="grid gap-8 md:grid-cols-5">
        <form action={postJob} className="space-y-4 rounded-xl border bg-white p-6 md:col-span-3">
          <h2 className="text-lg font-semibold">Post a job</h2>
          <Field label="Job title"><input name="title" required className="input" placeholder="Market research report on EV chargers in India" /></Field>
          <Field label="What do you need? Describe the deliverables">
            <textarea name="brief" required rows={6} className="input" placeholder="A 2-page PDF covering market size, top 5 players with market share, 3 key risks, and cited sources." />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Budget (USD)"><input name="amount" type="number" min="1" max="500" step="0.01" required className="input" placeholder="50" /></Field>
            <Field label="Your PayPal email"><input name="client_email" type="email" required className="input" placeholder="you@example.com" /></Field>
          </div>
          <SubmitButton pending="AI is drafting the acceptance checklist…">Post job & generate checklist</SubmitButton>
        </form>

        <div className="md:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">Recent jobs</h2>
          <ul className="space-y-2">
            {jobs.length === 0 && <li className="text-sm text-slate-500">No jobs yet.</li>}
            {jobs.map((j) => (
              <li key={j.id}>
                <a href={`/jobs/${j.id}`} className="block rounded-lg border bg-white p-3 hover:border-blue-400">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{j.title}</span>
                    <span className="text-sm text-slate-600">${Number(j.amount).toFixed(2)}</span>
                  </div>
                  <div className="mt-2"><StatusBadge status={j.status} /></div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-sm font-medium text-slate-700">{label}</span>{children}</label>;
}
