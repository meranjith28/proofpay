"use client";

/** Demo helper: pastes the template's sample deliverable into the submission box. */
export function SampleFill({ sample }: { sample: string }) {
  return (
    <button
      type="button"
      className="text-sm font-medium text-action underline underline-offset-4 hover:no-underline"
      onClick={() => {
        const box = document.querySelector<HTMLTextAreaElement>('textarea[name="text"]');
        if (box) { box.value = sample; box.focus(); }
      }}
    >
      Paste the sample deliverable
    </button>
  );
}
