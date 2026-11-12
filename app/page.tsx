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
import {
  CategoryIcon, IconArrow, IconBriefcase, IconCheck, IconClock, IconEye, IconLock, IconMail,
  IconRuler, IconScale, IconShield, IconWallet,
} from "./icons";

export const dynamic = "force-dynamic";

const STEPS = [
  { title: "Client posts and funds", text: "The brief becomes a numbered acceptance checklist. The client pays through PayPal, and the money is held." },
  { title: "Freelancer delivers", text: "A live website link, copy, a design, a cleaned spreadsheet, code or a translation." },
  { title: "AI checks every item", text: "Each item gets a pass or fail with evidence. Sizes, counts and page behaviour are measured exactly, never guessed." },
  { title: "Money moves itself", text: "If every item passes, the agent confirms the funds with PayPal and pays the freelancer. If not, it lists what to fix." },
];

const PROOF = [
  { icon: IconRuler, title: "Measured, not guessed", text: "Word counts, image pixels, CSV rows and code functions are computed by code. The AI judges facts." },
  { icon: IconEye, title: "Websites opened for real", text: "A KERNEL cloud browser loads the site on desktop and phone, checks links and forms, and keeps screenshots." },
  { icon: IconShield, title: "Rules the agent can't break", text: "No payout without a full pass and confirmed funds. One payout per job, with a spend cap. All enforced in code." },
  { icon: IconScale, title: "A person has the last word", text: "Freelancers can ask a different AI model for a second opinion. If it passes, the client decides." },
  { icon: IconMail, title: "Everyone stays informed", text: "Funded, accepted, paid, changes needed, refunded: each event sends an email through Zapier." },
  { icon: IconClock, title: "Fair deadlines and refunds", text: "Clients can cancel before anyone accepts, or after a missed deadline. Never in the middle of honest work." },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  await migrate();
  const user = await currentUser();
  if (user?.role === "freelancer") redirect(`/work${error ? `?error=${encodeURIComponent(error)}` : ""}`);

  const alert = error && <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm">{error}</div>;

  if (!user) {
    const [stats] = await sql`
      select count(*)::int as jobs,
             count(*) filter (where status = 'paid')::int as paid_jobs,
             coalesce(sum(amount) filter (where status = 'paid'), 0)::float as paid
      from jobs`;
    return (
      <div className="space-y-20">
        {alert}
        <section className="band hero-grid -mt-10 text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-[1.05fr_1fr] md:py-24">
            <div className="rise">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-white/80">
                <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                Escrow for freelance work, run by an AI agent and PayPal
              </p>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] md:text-6xl">
                Freelance payments that release themselves.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-white/75">
                The client funds the job through PayPal. An AI agent checks the delivered work against the checklist both
                sides agreed on, and pays the freelancer the moment every item passes.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="/login" className="btn btn-light px-5 py-3">Try the live demo <IconArrow className="h-4 w-4" /></a>
                <a href="/login?mode=signup" className="btn btn-outline-light px-5 py-3">Create an account</a>
              </div>
              <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-white/10 pt-6">
                <HeroStat value={String(stats.jobs)} label="jobs posted" />
                <HeroStat value={String(stats.paid_jobs)} label="paid on proof" />
                <HeroStat value={`$${Number(stats.paid).toFixed(2)}`} label="released through PayPal" />
              </dl>
            </div>
            <ProofPreview />
          </div>
        </section>

        <HowItWorks />

        <section>
          <SectionHead title="Why both sides can trust the result" text="The AI is given facts and tools, not the keys. Every decision shows its evidence." />
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PROOF.map((p) => (
              <li key={p.title} className="card p-5">
                <span className="icon-tile">{p.icon({})}</span>
                <h3 className="mt-4 text-lg font-bold">{p.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{p.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SectionHead title="What can you hire for?" text="Any job whose result can be checked against written requirements." />
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TEMPLATES.map((t) => (
              <li key={t.category} className="card flex flex-col p-4">
                <span className="icon-tile"><CategoryIcon category={t.category} /></span>
                <span className="mt-3 text-base font-bold" style={{ fontFamily: "var(--font-display)" }}>{t.label}</span>
                <p className="mt-1 text-sm text-muted">{t.blurb}</p>
                <p className="mt-auto border-t border-line pt-3 text-xs text-muted">Delivered as: {t.submitAs}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="hero-grid overflow-hidden rounded-3xl px-8 py-12 text-white md:px-14">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h2 className="text-3xl font-bold">See a job go from brief to payout.</h2>
              <p className="mt-2 max-w-xl text-white/75">Sign in with a demo client or freelancer. Funding and payouts run end to end with PayPal sandbox money.</p>
            </div>
            <a href="/login" className="btn btn-light shrink-0 px-5 py-3">Open the demo <IconArrow className="h-4 w-4" /></a>
          </div>
        </section>
      </div>
    );
  }

  // Signed-in client: their dashboard, then post a job.
  const { rows, totals } = await myJobs(user);
  return (
    <div className="space-y-14">
      {alert}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted">Welcome back, {user.name}</p>
            <h1 className="mt-1 text-3xl font-bold md:text-4xl">Your jobs</h1>
            <p className="mt-1.5 text-muted">Everything you have posted, where the money is, and what each freelancer delivered.</p>
          </div>
          <a href="#post" className="btn btn-primary">Post a job</a>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Total icon={<IconBriefcase />} label="Jobs posted" value={String(totals.count)} />
          <Total icon={<IconClock />} label="Active now" value={String(totals.active)} />
          <Total icon={<IconLock />} label="Held for you" value={`$${totals.held.toFixed(2)}`} tone="held" />
          <Total icon={<IconWallet />} label="Paid on proof" value={`$${totals.paid.toFixed(2)}`} tone="verified" />
        </dl>
        <div className="mt-5">
          <JobsGrid rows={rows} counterpartLabel="Freelancer" emptyText="You haven't posted a job yet. Pick a job type below to start." />
        </div>
      </section>

      <section>
        <SectionHead title="Start from a job type" text="Pick one to fill the form with a ready-made brief, then adjust it." />
        <div className="mt-6"><TemplatePicker templates={TEMPLATES} /></div>
      </section>

      <section className="grid gap-8 lg:grid-cols-5">
        <form id="post" action={postJob} className="card space-y-5 p-6 md:p-8 lg:col-span-3">
          <div>
            <h2 className="text-2xl font-bold">Post a job</h2>
            <p className="mt-1 text-sm text-muted">The AI turns your brief into the acceptance checklist. You fund it with PayPal in the next step.</p>
          </div>
          <Field label="Job type">
            <select name="category" className="input" defaultValue="writing">
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Job title"><input name="title" required className="input" placeholder="Market research summary on EV chargers in India" /></Field>
          <Field label="What should be delivered?" hint="Be specific: the AI turns this into the checklist.">
            <textarea name="brief" required rows={7} className="input" placeholder="A 2-page summary covering market size, the top 5 players with market share, 3 key risks, and cited sources." />
          </Field>
          <BriefCoach />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Budget in USD"><input name="amount" type="number" min="1" max="500" step="0.01" required className="input" placeholder="25" /></Field>
            <Field label="Due date" hint="Optional"><input name="due_date" type="date" className="input" /></Field>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <p className="text-sm text-muted">Signed in as <span className="break-all text-ink">{user.email}</span></p>
            <SubmitButton pending="Posting…" stages={["Reading your brief…", "Writing the acceptance checklist…", "Saving the job…"]}>
              Post job and create checklist
            </SubmitButton>
          </div>
        </form>
        <aside className="lg:col-span-2">
          <div className="card p-6">
            <h2 className="text-xl font-bold">What happens next</h2>
            <ol className="mt-5 space-y-5">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3.5">
                  <span className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">{i + 1}</span>
                  <div>
                    <h3 className="font-bold">{s.title}</h3>
                    <p className="mt-0.5 text-sm text-muted">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </section>
    </div>
  );
}

/** The hero's product preview: one finished job, as the two sides see it. */
function ProofPreview() {
  const rows = [
    { req: "Page loads with HTTP status 200", ev: "http_status: 200, loaded in 1.2 s" },
    { req: "Menu lists at least 5 items with prices", ev: "list_items_total: 6" },
    { req: "No sideways scrolling on a phone", ev: "mobile_horizontal_scroll: No" },
  ];
  return (
    <div className="rise relative" style={{ animationDelay: "120ms" }}>
      <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-2 shadow-lift backdrop-blur">
        <div className="rounded-xl bg-white p-5 text-ink">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-muted">Website job</p>
              <p className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>One-page website for a café</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-verified-soft px-2.5 py-1 text-xs font-semibold text-verified">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />Verified and paid
            </span>
          </div>
          <div className="mt-4 rounded-xl bg-paper px-2 py-3"><MoneyPath amount={60} status="paid" compact /></div>
          <ul className="mt-4 space-y-2.5">
            {rows.map((r) => (
              <li key={r.req} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-verified text-white"><IconCheck className="h-3 w-3" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">{r.req}</p>
                  <p className="font-mono text-xs text-muted">{r.ev}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-verified/25 bg-verified-soft px-4 py-3">
            <span className="text-sm font-medium text-verified">10 of 10 passed. Paid by PayPal Payouts</span>
            <span className="num text-lg font-bold text-verified">$60.00</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HowItWorks() {
  return (
    <section id="how">
      <SectionHead title="How it works" text="Four steps, and the last one needs nobody to press a button." />
      <ol className="mt-8 grid gap-4 md:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="card relative p-5">
            <span className="num flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">{i + 1}</span>
            <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
            <p className="mt-1.5 text-sm text-muted">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
function SectionHead({ title, text }: { title: string; text: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold md:text-3xl">{title}</h2>
      <p className="mt-2 text-muted">{text}</p>
    </div>
  );
}
function HeroStat({ value, label }: { value: string; label: string }) {
  return <div><dd className="num text-3xl font-bold">{value}</dd><dt className="text-sm text-white/60">{label}</dt></div>;
}
function Total({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "held" | "verified" }) {
  const tile = tone === "held" ? "bg-held-soft text-held" : tone === "verified" ? "bg-verified-soft text-verified" : "bg-action-soft text-action";
  return (
    <div className="card flex items-center gap-3.5 p-4">
      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tile}`}>{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="num truncate text-2xl font-bold leading-tight">{value}</dd>
      </div>
    </div>
  );
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-baseline justify-between gap-3 text-sm font-semibold">
        {label}{hint && <span className="text-xs font-normal text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
