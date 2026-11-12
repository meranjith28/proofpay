import { notFound, redirect } from "next/navigation";
import { currentUser, accessTo } from "@/lib/auth";
import { sql, migrate } from "@/lib/db";
import { fundJob, requestJob, withdrawRequest, assignFreelancer, submitWork, refundJob, requestSecondOpinion, decideDispute } from "../../actions";
import { AskAgent } from "../../ask-agent";
import { StatusBadge } from "../../status";
import { SubmitButton } from "../../submit-button";
import { MoneyPath } from "../../money-path";
import { TrackRecord } from "../../track-record";
import { SampleFill } from "../../sample-fill";
import { canRefund, isOverdue } from "@/lib/rules";
import { CATEGORY_LABELS, templateFor } from "@/lib/templates";
import type { Category } from "@/lib/measure";
import { CategoryIcon, IconCheck, IconX, IconClock } from "../../icons";

export const dynamic = "force-dynamic";

type Item = { id: number; requirement: string; how_to_verify: string };
type Verdict = { id: number; passed: boolean; evidence: string; reason: string };
type Measurements = Record<string, unknown>;

const STEPS = ["Posted", "Funded", "Assigned", "Submitted", "Paid"];
function stepIndex(status: string) {
  return ({ draft: 0, funding: 0, funded: 1, in_progress: 2, submitted: 3, needs_revision: 3, disputed: 3, paid: 4, refunded: 1 } as Record<string, number>)[status] ?? 0;
}
const IST = (d: Date) => new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ funding?: string; error?: string }> }) {
  await migrate();
  const { id } = await params;
  const { funding, error } = await searchParams;
  const [job] = await sql`select * from jobs where id = ${id}`;
  if (!job) notFound();
  const user = await currentUser();
  if (!user) redirect("/login");
  const access = accessTo(job as never, user);
  if (!access.canView) return <NotYours taken={user.role === "freelancer" && !!job.freelancer_email} role={user.role} />;
  const [sub] = await sql`select * from submissions where job_id = ${id} order by id desc limit 1`;
  const events = await sql`select * from events where job_id = ${id} order by id asc`;
  const requests = job.status === "funded"
    ? await sql`select id, freelancer_email, freelancer_name, created_at from job_requests where job_id = ${id} order by id asc`
    : [];
  const myRequest = user.role === "freelancer" && requests.some((r) => r.freelancer_email.toLowerCase() === user.email.toLowerCase());
  const items: Item[] = job.checklist.items ?? [];
  const verdicts: Verdict[] = sub?.verdict ?? [];
  const latest = (action: string) => [...events].reverse().find((e) => e.action === action);
  const revision = job.status === "needs_revision" ? latest("revision_requested") : undefined;
  const measured: Measurements | undefined =
    [...events].reverse().find((e) => e.detail?.measurements)?.detail?.measurements ?? undefined;
  const secondOpinion = sub?.reviewer === "second_opinion";
  const funded = latest("funding_checked");
  const amount = Number(job.amount);
  const step = stepIndex(job.status);
  const passedCount = verdicts.filter((v) => v.passed).length;
  const overdue = isOverdue(job as never);
  const dueText = job.due_at ? new Date(job.due_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" }) : "";
  const refundable = access.isClient && canRefund(job as never);
  const sample = templateFor(job.category)?.sample;
  const sampleUrl = job.category === "website" ? `${process.env.APP_URL ?? ""}/samples/brew-and-bloom/index.html` : undefined;

  return (
    <div className="space-y-8">
      {error && <Banner tone="danger">{error}</Banner>}
      {funding === "ok" && <Banner tone="verified">Payment captured. The money is held until the work passes the checklist.</Banner>}
      {funding === "error" && <Banner tone="danger">Funding did not complete. Try “Fund with PayPal” again.</Banner>}
      {funding === "cancelled" && <Banner tone="held">Funding was cancelled. Nothing was charged.</Banner>}
      {overdue && ["in_progress", "needs_revision"].includes(job.status) && (
        <Banner tone="danger">The deadline has passed without accepted work. The client can now cancel and get a refund, or wait for the delivery.</Banner>
      )}

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-5 p-6 md:p-7">
          <div className="flex min-w-0 gap-4">
            <span className="icon-tile mt-1 h-12 w-12 max-sm:hidden"><CategoryIcon category={job.category} className="h-6 w-6" /></span>
            <div className="min-w-0">
              <a href={user.role === "freelancer" ? "/work" : "/"} className="text-sm font-medium text-muted hover:text-ink">
                {user.role === "freelancer" ? "Find work" : "Your jobs"} <span aria-hidden>/</span> Job {job.id}
              </a>
              <h1 className="mt-1 text-3xl font-bold md:text-4xl">{job.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <StatusBadge status={job.status} />
                <span className="rounded-full border border-line bg-white px-2.5 py-1 text-xs font-semibold">{CATEGORY_LABELS[job.category as Category] ?? "Writing"}</span>
                {job.due_at && (
                  <span className={`inline-flex items-center gap-1 text-xs ${overdue ? "font-semibold text-danger" : "text-muted"}`}>
                    <IconClock className="h-3.5 w-3.5" />{overdue ? "Overdue: was due " : "Due "}{dueText}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-paper px-5 py-3 text-right">
            <div className="text-xs font-medium text-muted">Job budget</div>
            <div className="num text-3xl font-bold md:text-4xl">${amount.toFixed(2)}</div>
          </div>
        </div>
        <div className="border-t border-line bg-gradient-to-b from-paper/60 to-white px-6 pb-6 pt-5 md:px-7">
          <MoneyPath amount={amount} status={job.status} />
          <ol className="mt-6 grid grid-cols-5 gap-2" aria-label="Job progress">
            {STEPS.map((s, i) => {
              const done = i < step || (i === step && job.status === "paid");
              const current = i === step && job.status !== "paid";
              return (
                <li key={s} className="text-center">
                  <div className={`h-1.5 rounded-full ${done ? "bg-verified" : current ? (job.status === "needs_revision" ? "bg-danger" : "bg-held") : "bg-line"}`} />
                  <div className={`mt-2 text-xs ${current ? "font-bold text-ink" : done ? "font-medium text-verified" : "text-muted"}`}>{s}</div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <div className="grid gap-8 md:grid-cols-5">
        <div className="space-y-6 md:col-span-3">
          <Card
            title="Acceptance checklist"
            aside={verdicts.length ? `${passedCount} of ${items.length} passed` : `${items.length} ${items.length === 1 ? "item" : "items"}`}
            subtitle={secondOpinion
              ? "Showing the independent second opinion, requested by the freelancer."
              : "Written by AI from the brief. Payment is released only when every item passes."}
          >
            {verdicts.length > 0 && (
              <div className="mb-4 h-2 overflow-hidden rounded-full bg-danger-soft" aria-hidden>
                <div className="h-full rounded-full bg-verified" style={{ width: `${items.length ? (passedCount / items.length) * 100 : 0}%` }} />
              </div>
            )}
            <ol className="space-y-3">
              {items.map((it) => {
                const v = verdicts.find((x) => x.id === it.id);
                return (
                  <li key={it.id} className={`rounded-xl border p-4 ${v ? (v.passed ? "border-verified/25" : "border-danger/30") : "border-line"}`}>
                    <div className="flex items-start gap-3">
                      <span
                        aria-label={v ? (v.passed ? "passed" : "failed") : `item ${it.id}`}
                        className={`num mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${v ? (v.passed ? "bg-verified text-white" : "bg-danger text-white") : "bg-paper text-muted"}`}
                      >
                        {v ? (v.passed ? <IconCheck className="h-4 w-4" /> : <IconX className="h-4 w-4" />) : it.id}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold">{it.requirement}</div>
                        <div className="text-sm text-muted">How it is checked: {it.how_to_verify}</div>
                        {v && (
                          <div className={`mt-3 rounded-lg p-3 text-sm ${v.passed ? "bg-verified-soft" : "bg-danger-soft"}`}>
                            {v.reason}
                            {v.evidence && <div className="mt-1.5 break-words font-mono text-xs text-muted">Evidence: “{v.evidence}”</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          {measured && <MeasuredPanel m={measured} />}
          {sub?.shot_desktop && (
            <Card title="What the agent saw" subtitle={`Screenshots taken in a KERNEL cloud browser${sub.url ? ` of ${sub.url}` : ""}.`}>
              <div className="grid gap-4 sm:grid-cols-[3fr_1fr]">
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/submissions/${sub.id}/shot?view=desktop`} alt="Desktop screenshot of the submitted website" className="w-full rounded-lg border border-line shadow-card" />
                  <figcaption className="mt-1 text-xs text-muted">Desktop, 1280 px</figcaption>
                </figure>
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/submissions/${sub.id}/shot?view=mobile`} alt="Mobile screenshot of the submitted website" className="w-full rounded-lg border border-line shadow-card" />
                  <figcaption className="mt-1 text-xs text-muted">Mobile, 390 px</figcaption>
                </figure>
              </div>
            </Card>
          )}

          <Card title="Original brief"><p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{job.brief}</p></Card>
        </div>

        <div className="order-first space-y-6 md:order-none md:col-span-2">
          <NextStep requested={myRequest} applicants={access.isClient ? (requests as unknown as Applicant[]) : []} job={job} revision={revision?.detail?.message} amount={amount} sample={sample} sampleUrl={sampleUrl}
            role={access.isClient ? "client" : access.isFreelancer || access.openForFreelancers ? "freelancer" : "visitor"}
            canDispute={job.status === "needs_revision" && sub?.reviewer === "primary"}
            passedCount={passedCount} total={items.length} />
          {(access.isClient || access.isFreelancer) && <AskAgent jobId={job.id} role={access.isClient ? "client" : "freelancer"} />}

          <Card title="Payment record" subtitle="PayPal references for every money movement on this job.">
            <dl className="divide-y divide-line text-sm">
              <Row label="Client" value={job.client_email} />
              <Row label="Freelancer" value={job.freelancer_email ?? "Not assigned yet"} />
              <Row label="PayPal order" value={job.paypal_order_id ?? "Not created yet"} mono={!!job.paypal_order_id} />
              <Row label="Capture" value={job.paypal_capture_id ?? "Not captured yet"} mono={!!job.paypal_capture_id} />
              {funded && <Row label="Funds confirmed" value={funded.detail?.checked_via ?? "PayPal"} />}
              <Row label="Payout batch" value={job.payout_batch_id ?? "Not paid yet"} mono={!!job.payout_batch_id} />
              {job.refund_id && <Row label="Refund" value={job.refund_id} mono />}
            </dl>
          </Card>

          {refundable && (
            <form action={refundJob.bind(null, job.id)} className="space-y-1">
              <SubmitButton variant="danger" pending="Refunding through PayPal…">
                {overdue && job.status !== "funded" ? "Deadline missed: refund the client" : "Cancel job and refund the client"}
              </SubmitButton>
              <p className="text-xs text-muted">Refunds are possible before a freelancer is assigned, or after a missed deadline.</p>
            </form>
          )}

          {job.freelancer_email && (
            <Card title="Freelancer track record" subtitle={job.freelancer_email}>
              <TrackRecord email={job.freelancer_email} />
            </Card>
          )}

          <Card title="Audit trail" subtitle="Who did what, and when (India time).">
            <ol className="relative space-y-4 border-l-2 border-line pl-5 text-sm">
              {events.map((e) => (
                <li key={e.id} className="relative">
                  <span aria-hidden className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white ${DOT[e.actor] ?? "bg-line"}`} />
                  <span className="min-w-0">
                    <span className={`mr-2 rounded px-1.5 py-0.5 text-xs font-semibold capitalize ${ACTOR[e.actor] ?? ""}`}>{e.actor}</span>
                    <span className="font-semibold">{(e.action.charAt(0).toUpperCase() + e.action.slice(1)).replaceAll("_", " ")}</span>
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

type Applicant = { id: number; freelancer_email: string; freelancer_name: string; created_at: Date };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NextStep({ requested, applicants, job, revision, amount, sample, sampleUrl, role, canDispute, passedCount, total }: { requested: boolean; applicants: Applicant[]; job: any; revision?: string; amount: number; sample?: string; sampleUrl?: string; role: "client" | "freelancer" | "visitor"; canDispute: boolean; passedCount: number; total: number }) {
  const accept = ACCEPT[job.category as Category] ?? ACCEPT.writing;
  const turn = (who: string, tone: string) => <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{who}</span>;
  const waiting = (who: string, title: string, text: string) => (
    <div className="space-y-2">{turn(who, "bg-slate-200 text-slate-700")}<h2 className="text-2xl font-bold">{title}</h2><p className="text-sm text-muted">{text}</p></div>
  );
  const s = job.status;
  return (
    <section className="card border-t-4 border-t-action p-5 shadow-lift md:p-6">
      {(s === "draft" || s === "funding") && (role === "client" ? (
        <form action={fundJob.bind(null, job.id)} className="space-y-3">
          {turn("Your turn", "bg-ink text-white")}
          <h2 className="text-xl font-bold">Fund the job</h2>
          <p className="text-sm text-muted">You pay ${amount.toFixed(2)} through PayPal. ProofPay holds it; the freelancer is paid only after the work passes.</p>
          <SubmitButton pending="Opening PayPal…">Fund ${amount.toFixed(2)} with PayPal</SubmitButton>
        </form>
      ) : waiting("Client's turn", "Waiting for funding", "The client hasn't funded this job yet."))}

      {s === "funded" && role === "freelancer" && (requested ? (
        <div className="space-y-3">
          {turn("Client's turn", "bg-slate-200 text-slate-700")}
          <h2 className="text-2xl font-bold">Request sent</h2>
          <p className="text-sm text-muted">The client can see your track record and will choose a freelancer. You'll get an email if they assign the job to you.</p>
          <form action={withdrawRequest.bind(null, job.id)}><SubmitButton variant="ghost" pending="Withdrawing…">Withdraw my request</SubmitButton></form>
        </div>
      ) : (
        <form action={requestJob.bind(null, job.id)} className="space-y-3">
          {turn("Open job", "bg-held text-white")}
          <h2 className="text-2xl font-bold">Request this job</h2>
          <p className="text-sm text-muted">${amount.toFixed(2)} is already held. The client sees your track record and assigns the job to one freelancer. Once it's yours, the payout goes to your PayPal account when every checklist item passes.</p>
          <SubmitButton pending="Sending your request…">Request this job</SubmitButton>
        </form>
      ))}
      {s === "funded" && role !== "freelancer" && (applicants.length === 0
        ? waiting("Freelancers' turn", "Waiting for requests", "Your job is live on the Find work board. Freelancers who want it will appear here, and you choose who gets it.")
        : (
          <div className="space-y-4">
            {turn("Your turn", "bg-ink text-white")}
            <h2 className="text-2xl font-bold">Choose your freelancer</h2>
            <p className="text-sm text-muted">{applicants.length} {applicants.length === 1 ? "freelancer has" : "freelancers have"} asked for this job. Assign it to one; the others are told it's taken.</p>
            <ul className="space-y-3">
              {applicants.map((a) => (
                <li key={a.id} className="rounded-xl border border-line p-4">
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold uppercase text-white">{a.freelancer_name.slice(0, 1)}</span>
                    <div className="min-w-0">
                      <div className="font-semibold">{a.freelancer_name}</div>
                      <div className="break-all text-xs text-muted">{a.freelancer_email}</div>
                    </div>
                  </div>
                  <div className="my-3"><TrackRecord email={a.freelancer_email} /></div>
                  <form action={assignFreelancer.bind(null, job.id, a.id)}>
                    <SubmitButton full pending="Assigning…">Assign to {a.freelancer_name}</SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        ))}

      {(s === "in_progress" || s === "needs_revision" || s === "submitted") && (role === "freelancer" ? (
        <div className="space-y-4">
          <form action={submitWork.bind(null, job.id)} className="space-y-3">
            {turn("Your turn", "bg-held text-white")}
            <h2 className="text-xl font-bold">{s === "needs_revision" ? "Fix and resubmit" : "Submit the work"}</h2>
            {revision && <div className="rounded-lg border border-danger/25 bg-danger-soft p-3 text-sm">{revision}</div>}
            <p className="text-sm text-muted">{accept.hint}</p>
            {accept.paste && (
              <>
                <textarea name="text" rows={6} className="input font-mono text-xs" placeholder={accept.placeholder} />
                {sample && <SampleFill sample={sample} />}
              </>
            )}
            {job.category === "website" ? (
              <>
                <input name="url" type="url" required className="input" placeholder="https://your-site.example.com" aria-label="Link to the live site" />
                {sampleUrl && <SampleFill sample={sampleUrl} field="url" label="Use the sample café website" />}
              </>
            ) : (
              <input name="file" type="file" accept={accept.files} className="block w-full rounded-lg border border-dashed border-line bg-paper p-3 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white" aria-label="Upload a file" />
            )}
            <input name="note" className="input" placeholder="Note to the reviewer (optional)" />
            <SubmitButton pending="Checking…" stages={job.category === "website"
              ? ["Starting a cloud browser (KERNEL)…", "Opening the site on desktop and mobile…", "Checking each checklist item…", "Confirming funds with PayPal…", "Settling the payment…"]
              : ["Measuring the work exactly…", "Checking each checklist item…", "Confirming funds with PayPal…", "Settling the payment…"]}>
              Submit for checking
            </SubmitButton>
          </form>
          {canDispute && (
            <form action={requestSecondOpinion.bind(null, job.id)} className="space-y-2 border-t border-line pt-4">
              <p className="text-sm"><strong>Think the check got it wrong?</strong> <span className="text-muted">A different AI model re-checks the same submission independently. If it passes, the client decides.</span></p>
              <SubmitButton pending="Getting a second opinion…" stages={["Sending to an independent reviewer…", "Re-checking every item…"]}>Ask for a second opinion</SubmitButton>
            </form>
          )}
        </div>
      ) : s === "needs_revision"
        ? waiting("Freelancer's turn", "Changes requested", `The work passed ${passedCount} of ${total} items. The freelancer has been told exactly what to fix.`)
        : waiting("Freelancer's turn", "Work in progress", "The freelancer is working on it. You'll see the checklist results here as soon as they submit."))}

      {s === "disputed" && (role === "client" ? (
        <div className="space-y-3">
          {turn("Your decision", "bg-action text-white")}
          <h2 className="text-xl font-bold">The second opinion passed the work</h2>
          <p className="text-sm text-muted">The first check failed, but an independent AI reviewer found all {total} items met. See the evidence in the checklist. Pay the freelancer, or keep the rejection and ask for changes.</p>
          <div className="flex flex-wrap gap-2">
            <form action={decideDispute.bind(null, job.id, true)}><SubmitButton pending="Paying through PayPal…">Approve and pay ${amount.toFixed(2)}</SubmitButton></form>
            <form action={decideDispute.bind(null, job.id, false)}><SubmitButton variant="danger" pending="Saving…">Keep the rejection</SubmitButton></form>
          </div>
        </div>
      ) : waiting("Client's turn", "Second opinion passed your work", "The client is reviewing it and will decide whether to release the payment."))}

      {s === "paid" && (
        <div className="space-y-2">
          {turn("Done", "bg-verified text-white")}
          <h2 className="text-2xl font-bold">Paid on proof</h2>
          <p className="break-words text-sm">Every item passed. ${amount.toFixed(2)} was sent to <span className="break-all">{job.freelancer_email}</span> through PayPal Payouts.</p>
        </div>
      )}
      {s === "refunded" && (
        <div className="space-y-2">
          {turn("Closed", "bg-slate-200 text-slate-700")}
          <h2 className="text-xl font-bold">Refunded</h2>
          <p className="text-sm">The job was cancelled and the client got the money back.</p>
        </div>
      )}
    </section>
  );
}

function NotYours({ taken, role }: { taken: boolean; role: string }) {
  return (
    <div className="card mx-auto max-w-xl p-10 text-center">
      <h1 className="text-2xl font-bold">{taken ? "This job has been taken" : "This job isn't available to you"}</h1>
      <p className="mt-2 text-muted">
        {taken
          ? "The client assigned it to another freelancer. Only the client and that freelancer can open it now."
          : "Only the client who posted it, and the freelancer it is assigned to, can open this job."}
      </p>
      <a href={role === "freelancer" ? "/work" : "/"} className="btn btn-primary mt-5">
        {role === "freelancer" ? "Find other work" : "Back to your jobs"}
      </a>
    </div>
  );
}

const ACCEPT: Record<Category, { hint: string; paste: boolean; placeholder: string; files: string }> = {
  writing: { hint: "Paste the text, or upload a PDF or text file.", paste: true, placeholder: "Paste your text here", files: ".pdf,.txt,.md,.doc,.docx" },
  translation: { hint: "Paste the translation, or upload a text or PDF file.", paste: true, placeholder: "Paste the translation here", files: ".pdf,.txt,.md" },
  social: { hint: "Paste all posts, one per paragraph or labelled Post 1, Post 2…", paste: true, placeholder: "Post 1: …", files: ".txt,.md" },
  design: { hint: "Upload the image (PNG, JPG or WebP). Its size and format are measured exactly.", paste: false, placeholder: "", files: "image/png,image/jpeg,image/webp,image/gif" },
  data: { hint: "Upload the CSV file, or paste the CSV text. Rows, columns, duplicates and empty cells are counted exactly.", paste: true, placeholder: "name,email,…", files: ".csv,.txt" },
  code: { hint: "Upload the code file, or paste the code. Functions, tests and TODOs are detected exactly.", paste: true, placeholder: "def …", files: ".py,.js,.ts,.java,.go,.rb,.txt" },
  website: { hint: "Paste the link to the live site. The agent opens it in a real cloud browser (KERNEL), tests it on desktop and mobile, and takes screenshots as proof.", paste: false, placeholder: "", files: "" },
};

const NICE: Record<string, string> = {
  total_words: "Total words", first_line_words: "First line words", last_line_words: "Last line words", bullet_points: "Bullet points",
  posts: "Posts", hashtags: "Hashtags", mentions: "Mentions", longest_line_characters: "Longest line (characters)", links: "Links",
  width_px: "Width (px)", height_px: "Height (px)", file_type: "File type", is_square: "Square", file_size_kb: "File size (KB)",
  transparent_background_supported: "Transparency", aspect_ratio: "Aspect ratio",
  column_count: "Columns", data_row_count: "Data rows", duplicate_rows: "Duplicate rows", total_empty_cells: "Empty cells",
  invalid_emails: "Invalid emails", rows_with_wrong_column_count: "Broken rows", header_row: "Header row",
  language_guess: "Language", functions_defined: "Functions", classes_defined: "Classes", code_lines: "Code lines",
  todo_or_fixme: "TODOs", has_tests: "Has tests", has_docstrings_or_jsdoc: "Has docstrings",
  http_status: "HTTP status", load_time_ms: "Load time (ms)", page_title: "Page title", has_contact_form: "Contact form",
  list_items_total: "List items", broken_links: "Broken links", images_missing_alt: "Images missing alt text",
  mobile_horizontal_scroll: "Sideways scroll on phone", mobile_font_too_small: "Tiny text on phone", nav_links: "Navigation",
};

function show(v: unknown): string {
  if (v === null || v === undefined) return "n/a";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "None";
  return String(v);
}

/** Shows the exact, code-computed facts that were handed to the AI. */
function MeasuredPanel({ m }: { m: Record<string, unknown> }) {
  const keys = Object.keys(NICE).filter((k) => k in m);
  const paragraphs = Array.isArray(m.paragraphs) ? (m.paragraphs as { index: number; words: number; starts_with: string }[]) : [];
  return (
    <Card title="Measured by code" subtitle="Exact facts handed to the AI, so counts, sizes and structure are never guessed.">
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {keys.map((k) => (
          <div key={k} className="min-w-0 rounded-xl bg-paper px-3 py-2.5">
            <dt className="text-xs text-muted">{NICE[k]}</dt>
            <dd className="break-words text-sm font-bold">{show(m[k])}</dd>
          </div>
        ))}
      </dl>
      {paragraphs.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm text-muted">
          {paragraphs.map((p) => (
            <li key={p.index}>Paragraph {p.index}: <span className="font-semibold text-ink">{p.words} words</span>, starts “{p.starts_with.replace(/\n/g, " ")}{p.starts_with.length >= 60 ? "…" : ""}”</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const DOT: Record<string, string> = { client: "bg-ink", freelancer: "bg-held", agent: "bg-action", paypal: "bg-verified" };
const ACTOR: Record<string, string> = {
  client: "bg-ink text-white", freelancer: "bg-held-soft text-held",
  agent: "bg-action-soft text-action", paypal: "bg-verified-soft text-verified",
};

function Card({ title, subtitle, aside, children }: { title: string; subtitle?: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{title}</h2>
        {aside && <span className="num shrink-0 rounded-full bg-paper px-3 py-1 text-xs font-bold text-ink">{aside}</span>}
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
    <div className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:justify-between sm:gap-3">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className={`min-w-0 break-all sm:text-right ${mono ? "font-mono text-xs leading-5" : ""}`}>{value}</dd>
    </div>
  );
}
function Banner({ tone, children }: { tone: "verified" | "danger" | "held"; children: React.ReactNode }) {
  const c = { verified: "bg-verified-soft border-verified/30", danger: "bg-danger-soft border-danger/30", held: "bg-held-soft border-held/30" }[tone];
  return <div role="status" className={`rounded-xl border p-4 text-sm font-medium ${c}`}>{children}</div>;
}
