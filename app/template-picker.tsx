"use client";
import type { Template } from "@/lib/templates";

/** Job-type gallery: one click fills the post-a-job form with a realistic brief. */
export function TemplatePicker({ templates }: { templates: Template[] }) {
  function use(t: Template) {
    const set = (name: string, value: string) => {
      const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[name="${name}"]`);
      if (el) el.value = value;
    };
    set("title", t.title);
    set("brief", t.brief);
    set("amount", String(t.amount));
    set("category", t.category);
    const form = document.getElementById("post");
    form?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.querySelector<HTMLInputElement>('[name="title"]')?.focus({ preventScroll: true });
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((t) => (
        <li key={t.category}>
          <button
            type="button"
            onClick={() => use(t)}
            className="group flex h-full w-full flex-col rounded-xl border border-line bg-white p-4 text-left hover:border-ink"
          >
            <span className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>{t.label}</span>
            <span className="mt-1 text-sm text-muted">{t.blurb}</span>
            <span className="mt-3 flex w-full items-center justify-between text-sm">
              <span className="text-muted">Delivered as: {t.submitAs}</span>
              <span className="shrink-0 whitespace-nowrap pl-3 font-semibold text-action group-hover:underline">Use this</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
