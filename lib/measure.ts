/**
 * Exact, code-computed facts about a submission for each job type.
 * The AI is given these as facts so it never has to count, read pixel sizes
 * or parse file structure by eye.
 */
import { measureText, countWords } from "./textstats";

export type Category = "writing" | "translation" | "social" | "design" | "data" | "code" | "website";

// ---------- text extras (writing, translation, social) ----------
export function measureWriting(text: string) {
  const base = measureText(text);
  return {
    ...base,
    hashtags: (text.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).map((h) => h.trim()),
    mentions: (text.match(/(^|\s)@[\w.]+/g) ?? []).map((m) => m.trim()),
    links: (text.match(/https?:\/\/\S+/g) ?? []).length,
    emojis: (text.match(/\p{Extended_Pictographic}/gu) ?? []).length,
    // Social packs are usually separated by blank lines or "Post 1:", "Post 2:" markers.
    posts:
      (text.match(/^\s*(post|tweet|caption)\s*\d+\s*[:.)-]/gim) ?? []).length ||
      text.replace(/\r\n/g, "\n").split(/\n\s*\n/).filter((b) => b.trim()).length,
    longest_line_characters: Math.max(0, ...text.split("\n").map((l) => l.trim().length)),
  };
}

// ---------- CSV (data cleaning) ----------
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const t = text.replace(/\r\n/g, "\n");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quoted) {
      if (c === '"' && t[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

export function measureCsv(text: string) {
  const rows = parseCsv(text);
  const headers = (rows[0] ?? []).map((h) => h.trim());
  const data = rows.slice(1);
  const emptyByColumn: Record<string, number> = {};
  headers.forEach((h, i) => {
    emptyByColumn[h || `column_${i + 1}`] = data.filter((r) => (r[i] ?? "").trim() === "").length;
  });
  const seen = new Set<string>();
  let duplicates = 0;
  for (const r of data) {
    const key = r.map((v) => v.trim().toLowerCase()).join("\u0001");
    if (seen.has(key)) duplicates++;
    else seen.add(key);
  }
  const ragged = data.filter((r) => r.length !== headers.length).length;
  const emailCol = headers.findIndex((h) => /e-?mail/i.test(h));
  const badEmails =
    emailCol >= 0 ? data.filter((r) => (r[emailCol] ?? "").trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r[emailCol].trim())).length : null;
  const dateCols = headers
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => /date|dob|joined|created/i.test(h))
    .map(({ h, i }) => ({
      column: h,
      iso_format: data.filter((r) => /^\d{4}-\d{2}-\d{2}$/.test((r[i] ?? "").trim())).length,
      other_format: data.filter((r) => (r[i] ?? "").trim() && !/^\d{4}-\d{2}-\d{2}$/.test(r[i].trim())).length,
    }));
  return {
    file_type: "csv",
    header_row: headers,
    column_count: headers.length,
    data_row_count: data.length,
    rows_with_wrong_column_count: ragged,
    duplicate_rows: duplicates,
    empty_cells_by_column: emptyByColumn,
    total_empty_cells: Object.values(emptyByColumn).reduce((a, b) => a + b, 0),
    invalid_emails: badEmails,
    date_columns: dateCols,
    first_rows: data.slice(0, 5),
  };
}

// ---------- code ----------
export function measureCode(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const fnPatterns = [
    /^\s*def\s+([A-Za-z_]\w*)\s*\(/, // python
    /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/, // js/ts
    /^\s*(?:export\s+)?(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/, // arrow fn
    /^\s*(?:public|private|protected|static|\s)*[\w<>\[\]]+\s+([A-Za-z_]\w*)\s*\([^)]*\)\s*\{/, // java/c-like
  ];
  const functions = new Set<string>();
  const classes = new Set<string>();
  for (const l of lines) {
    for (const p of fnPatterns) {
      const m = l.match(p);
      if (m && !["if", "for", "while", "switch", "return", "catch"].includes(m[1])) functions.add(m[1]);
    }
    const c = l.match(/^\s*(?:export\s+)?class\s+([A-Za-z_]\w*)/);
    if (c) classes.add(c[1]);
  }
  const language = /^\s*def\s|^\s*import\s+\w+$|:\s*$/m.test(text) && !/[{};]\s*$/m.test(text)
    ? "python"
    : /\binterface\b|:\s*(string|number|boolean)\b/.test(text)
      ? "typescript"
      : /\bfunction\b|=>|\bconst\b/.test(text)
        ? "javascript"
        : "unknown";
  return {
    language_guess: language,
    total_lines: lines.length,
    code_lines: lines.filter((l) => l.trim() && !/^\s*(#|\/\/|\*|\/\*)/.test(l)).length,
    comment_lines: lines.filter((l) => /^\s*(#|\/\/|\*|\/\*)/.test(l)).length,
    functions_defined: [...functions],
    classes_defined: [...classes],
    todo_or_fixme: (text.match(/\b(TODO|FIXME|XXX)\b/g) ?? []).length,
    has_tests: /\b(def test_|it\(|test\(|describe\(|assert\b|unittest|pytest)/.test(text),
    has_docstrings_or_jsdoc: /"""|'''|\/\*\*/.test(text),
    longest_line: Math.max(0, ...lines.map((l) => l.length)),
  };
}

// ---------- images ----------
export function measureImage(bytes: Uint8Array, mediaType: string) {
  const b = bytes;
  let width: number | null = null;
  let height: number | null = null;
  let format = mediaType.replace("image/", "");
  const u32 = (o: number) => (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3];
  const u16 = (o: number) => (b[o] << 8) | b[o + 1];
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    format = "png"; width = u32(16); height = u32(20);
  } else if (b[0] === 0xff && b[1] === 0xd8) {
    format = "jpeg";
    let o = 2;
    while (o < b.length - 9) {
      if (b[o] !== 0xff) { o++; continue; }
      const marker = b[o + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        height = u16(o + 5); width = u16(o + 7); break;
      }
      o += 2 + u16(o + 2);
    }
  } else if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
    format = "gif"; width = b[6] | (b[7] << 8); height = b[8] | (b[9] << 8);
  } else if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    format = "webp";
    const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (chunk === "VP8X") { width = 1 + (b[24] | (b[25] << 8) | (b[26] << 16)); height = 1 + (b[27] | (b[28] << 8) | (b[29] << 16)); }
    else if (chunk === "VP8 ") { width = (b[26] | (b[27] << 8)) & 0x3fff; height = (b[28] | (b[29] << 8)) & 0x3fff; }
    else if (chunk === "VP8L") { const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24); width = (bits & 0x3fff) + 1; height = ((bits >> 14) & 0x3fff) + 1; }
  }
  const hasAlpha = format === "png" ? [4, 6].includes(b[25]) : format === "webp" || format === "gif" ? null : false;
  return {
    file_type: format,
    width_px: width,
    height_px: height,
    aspect_ratio: width && height ? +(width / height).toFixed(3) : null,
    is_square: width && height ? width === height : null,
    transparent_background_supported: hasAlpha,
    file_size_kb: Math.round(b.length / 1024),
  };
}

/** Pick the right measurements for the job type and what was submitted. */
export function measureSubmission(
  category: string,
  text: string,
  file?: { data: Uint8Array; mediaType: string; name?: string },
) {
  if (file?.mediaType.startsWith("image/")) return measureImage(file.data, file.mediaType);
  if (file?.mediaType === "application/pdf") return { file_type: "pdf", file_size_kb: Math.round(file.data.length / 1024) };
  if (!text.trim()) return null;
  if (category === "data" || /\.csv$/i.test(file?.name ?? "")) return measureCsv(text);
  if (category === "code") return measureCode(text);
  return measureWriting(text);
}

/** What the code can measure for each job type, so checklists are written to be checkable. */
export const MEASURABLE: Record<Category, string> = {
  writing: "word counts (total, per paragraph, first and last line), bullet count, line count, links",
  translation: "word counts, line count, paragraph count",
  social: "number of posts, hashtags, mentions, emojis, longest line in characters, links",
  design: "image file type, width and height in pixels, aspect ratio, whether it is square, transparency support, file size",
  data: "header row, column count, data row count, duplicate rows, empty cells per column, invalid emails, date formats",
  code: "functions and classes defined, language, line counts, TODO count, presence of tests and docstrings",
  website:
    "opened in a real cloud browser (KERNEL): HTTP status, load time in ms, page title, headings, navigation links, broken internal links, " +
    "forms and their fields, contact form present, list items, images missing alt text, sideways scrolling on a phone-sized screen, " +
    "tiny text on mobile, visible text; plus desktop and mobile screenshots",
};

export { countWords };
