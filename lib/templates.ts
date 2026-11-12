import type { Category } from "./measure";

export type Template = {
  category: Category;
  label: string;
  blurb: string;
  title: string;
  brief: string;
  amount: number;
  submitAs: string; // what the freelancer delivers
  sample?: string; // a passing sample deliverable, for demos (text-based types only)
};

export const CATEGORY_LABELS: Record<Category, string> = {
  writing: "Writing",
  translation: "Translation",
  social: "Social media",
  design: "Design",
  data: "Data cleaning",
  code: "Code",
};

export const TEMPLATES: Template[] = [
  {
    category: "writing",
    label: "Product description",
    blurb: "Copy with word limits and required points",
    title: "Product description for a smart water bottle",
    brief:
      'Write a product description for "HydraSmart", a smart water bottle. It must include: a headline under 10 words, ' +
      "a 100-150 word description, exactly 3 bullet points listing features (temperature display, hydration reminders, " +
      "24-hour cold retention), and a one-line call to action at the end.",
    amount: 25,
    submitAs: "Pasted text",
    sample: `Stay Smart, Stay Hydrated with HydraSmart

HydraSmart is the water bottle that thinks ahead so you don't have to. Built from double-walled stainless steel, it keeps drinks icy cold through long workdays, gym sessions and weekend hikes. A sleek LED cap shows the exact temperature of your water at a tap, so you always know what you're sipping. Gentle glowing reminders nudge you to drink throughout the day, helping you build a healthy hydration habit without another app to manage. The leak-proof lid slips easily into any bag, and the matte finish resists scratches and fingerprints. Whether you're commuting, training or travelling, HydraSmart keeps you refreshed, focused and ready for whatever the day brings. It is simple to clean, easy to carry and made to last for years.

- Temperature display: the LED cap shows your drink's temperature with a single tap.
- Hydration reminders: a soft glow reminds you to drink at regular intervals.
- 24-hour cold retention: double-wall insulation keeps water cold for a full day.

Order your HydraSmart today and make every sip count.`,
  },
  {
    category: "social",
    label: "Social media pack",
    blurb: "Posts with hashtags and length limits",
    title: "Launch posts for a neighbourhood café",
    brief:
      'Write 3 Instagram posts announcing the opening of "Brew & Bloom", a café in Chennai, on 1 December. ' +
      "Each post must be under 200 characters, include #BrewAndBloom, mention @brewandbloom, and one post must mention the 20% opening-week discount.",
    amount: 15,
    submitAs: "Pasted text",
    sample: `Post 1: Fresh coffee, fresh flowers, fresh start. @brewandbloom opens in Chennai on 1 December ☕🌸 #BrewAndBloom #ChennaiCafe

Post 2: Opening week treat: 20% off everything from 1 to 7 December at @brewandbloom. Bring a friend! #BrewAndBloom

Post 3: Filter coffee, cold brew and a garden to sit in. Meet us at @brewandbloom from 1 December 🌿 #BrewAndBloom #Chennai`,
  },
  {
    category: "data",
    label: "Clean a spreadsheet",
    blurb: "CSV with rules on columns, duplicates, formats",
    title: "Clean a customer list",
    brief:
      "Clean our customer CSV. The result must have exactly these columns in order: name, email, city, joined. " +
      "No duplicate rows, no empty emails, every email valid, and every joined date in YYYY-MM-DD format. Keep at least 5 customers.",
    amount: 30,
    submitAs: "CSV file or pasted CSV",
    sample: `name,email,city,joined
Asha Rao,asha.rao@example.com,Chennai,2024-03-01
Ravi Kumar,ravi.kumar@example.com,Bengaluru,2024-03-04
Meera Iyer,meera.iyer@example.com,Coimbatore,2024-05-09
Arjun Menon,arjun.menon@example.com,Kochi,2024-06-17
Divya Shah,divya.shah@example.com,Mumbai,2024-07-02
Karthik S,karthik.s@example.com,Madurai,2024-08-21`,
  },
  {
    category: "code",
    label: "Small coding task",
    blurb: "Required functions, tests, no TODOs",
    title: "Python function to validate Indian PIN codes",
    brief:
      "Write a Python file with a function is_valid_pin(pin: str) -> bool that returns True for valid 6-digit Indian PIN codes " +
      "(first digit 1-9, all digits numeric). Include a docstring, at least 3 tests in a function named test_is_valid_pin using assert, and no TODO comments.",
    amount: 40,
    submitAs: "Code file or pasted code",
    sample: `def is_valid_pin(pin: str) -> bool:
    """Return True if pin is a valid 6-digit Indian PIN code (first digit 1-9)."""
    return len(pin) == 6 and pin.isdigit() and pin[0] != "0"


def test_is_valid_pin():
    assert is_valid_pin("600001")
    assert not is_valid_pin("012345")
    assert not is_valid_pin("60001A")
    assert not is_valid_pin("6000011")`,
  },
  {
    category: "design",
    label: "Logo or banner",
    blurb: "Image checked for size, format and content",
    title: "Square logo for a café",
    brief:
      'Design a logo for "Brew & Bloom", a café. Deliver a square PNG at least 1000 by 1000 pixels. ' +
      "The logo must show the name Brew & Bloom, include a coffee cup or flower, and use no more than 3 main colours.",
    amount: 50,
    submitAs: "Image upload (PNG or JPG)",
  },
  {
    category: "translation",
    label: "Translation",
    blurb: "Meaning, length and terms preserved",
    title: "Translate a delivery notice into Tamil",
    brief:
      'Translate this notice into Tamil: "Your order has been shipped and will arrive within 3 days. Track it using the link in your email. ' +
      'For help, call 1800-123-456." The translation must keep the number 3, the phone number 1800-123-456 exactly, and must be in Tamil script.',
    amount: 10,
    submitAs: "Pasted text",
    sample:
      "உங்கள் ஆர்டர் அனுப்பப்பட்டது, 3 நாட்களுக்குள் வந்து சேரும். உங்கள் மின்னஞ்சலில் உள்ள இணைப்பைப் பயன்படுத்தி அதைக் கண்காணிக்கவும். உதவிக்கு 1800-123-456 என்ற எண்ணை அழைக்கவும்.",
  },
];

export function templateFor(category: string) {
  return TEMPLATES.find((t) => t.category === category);
}
