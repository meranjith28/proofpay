import Kernel from "@onkernel/sdk";
import { chromium, type Page } from "playwright-core";

/**
 * Website checks with a KERNEL cloud browser.
 * The agent opens the freelancer's site in a real Chrome running on KERNEL, measures it on
 * desktop and mobile, and takes screenshots as proof. Everything that touches the site runs
 * inside KERNEL's browser, never from our own server.
 */
export type WebsiteFacts = {
  url: string;
  final_url: string;
  http_status: number | null;
  load_time_ms: number;
  page_title: string;
  headings: string[];
  nav_links: string[];
  links_total: number;
  same_site_links_checked: number;
  broken_links: string[];
  images_total: number;
  images_missing_alt: number;
  forms: { fields: number; labels: string[]; has_submit: boolean }[];
  has_contact_form: boolean;
  list_items_total: number;
  mobile_horizontal_scroll: boolean;
  mobile_font_too_small: boolean;
  visible_text_words: number;
  visible_text_excerpt: string;
};

export function kernelConfigured() {
  return !!process.env.KERNEL_API_KEY;
}

export function normaliseUrl(raw: string) {
  const u = new URL(raw.trim());
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only http and https links can be checked.");
  return u.toString();
}

export async function measurePage(page: Page) {
  return page.evaluate(async () => {
    const text = (document.body?.innerText ?? "").replace(/\s+/g, " ").trim();
    const anchors = Array.from(document.querySelectorAll("a[href]")) as HTMLAnchorElement[];
    const sameSite = Array.from(new Set(anchors.map((a) => a.href).filter((h) => h.startsWith(location.origin) && !h.includes("#"))));
    const broken: string[] = [];
    // Check up to 15 internal links from inside the browser.
    await Promise.all(
      sameSite.slice(0, 15).map(async (href) => {
        try {
          const r = await fetch(href, { method: "GET", redirect: "follow" });
          if (r.status >= 400) broken.push(`${href} (${r.status})`);
        } catch {
          broken.push(`${href} (unreachable)`);
        }
      }),
    );
    const forms = Array.from(document.querySelectorAll("form")).map((f) => {
      const fields = f.querySelectorAll("input:not([type=hidden]):not([type=submit]), textarea, select");
      const labels = Array.from(f.querySelectorAll("label")).map((l) => (l.textContent ?? "").trim()).filter(Boolean);
      const placeholders = Array.from(fields).map((el) => (el as HTMLInputElement).placeholder || (el as HTMLInputElement).name).filter(Boolean);
      return {
        fields: fields.length,
        labels: (labels.length ? labels : placeholders).slice(0, 10),
        has_submit: !!f.querySelector("button, input[type=submit]"),
      };
    });
    const nav = Array.from(document.querySelectorAll("nav a, header a")).map((a) => (a.textContent ?? "").trim()).filter(Boolean);
    const nav_timing = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return {
      load_time_ms: Math.round(nav_timing ? nav_timing.loadEventEnd || nav_timing.domContentLoadedEventEnd : 0),
      page_title: document.title,
      headings: Array.from(document.querySelectorAll("h1, h2, h3")).map((h) => `${h.tagName}: ${(h.textContent ?? "").trim()}`).slice(0, 25),
      nav_links: Array.from(new Set(nav)).slice(0, 15),
      links_total: anchors.length,
      same_site_links_checked: Math.min(sameSite.length, 15),
      broken_links: broken,
      images_total: document.images.length,
      images_missing_alt: Array.from(document.images).filter((i) => !i.alt?.trim()).length,
      forms,
      list_items_total: document.querySelectorAll("li").length,
      visible_text_words: text ? text.split(" ").length : 0,
      visible_text_excerpt: text.slice(0, 6000),
    };
  });
}

/** Open the site in a KERNEL browser and return exact facts plus desktop and mobile screenshots. */
export async function checkWebsite(rawUrl: string) {
  if (!kernelConfigured()) throw new Error("Website checks need KERNEL_API_KEY to be set.");
  const url = normaliseUrl(rawUrl);
  const kernel = new Kernel();
  const session = await kernel.browsers.create({ headless: true, timeout_seconds: 120 });
  console.log("[kernel] browser", session.session_id, "checking", url);
  const started = Date.now();
  try {
    const browser = await chromium.connectOverCDP(session.cdp_ws_url);
    try {
      const context = browser.contexts()[0] ?? (await browser.newContext());
      const page = context.pages()[0] ?? (await context.newPage());

      // Desktop pass
      await page.setViewportSize({ width: 1280, height: 800 });
      const t0 = Date.now();
      const res = await page.goto(url, { waitUntil: "load", timeout: 30_000 });
      const wallLoad = Date.now() - t0;
      await page.waitForTimeout(800);
      const desktop = await measurePage(page);
      const desktopShot = await page.screenshot({ type: "jpeg", quality: 60, fullPage: false });

      // Mobile pass (phone-sized viewport on the same page)
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(600);
      const mobile = await page.evaluate(() => ({
        horizontal: document.documentElement.scrollWidth > window.innerWidth + 2,
        tinyText: Array.from(document.querySelectorAll("p, li, a, span"))
          .slice(0, 200)
          .some((el) => parseFloat(getComputedStyle(el).fontSize) < 12 && (el.textContent ?? "").trim().length > 20),
      }));
      const mobileShot = await page.screenshot({ type: "jpeg", quality: 60, fullPage: false });

      const forms = desktop.forms;
      const facts: WebsiteFacts = {
        url,
        final_url: page.url(),
        http_status: res?.status() ?? null,
        load_time_ms: desktop.load_time_ms || wallLoad,
        page_title: desktop.page_title,
        headings: desktop.headings,
        nav_links: desktop.nav_links,
        links_total: desktop.links_total,
        same_site_links_checked: desktop.same_site_links_checked,
        broken_links: desktop.broken_links,
        images_total: desktop.images_total,
        images_missing_alt: desktop.images_missing_alt,
        forms,
        has_contact_form: forms.some((f) => f.fields >= 2 && f.has_submit),
        list_items_total: desktop.list_items_total,
        mobile_horizontal_scroll: mobile.horizontal,
        mobile_font_too_small: mobile.tinyText,
        visible_text_words: desktop.visible_text_words,
        visible_text_excerpt: desktop.visible_text_excerpt,
      };
      console.log(`[kernel] checked ${url} in ${Math.round((Date.now() - started) / 1000)}s`);
      return { facts, desktopShot: new Uint8Array(desktopShot), mobileShot: new Uint8Array(mobileShot) };
    } finally {
      await browser.close().catch(() => undefined);
    }
  } finally {
    await kernel.browsers.deleteByID(session.session_id).catch((e) => console.error("[kernel] cleanup failed", e));
  }
}
