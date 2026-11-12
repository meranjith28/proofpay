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
  full = false,
}: {
  children: React.ReactNode;
  pending: string;
  stages?: string[];
  variant?: "primary" | "danger" | "ghost" | "light";
  full?: boolean;
}) {
  const { pending: busy } = useFormStatus();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!busy || !stages?.length) { setI(0); return; }
    const t = setInterval(() => setI((n) => Math.min(n + 1, stages.length - 1)), 6000);
    return () => clearInterval(t);
  }, [busy, stages]);

  const cls = { primary: "btn-primary", danger: "btn-danger", ghost: "btn-ghost", light: "btn-light" }[variant];
  return (
    <div className="space-y-3">
      <button type="submit" disabled={busy} className={`btn ${cls} ${full ? "w-full" : ""}`}>
        {busy && <span className="spinner" aria-hidden />}
        {busy ? (stages?.[i] ?? pending) : children}
      </button>
      {busy && stages && (
        <ol className="space-y-1.5 rounded-lg bg-paper p-3 text-xs text-muted" aria-live="polite">
          {stages.map((s, k) => (
            <li key={s} className={`flex items-center gap-2 ${k === i ? "font-semibold text-ink" : ""}`}>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${k < i ? "bg-verified" : k === i ? "bg-action" : "bg-line"}`} />
              <span className={k < i ? "text-verified" : ""}>{s}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
