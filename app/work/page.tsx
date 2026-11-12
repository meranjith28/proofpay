import { sql, migrate } from "@/lib/db";
import { CATEGORY_LABELS } from "@/lib/templates";
import type { Category } from "@/lib/measure";
import { TrackRecord } from "../track-record";

export const dynamic = "force-dynamic";

const due = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" }) : null;

export default async function FindWork({ searchParams }: { searchParams: Promise<{ me?: string; type?: string }> }) {
  await migrate();
  const { me, type } = await searchParams;
  const open = await sql`
    select id, title, amount, category, due_at, checklist, created_at
    from jobs where status = 'funded'
    ${type ? sql`and category = ${type}` : sql``}
    order by created_at desc limit 100`;
  const types = Object.entries(CATEGORY_LABELS) as [Category, string][];

  return (
    <div className="space-y-10">
      <section className="grid gap-8 md:grid-cols-5">
        <div className="md:col-span-3">
          <h1 className="text-4xl font-bold">Find work</h1>
          <p className="mt-3 max-w-xl text-lg text-muted">
            Every job here is already funded. The money is held by ProofPay, and the checklist tells you exactly what
            “done” means before you start.
          </p>
        </div>
        <form className="rounded-xl border border-line bg-white p-5 md:col-span-2" action="/work">
          <label className="block space-y-1">
            <span className="text-sm font-medium">See your track record</span>
            <input name="me" type="email" defaultValue={me} placeholder="your PayPal email" className="input" />
          </label>
          {type && <input type="hidden" name="type" value={type} />}
          <button className="mt-3 rounded-md border border-ink px-3 py-1.5 text-sm font-semibold hover:bg-paper">Show my record</button>
          {me && <div className="mt-4"><TrackRecord email={me} /></div>}
        </form>
      </section>

      <nav aria-label="Filter by job type" className="flex flex-wrap gap-2">
        <Chip href={`/work${me ? `?me=${encodeURIComponent(me)}` : ""}`} active={!type}>All types</Chip>
        {types.map(([key, label]) => (
          <Chip key={key} href={`/work?type=${key}${me ? `&me=${encodeURIComponent(me)}` : ""}`} active={type === key}>{label}</Chip>
        ))}
      </nav>

      {open.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-muted">
          No funded jobs {type ? "of this type " : ""}are open right now. Post one from the home page to try the flow.
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
                {(j.checklist?.items ?? []).slice(0, 3).map((it: { id: number; requirement: string }) => (
                  <li key={it.id}>✓ {it.requirement}</li>
                ))}
                {(j.checklist?.items?.length ?? 0) > 3 && <li>+ {j.checklist.items.length - 3} more requirements</li>}
              </ul>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-muted">{due(j.due_at) ? `Due ${due(j.due_at)}` : "No deadline"}</span>
                <a href={`/jobs/${j.id}`} className="rounded-md bg-action px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">
                  View and accept
                </a>
              </div>
            </li>
          ))}
        </ul>
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
