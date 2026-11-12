import { freelancerStats } from "@/lib/stats";

/** Compact freelancer track record, shown on the work board and job pages. */
export async function TrackRecord({ email }: { email: string }) {
  const s = await freelancerStats(email);
  return (
    <dl className="grid grid-cols-2 gap-2.5">
      <Item label="Jobs paid" value={String(s.paid)} />
      <Item label="Passed first try" value={s.firstTryRate === null ? "None yet" : `${s.firstTryRate}%`} />
      <Item label="Earned on ProofPay" value={`$${s.earned.toFixed(2)}`} />
      <Item label="In progress" value={String(s.active)} />
    </dl>
  );
}
function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-paper px-3.5 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="num mt-0.5 text-xl font-bold">{value}</dd>
    </div>
  );
}
