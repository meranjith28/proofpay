import postgres from "postgres";

// One shared connection pool. Neon requires SSL.
const url = process.env.DATABASE_URL ?? "";
export const sql = postgres(url, { ssl: /@(localhost|127\.0\.0\.1)[:/]/.test(url) ? false : "require", max: 5 });

export type JobStatus =
  | "draft"          // posted, checklist generated, awaiting funding
  | "funding"        // PayPal order created, waiting for client approval
  | "funded"         // money captured and held by platform
  | "in_progress"    // freelancer accepted
  | "submitted"      // deliverables uploaded, awaiting AI check
  | "needs_revision" // AI found gaps
  | "paid"           // AI passed, payout sent
  | "refunded";      // cancelled, client refunded

export type ChecklistItem = { id: number; requirement: string; how_to_verify: string };
export type ItemVerdict = { id: number; passed: boolean; evidence: string; reason: string };

/** Create tables if they don't exist. Safe to run on every boot. */
export async function migrate() {
  await sql`
    create table if not exists jobs (
      id text primary key,
      title text not null,
      brief text not null,
      amount numeric(10,2) not null,
      client_email text not null,
      freelancer_email text,
      checklist jsonb not null default '[]',
      status text not null default 'draft',
      paypal_order_id text,
      paypal_capture_id text,
      payout_batch_id text,
      refund_id text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`;
  // Added on day 2: job type and optional deadline. Safe to run on existing tables.
  await sql`alter table jobs add column if not exists category text not null default 'writing'`;
  await sql`alter table jobs add column if not exists due_at timestamptz`;
  await sql`
    create table if not exists submissions (
      id serial primary key,
      job_id text not null references jobs(id),
      note text,
      file_name text,
      file_text text,
      verdict jsonb,
      overall text,
      created_at timestamptz not null default now()
    )`;
  // Audit trail: every agent decision and payment action, shown on the job page.
  await sql`
    create table if not exists events (
      id serial primary key,
      job_id text not null references jobs(id),
      actor text not null,
      action text not null,
      detail jsonb,
      created_at timestamptz not null default now()
    )`;
}

export async function logEvent(jobId: string, actor: "client" | "freelancer" | "agent" | "paypal", action: string, detail: unknown = {}) {
  await sql`insert into events (job_id, actor, action, detail) values (${jobId}, ${actor}, ${action}, ${sql.json(detail as never)})`;
}
