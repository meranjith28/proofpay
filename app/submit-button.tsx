"use client";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * Submit button that shows what is happening while the server works.
 * `stages` cycle every few seconds so a long AI step never looks frozen.
 */
export function SubmitButton({
  children,
  pending,
  stages,
  variant = "primary",
}: {
  children: React.ReactNode;
  pending: string;
  stages?: string[];
  variant?: "primary" | "danger";
}) {
  const { pending: busy } = useFormStatus();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!busy || !stages?.length) { setI(0); return; }
    const t = setInterval(() => setI((n) => Math.min(n + 1, stages.length - 1)), 6000);
    return () => clearInterval(t);
  }, [busy, stages]);

  const cls =
    variant === "danger"
      ? "border border-danger/40 bg-white text-danger hover:bg-danger-soft"
      : "bg-action text-white hover:bg-blue-700";
  return (
    <div className="space-y-2">
      <button type="submit" disabled={busy} className={`rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-70 ${cls}`}>
        {busy ? (stages?.[i] ?? pending) : children}
      </button>
      {busy && stages && (
        <ol className="space-y-1 text-xs text-muted" aria-live="polite">
          {stages.map((s, k) => (
            <li key={s} className={k < i ? "line-through opacity-60" : k === i ? "font-semibold text-ink" : ""}>
              {s}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
