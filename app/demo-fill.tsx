"use client";

const DEMO = {
  title: "Product description for a smart water bottle",
  brief:
    'Write a product description for "HydraSmart", a smart water bottle. It must include: a headline under 10 words, ' +
    "a 100-150 word description, exactly 3 bullet points listing features (temperature display, hydration reminders, " +
    "24-hour cold retention), and a one-line call to action at the end.",
  amount: "25",
  client_email: "sb-kszla53855379@personal.example.com",
};

/** Fills the post-a-job form with a ready-made example, so a visitor can try the flow in seconds. */
export function DemoFill() {
  function fill() {
    for (const [name, value] of Object.entries(DEMO)) {
      const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
      if (el) el.value = value;
    }
    document.querySelector<HTMLInputElement>('[name="title"]')?.focus();
  }
  return (
    <button type="button" onClick={fill} className="text-sm font-medium text-action underline underline-offset-4 hover:no-underline">
      Fill in an example job
    </button>
  );
}
