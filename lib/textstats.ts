/**
 * Exact measurements of a text submission, computed in code.
 * Language models are poor at counting, so these numbers are handed to the
 * verifier as facts rather than left for the model to estimate.
 */
const BULLET = /^\s*(?:[-*•▪◦–]|\d+[.)])\s+/;

export function countWords(s: string) {
  return (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu) ?? []).length;
}

export function measureText(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);
  const bullets = nonEmpty.filter((l) => BULLET.test(l));

  // Paragraphs: blocks separated by blank lines, excluding bullet-only blocks.
  const blocks = text.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const paragraphs = blocks.filter((b) => !b.split("\n").every((l) => BULLET.test(l.trim())));

  return {
    total_words: countWords(text),
    total_characters: text.length,
    non_empty_lines: nonEmpty.length,
    first_line: nonEmpty[0] ?? "",
    first_line_words: countWords(nonEmpty[0] ?? ""),
    last_line: nonEmpty[nonEmpty.length - 1] ?? "",
    last_line_words: countWords(nonEmpty[nonEmpty.length - 1] ?? ""),
    bullet_points: bullets.length,
    bullet_texts: bullets.map((b) => b.replace(BULLET, "")).slice(0, 20),
    paragraphs: paragraphs.slice(0, 12).map((p, i) => ({
      index: i + 1,
      words: countWords(p),
      starts_with: p.slice(0, 60),
    })),
  };
}
