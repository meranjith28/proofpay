/**
 * Shows where the job's money is right now: with the client, held by ProofPay, or with the freelancer.
 * This is the one visual idea of the product.
 */
type Where = "client" | "held" | "freelancer";

export function whereIsMoney(status: string): Where {
  if (status === "paid") return "freelancer";
  if (["funded", "in_progress", "submitted", "needs_revision"].includes(status)) return "held";
  return "client"; // draft, funding, refunded
}

const STOPS: { key: Where; label: string; sub: string }[] = [
  { key: "client", label: "Client", sub: "Pays into the job" },
  { key: "held", label: "Held by ProofPay", sub: "Until the work is proven" },
  { key: "freelancer", label: "Freelancer", sub: "Paid by PayPal Payouts" },
];

export function MoneyPath({ amount, status, compact = false }: { amount: number; status: string; compact?: boolean }) {
  const where = whereIsMoney(status);
  const i = STOPS.findIndex((s) => s.key === where);
  const pct = [8, 50, 92][i];
  const chipColor = where === "freelancer" ? "bg-verified" : where === "held" ? "bg-held" : "bg-ink";
  const refunded = status === "refunded";

  return (
    <div role="img" aria-label={`$${amount.toFixed(2)} is with the ${STOPS[i].label.toLowerCase()}`} className="w-full">
      <div className={`relative ${compact ? "h-12" : "h-16"}`}>
        <div className="absolute left-[8%] right-[8%] top-1/2 h-1 -translate-y-1/2 rounded-full bg-line" />
        <div
          className={`absolute left-[8%] top-1/2 h-1 -translate-y-1/2 rounded-full ${where === "freelancer" ? "bg-verified" : "bg-held"}`}
          style={{ width: `${pct - 8}%` }}
        />
        {STOPS.map((s, k) => (
          <span
            key={s.key}
            className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ${k <= i ? "bg-ink" : "bg-line"}`}
            style={{ left: `${[8, 50, 92][k]}%` }}
          />
        ))}
        <span
          className={`chip-move absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${chipColor} px-3 py-1 text-sm font-semibold text-white shadow-sm`}
          style={{ left: `${pct}%` }}
        >
          ${amount.toFixed(2)}
        </span>
      </div>
      <div className="grid grid-cols-3 text-center">
        {STOPS.map((s) => (
          <div key={s.key} className={s.key === where ? "text-ink" : "text-muted"}>
            <div className={`text-sm ${s.key === where ? "font-semibold" : ""}`}>{s.label}</div>
            {!compact && <div className="text-xs">{s.sub}</div>}
          </div>
        ))}
      </div>
      {refunded && <p className="mt-2 text-center text-sm text-danger">Job cancelled: the money went back to the client.</p>}
    </div>
  );
}
