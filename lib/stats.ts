import { sql } from "./db";

/** A freelancer's record on ProofPay, computed from jobs and submissions. */
export async function freelancerStats(email: string) {
  const [row] = await sql`
    with mine as (
      select j.id, j.status, j.amount,
             (select count(*) from submissions s where s.job_id = j.id) as attempts
      from jobs j where lower(j.freelancer_email) = lower(${email})
    )
    select
      count(*)::int as accepted,
      count(*) filter (where status = 'paid')::int as paid,
      count(*) filter (where status = 'paid' and attempts = 1)::int as first_try,
      coalesce(sum(amount) filter (where status = 'paid'), 0)::float as earned,
      count(*) filter (where status in ('in_progress','submitted','needs_revision','disputed'))::int as active
    from mine`;
  const paid = row?.paid ?? 0;
  return {
    accepted: row?.accepted ?? 0,
    paid,
    active: row?.active ?? 0,
    earned: Number(row?.earned ?? 0),
    firstTryRate: paid ? Math.round(((row?.first_try ?? 0) / paid) * 100) : null,
  };
}
