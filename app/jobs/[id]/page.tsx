import { notFound } from "next/navigation";
import { sql, migrate } from "@/lib/db";
import { fundJob, acceptJob, submitWork, refundJob } from "../../actions";
import { StatusBadge } from "../../status";
import { SubmitButton } from "../../submit-button";
import { MoneyPath } from "../../money-path";

export const dynamic = "force-dynamic";

type Item = { id: number; requirement: string; how_to_verify: string };
type Verdict = { id: number; passed: boolean; evidence: string; reason: string };
type Measurements = {
  total_words: number; first_line_words: number; last_line_words: number; bullet_points: number; non_empty_lines: number;
  paragraphs: { index: number; words: number; starts_with: string }[];
};

const STEPS = ["Posted", "Funded", "Accepted", "Submitted", "Paid"];
function stepIndex(status: string) {
  return ({ draft: 0, funding: 0, funded: 1, in_progress: 2, submitted: 3, needs_revision: 3, paid: 4, refunded: 1 } as Record<string, number>)[status] ?? 0;
}
const IST = (d: Date) => new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ funding?: string; error?: string }> }) {
  await migrate();
  const { id } = await params;
  const { funding, error } = await searchParams;
  const [job] = await sql`select * from jobs where id = ${id}`;
  if (!job) notFound();
  const [sub] = await sql`select * from submissions where job_id = ${id} order by id desc limit 1`;
  const events = await sql`select * from events where job_id = ${id} order by id asc`;
  const items: Item[] = job.checklist.items ?? [];
  const verdicts: Verdict[] = sub?.verdict ?? [];
  const latest = (action: string) => [...events].reverse().find((e) => e.action === action);
  const revision = job.status === "needs_revision" ? latest("revision_requested") : undefined;
  const measured: Measurements | undefined = latest("verification_complete")?.detail?.measurements ?? undefined;
  const funded = latest("funding_checked");
  const amount = Number(job.amount);
  const step = stepIndex(job.status);
  const passedCount = verdicts.filter((v) => v.passed).length;

  return (
    <div className="space-y-8">
      {error && <Banner tone="danger">{error}</Banner>}
      {funding === "ok" && <Banner tone="verified">Payment captured. The money is held until the work passes the checklist.</Banner>}
      {funding === "error" && <Banner tone="danger">Funding did not complete. Try “Fund with PayPal” again.</Banner>}
      {funding === "cancelled" && <Banner tone="held">Funding was cancelled. Nothing was charged.</Banner>}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <a href="/" className="text-sm text-muted hover:text-ink">All jobs</a>
          <h1 className="mt-1 text-3xl font-bold">{job.title}</h1>
          <div className="mt-2"><StatusBadge status={job.status} /></div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>${amount.toFixed(2)}</div>
          <div className="text-sm text-muted">Job {job.id}</div>
        </div>
      </div>

      <section className="rounded-xl border border-line bg-white p-6">
        <MoneyPath amount={amount} status={job.status} />
        <ol className="mt-6 grid grid-cols-5 gap-2" aria-label="Job progress">
          {STEPS.map((s, i) => {
            const done = i < step || (i === step && job.status === "paid");
            const current = i === step && job.status !== "paid";
            return (
              <li key={s} className="text-center">
                <div className={`h-1.5 rounded-full ${done ? "bg-verified" : current ? (job.status === "needs_revision" ? "bg-danger" : "bg-held") : "bg-line"}`} />
                <div className={`mt-2 text-xs ${current ? "font-semibold text-ink" : done ? "text-verified" : "text-muted"}`}>{s}</div>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid gap-8 md:grid-cols-5">
        <div className="space-y-6 md:col-span-3">
          <Card
            title="Acceptance checklist"
            aside={verdicts.length ? `${passedCount} of ${items.length} passed` : `${items.length} items`}
            subtitle="Written by AI from the brief. Payment is released only when every item passes."
          >
            <ol className="space-y-3">
              {items.map((it) => {
                const v = verdicts.find((x) => x.id === it.id);
                return (
                  <li key={it.id} className="rounded-lg border border-line p-4">
                    <div className="flex items-start gap-3">
                      <span
                        aria-label={v ? (v.passed ? "passed" : "failed") : `item ${it.id}`}
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${v ? (v.passed ? "bg-verified text-white" : "bg-danger text-white") : "bg-paper text-muted"}`}
                      >
                        {v ? (v.passed ? "✓" : "✗") : it.id}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium">{it.requirement}</div>
                        <div className="text-sm text-muted">How it is checked: {it.how_to_verify}</div>
                        {v && (
                          <div className={`mt-2 rounded-md p-3 text-sm ${v.passed ? "bg-verified-soft" : "bg-danger-soft"}`}>
                            {v.reason}
                            {v.evidence && <div className="mt-1 text-muted">Evidence: “{v.evidence}”</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          {measured && (
            <Card title="Measured by code" subtitle="Exact counts handed to the AI as facts, so word and bullet limits are never guessed.">
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Total words" value={measured.total_words} />
                <Stat label="First line words" value={measured.first_line_words} />
                <Stat label="Bullet points" value={measured.bullet_points} />
                <Stat label="Last line words" value={measured.last_line_words} />
              </dl>
              {measured.paragraphs?.length > 0 && (
                <ul className="mt-4 space-y-1 text-sm text-muted">
                  {measured.paragraphs.map((p) => (
                    <li key={p.index}>Paragraph {p.index}: <span className="font-semibold text-ink">{p.words} words</span>, starts “{p.starts_with}{p.starts_with.length >= 60 ? "…" : ""}”</li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card title="Original brief"><p className="whitespace-pre-wrap text-sm">{job.brief}</p></Card>
        </div>

        <div className="order-first space-y-6 md:order-none md:col-span-2">
          <NextStep job={job} revision={revision?.detail?.message} amount={amount} />

          <Card title="Payment record" subtitle="PayPal references for every money movement on this job.">
            <dl className="space-y-2 text-sm">
              <Row label="Client" value={job.client_email} />
              <Row label="Freelancer" value={job.freelancer_email ?? "Not accepted yet"} />
              <Row label="PayPal order" value={job.paypal_order_id ?? "Not created yet"} mono={!!job.paypal_order_id} />
              <Row label="Capture" value={job.paypal_capture_id ?? "Not captured yet"} mono={!!job.paypal_capture_id} />
              {funded && <Row label="Funds confirmed" value={funded.detail?.checked_via ?? "PayPal"} />}
              <Row label="Payout batch" value={job.payout_batch_id ?? "Not paid yet"} mono={!!job.payout_batch_id} />
              {job.refund_id && <Row label="Refund" value={job.refund_id} mono />}
            </dl>
          </Card>

          {job.paypal_capture_id && !job.payout_batch_id && job.status !== "refunded" && (
            <form action={refundJob.bind(null, job.id)}>
              <SubmitButton variant="danger" pending="Refunding through PayPal…">Cancel job and refund the client</SubmitButton>
            </form>
          )}

          <Card title="Audit trail" subtitle="Who did what, and when (India time).">
            <ol className="space-y-3 text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className={`h-fit w-20 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-medium ${ACTOR[e.actor] ?? ""}`}>{e.actor}</span>
                  <span className="min-w-0">
                    <span className="font-medium">{e.action.replaceAll("_", " ")}</span>
                    {e.detail?.text && <span className="block text-muted">{e.detail.text}</span>}
                    {e.detail?.summary && <span className="block text-muted">{e.detail.summary}</span>}
                    <span className="block text-xs text-muted">{IST(e.created_at)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NextStep({ job, revision, amount }: { job: any; revision?: string; amount: number }) {
  const turn = (who: string, tone: string) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{who}</span>;
  return (
    <section className="rounded-xl border-2 border-ink bg-white p-5">
      {(job.status === "draft" || job.status === "funding") && (
        <form action={fundJob.bind(null, job.id)} className="space-y-3">
          {turn("Client's turn", "bg-ink text-white")}
          <h2 className="text-xl font-bold">Fund the job</h2>
          <p className="text-sm text-muted">You pay ${amount.toFixed(2)} through PayPal. ProofPay holds it; the freelancer is paid only after the work passes.</p>
          <SubmitButton pending="Opening PayPal…">Fund ${amount.toFixed(2)} with PayPal</SubmitButton>
        </form>
      )}
      {job.status === "funded" && (
        <form action={acceptJob.bind(null, job.id)} className="space-y-3">
          {turn("Freelancer's turn", "bg-held text-white")}
          <h2 className="text-xl font-bold">Accept the job</h2>
          <p className="text-sm text-muted">The money is already held. Enter the PayPal email that should receive the payout.</p>
          <input name="freelancer_email" type="email" required placeholder="sb-…@personal.example.com" className="input" />
          <SubmitButton pending="Accepting…">Accept job</SubmitButton>
        </form>
      )}
      {(job.status === "in_progress" || job.status === "needs_revision" || job.status === "submitted") && (
        <form action={submitWork.bind(null, job.id)} className="space-y-3">
          {turn("Freelancer's turn", "bg-held text-white")}
          <h2 className="text-xl font-bold">{job.status === "needs_revision" ? "Fix and resubmit" : "Submit the work"}</h2>
          {revision && <div className="rounded-md bg-danger-soft p-3 text-sm">{revision}</div>}
          <p className="text-sm text-muted">Paste the work below, or upload a PDF, image or text file.</p>
          <textarea name="text" rows={6} className="input" placeholder="Paste your work here" />
          <input name="file" type="file" accept=".pdf,.txt,.md,.csv,.json,.html,.js,.ts,.py,image/*" className="block w-full text-sm" aria-label="Upload a file" />
          <input name="note" className="input" placeholder="Note to the reviewer (optional)" />
          <SubmitButton
            pending="Checking…"
            stages={["Measuring the text exactly…", "Checking each checklist item…", "Confirming funds with PayPal…", "Settling the payment…"]}
          >
            Submit for checking
          </SubmitButton>
        </form>
      )}
      {job.status === "paid" && (
        <div className="space-y-2">
          {turn("Done", "bg-verified text-white")}
          <h2 className="text-xl font-bold">Paid on proof</h2>
          <p className="break-words text-sm">Every item passed. ${amount.toFixed(2)} was sent to <span className="break-all">{job.freelancer_email}</span> through PayPal Payouts.</p>
        </div>
      )}
      {job.status === "refunded" && (
        <div className="space-y-2">
          {turn("Closed", "bg-slate-200 text-slate-700")}
          <h2 className="text-xl font-bold">Refunded</h2>
          <p className="text-sm">The job was cancelled and the client got the money back.</p>
        </div>
      )}
    </section>
  );
}

const ACTOR: Record<string, string> = {
  client: "bg-ink text-white", freelancer: "bg-held-soft text-held",
  agent: "bg-blue-50 text-action", paypal: "bg-verified-soft text-verified",
};

function Card({ title, subtitle, aside, children }: { title: string; subtitle?: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-bold">{title}</h2>
        {aside && <span className="text-sm font-semibold text-muted">{aside}</span>}
      </div>
      {subtitle && <p className="mb-4 text-sm text-muted">{subtitle}</p>}
      <div className={subtitle ? "" : "mt-3"}>{children}</div>
    </section>
  );
}
function Stat({ label, value }: { label: string; value: number }) {
  return <div><dt className="text-xs text-muted">{label}</dt><dd className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{value}</dd></div>;
}
function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className={`min-w-0 break-all sm:text-right ${mono ? "font-mono text-xs leading-5" : ""}`}>{value}</dd>
    </div>
  );
}
function Banner({ tone, children }: { tone: "verified" | "danger" | "held"; children: React.ReactNode }) {
  const c = { verified: "bg-verified-soft border-verified/30", danger: "bg-danger-soft border-danger/30", held: "bg-held-soft border-held/30" }[tone];
  return <div role="status" className={`rounded-md border p-3 text-sm ${c}`}>{children}</div>;
}
