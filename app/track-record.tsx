import { freelancerStats } from "@/lib/stats";

/** Compact freelancer track record, shown on the work board and job pages. */
export async function TrackRecord({ email }: { email: string }) {
  const s = await freelancerStats(email);
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Item label="Jobs paid" value={String(s.paid)} />
      <Item label="Passed first try" value={s.firstTryRate === null ? "None yet" : `${s.firstTryRate}%`} />
      <Item label="Earned on ProofPay" value={`$${s.earned.toFixed(2)}`} />
      <Item label="In progress" value={String(s.active)} />
    </dl>
  );
}
function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{value}</dd>
    </div>
  );
}
