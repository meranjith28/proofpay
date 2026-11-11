const STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  funding: "bg-amber-100 text-amber-800",
  funded: "bg-blue-100 text-blue-800",
  in_progress: "bg-indigo-100 text-indigo-800",
  submitted: "bg-purple-100 text-purple-800",
  needs_revision: "bg-orange-100 text-orange-800",
  paid: "bg-green-100 text-green-800",
  refunded: "bg-rose-100 text-rose-800",
};
const LABELS: Record<string, string> = {
  draft: "Awaiting funding", funding: "Funding in progress", funded: "Funded — open for work",
  in_progress: "In progress", submitted: "Under AI review", needs_revision: "Needs revision",
  paid: "Verified & paid", refunded: "Refunded",
};
export function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${STYLES[status] ?? STYLES.draft}`}>{LABELS[status] ?? status}</span>;
}
