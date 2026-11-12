const STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  funding: "bg-held-soft text-held",
  funded: "bg-held-soft text-held",
  in_progress: "bg-held-soft text-held",
  submitted: "bg-blue-50 text-action",
  needs_revision: "bg-danger-soft text-danger",
  disputed: "bg-blue-50 text-action",
  paid: "bg-verified-soft text-verified",
  refunded: "bg-slate-100 text-slate-700",
};
const LABELS: Record<string, string> = {
  draft: "Waiting for funding", funding: "Funding in progress", funded: "Funded, waiting for a freelancer",
  in_progress: "Work in progress", submitted: "Being checked", needs_revision: "Needs changes",
  disputed: "Second opinion: client decides", paid: "Verified and paid", refunded: "Refunded to client",
};
export function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status] ?? STYLES.draft}`}>{LABELS[status] ?? status}</span>;
}
