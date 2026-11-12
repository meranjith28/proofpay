"use client";

/** Demo helper: fills the submission box (or the link field) with a sample deliverable. */
export function SampleFill({ sample, field = "text", label = "Paste the sample deliverable" }: { sample: string; field?: string; label?: string }) {
  return (
    <button
      type="button"
      className="text-sm font-medium text-action underline underline-offset-4 hover:no-underline"
      onClick={() => {
        const box = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${field}"]`);
        if (box) { box.value = sample; box.focus(); }
      }}
    >
      {label}
    </button>
  );
}
