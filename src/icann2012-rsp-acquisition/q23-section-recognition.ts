/**
 * Shared Question 23 section recognition for public-portion validation and
 * Q23 evidence-extractor section isolation.
 *
 * Recognizers (additive):
 * - A: id="q23" / id="q23_agb"
 * - B: "Question 23 … Registry Services" / "23. Registry Services"
 * - C: "Registry services are defined as the following"
 * - D: canonical ICANN prompt
 *     "23. Provide name and full description of all the Registry Services to be provided"
 *
 * `Q23 Registry Services` alone is intentionally NOT a matcher: the canonical
 * prompt already covers the observed 1H3 morphology that included that label.
 */

/** Whitespace, &nbsp;/&#160;, or a single HTML tag between tokens. */
const TOKEN_GAP = String.raw`(?:\s|&nbsp;|&#160;|<[^>]+>)*`;

const Q23_DOM_ID = /id\s*=\s*["']q23(?:_agb)?["']/i;
const Q23_HEADING =
  /(?:Question\s+23\b|\b23\s*[\.\)])\s*[:\-]?\s*Registry\s+Services\b/i;
const Q23_DEFINED = /Registry\s+services\s+are\s+defined\s+as\s+the\s+following/i;

/**
 * Canonical ICANN Q23 prompt with bounded presentation variance
 * (whitespace / &nbsp; / nested formatting tags between tokens).
 */
const Q23_CANONICAL_PROMPT = new RegExp(
  String.raw`\b23\s*[\.\)]` +
    TOKEN_GAP +
    String.raw`Provide` +
    TOKEN_GAP +
    String.raw`name` +
    TOKEN_GAP +
    String.raw`and` +
    TOKEN_GAP +
    String.raw`full` +
    TOKEN_GAP +
    String.raw`description` +
    TOKEN_GAP +
    String.raw`of` +
    TOKEN_GAP +
    String.raw`all` +
    TOKEN_GAP +
    String.raw`the` +
    TOKEN_GAP +
    String.raw`Registry` +
    TOKEN_GAP +
    String.raw`Services` +
    TOKEN_GAP +
    String.raw`to` +
    TOKEN_GAP +
    String.raw`be` +
    TOKEN_GAP +
    String.raw`provided\b`,
  "i",
);

const Q23_PATTERNS: RegExp[] = [Q23_DOM_ID, Q23_HEADING, Q23_DEFINED, Q23_CANONICAL_PROMPT];

const SCRIPT_OR_STYLE_BLOCK =
  /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;

function rangesInsideScriptOrStyle(html: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  SCRIPT_OR_STYLE_BLOCK.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SCRIPT_OR_STYLE_BLOCK.exec(html)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  return ranges;
}

function isInsideExcludedRange(
  index: number,
  ranges: Array<{ start: number; end: number }>,
): boolean {
  return ranges.some((r) => index >= r.start && index < r.end);
}

/**
 * First match of `pattern` whose start index is outside excluded script/style
 * ranges. Continues past excluded hits; does not treat an excluded first match
 * as terminal. Uses a local global clone so shared pattern state is untouched.
 */
function findFirstNonExcludedMatch(
  html: string,
  pattern: RegExp,
  excluded: Array<{ start: number; end: number }>,
): RegExpExecArray | null {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);
  re.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    if (!isInsideExcludedRange(match.index, excluded)) {
      return match;
    }
    // Avoid zero-length-match infinite loops when continuing past exclusions.
    if (match[0].length === 0) {
      re.lastIndex += 1;
      if (re.lastIndex > html.length) break;
    }
  }
  return null;
}

export type Q23SectionMatch = {
  /** Raw HTML index where the Q23 section should begin for slicing. */
  index: number;
  /** Which recognizer matched (for diagnostics/tests). */
  kind: "dom-id" | "heading" | "defined-phrase" | "canonical-prompt";
};

function kindForPattern(pattern: RegExp): Q23SectionMatch["kind"] {
  if (pattern === Q23_DOM_ID) return "dom-id";
  if (pattern === Q23_HEADING) return "heading";
  if (pattern === Q23_DEFINED) return "defined-phrase";
  return "canonical-prompt";
}

/**
 * Earliest recognized Q23 section start in raw HTML, or -1.
 * DOM-id matches begin after the opening tag's `>` so attribute text is excluded.
 * Matches inside `<script>` / `<style>` blocks are ignored; later body matches
 * for the same recognizer remain eligible.
 */
export function findQ23SectionStart(html: string): number {
  return findQ23SectionMatch(html)?.index ?? -1;
}

export function findQ23SectionMatch(html: string): Q23SectionMatch | null {
  const excluded = rangesInsideScriptOrStyle(html);
  let best: Q23SectionMatch | null = null;

  for (const pattern of Q23_PATTERNS) {
    const match = findFirstNonExcludedMatch(html, pattern, excluded);
    if (!match) continue;

    let index = match.index;
    if (/id\s*=/i.test(match[0])) {
      const gt = html.indexOf(">", match.index);
      if (gt >= 0) index = gt + 1;
    }

    const candidate: Q23SectionMatch = {
      index,
      kind: kindForPattern(pattern),
    };
    if (!best || candidate.index < best.index) best = candidate;
  }

  return best;
}

/** True when the document contains a recognized Q23 section outside script/style. */
export function portionDocumentHasQ23Section(html: string): boolean {
  return findQ23SectionStart(html) >= 0;
}
