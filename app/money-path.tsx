/**
 * Shows where the job's money is right now: with the client, held by ProofPay, or with the freelancer.
 * This is the one visual idea of the product.
 */
type Where = "client" | "held" | "freelancer";

export function whereIsMoney(status: string): Where {
  if (status === "paid") return "freelancer";
  if (["funded", "in_progress", "submitted", "needs_revision", "disputed"].includes(status)) return "held";
  return "client"; // draft, funding, refunded
}

const STOPS: { key: Where; label: string; sub: string }[] = [
  { key: "client", label: "Client", sub: "Pays into the job" },
  { key: "held", label: "Held by ProofPay", sub: "Until the work is proven" },
  { key: "freelancer", label: "Freelancer", sub: "Paid by PayPal Payouts" },
];

export function MoneyPath({ amount, status, compact = false, dark = false }: { amount: number; status: string; compact?: boolean; dark?: boolean }) {
  const where = whereIsMoney(status);
  const i = STOPS.findIndex((s) => s.key === where);
  const pct = [8, 50, 92][i];
  const chipColor = where === "freelancer" ? "bg-verified" : where === "held" ? "bg-held" : dark ? "bg-white text-navy" : "bg-ink";
  const refunded = status === "refunded";
  const track = dark ? "bg-white/15" : "bg-line";
  const on = dark ? "text-white" : "text-ink";
  const off = dark ? "text-white/55" : "text-muted";

  return (
    <div role="img" aria-label={`$${amount.toFixed(2)} is with the ${STOPS[i].label.toLowerCase()}`} className="w-full">
      <div className={`relative ${compact ? "h-12" : "h-16"}`}>
        <div className={`absolute left-[8%] right-[8%] top-1/2 h-1.5 -translate-y-1/2 rounded-full ${track}`} />
        <div
          className={`absolute left-[8%] top-1/2 h-1.5 -translate-y-1/2 rounded-full ${where === "freelancer" ? "bg-verified" : "bg-held"}`}
          style={{ width: `${pct - 8}%` }}
        />
        {STOPS.map((s, k) => (
          <span
            key={s.key}
            className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${dark ? "border-navy" : "border-white"} ${k <= i ? (dark ? "bg-white" : "bg-ink") : track}`}
            style={{ left: `${[8, 50, 92][k]}%` }}
          />
        ))}
        <span
          className={`chip-move num absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${chipColor} px-3.5 py-1.5 text-sm font-bold ${chipColor.includes("text-navy") ? "" : "text-white"} shadow-lift`}
          style={{ left: `${pct}%` }}
        >
          ${amount.toFixed(2)}
        </span>
      </div>
      <div className="grid grid-cols-3 text-center">
        {STOPS.map((s) => (
          <div key={s.key} className={s.key === where ? on : off}>
            <div className={`text-sm ${s.key === where ? "font-semibold" : ""}`}>{s.label}</div>
            {!compact && <div className="text-xs">{s.sub}</div>}
          </div>
        ))}
      </div>
      {refunded && <p className="mt-2 text-center text-sm text-danger">Job cancelled: the money went back to the client.</p>}
    </div>
  );
}
