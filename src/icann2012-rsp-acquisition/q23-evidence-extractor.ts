import { emptyHistoricalRspEvidenceExtractionResult } from "./historical-rsp-evidence-candidate";
import type {
  HistoricalRspEvidenceCandidate,
  HistoricalRspEvidenceExtractionResult,
  HistoricalRspEvidenceSourceFieldPath,
} from "./historical-rsp-evidence-candidate";
import {
  HISTORICAL_RSP_EVIDENCE_CANDIDATE_SCHEMA_VERSION,
  HISTORICAL_RSP_EVIDENCE_EXTRACTION_SCHEMA_VERSION,
} from "./historical-rsp-evidence-candidate";
import {
  PUBLIC_PORTION_VERSION_BASIS,
  validatePublicPortionDocument,
  type PublicPortionValidationOptions,
} from "./public-portion-validation";
import { findQ23SectionStart } from "./q23-section-recognition";

const MAX_EXCERPT_CHARS = 240;

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Decode a small, deterministic set of HTML entities (no external decoder). */
export function decodeBasicHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n: string) => {
      const code = Number(n);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : "";
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => {
      const code = Number.parseInt(h, 16);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : "";
    })
    .replace(/&([a-zA-Z]+);/g, (full, name: string) => HTML_ENTITY_MAP[name.toLowerCase()] ?? full);
}

/** Strip tags and normalize whitespace — mechanical only. */
export function htmlToPlainText(html: string): string {
  const withoutScripts = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  const withBreaks = withoutScripts.replace(/<(br|\/p|\/div|\/tr|\/li|\/h[1-6])\b[^>]*>/gi, "\n");
  const noTags = withBreaks.replace(/<[^>]+>/g, " ");
  return decodeBasicHtmlEntities(noTags).replace(/\s+/g, " ").trim();
}

type SectionSlice = {
  fieldPath: HistoricalRspEvidenceSourceFieldPath;
  html: string;
  text: string;
};

function findQuestionStart(html: string, question: 23 | 24 | 25): number {
  if (question === 23) {
    return findQ23SectionStart(html);
  }
  const patterns =
    question === 24
      ? [
          /id\s*=\s*["']q24(?:_agb)?["']/i,
          /(?:Question\s+24\b|\b24\s*[\.\)])\s*[:\-]?\s*/i,
        ]
      : [
          /id\s*=\s*["']q25(?:_agb)?["']/i,
          /(?:Question\s+25\b|\b25\s*[\.\)])\s*[:\-]?\s*/i,
        ];
  let best = -1;
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(html);
    if (!match) continue;
    let index = match.index;
    // id="q24"/"q25" matches inside the opening tag — start after `>` so
    // attribute debris cannot precede the question heading in plain text.
    if (/id\s*=/i.test(match[0])) {
      const gt = html.indexOf(">", match.index);
      if (gt >= 0) index = gt + 1;
    }
    if (best < 0 || index < best) best = index;
  }
  return best;
}

function extractQuestionSections(html: string): SectionSlice[] {
  const starts: { fieldPath: HistoricalRspEvidenceSourceFieldPath; index: number }[] = [];
  for (const q of [23, 24, 25] as const) {
    const index = findQuestionStart(html, q);
    if (index >= 0) {
      starts.push({ fieldPath: `Q${q}` as HistoricalRspEvidenceSourceFieldPath, index });
    }
  }
  starts.sort((a, b) => a.index - b.index);
  const sections: SectionSlice[] = [];
  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i]!;
    const end = i + 1 < starts.length ? starts[i + 1]!.index : html.length;
    const sliceHtml = html.slice(start.index, end);
    sections.push({
      fieldPath: start.fieldPath,
      html: sliceHtml,
      text: htmlToPlainText(sliceHtml),
    });
  }
  return sections;
}

function normalizeProviderName(raw: string): string {
  let name = decodeBasicHtmlEntities(raw)
    .replace(/\s+/g, " ")
    // Preserve legal-name commas and Inc. abbreviation periods; strip only loose edge delimiters.
    .replace(/^[\s,;:"']+|[\s,;:"']+$/g, "")
    .trim();
  // Sentence-terminating period after LLC/Ltd/Corp/Co/PLC is outside the name; Inc. keeps its period.
  name = name.replace(/\b(LLC|L\.L\.C|Ltd|Corp|Co|PLC)\.$/i, "$1");
  return name;
}

const PROVIDER_NAME_STOPWORDS =
  /^(?:selected|engaged|contracted|appointed|retained|partnered|provided|providing|performed|operated|not|no|the|a|an|this|these|none)$/i;

function isPlausibleProviderName(name: string): boolean {
  if (!name || name.length < 2 || name.length > 120) return false;
  if (PROVIDER_NAME_STOPWORDS.test(name)) return false;
  if (/^the\s+applicant\b/i.test(name) || /^applicant\b/i.test(name)) return false;
  if (!/[A-Za-z]/.test(name)) return false;
  return true;
}

/**
 * Legal suffix after a comma must be a complete token.
 * `(?![A-Za-z])` rejects prefix matches such as Co⊂conducts / Corp⊂corporate.
 */
const LEGAL_SUFFIX_AT =
  /^(?:Inc\.?|LLC|L\.L\.C\.?|Ltd\.?|Corp\.?|Co\.?|PLC|s\.r\.o\.)(?![A-Za-z])/i;
/** Space-separated dotted legal form (no leading comma), e.g. `Gransy s.r.o.`. */
const DOTTED_LEGAL_SUFFIX_AT = /^\s+(s\.r\.o\.)/i;
/**
 * Short all-caps/digit parenthetical alias immediately after a provider span
 * (e.g. `(CNNIC)`, `(TRA)`, `(ISC)`, `(ARI)`). Descriptive or exchange-code
 * parentheticals are intentionally rejected.
 */
const PARENTHETICAL_ALIAS_AT = /^\s*\(([A-Z][A-Z0-9]{1,12})\)/;
const PROVIDER_FIRST_WORD = /^[A-Z][A-Za-z0-9&'\-]*/;
/** Continuation word: Title Case only — periods are never part of ordinary tokens. */
const PROVIDER_NEXT_WORD = /^\s+(?:&\s+)?([A-Z][A-Za-z0-9&'\-]*)/;

function absorbParentheticalAlias(text: string, i: number, end: number): number {
  const alias = text.slice(i).match(PARENTHETICAL_ALIAS_AT);
  if (!alias) return end;
  return i + alias[0].length;
}

/**
 * Take a provider name starting at `start`, preserving commas before legal suffixes
 * and Inc. abbreviation periods. Stops at real sentence boundaries — ordinary word
 * tokens do not absorb `.` so following prose is never consumed.
 *
 * Bounded extensions (additive): `s.r.o.` dotted legal suffix; short parenthetical
 * acronym/alias immediately attached to the completed name span.
 */
function takeProviderNameAsStated(
  text: string,
  start: number,
): { raw: string; length: number } | null {
  if (start >= text.length) return null;
  const first = text.slice(start).match(PROVIDER_FIRST_WORD);
  if (!first) return null;
  let i = start + first[0].length;
  let end = i;

  while (i < text.length) {
    const comma = text.slice(i).match(/^,\s*/);
    if (comma) {
      const afterComma = i + comma[0].length;
      const suffix = text.slice(afterComma).match(LEGAL_SUFFIX_AT);
      if (suffix) {
        i = afterComma + suffix[0].length;
        end = i;
        end = absorbParentheticalAlias(text, i, end);
        break;
      }
      break;
    }

    const dotted = text.slice(i).match(DOTTED_LEGAL_SUFFIX_AT);
    if (dotted) {
      i += dotted[0].length;
      end = i;
      end = absorbParentheticalAlias(text, i, end);
      break;
    }

    const ch = text[i];
    if (ch === "." || ch === ";" || ch === "!" || ch === "?") break;

    const next = text.slice(i).match(PROVIDER_NEXT_WORD);
    if (next) {
      i += next[0].length;
      end = i;
      if (/^Inc$/i.test(next[1]!) && text[i] === ".") {
        i += 1;
        end = i;
        end = absorbParentheticalAlias(text, i, end);
        break;
      }
      continue;
    }

    // Parenthetical alias may follow the final Title Case token with no legal suffix.
    const withAlias = absorbParentheticalAlias(text, i, end);
    if (withAlias !== end) {
      end = withAlias;
      break;
    }
    break;
  }

  const raw = text.slice(start, end);
  if (!raw) return null;
  return { raw, length: end - start };
}

/** Drop leading Q23–Q25 heading labels so they cannot enter provider-name captures. */
function stripLeadingQuestionHeading(text: string): string {
  return text
    .replace(/^id\s*=\s*["']q2[3-5][^>]*>\s*/i, "")
    .replace(/^(?:Question\s+)?2[3-5]\s*[.)]\s*/i, "")
    .replace(/^Question\s+2[3-5]\s*[:.\-]?\s*/i, "")
    // Case-sensitive: `/i` would make (?=[A-Z]) also match "will".
    .replace(/^Registry\s+Services\b\s+(?=[A-Z])/, "")
    // Bounded: allow guidebook subsection numbers immediately after the Q23 title
    // so `Registry Services 23.2.1. Registry Operations Team…` can expose the clause.
    .replace(/^Registry\s+Services\b\s+(?=\d+(?:\.\d+)+\.?)/, "")
    .replace(/^Additional\s+services?\b\s*/i, "")
    .trimStart();
}

/** True when `periodIndex` is the abbreviation period in Inc. / similar legal suffixes. */
function isLegalAbbreviationPeriod(text: string, periodIndex: number): boolean {
  if (text[periodIndex] !== ".") return false;
  const before = text.slice(Math.max(0, periodIndex - 10), periodIndex);
  return /\b(?:Inc|L\.L\.C|Ltd|Corp|Co|PLC)$/i.test(before);
}

/**
 * Deterministic sentence split on `.|;|!|?` followed by whitespace or end.
 * Inc. abbreviation periods stay inside the clause when followed by lowercase
 * continuation ("Inc. to provide…"), but split when the next token is a new
 * capitalized sentence ("Inc. The Applicant…").
 * L.L.C. internal periods (not followed by whitespace) stay intact.
 */
function splitSentences(text: string): { text: string; absoluteStart: number }[] {
  const out: { text: string; absoluteStart: number }[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (
      (ch === "." || ch === ";" || ch === "!" || ch === "?") &&
      (i + 1 >= text.length || /\s/.test(text[i + 1]!))
    ) {
      if (ch === "." && isLegalAbbreviationPeriod(text, i)) {
        let look = i + 1;
        while (look < text.length && /\s/.test(text[look]!)) look += 1;
        const next = text[look];
        // Same-clause continuation after Inc. (e.g. "to provide") — do not split.
        if (!next || !/[A-Z]/.test(next)) {
          continue;
        }
        // Capitalized token after Inc. — treat as a new sentence boundary.
      }
      const raw = text.slice(start, i + 1);
      const lead = raw.match(/^\s*/)?.[0].length ?? 0;
      const trimmed = raw.trim();
      if (trimmed) out.push({ text: trimmed, absoluteStart: start + lead });
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j]!)) j += 1;
      start = j;
      i = j - 1;
    }
  }
  if (start < text.length) {
    const raw = text.slice(start);
    const lead = raw.match(/^\s*/)?.[0].length ?? 0;
    const trimmed = raw.trim();
    if (trimmed) out.push({ text: trimmed, absoluteStart: start + lead });
  }
  return out;
}

function boundExcerpt(text: string, matchIndex: number, matchLength: number): string {
  const pad = 40;
  const start = Math.max(0, matchIndex - pad);
  const end = Math.min(text.length, matchIndex + matchLength + pad);
  let excerpt = text.slice(start, end).trim();
  if (start > 0) excerpt = `…${excerpt}`;
  if (end < text.length) excerpt = `${excerpt}…`;
  if (excerpt.length > MAX_EXCERPT_CHARS) {
    excerpt = `${excerpt.slice(0, MAX_EXCERPT_CHARS - 1)}…`;
  }
  return excerpt;
}

type ExplicitHit = {
  providerNameAsStated: string;
  roleAsStated?: string;
  matchIndex: number;
  matchLength: number;
  matchedText: string;
};

/** Presentation variants for back-end role wording (recognition only; roleAsStated stays literal). */
const BACK_END = String.raw`(?:backend|back-end|back\s+end)`;

/** Role tail shared by affirmative Applicant assignment forms. */
const ROLE_TAIL = new RegExp(
  String.raw`^\s+to\s+(?:provide|perform|operate)\s+((?:the\s+)?(?:${BACK_END}\s+)?(?:registry\s+services?|registry\s+service\s+provider(?:\s+services?)?))\b`,
  "i",
);

const PARTNERED_ROLE_TAIL = new RegExp(
  String.raw`^\s+to\s+(?:provide|perform|operate)\s+((?:the\s+)?(?:${BACK_END}\s+)?registry\s+services?)\b`,
  "i",
);

const WILL_PROVIDE_ROLE = new RegExp(
  String.raw`^\s+will\s+(?:provide|perform|operate)\s+((?:the\s+)?(?:${BACK_END}\s+)?registry\s+services?)\s+for\s+(?:the\s+)?Applicant\b`,
  "i",
);

/** Steward-verified: elected to partner with PROVIDER to provide back-end services. */
const ELECTED_PARTNER_OPENER = /\b(?:has\s+)?elected\s+to\s+partner\s+with\s+/i;
/**
 * Role tail for elected-partner only. Allows a single optional comma before
 * `to provide` so `Inc, to provide` matches without absorbing the comma into
 * the provider span. Do not reuse this separator for other role tails.
 */
const ELECTED_PARTNER_ROLE = new RegExp(
  String.raw`^\s*,?\s*to\s+provide\s+((?:the\s+)?${BACK_END}\s+(?:registry\s+)?services?)\b`,
  "i",
);

const LEGAL_SUFFIX_TOKEN = /^(?:Inc|LLC|L\.L\.C|Ltd|Corp|Co|PLC|s\.r\.o)\.?$/i;

/**
 * Single-token parenthetical that case-insensitively aliases one non-suffix
 * token of the just-parsed provider span (e.g. `NeuStar, Inc (Neustar)`).
 * Treated as interstitial evidence — not included in providerNameAsStated.
 * Narrower than all-caps acronym absorption; rejects descriptive prose.
 */
function skipSameNameParentheticalAlias(
  text: string,
  start: number,
  providerRaw: string,
): number | null {
  const match = text
    .slice(start)
    .match(/^\s*\([“"']?([A-Za-z][A-Za-z0-9&.'-]{0,40})[”"']?\)/);
  if (!match) return null;
  const alias = match[1]!;
  const tokens = providerRaw
    .split(/[\s,]+/)
    .map((token) => token.replace(/\.+$/, ""))
    .filter((token) => token.length > 0 && !LEGAL_SUFFIX_TOKEN.test(token));
  if (!tokens.some((token) => token.toLowerCase() === alias.toLowerCase())) {
    return null;
  }
  return start + match[0].length;
}

/** Steward-verified: will outsource the entirety of its technical operations to PROVIDER. */
const OUTSOURCE_ENTIRETY_OPENER =
  /\bwill\s+outsource\s+the\s+entirety\s+of\s+(?:its|their)\s+technical\s+operations\s+to\s+/i;

/** Steward-verified: PROVIDER, the back-end provider of registry services … */
const BACKEND_PROVIDER_APPOSITIVE = new RegExp(
  String.raw`,\s+the\s+(${BACK_END}\s+provider\s+of\s+registry\s+services?)\b`,
  "i",
);

/** Steward-verified: engaged PROVIDER to deliver (registry) services. */
const ENGAGED_TO_DELIVER_OPENER = /\b(?:(?:We|I)\s+have|has)\s+engaged\s+/i;
const ENGAGED_TO_DELIVER_ROLE =
  /^\s+to\s+deliver\s+((?:the\s+)?(?:registry\s+)?services?)\b/i;

/**
 * Steward-verified passive/explicit selected-as-backend constructions:
 * - PROVIDER has been/was selected [by X] to provide back-end services
 * - PROVIDER has been/was selected as [the] back-end registry services provider
 * - PROVIDER is [Possessive] selected (provider of) backend registry services
 * - selected backend registry services provider, PROVIDER
 */
const SELECTED_PASSIVE_TO_PROVIDE = new RegExp(
  String.raw`^\s*,?\s*(?:in\s+turn,?\s+)?(?:has\s+been|was)\s+selected\b(?:\s+by\s+(?:(?!\bto\s+provide\b).){1,80}?)?\s+to\s+provide\s+((?:the\s+)?${BACK_END}\s+(?:registry\s+)?services?)\b`,
  "i",
);
const SELECTED_AS_BACKEND_PROVIDER = new RegExp(
  String.raw`^\s*,?\s*(?:has\s+been|was)\s+selected\s+as\s+(?:the\s+)?((?:${BACK_END}\s+)(?:registry\s+)?(?:services?\s+)?provider)\b`,
  "i",
);
const IS_SELECTED_BACKEND_PROVIDER = new RegExp(
  String.raw`^\s+is\s+(?:[A-Za-z][A-Za-z0-9&.'-]{0,40}'s\s+)?selected\s+(?:provider\s+of\s+)?((?:${BACK_END}\s+)?registry\s+services?(?:\s+provider)?)\b`,
  "i",
);
const SELECTED_BACKEND_PROVIDER_COMMA = new RegExp(
  String.raw`\bselected\s+(?:provider\s+of\s+)?((?:${BACK_END}\s+)?registry\s+services?(?:\s+provider)?),\s*`,
  "i",
);

/** Steward-verified: retained PROVIDER as the Registry Back-End Service Provider. */
const RETAINED_AS_BACKEND_OPENER = /\b(?:has\s+)?retained\s+/i;
const RETAINED_AS_BACKEND_ROLE = new RegExp(
  String.raw`^\s+as\s+["“]?((?:the\s+)?Registry\s+Back[\s-]?End\s+Service\s+Provider)["”]?\b`,
  "i",
);

/** Steward-verified: Registry operations are outsourced to and performed by PROVIDER. */
const OUTSOURCED_AND_PERFORMED_BY =
  /^(?:Registry\s+operations?)\s+(?:are|is|will\s+be)\s+outsourced\s+to\s+and\s+performed\s+by\s+/i;

/**
 * Guidebook subsection heading leak immediately before the outsourced-operations
 * clause (1H10–1H13). Accepts:
 * - `N.N.N. Registry Operations Team` at sentence start; or
 * - exact outer residue `OPERATIONS N.N.N Registry Operations Team` after the
 *   ordinary splitter splits on `23.2.` in `23.2. OPERATIONS 23.2.1. …`
 * Only when immediately followed by `Registry operation(s)…`.
 * Case-sensitive `OPERATIONS` — not generic uppercase-heading stripping.
 */
const REGISTRY_OPERATIONS_TEAM_HEADING_LEAK =
  /^((?:OPERATIONS\s+)?\d+(?:\.\d+)+\.?\s+Registry\s+Operations\s+Team\s+)(?=Registry\s+operations?\b)/;

/**
 * Neutralize only the terminal period after `N.N.N.` when it would otherwise
 * split the verified `Registry Operations Team` heading away from the following
 * assignment clause. Replaces that period with a space (length-preserving) so
 * evidence locators remain aligned to the section text.
 */
function collapseRegistryOperationsTeamHeadingPeriod(text: string): string {
  return text.replace(
    /(\d+(?:\.\d+)+)(\.)(\s+)(Registry\s+Operations\s+Team\s+)(?=Registry\s+operations?\b)/gi,
    "$1 $3$4",
  );
}

function stripRegistryOperationsTeamHeadingLeak(
  sentence: string,
): { text: string; strippedLength: number } {
  const match = sentence.match(REGISTRY_OPERATIONS_TEAM_HEADING_LEAK);
  if (!match) return { text: sentence, strippedLength: 0 };
  return { text: sentence.slice(match[1]!.length), strippedLength: match[1]!.length };
}

/**
 * Steward-verified planning form (narrow): planning to outsource the technical
 * operation … to … partner company PROVIDER.
 */
const PLANNING_OUTSOURCE_PARTNER_OPENER =
  /\b(?:(?:we|I)\s+are|is|are)\s+planning\s+to\s+outsource\s+the\s+technical\s+operation(?:s)?(?:\s+of\s+(?:the\s+)?gTLD)?\s+to\s+(?:our\s+|its\s+|their\s+)?partner\s+company\s+/i;

/**
 * Affirmative clause openers only — past/perfect assignment verbs after Applicant.
 * Bare "select"/"engage" and modality wrappers are intentionally unsupported.
 */
const AFFIRMATIVE_APPLICANT_ASSIGNED =
  /^(?:The\s+)?Applicant\s+(?:has\s+)?(selected|engaged|contracted|appointed|retained)\s+/i;

const AFFIRMATIVE_APPLICANT_PARTNERED =
  /^(?:The\s+)?Applicant\s+(?:has\s+)?partnered\s+with\s+/i;

const AFFIRMATIVE_PROVIDED_BY =
  /^(?:(?:Backend\s+)?Registry\s+services?)\s+(?:will\s+be|are)\s+provided\s+by\s+/i;

const AFFIRMATIVE_RSP_LABEL = /^Registry\s+Service\s+Provider\s*(?:is|:)\s*/i;

const SELF_OPERATED_PATTERNS: RegExp[] = [
  /\bApplicant\s+will\s+(?:provide|perform|operate)\s+(?:all\s+)?(?:the\s+)?(?:relevant\s+)?(?:registry\s+)?services?\s+itself\b/i,
  /\bApplicant\s+itself\s+will\s+(?:provide|perform|operate)\s+(?:the\s+)?(?:registry\s+)?services?\b/i,
  /\bself[-\s]?operated\b/i,
  /\bno\s+external\s+(?:registry\s+)?(?:service\s+)?provider\b/i,
  /\bwill\s+not\s+(?:engage|select|contract)\s+(?:an?\s+)?external\s+(?:registry\s+)?(?:service\s+)?provider\b/i,
];

const AMBIGUOUS_VENDOR_NEAR_TECH =
  /\b([A-Z][A-Za-z0-9&.'-]{2,40})\s+(?:DNSSEC|DNS|EPP|Whois|WHOIS|SRS)\b|\b(?:DNSSEC|DNS|EPP|Whois|WHOIS|SRS)\s+(?:materials?|documentation|software|products?)?\s*(?:from|by|of)\s+([A-Z][A-Za-z0-9&.'-]{2,40})\b/g;

const AMBIGUOUS_NAME_STOPWORDS =
  /^(?:The|This|These|Applicant|Registry|Services|Service|Provider|Question|Technical|General|Industry|No|DNS|DNSSEC|EPP|Whois|WHOIS|SRS)$/i;

/**
 * After a provider span with no trailing role grammar, only ordinary sentence
 * punctuation may remain. Any other leftover text means the span is incomplete
 * (e.g. lowercase connectors or unsupported suffixes) — fail closed.
 */
function isOnlyTerminalSentencePunctuation(remainder: string): boolean {
  return /^\s*[.!?;]*\s*$/.test(remainder);
}

function tryAffirmativeHit(
  sentence: string,
  absoluteStart: number,
  opener: RegExp,
  roleTail: RegExp | null,
  options: {
    requireCompleteProviderSpan?: boolean;
    /** When true, opener may appear mid-sentence (not only at index 0). */
    allowMidSentence?: boolean;
    skipLeadingThe?: boolean;
  } = {},
): ExplicitHit | null {
  opener.lastIndex = 0;
  const openMatch = opener.exec(sentence);
  if (!openMatch) return null;
  if (!options.allowMidSentence && openMatch.index !== 0) return null;
  let nameStart = openMatch.index + openMatch[0].length;
  if (options.skipLeadingThe !== false) {
    const theSkip = sentence.slice(nameStart).match(/^the\s+/i);
    if (theSkip) nameStart += theSkip[0].length;
  }
  const taken = takeProviderNameAsStated(sentence, nameStart);
  if (!taken) return null;

  let role: string | undefined;
  let cursor = nameStart + taken.length;
  // Optional same-name mixed-case alias interstitial before a role tail.
  if (roleTail) {
    const aliasEnd = skipSameNameParentheticalAlias(sentence, cursor, taken.raw);
    if (aliasEnd !== null) cursor = aliasEnd;
  }
  let matchEnd = cursor;
  if (roleTail) {
    const afterName = sentence.slice(cursor);
    const roleMatch = afterName.match(roleTail);
    if (!roleMatch || roleMatch.index !== 0) return null;
    role = roleMatch[1];
    matchEnd = cursor + roleMatch[0].length;
  } else if (options.requireCompleteProviderSpan) {
    const remainder = sentence.slice(cursor);
    if (!isOnlyTerminalSentencePunctuation(remainder)) {
      // Incomplete provider wording (truncated prefix) — never emit partial name.
      return null;
    }
  }

  const providerNameAsStated = normalizeProviderName(taken.raw);
  if (!isPlausibleProviderName(providerNameAsStated)) return null;

  const matchedText = sentence.slice(openMatch.index, matchEnd);
  return {
    providerNameAsStated,
    roleAsStated: role ? normalizeProviderName(role) : undefined,
    matchIndex: absoluteStart + openMatch.index,
    matchLength: matchEnd - openMatch.index,
    matchedText,
  };
}

function tryBackendProviderAppositiveHit(
  sentence: string,
  absoluteStart: number,
): ExplicitHit | null {
  BACKEND_PROVIDER_APPOSITIVE.lastIndex = 0;
  const roleMatch = BACKEND_PROVIDER_APPOSITIVE.exec(sentence);
  if (!roleMatch || roleMatch.index <= 0) return null;
  const commaIndex = roleMatch.index;
  // Provider span must end exactly at the appositive comma. Prefer the longest
  // (leftmost) plausible span so legal tokens like "Co" are not taken alone.
  let bestStart = -1;
  let bestTaken: { raw: string; length: number } | null = null;
  for (let start = 0; start < commaIndex; start += 1) {
    if (start > 0 && /[A-Za-z0-9]/.test(sentence[start - 1]!)) continue;
    const taken = takeProviderNameAsStated(sentence, start);
    if (!taken || start + taken.length !== commaIndex) continue;
    if (bestStart < 0 || start < bestStart) {
      bestStart = start;
      bestTaken = taken;
    }
  }
  if (bestStart < 0 || !bestTaken) return null;
  const providerNameAsStated = normalizeProviderName(bestTaken.raw);
  if (!isPlausibleProviderName(providerNameAsStated)) return null;
  const matchEnd = commaIndex + roleMatch[0].length;
  return {
    providerNameAsStated,
    roleAsStated: normalizeProviderName(roleMatch[1]!),
    matchIndex: absoluteStart + bestStart,
    matchLength: matchEnd - bestStart,
    matchedText: sentence.slice(bestStart, matchEnd),
  };
}

function trySelectedBackendProviderHits(
  sentence: string,
  absoluteStart: number,
): ExplicitHit | null {
  // Sentence-initial PROVIDER + passive/selected-as / is-selected role.
  const providerOpen = takeProviderNameAsStated(sentence, 0);
  if (providerOpen) {
    let cursor = providerOpen.length;
    const aliasEnd = skipSameNameParentheticalAlias(sentence, cursor, providerOpen.raw);
    if (aliasEnd !== null) cursor = aliasEnd;
    const after = sentence.slice(cursor);
    for (const roleRe of [
      SELECTED_PASSIVE_TO_PROVIDE,
      SELECTED_AS_BACKEND_PROVIDER,
      IS_SELECTED_BACKEND_PROVIDER,
    ]) {
      const roleMatch = after.match(roleRe);
      if (!roleMatch || roleMatch.index !== 0) continue;
      const providerNameAsStated = normalizeProviderName(providerOpen.raw);
      if (!isPlausibleProviderName(providerNameAsStated)) return null;
      const matchEnd = cursor + roleMatch[0].length;
      return {
        providerNameAsStated,
        roleAsStated: normalizeProviderName(roleMatch[1]!),
        matchIndex: absoluteStart,
        matchLength: matchEnd,
        matchedText: sentence.slice(0, matchEnd),
      };
    }
  }

  // Role-then-provider: selected backend registry services provider, PROVIDER
  SELECTED_BACKEND_PROVIDER_COMMA.lastIndex = 0;
  const commaRole = SELECTED_BACKEND_PROVIDER_COMMA.exec(sentence);
  if (commaRole) {
    const nameStart = commaRole.index + commaRole[0].length;
    const theSkip = sentence.slice(nameStart).match(/^the\s+/i);
    const adjusted = nameStart + (theSkip?.[0].length ?? 0);
    const taken = takeProviderNameAsStated(sentence, adjusted);
    if (taken) {
      const providerNameAsStated = normalizeProviderName(taken.raw);
      if (isPlausibleProviderName(providerNameAsStated)) {
        let matchEnd = adjusted + taken.length;
        const aliasEnd = skipSameNameParentheticalAlias(sentence, matchEnd, taken.raw);
        if (aliasEnd !== null) matchEnd = aliasEnd;
        return {
          providerNameAsStated,
          roleAsStated: normalizeProviderName(commaRole[1]!),
          matchIndex: absoluteStart + commaRole.index,
          matchLength: matchEnd - commaRole.index,
          matchedText: sentence.slice(commaRole.index, matchEnd),
        };
      }
    }
  }

  return null;
}

/**
 * Evaluate one sentence against the locked affirmative assignment grammar only.
 * No assignment-verb token scan; no growing negation blacklist.
 */
function matchAffirmativeSentence(
  sentence: string,
  absoluteStart: number,
): ExplicitHit | null {
  // Sentence text is already trimmed by splitSentences; do not strip trailing
  // periods here — Inc. abbreviation periods must remain available to the name taker.
  // Bounded heading-leak strip for ISC-style guidebook subsection prefixes only.
  const stripped = stripRegistryOperationsTeamHeadingLeak(sentence);
  const body = stripped.text;
  absoluteStart += stripped.strippedLength;

  const applicantAssigned = tryAffirmativeHit(
    body,
    absoluteStart,
    AFFIRMATIVE_APPLICANT_ASSIGNED,
    ROLE_TAIL,
  );
  if (applicantAssigned) return applicantAssigned;

  const partnered = tryAffirmativeHit(
    body,
    absoluteStart,
    AFFIRMATIVE_APPLICANT_PARTNERED,
    PARTNERED_ROLE_TAIL,
  );
  if (partnered) return partnered;

  const providedBy = tryAffirmativeHit(body, absoluteStart, AFFIRMATIVE_PROVIDED_BY, null, {
    requireCompleteProviderSpan: true,
  });
  if (providedBy) return providedBy;

  const rspLabel = tryAffirmativeHit(body, absoluteStart, AFFIRMATIVE_RSP_LABEL, null, {
    requireCompleteProviderSpan: true,
  });
  if (rspLabel) return rspLabel;

  // <Provider> will provide … for the Applicant — provider must open the sentence.
  const providerOpen = takeProviderNameAsStated(body, 0);
  if (providerOpen) {
    const after = body.slice(providerOpen.length);
    const roleMatch = after.match(WILL_PROVIDE_ROLE);
    if (roleMatch && roleMatch.index === 0) {
      const providerNameAsStated = normalizeProviderName(providerOpen.raw);
      if (isPlausibleProviderName(providerNameAsStated)) {
        const matchEnd = providerOpen.length + roleMatch[0].length;
        return {
          providerNameAsStated,
          roleAsStated: normalizeProviderName(roleMatch[1]!),
          matchIndex: absoluteStart,
          matchLength: matchEnd,
          matchedText: body.slice(0, matchEnd),
        };
      }
    }
  }

  // --- Steward-verified additive constructions (RIH-2012-RSP-VISIBILITY-1H8) ---

  const elected = tryAffirmativeHit(
    body,
    absoluteStart,
    ELECTED_PARTNER_OPENER,
    ELECTED_PARTNER_ROLE,
    { allowMidSentence: true },
  );
  if (elected) return elected;

  const outsourceEntirety = tryAffirmativeHit(
    body,
    absoluteStart,
    OUTSOURCE_ENTIRETY_OPENER,
    null,
    { allowMidSentence: true, requireCompleteProviderSpan: true },
  );
  if (outsourceEntirety) return outsourceEntirety;

  const appositive = tryBackendProviderAppositiveHit(body, absoluteStart);
  if (appositive) return appositive;

  const engagedDeliver = tryAffirmativeHit(
    body,
    absoluteStart,
    ENGAGED_TO_DELIVER_OPENER,
    ENGAGED_TO_DELIVER_ROLE,
    { allowMidSentence: true },
  );
  if (engagedDeliver) return engagedDeliver;

  const selectedBackend = trySelectedBackendProviderHits(body, absoluteStart);
  if (selectedBackend) return selectedBackend;

  const retainedBackend = tryAffirmativeHit(
    body,
    absoluteStart,
    RETAINED_AS_BACKEND_OPENER,
    RETAINED_AS_BACKEND_ROLE,
    { allowMidSentence: true },
  );
  if (retainedBackend) return retainedBackend;

  const outsourcedPerformed = tryAffirmativeHit(
    body,
    absoluteStart,
    OUTSOURCED_AND_PERFORMED_BY,
    null,
    { requireCompleteProviderSpan: true },
  );
  if (outsourcedPerformed) return outsourcedPerformed;

  const planningPartner = tryAffirmativeHit(
    body,
    absoluteStart,
    PLANNING_OUTSOURCE_PARTNER_OPENER,
    null,
    { allowMidSentence: true, requireCompleteProviderSpan: true },
  );
  if (planningPartner) return planningPartner;

  return null;
}

function collectExplicitHits(text: string): ExplicitHit[] {
  const hits: ExplicitHit[] = [];
  // Prevent guidebook `N.N.N.` terminal periods from splitting the verified
  // Registry Operations Team heading away from the outsourced-operations clause.
  const segmentedText = collapseRegistryOperationsTeamHeadingPeriod(text);

  for (const sentence of splitSentences(segmentedText)) {
    const hit = matchAffirmativeSentence(sentence.text, sentence.absoluteStart);
    if (hit) hits.push(hit);
  }

  const seen = new Set<string>();
  const unique: ExplicitHit[] = [];
  for (const hit of hits.sort(
    (a, b) =>
      a.matchIndex - b.matchIndex || a.providerNameAsStated.localeCompare(b.providerNameAsStated),
  )) {
    const key = `${hit.providerNameAsStated.toLowerCase()}|${(hit.roleAsStated ?? "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(hit);
  }
  return unique;
}

function hasExplicitSelfOperated(text: string): boolean {
  return SELF_OPERATED_PATTERNS.some((pattern) => pattern.test(text));
}

function hasAmbiguousVendorMention(text: string): boolean {
  if (collectExplicitHits(text).length > 0) return false;
  AMBIGUOUS_VENDOR_NEAR_TECH.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = AMBIGUOUS_VENDOR_NEAR_TECH.exec(text)) !== null) {
    const name = normalizeProviderName(match[1] ?? match[2] ?? "");
    if (!name || AMBIGUOUS_NAME_STOPWORDS.test(name)) continue;
    return true;
  }
  return false;
}

function buildCandidate(
  applicationId: string,
  fieldPath: HistoricalRspEvidenceSourceFieldPath,
  hit: ExplicitHit,
  sectionText: string,
): HistoricalRspEvidenceCandidate {
  return {
    schemaVersion: HISTORICAL_RSP_EVIDENCE_CANDIDATE_SCHEMA_VERSION,
    applicationId,
    providerNameAsStated: hit.providerNameAsStated,
    sourceFieldPath: fieldPath,
    evidenceClassification: "PUBLIC_ICANN",
    applicationVersionBasis: PUBLIC_PORTION_VERSION_BASIS,
    reviewState: "REQUIRES_STEWARD_REVIEW",
    evidenceLocator: `${fieldPath}@${hit.matchIndex}:${hit.matchLength}`,
    evidenceExcerpt: boundExcerpt(sectionText, hit.matchIndex, hit.matchLength),
    roleAsStated: hit.roleAsStated,
  };
}

export interface ExtractHistoricalRspEvidenceOptions extends PublicPortionValidationOptions {
  /** Optional Application ID when the HTML omits a labeled id but the caller knows it. */
  applicationId?: string;
}

/**
 * Offline deterministic extraction of historical RSP evidence candidates from
 * already-acquired public-portion HTML (Q23–Q25).
 *
 * Emits candidates only for bounded affirmative assignment constructions.
 * Does not perform HTTP, identity canonicalization, steward approval, or
 * relationship confirmation.
 */
export function extractHistoricalRspEvidenceFromPublicPortionHtml(
  html: string,
  options: ExtractHistoricalRspEvidenceOptions = {},
): HistoricalRspEvidenceExtractionResult {
  const validation = validatePublicPortionDocument(html, {
    expectedApplicationId: options.expectedApplicationId,
  });

  if (!validation.ok) {
    if (validation.reason === "incomplete-portion-q23") {
      return emptyHistoricalRspEvidenceExtractionResult(
        "UNSUPPORTED_OR_MISSING_Q23_BASIS",
        options.applicationId ?? options.expectedApplicationId ?? null,
        ["public-portion validation failed: incomplete-portion-q23"],
      );
    }
    return emptyHistoricalRspEvidenceExtractionResult(
      "MALFORMED_OR_UNUSABLE_SECTION",
      options.applicationId ?? options.expectedApplicationId ?? null,
      [`public-portion validation failed: ${validation.reason}`],
    );
  }

  const applicationId =
    validation.applicationId ?? options.applicationId ?? options.expectedApplicationId ?? null;
  if (!applicationId) {
    return emptyHistoricalRspEvidenceExtractionResult(
      "MALFORMED_OR_UNUSABLE_SECTION",
      null,
      ["applicationId required for candidate provenance but was not labeled in the document"],
    );
  }

  let sections: SectionSlice[];
  try {
    sections = extractQuestionSections(html);
  } catch (error) {
    return emptyHistoricalRspEvidenceExtractionResult(
      "MALFORMED_OR_UNUSABLE_SECTION",
      applicationId,
      [
        `section extraction failed closed: ${
          error instanceof Error ? error.message : "unknown-error"
        }`,
      ],
    );
  }

  const q23 = sections.find((section) => section.fieldPath === "Q23");
  if (!q23 || !q23.text) {
    return emptyHistoricalRspEvidenceExtractionResult(
      "MALFORMED_OR_UNUSABLE_SECTION",
      applicationId,
      ["Q23 section could not be bounded for text extraction"],
    );
  }

  const candidates: HistoricalRspEvidenceCandidate[] = [];
  const notes: string[] = [];
  let selfOperated = false;
  let ambiguous = false;

  for (const section of sections) {
    const text = stripLeadingQuestionHeading(section.text);
    const hits = collectExplicitHits(text);
    for (const hit of hits) {
      candidates.push(buildCandidate(applicationId, section.fieldPath, hit, text));
    }
    if (hasExplicitSelfOperated(text)) {
      selfOperated = true;
      notes.push(`${section.fieldPath}: explicit self-operated / no-external-provider language`);
    }
    if (hits.length === 0 && hasAmbiguousVendorMention(text)) {
      ambiguous = true;
      notes.push(
        `${section.fieldPath}: vendor-like mention near technical terms without assignment language`,
      );
    }
  }

  candidates.sort(
    (a, b) =>
      a.sourceFieldPath.localeCompare(b.sourceFieldPath) ||
      a.providerNameAsStated.localeCompare(b.providerNameAsStated) ||
      a.evidenceLocator.localeCompare(b.evidenceLocator),
  );

  if (candidates.length > 0) {
    const conflictNotes = selfOperated
      ? [
          "CONFLICT: explicit third-party assignment and explicit self-operated / no-external-provider language both present; steward review required — not confirmed",
        ]
      : [];
    return {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_EXTRACTION_SCHEMA_VERSION,
      disposition: "EXPLICIT_PROVIDER_CANDIDATE",
      applicationId,
      applicationVersionBasis: PUBLIC_PORTION_VERSION_BASIS,
      candidates,
      notes: [
        ...notes,
        ...conflictNotes,
        "candidates require steward review; rspKey / confirmed relationship not assigned",
      ],
    };
  }

  if (selfOperated) {
    return {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_EXTRACTION_SCHEMA_VERSION,
      disposition: "EXPLICIT_SELF_OPERATED",
      applicationId,
      applicationVersionBasis: PUBLIC_PORTION_VERSION_BASIS,
      candidates: [],
      notes,
    };
  }

  if (ambiguous) {
    return {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_EXTRACTION_SCHEMA_VERSION,
      disposition: "AMBIGUOUS_PROVIDER_RELATIONSHIP",
      applicationId,
      applicationVersionBasis: PUBLIC_PORTION_VERSION_BASIS,
      candidates: [],
      notes,
    };
  }

  return {
    schemaVersion: HISTORICAL_RSP_EVIDENCE_EXTRACTION_SCHEMA_VERSION,
    disposition: "NO_QUALIFYING_PROVIDER_ASSERTION",
    applicationId,
    applicationVersionBasis: PUBLIC_PORTION_VERSION_BASIS,
    candidates: [],
    notes: [...notes, "no explicit registry-services provider assignment found in Q23–Q25"],
  };
}
