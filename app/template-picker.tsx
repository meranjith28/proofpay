"use client";
import type { Template } from "@/lib/templates";
import { CategoryIcon } from "./icons";

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
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {templates.map((t) => (
        <li key={t.category}>
          <button
            type="button"
            onClick={() => use(t)}
            className="card group flex h-full w-full flex-col p-4 text-left transition-all hover:-translate-y-0.5 hover:border-action hover:shadow-lift"
          >
            <span className="flex items-center justify-between">
              <span className="icon-tile transition-colors group-hover:bg-action group-hover:text-white"><CategoryIcon category={t.category} /></span>
              <span className="num text-sm font-bold text-muted">${t.amount}</span>
            </span>
            <span className="mt-3 text-base font-bold" style={{ fontFamily: "var(--font-display)" }}>{t.label}</span>
            <span className="mt-1 text-sm text-muted">{t.blurb}</span>
            <span className="mt-3 border-t border-line pt-3 text-xs text-muted">Delivered as: {t.submitAs}</span>
            <span className="mt-2 text-sm font-semibold text-action">Use this brief</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
