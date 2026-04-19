/**
 * parseMarkdown — parse journal entry: frontmatter, body, word count, structural signals.
 * Zero LLM calls — deterministic.
 */

function getSeason(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "unknown";
  const month = d.getMonth(); // 0-indexed
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  return "winter";
}

function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  if (!content.startsWith("---")) return { meta: {}, body: content };
  const end = content.indexOf("\n---", 3);
  if (end === -1) return { meta: {}, body: content };

  const fmLines = content.slice(3, end).trim().split("\n");
  const meta: Record<string, string> = {};
  for (const line of fmLines) {
    const colon = line.indexOf(":");
    if (colon > 0) {
      const key = line.slice(0, colon).trim();
      const val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
      meta[key] = val;
    }
  }
  return { meta, body: content.slice(end + 4).trim() };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const parseMarkdownNode = async (state: any) => {
  const { rawContent, entryDate } = state;
  const content: string = rawContent ?? "";

  const { meta, body } = parseFrontmatter(content);
  const resolvedDate = meta.date ?? entryDate ?? new Date().toISOString().split("T")[0];

  const wordCount = body.split(/\s+/).filter(Boolean).length;

  // Structural signals
  const structuralSignals: Record<string, unknown> = {
    hasHeaders: /^#{1,6} /m.test(body),
    hasBullets: /^[-*+] /m.test(body),
    hasQuestions: (body.match(/\?/g) ?? []).length,
    hasEmphasis: (body.match(/\*\*[^*]+\*\*/g) ?? []).length,
    paragraphCount: body.split(/\n\n+/).filter(p => p.trim().length > 20).length,
    frontmatterKeys: Object.keys(meta),
  };

  return {
    phase: "parse-markdown",
    bodyText: body,
    wordCount,
    structuralSignals,
    season: getSeason(resolvedDate),
  };
};
