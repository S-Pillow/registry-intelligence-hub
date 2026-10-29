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
  const patterns =
    question === 23
      ? [
          /id\s*=\s*["']q23(?:_agb)?["']/i,
          /(?:Question\s+23\b|\b23\s*[\.\)])\s*[:\-]?\s*Registry\s+Services\b/i,
          /Registry\s+services\s+are\s+defined\s+as\s+the\s+following/i,
        ]
      : question === 24
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
    // id="q23" matches inside the opening tag — start after `>` so attribute
    // debris cannot precede the question heading in plain text.
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
  // Require at least one letter; reject pure verbs/fragments.
  if (!/[A-Za-z]/.test(name)) return false;
  return true;
}

/**
 * Directly governing negation immediately before an assignment-verb match index
 * (e.g. "has not selected", "did not engage", "has never partnered").
 */
const GOVERNING_NEGATION_PREFIX =
  /(?:\b(?:do|does|did|has|have|had|is|are|was|were|will|shall)\s+)?(?:not|never)(?:\s+currently)?\s+$/i;

/**
 * Non-assertive / speculative framing immediately before an assignment verb.
 * Intention, plan, modality, and counterfactual "were to" must not become candidates.
 */
const NON_ASSERTIVE_ASSIGNMENT_PREFIX =
  /(?:\b(?:do|does|did|has|have|had)\s+not\s+(?:intend|plan|want|wish|propose|expect)(?:s|ed)?\s+to\s+|\b(?:intends?|plans?|wants?|wishes?|proposes?|expects?)\s+to\s+|\b(?:may|might|could|would|should|can)\s+|\b(?:were|was)\s+to\s+)$/i;

/**
 * Negation inside a provided/performed/operated-by span
 * (e.g. "will not be provided by", "are never provided by").
 */
const NEGATED_PASSIVE_ASSIGNMENT =
  /\b(?:will|shall|are|is|was|were)\s+(?:not|never)\s+(?:be\s+)?(?:provided|performed|operated)\b|\b(?:not|never)\s+(?:be\s+)?(?:provided|performed|operated)\s+by\b/i;

const LEGAL_SUFFIX_AT = /^(Inc|LLC|L\.L\.C|Ltd|Corp|Co|PLC)\.?/i;
const PROVIDER_FIRST_WORD = /^[A-Z][A-Za-z0-9&'\-]*/;
/** Continuation word: Title Case only — periods are never part of ordinary tokens. */
const PROVIDER_NEXT_WORD = /^\s+(?:&\s+)?([A-Z][A-Za-z0-9&'\-]*)/;

function isDirectlyNegatedAssignment(
  text: string,
  matchIndex: number,
  matchedText: string,
): boolean {
  const prefix = text.slice(Math.max(0, matchIndex - 120), matchIndex);
  if (GOVERNING_NEGATION_PREFIX.test(prefix)) return true;
  if (NON_ASSERTIVE_ASSIGNMENT_PREFIX.test(prefix)) return true;
  if (NEGATED_PASSIVE_ASSIGNMENT.test(matchedText)) return true;
  // Passive forms where "not/never" sits between services and provided (outside matchedText start).
  const windowStart = Math.max(0, matchIndex - 40);
  const local = text.slice(windowStart, matchIndex + matchedText.length);
  if (
    /\bregistry\s+services?\b[\s\S]{0,40}?\b(?:not|never)\b[\s\S]{0,20}?\b(?:provided|performed|operated)\s+by\b/i.test(
      local,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Take a provider name starting at `start`, preserving commas before legal suffixes
 * and Inc. abbreviation periods. Stops at real sentence boundaries — ordinary word
 * tokens do not absorb `.` so following prose is never consumed.
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
        // Legal suffix completes the name; do not continue into following prose.
        break;
      }
      break;
    }

    // Sentence / clause terminator (not part of a legal-suffix abbreviation).
    const ch = text[i];
    if (ch === "." || ch === ";" || ch === "!" || ch === "?") break;

    const next = text.slice(i).match(PROVIDER_NEXT_WORD);
    if (next) {
      i += next[0].length;
      end = i;
      // "Inc." abbreviation period belongs to the name when not introduced by a comma.
      if (/^Inc$/i.test(next[1]!) && text[i] === ".") {
        i += 1;
        end = i;
        break;
      }
      continue;
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
    // Numbered heading only — do not strip body sentences that begin "Registry services will…".
    .replace(/^(?:Question\s+)?2[3-5]\s*[.)]\s*(?:Registry\s+Services\b\s*)?/i, "")
    .replace(/^Question\s+2[3-5]\s*[:.\-]?\s*/i, "")
    .trimStart();
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

/**
 * Explicit third-party registry-services assignment patterns.
 * Requires a named provider connected to registry-service / backend RSP wording.
 * Provider names after the verb are taken with takeProviderNameAsStated (bounded).
 * Provider-will-provide is handled separately as a sentence-local pattern.
 */
const ASSIGNMENT_VERB_PREFIX =
  /\b(?:selected|select|engaged|engage|contracted|contract|appointed|appoint|retained|retain)\s+/gi;

const PARTNERED_WITH_PREFIX = /\b(?:partnered|partner)\s+with\s+/gi;

const ASSIGNMENT_ROLE_TAIL =
  /\s+to\s+(?:provide|perform|operate)\s+((?:the\s+)?(?:backend\s+)?(?:registry\s+services?|registry\s+service\s+provider(?:\s+services?)?))\b/i;

const PARTNERED_ROLE_TAIL =
  /\s+to\s+(?:provide|perform|operate)\s+((?:the\s+)?(?:backend\s+)?registry\s+services?)\b/i;

/**
 * Sentence-local: provider name immediately after a sentence boundary (or start),
 * then "will provide/perform/operate … for the Applicant".
 */
const WILL_PROVIDE_FOR_APPLICANT =
  /(?:^|[.!?]\s+)((?:[A-Z][A-Za-z0-9&'\-]*)(?:\s+(?:&\s+)?[A-Z][A-Za-z0-9&'\-]*){0,5}(?:,\s*(?:Inc|LLC|L\.L\.C|Ltd|Corp|Co|PLC)\.?)?)\s+will\s+(?:provide|perform|operate)\s+((?:the\s+)?(?:backend\s+)?registry\s+services?)\s+for\s+(?:the\s+)?Applicant\b/g;

/** Prefix-only: name span collected with takeProviderNameAsStated (preserves Inc./LLC commas). */
const PROVIDED_BY_PREFIX =
  /\b((?:backend\s+)?registry\s+services?)\s+(?:will\s+be\s+|are\s+)?(?:provided|performed|operated)\s+by\s+/gi;

const RSP_LABEL_PREFIXES: RegExp[] = [
  /\bRegistry\s+Service\s+Provider\s*(?:is|:)\s*/gi,
  /\b(?:as|with)\s+(?:our|the)\s+Registry\s+Service\s+Provider[,\s]+/gi,
];

const SELF_OPERATED_PATTERNS: RegExp[] = [
  /\bApplicant\s+will\s+(?:provide|perform|operate)\s+(?:all\s+)?(?:the\s+)?(?:relevant\s+)?(?:registry\s+)?services?\s+itself\b/i,
  /\bApplicant\s+itself\s+will\s+(?:provide|perform|operate)\s+(?:the\s+)?(?:registry\s+)?services?\b/i,
  /\bself[-\s]?operated\b/i,
  /\bno\s+external\s+(?:registry\s+)?(?:service\s+)?provider\b/i,
  /\bwill\s+not\s+(?:engage|select|contract)\s+(?:an?\s+)?external\s+(?:registry\s+)?(?:service\s+)?provider\b/i,
];

/**
 * Vendor-like token immediately adjacent to technical material (not a loose
 * window). Adjacent-only avoids matching sentence-leading words like "Technical".
 */
const AMBIGUOUS_VENDOR_NEAR_TECH =
  /\b([A-Z][A-Za-z0-9&.'-]{2,40})\s+(?:DNSSEC|DNS|EPP|Whois|WHOIS|SRS)\b|\b(?:DNSSEC|DNS|EPP|Whois|WHOIS|SRS)\s+(?:materials?|documentation|software|products?)?\s*(?:from|by|of)\s+([A-Z][A-Za-z0-9&.'-]{2,40})\b/g;

const AMBIGUOUS_NAME_STOPWORDS =
  /^(?:The|This|These|Applicant|Registry|Services|Service|Provider|Question|Technical|General|Industry|No|DNS|DNSSEC|EPP|Whois|WHOIS|SRS)$/i;

function pushHit(
  hits: ExplicitHit[],
  text: string,
  matchIndex: number,
  matchLength: number,
  matchedText: string,
  rawName: string,
  role?: string,
): void {
  if (isDirectlyNegatedAssignment(text, matchIndex, matchedText)) return;
  const providerNameAsStated = normalizeProviderName(rawName);
  if (!isPlausibleProviderName(providerNameAsStated)) return;
  hits.push({
    providerNameAsStated,
    roleAsStated: role ? normalizeProviderName(role) : undefined,
    matchIndex,
    matchLength,
    matchedText,
  });
}

function collectVerbAssignmentHits(
  text: string,
  hits: ExplicitHit[],
  verbPrefix: RegExp,
  roleTail: RegExp,
): void {
  verbPrefix.lastIndex = 0;
  let prefixMatch: RegExpExecArray | null;
  while ((prefixMatch = verbPrefix.exec(text)) !== null) {
    const nameStart = prefixMatch.index + prefixMatch[0].length;
    const taken = takeProviderNameAsStated(text, nameStart);
    if (!taken) continue;
    const afterName = text.slice(nameStart + taken.length);
    const roleMatch = afterName.match(roleTail);
    if (!roleMatch || roleMatch.index !== 0) continue;
    const matchEnd = nameStart + taken.length + roleMatch[0].length;
    const matchedText = text.slice(prefixMatch.index, matchEnd);
    // Verb index for negation/modality: start of the assignment verb token.
    const verbToken = prefixMatch[0].match(
      /\b(?:selected|select|engaged|engage|contracted|contract|appointed|appoint|retained|retain|partnered|partner)\b/i,
    );
    const verbOffset = verbToken ? prefixMatch[0].toLowerCase().lastIndexOf(verbToken[0].toLowerCase()) : 0;
    const verbIndex = prefixMatch.index + Math.max(0, verbOffset);
    pushHit(
      hits,
      text,
      verbIndex,
      matchEnd - verbIndex,
      matchedText,
      taken.raw,
      roleMatch[1],
    );
  }
}

function collectExplicitHits(rawText: string): ExplicitHit[] {
  const text = stripLeadingQuestionHeading(rawText);
  const hits: ExplicitHit[] = [];

  collectVerbAssignmentHits(text, hits, ASSIGNMENT_VERB_PREFIX, ASSIGNMENT_ROLE_TAIL);
  collectVerbAssignmentHits(text, hits, PARTNERED_WITH_PREFIX, PARTNERED_ROLE_TAIL);

  WILL_PROVIDE_FOR_APPLICANT.lastIndex = 0;
  let willMatch: RegExpExecArray | null;
  while ((willMatch = WILL_PROVIDE_FOR_APPLICANT.exec(text)) !== null) {
    const full = willMatch[0];
    // Group 1 is the provider; match may include a leading ". " sentence boundary.
    const providerRaw = willMatch[1] ?? "";
    const providerOffsetInFull = full.lastIndexOf(providerRaw);
    const matchIndex =
      willMatch.index + (providerOffsetInFull >= 0 ? providerOffsetInFull : 0);
    pushHit(
      hits,
      text,
      matchIndex,
      full.length - (providerOffsetInFull >= 0 ? providerOffsetInFull : 0),
      full.slice(providerOffsetInFull >= 0 ? providerOffsetInFull : 0),
      providerRaw,
      willMatch[2],
    );
  }

  PROVIDED_BY_PREFIX.lastIndex = 0;
  let providedPrefix: RegExpExecArray | null;
  while ((providedPrefix = PROVIDED_BY_PREFIX.exec(text)) !== null) {
    const nameStart = providedPrefix.index + providedPrefix[0].length;
    const taken = takeProviderNameAsStated(text, nameStart);
    if (!taken) continue;
    const matchedText = text.slice(providedPrefix.index, nameStart + taken.length);
    const role = providedPrefix[1];
    pushHit(
      hits,
      text,
      providedPrefix.index,
      matchedText.length,
      matchedText,
      taken.raw,
      role,
    );
  }

  for (const prefixPattern of RSP_LABEL_PREFIXES) {
    prefixPattern.lastIndex = 0;
    let labelPrefix: RegExpExecArray | null;
    while ((labelPrefix = prefixPattern.exec(text)) !== null) {
      const nameStart = labelPrefix.index + labelPrefix[0].length;
      const taken = takeProviderNameAsStated(text, nameStart);
      if (!taken) continue;
      const matchedText = text.slice(labelPrefix.index, nameStart + taken.length);
      pushHit(hits, text, labelPrefix.index, matchedText.length, matchedText, taken.raw);
    }
  }

  // Stable unique by provider+role
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
  // Explicit assignment already covers the positive path; do not reclassify those.
  if (collectExplicitHits(text).length > 0) return false;
  AMBIGUOUS_VENDOR_NEAR_TECH.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = AMBIGUOUS_VENDOR_NEAR_TECH.exec(text)) !== null) {
    const name = normalizeProviderName(match[1] ?? match[2] ?? "");
    if (!name || AMBIGUOUS_NAME_STOPWORDS.test(name)) continue;
    // Negated "no … selected" elsewhere must not suppress adjacency ambiguity.
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
    // Strip Q-heading labels before parse/excerpt so locators stay sentence-local.
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
      notes.push(`${section.fieldPath}: vendor-like mention near technical terms without assignment language`);
    }
  }

  candidates.sort(
    (a, b) =>
      a.sourceFieldPath.localeCompare(b.sourceFieldPath) ||
      a.providerNameAsStated.localeCompare(b.providerNameAsStated) ||
      a.evidenceLocator.localeCompare(b.evidenceLocator),
  );

  if (candidates.length > 0) {
    const conflictNotes =
      selfOperated
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
