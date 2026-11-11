"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pending, variant = "primary" }: { children: React.ReactNode; pending: string; variant?: "primary" | "danger" }) {
  const { pending: busy } = useFormStatus();
  const cls = variant === "danger" ? "bg-white text-rose-700 border border-rose-300 hover:bg-rose-50" : "bg-blue-600 text-white hover:bg-blue-700";
  return (
    <button type="submit" disabled={busy} className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${cls}`}>
      {busy ? pending : children}
    </button>
  );
}
