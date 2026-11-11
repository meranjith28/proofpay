"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { sql, migrate, logEvent } from "@/lib/db";
import { generateChecklist, verifySubmission } from "@/lib/ai";
import { createFundingOrder } from "@/lib/paypal";
import { settleJob, cancelAndRefund } from "@/lib/agent";

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
  const title = String(form.get("title") ?? "").trim();
  const brief = String(form.get("brief") ?? "").trim();
  const amount = Number(form.get("amount"));
  const clientEmail = String(form.get("client_email") ?? "").trim();
  if (!title || !brief || !(amount > 0) || !clientEmail) throw new Error("All fields are required");

  const id = randomUUID().slice(0, 8);
  let generated;
  try {
    generated = await generateChecklist(title, brief);
  } catch (e) {
    console.error(e);
    redirect(`/?error=${encodeURIComponent(friendly(e))}`);
  }
  const { items, work_brief } = generated;
  await sql`insert into jobs (id, title, brief, amount, client_email, checklist)
            values (${id}, ${title}, ${brief}, ${amount}, ${clientEmail}, ${sql.json({ items, work_brief } as never)})`;
  await logEvent(id, "client", "job_posted", { amount });
  await logEvent(id, "agent", "checklist_generated", { count: items.length });
  redirect(`/jobs/${id}`);
}

export async function fundJob(id: string) {
  await ready();
  const [job] = await sql`select * from jobs where id = ${id}`;
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

export async function acceptJob(id: string, form: FormData) {
  await ready();
  const email = String(form.get("freelancer_email") ?? "").trim();
  if (!email) throw new Error("Freelancer PayPal email is required");
  await sql`update jobs set freelancer_email = ${email}, status = 'in_progress', updated_at = now()
            where id = ${id} and status = 'funded'`;
  await logEvent(id, "freelancer", "job_accepted", { email });
  revalidatePath(`/jobs/${id}`);
}

export async function submitWork(id: string, form: FormData) {
  await ready();
  const [job] = await sql`select * from jobs where id = ${id}`;
  const note = String(form.get("note") ?? "");
  const text = String(form.get("text") ?? "");
  const file = form.get("file") as File | null;

  let fileText = text;
  let filePart: { data: Uint8Array; mediaType: string } | undefined;
  if (file && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (file.type === "application/pdf" || file.type.startsWith("image/")) filePart = { data: bytes, mediaType: file.type };
    else fileText = new TextDecoder().decode(bytes);
  }
  if (!filePart && !fileText.trim()) throw new Error("Upload a file or paste your work");

  await sql`update jobs set status = 'submitted', updated_at = now() where id = ${id}`;
  await logEvent(id, "freelancer", "work_submitted", { file: file?.name ?? null });

  let verdict;
  try {
    verdict = await verifySubmission(job.checklist.items, fileText, note, filePart);
  } catch (e) {
    console.error(e);
    await sql`update jobs set status = ${job.status}, updated_at = now() where id = ${id}`;
    await logEvent(id, "agent", "verification_failed", { summary: friendly(e) });
    redirect(`/jobs/${id}?error=${encodeURIComponent(friendly(e))}`);
  }
  await sql`insert into submissions (job_id, note, file_name, file_text, verdict, overall)
            values (${id}, ${note}, ${file?.name ?? null}, ${fileText.slice(0, 100_000)}, ${sql.json(verdict.items as never)}, ${verdict.overall})`;
  await logEvent(id, "agent", "verification_complete", { overall: verdict.overall, summary: verdict.summary });

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
  await cancelAndRefund(id);
  revalidatePath(`/jobs/${id}`);
}
