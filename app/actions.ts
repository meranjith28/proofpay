"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { sql, migrate, logEvent } from "@/lib/db";
import { generateChecklist, verifySubmission, verifyWebsite } from "@/lib/ai";
import { checkWebsite, kernelConfigured, normaliseUrl } from "@/lib/website-check";
import { notify } from "@/lib/notify";
import { createFundingOrder } from "@/lib/paypal";
import { settleJob, cancelAndRefund } from "@/lib/agent";
import { canRefund } from "@/lib/rules";
import { requireUser, accessTo } from "@/lib/auth";

function friendly(e: unknown) {
  const msg = String((e as Error)?.message ?? e);
  if (/high demand|overloaded|UNAVAILABLE|503|429|quota/i.test(msg))
    return "The AI service is busy right now. Please try again in a minute.";
  if (/PayPal/i.test(msg)) return "PayPal returned an error. Please try again.";
  return "Something went wrong. Please try again.";
}

let migrated = false;
async function ready() {
  if (!migrated) { await migrate(); migrated = true; }
}

export async function postJob(form: FormData) {
  await ready();
  const user = await requireUser("client");
  const title = String(form.get("title") ?? "").trim();
  const brief = String(form.get("brief") ?? "").trim();
  const amount = Number(form.get("amount"));
  const clientEmail = user.email;
  const categories = ["writing", "translation", "social", "design", "data", "code", "website"] as const;
  const rawCategory = String(form.get("category") ?? "writing");
  const category = (categories as readonly string[]).includes(rawCategory) ? (rawCategory as (typeof categories)[number]) : "writing";
  const dueRaw = String(form.get("due_date") ?? "").trim();
  // A due date means "by the end of that day, India time".
  const dueAt = dueRaw ? new Date(`${dueRaw}T23:59:59+05:30`) : null;
  if (!title || !brief || !(amount > 0) || !clientEmail) throw new Error("All fields are required");

  const id = randomUUID().slice(0, 8);
  let generated;
  try {
    generated = await generateChecklist(title, brief, category);
  } catch (e) {
    console.error(e);
    redirect(`/?error=${encodeURIComponent(friendly(e))}`);
  }
  const { items, work_brief } = generated;
  await sql`insert into jobs (id, title, brief, amount, client_email, checklist, category, due_at)
            values (${id}, ${title}, ${brief}, ${amount}, ${clientEmail}, ${sql.json({ items, work_brief } as never)}, ${category}, ${dueAt})`;
  await logEvent(id, "client", "job_posted", { amount, category, text: dueAt ? `Due ${dueRaw}` : undefined });
  await logEvent(id, "agent", "checklist_generated", { count: items.length });
  redirect(`/jobs/${id}`);
}

export async function fundJob(id: string) {
  await ready();
  const user = await requireUser("client");
  const [job] = await sql`select * from jobs where id = ${id}`;
  if (!job || !accessTo(job as never, user).isClient) redirect(`/?error=${encodeURIComponent("Only the client who posted this job can fund it.")}`);
  let order;
  try {
    order = await createFundingOrder(id, job.title, Number(job.amount));
  } catch (e) {
    console.error(e);
    redirect(`/jobs/${id}?error=${encodeURIComponent(friendly(e))}`);
  }
  const { orderId, approveUrl } = order;
  await sql`update jobs set status = 'funding', paypal_order_id = ${orderId}, updated_at = now() where id = ${id}`;
  await logEvent(id, "paypal", "order_created", { orderId });
  if (!approveUrl) throw new Error("PayPal did not return an approval link");
  redirect(approveUrl);
}

/** A freelancer asks for an open job. Several can ask; the client chooses one. */
export async function requestJob(id: string) {
  await ready();
  const user = await requireUser("freelancer");
  const [j] = await sql`select title, client_email, amount from jobs where id = ${id} and status = 'funded' and freelancer_email is null`;
  if (!j) redirect(`/work?error=${encodeURIComponent("This job is no longer open.")}`);
  const added = await sql`insert into job_requests (job_id, freelancer_email, freelancer_name)
            values (${id}, ${user.email}, ${user.name}) on conflict (job_id, freelancer_email) do nothing returning id`;
  if (added.length) {
    await logEvent(id, "freelancer", "job_requested", { text: `${user.name} asked to take this job` });
    void notify("job_requested", { to: j.client_email, jobId: id, jobTitle: j.title, amount: Number(j.amount),
      subject: `${user.name} wants to work on "${j.title}"`,
      message: `${user.name} asked to take your job. Open the job to see their track record and assign it to them.` });
  }
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/work");
}

/** The freelancer changes their mind before the client has chosen. */
export async function withdrawRequest(id: string) {
  await ready();
  const user = await requireUser("freelancer");
  const gone = await sql`delete from job_requests where job_id = ${id} and lower(freelancer_email) = lower(${user.email}) returning id`;
  if (gone.length) await logEvent(id, "freelancer", "request_withdrawn", { text: `${user.name} withdrew their request` });
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/work");
}

/** The client picks one of the freelancers who asked. From here the job is private to the two of them. */
export async function assignFreelancer(id: string, requestId: number) {
  await ready();
  const user = await requireUser("client");
  const [job] = await sql`select * from jobs where id = ${id}`;
  if (!job || !accessTo(job as never, user).isClient) throw new Error("Only the client who posted this job can assign it.");
  const [req] = await sql`select * from job_requests where id = ${requestId} and job_id = ${id}`;
  if (!req) redirect(`/jobs/${id}?error=${encodeURIComponent("That freelancer withdrew their request.")}`);
  // Only one freelancer can get the job: the update succeeds only while it is still open.
  const taken = await sql`update jobs set freelancer_email = ${req.freelancer_email}, status = 'in_progress', updated_at = now()
            where id = ${id} and status = 'funded' and freelancer_email is null returning id`;
  if (taken.length === 0) redirect(`/jobs/${id}?error=${encodeURIComponent("This job has already been assigned.")}`);
  await sql`delete from job_requests where job_id = ${id}`;
  await logEvent(id, "client", "job_assigned", { text: `Assigned to ${req.freelancer_name}` });
  void notify("job_assigned", { to: req.freelancer_email, jobId: id, jobTitle: job.title, amount: Number(job.amount),
    subject: `You got the job: "${job.title}"`,
    message: `The client chose you. $${Number(job.amount).toFixed(2)} is held and is paid to your PayPal account when every checklist item passes. You can start now.` });
  revalidatePath(`/jobs/${id}`);
}

export async function submitWork(id: string, form: FormData) {
  await ready();
  const user = await requireUser("freelancer");
  const [job] = await sql`select * from jobs where id = ${id}`;
  if (!job || !accessTo(job as never, user).isFreelancer) redirect(`/work?error=${encodeURIComponent("Only the freelancer assigned to this job can submit work.")}`);
  const note = String(form.get("note") ?? "");
  if (job.category === "website") return submitWebsite(job, String(form.get("url") ?? ""), note);
  const text = String(form.get("text") ?? "");
  const file = form.get("file") as File | null;

  let fileText = text;
  let filePart: { data: Uint8Array; mediaType: string; name?: string } | undefined;
  if (file && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (file.type === "application/pdf" || file.type.startsWith("image/")) filePart = { data: bytes, mediaType: file.type, name: file.name };
    else fileText = new TextDecoder().decode(bytes);
  }
  if (!filePart && !fileText.trim()) throw new Error("Upload a file or paste your work");

  await sql`update jobs set status = 'submitted', updated_at = now() where id = ${id}`;
  await logEvent(id, "freelancer", "work_submitted", { file: file?.name ?? null });

  let verdict;
  try {
    verdict = await verifySubmission(job.checklist.items, fileText, note, filePart, job.category ?? "writing");
  } catch (e) {
    console.error(e);
    await sql`update jobs set status = ${job.status}, updated_at = now() where id = ${id}`;
    await logEvent(id, "agent", "verification_failed", { summary: friendly(e) });
    redirect(`/jobs/${id}?error=${encodeURIComponent(friendly(e))}`);
  }
  await sql`insert into submissions (job_id, note, file_name, file_text, verdict, overall, file_data, file_type)
            values (${id}, ${note}, ${file?.name ?? null}, ${fileText.slice(0, 100_000)}, ${sql.json(verdict.items as never)}, ${verdict.overall},
                    ${filePart ? Buffer.from(filePart.data) : null}, ${filePart?.mediaType ?? null})`;
  await logEvent(id, "agent", "verification_complete", { overall: verdict.overall, summary: verdict.summary, measurements: verdict.measurements });

  try {
    await settleJob(id);
  } catch (e) {
    console.error(e);
    await logEvent(id, "agent", "settlement_failed", { summary: friendly(e) });
    redirect(`/jobs/${id}?error=${encodeURIComponent(friendly(e))}`);
  }
  revalidatePath(`/jobs/${id}`);
}

/** Website jobs: the agent opens the site in a KERNEL cloud browser, measures it, screenshots it, then judges. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function submitWebsite(job: any, rawUrl: string, note: string) {
  const id = job.id as string;
  let url: string;
  try {
    url = normaliseUrl(rawUrl);
  } catch {
    redirect(`/jobs/${id}?error=${encodeURIComponent("Enter the full link to the live site, starting with https://")}`);
  }
  if (!kernelConfigured()) {
    redirect(`/jobs/${id}?error=${encodeURIComponent("Website checking isn't switched on yet (KERNEL key missing). Ask the platform owner.")}`);
  }
  await sql`update jobs set status = 'submitted', updated_at = now() where id = ${id}`;
  await logEvent(id, "freelancer", "work_submitted", { text: `Site: ${url}` });

  let check, verdict;
  try {
    check = await checkWebsite(url);
    await logEvent(id, "agent", "website_opened", {
      text: `Opened in a KERNEL cloud browser: HTTP ${check.facts.http_status}, loaded in ${check.facts.load_time_ms} ms, ${check.facts.broken_links.length} broken links`,
    });
    verdict = await verifyWebsite(job.checklist.items, check.facts, { desktop: check.desktopShot, mobile: check.mobileShot }, note);
  } catch (e) {
    console.error(e);
    await sql`update jobs set status = ${job.status}, updated_at = now() where id = ${id}`;
    const msg = /timeout|net::|ERR_|navigat/i.test(String((e as Error)?.message)) ? "The site couldn't be opened. Check the link is public and online, then try again." : friendly(e);
    await logEvent(id, "agent", "verification_failed", { summary: msg });
    redirect(`/jobs/${id}?error=${encodeURIComponent(msg)}`);
  }
  const { visible_text_excerpt, ...factsForRecord } = check.facts;
  await sql`insert into submissions (job_id, note, file_text, verdict, overall, url, shot_desktop, shot_mobile)
            values (${id}, ${note}, ${visible_text_excerpt}, ${sql.json(verdict.items as never)}, ${verdict.overall},
                    ${url}, ${Buffer.from(check.desktopShot)}, ${Buffer.from(check.mobileShot)})`;
  await logEvent(id, "agent", "verification_complete", { overall: verdict.overall, summary: verdict.summary, measurements: factsForRecord });
  try {
    await settleJob(id);
  } catch (e) {
    console.error(e);
    await logEvent(id, "agent", "settlement_failed", { summary: friendly(e) });
    redirect(`/jobs/${id}?error=${encodeURIComponent(friendly(e))}`);
  }
  revalidatePath(`/jobs/${id}`);
}

export async function refundJob(id: string) {
  await ready();
  const user = await requireUser("client");
  const [job] = await sql`select * from jobs where id = ${id}`;
  if (!job || !accessTo(job as never, user).isClient || !canRefund(job as never)) {
    redirect(`/jobs/${id}?error=${encodeURIComponent("A refund is only possible before a freelancer is assigned, or after a missed deadline.")}`);
  }
  await cancelAndRefund(id);
  revalidatePath(`/jobs/${id}`);
}

/** Freelancer disputes a failed check: an independent model re-checks the same submission. */
export async function requestSecondOpinion(id: string) {
  await ready();
  const user = await requireUser("freelancer");
  const [job] = await sql`select * from jobs where id = ${id}`;
  if (!job || !accessTo(job as never, user).isFreelancer || job.status !== "needs_revision") {
    redirect(`/jobs/${id}?error=${encodeURIComponent("A second opinion is only available after a failed check.")}`);
  }
  const [sub] = await sql`select * from submissions where job_id = ${id} order by id desc limit 1`;
  if (!sub || sub.reviewer !== "primary") {
    redirect(`/jobs/${id}?error=${encodeURIComponent("This submission already had a second opinion. Fix and resubmit instead.")}`);
  }
  await logEvent(id, "freelancer", "second_opinion_requested", {});
  const filePart = sub.file_data ? { data: new Uint8Array(sub.file_data), mediaType: sub.file_type } : undefined;
  let verdict;
  let shots: { desktop: Uint8Array; mobile: Uint8Array } | null = null;
  try {
    if (job.category === "website" && sub.url) {
      // Re-open the live site so the second reviewer sees it fresh.
      const check = await checkWebsite(sub.url);
      shots = { desktop: check.desktopShot, mobile: check.mobileShot };
      const { visible_text_excerpt: _t, ...facts } = check.facts;
      void _t;
      verdict = await verifyWebsite(job.checklist.items, check.facts, shots, sub.note ?? "", true);
      verdict = { ...verdict, measurements: facts };
    } else {
      verdict = await verifySubmission(job.checklist.items, sub.file_text ?? "", sub.note ?? "", filePart, job.category ?? "writing", true);
    }
  } catch (e) {
    console.error(e);
    redirect(`/jobs/${id}?error=${encodeURIComponent(friendly(e))}`);
  }
  await sql`insert into submissions (job_id, note, file_name, file_text, verdict, overall, file_data, file_type, reviewer, url, shot_desktop, shot_mobile)
            values (${id}, ${sub.note}, ${sub.file_name}, ${sub.file_text}, ${sql.json(verdict.items as never)}, ${verdict.overall},
                    ${sub.file_data}, ${sub.file_type}, 'second_opinion', ${sub.url ?? null},
                    ${shots ? Buffer.from(shots.desktop) : sub.shot_desktop ?? null}, ${shots ? Buffer.from(shots.mobile) : sub.shot_mobile ?? null})`;
  if (verdict.overall === "pass") {
    await sql`update jobs set status = 'disputed', updated_at = now() where id = ${id}`;
    await logEvent(id, "agent", "second_opinion_passed", { summary: `${verdict.summary} The client now decides whether to pay.`, measurements: verdict.measurements });
    void notify("second_opinion_ready", { to: job.client_email, jobId: id, jobTitle: job.title, amount: Number(job.amount),
      subject: `Your decision needed: second opinion passed "${job.title}"`,
      message: "The freelancer disputed a failed check, and an independent AI reviewer found every item met. Please approve the payment or keep the rejection." });
  } else {
    await logEvent(id, "agent", "second_opinion_agreed", { summary: `The second reviewer also found missing items. ${verdict.summary}`, measurements: verdict.measurements });
  }
  revalidatePath(`/jobs/${id}`);
}

/** Client's final decision after a second opinion passed the work. */
export async function decideDispute(id: string, approve: boolean) {
  await ready();
  const user = await requireUser("client");
  const [job] = await sql`select * from jobs where id = ${id}`;
  if (!job || !accessTo(job as never, user).isClient || job.status !== "disputed") {
    redirect(`/jobs/${id}?error=${encodeURIComponent("There is no open dispute to decide on this job.")}`);
  }
  if (approve) {
    await logEvent(id, "client", "dispute_approved", { text: "Client accepted the second opinion and approved payment." });
    try {
      await settleJob(id);
    } catch (e) {
      console.error(e);
      redirect(`/jobs/${id}?error=${encodeURIComponent(friendly(e))}`);
    }
  } else {
    await sql`update jobs set status = 'needs_revision', updated_at = now() where id = ${id}`;
    await logEvent(id, "client", "dispute_rejected", { text: "Client kept the rejection. The freelancer can fix and resubmit." });
    await logEvent(id, "agent", "revision_requested", { message: "The client reviewed the second opinion and still wants changes. Check the red items and resubmit." });
  }
  revalidatePath(`/jobs/${id}`);
}
