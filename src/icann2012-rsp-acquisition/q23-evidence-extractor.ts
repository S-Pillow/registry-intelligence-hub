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
    if (match && (best < 0 || match.index < best)) best = match.index;
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
  return decodeBasicHtmlEntities(raw)
    .replace(/\s+/g, " ")
    // Preserve abbreviation periods (Inc. / Ltd.); strip only loose punctuation.
    .replace(/^[\s,;:"']+|[\s,;:"']+$/g, "")
    .trim();
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
 */
const EXPLICIT_PROVIDER_PATTERNS: RegExp[] = [
  /\b(?:selected|engaged|contracted|appointed|retained)\s+(.+?)\s+to\s+(?:provide|perform|operate)\s+((?:the\s+)?(?:backend\s+)?(?:registry\s+services?|registry\s+service\s+provider(?:\s+services?)?))\b/gi,
  /\bpartnered\s+with\s+(.+?)\s+to\s+(?:provide|perform|operate)\s+((?:the\s+)?(?:backend\s+)?registry\s+services?)\b/gi,
  /\b(.+?)\s+will\s+(?:provide|perform|operate)\s+((?:the\s+)?(?:backend\s+)?registry\s+services?)\s+for\s+(?:the\s+)?Applicant\b/gi,
  /\b(?:backend\s+)?registry\s+services?\s+(?:will\s+be\s+|are\s+)?(?:provided|performed|operated)\s+by\s+(.+?)(?:\.|,|;|$)/gi,
  /\bRegistry\s+Service\s+Provider\s*(?:is|:)\s*([A-Z][^.!?\n]{1,80}?)(?:\.|,|;|$)/g,
  /\b(?:as|with)\s+(?:our|the)\s+Registry\s+Service\s+Provider[,\s]+([A-Z][^.!?\n]{1,80}?)(?:\.|,|;|$)/g,
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

function collectExplicitHits(text: string): ExplicitHit[] {
  const hits: ExplicitHit[] = [];
  for (const pattern of EXPLICIT_PROVIDER_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const rawName = match[1] ?? "";
      const role = match[2];
      const providerNameAsStated = normalizeProviderName(rawName);
      if (!isPlausibleProviderName(providerNameAsStated)) continue;
      hits.push({
        providerNameAsStated,
        roleAsStated: role ? normalizeProviderName(role) : undefined,
        matchIndex: match.index,
        matchLength: match[0].length,
        matchedText: match[0],
      });
    }
  }
  // Stable unique by provider+role
  const seen = new Set<string>();
  const unique: ExplicitHit[] = [];
  for (const hit of hits.sort((a, b) => a.matchIndex - b.matchIndex || a.providerNameAsStated.localeCompare(b.providerNameAsStated))) {
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
    const hits = collectExplicitHits(section.text);
    for (const hit of hits) {
      candidates.push(buildCandidate(applicationId, section.fieldPath, hit, section.text));
    }
    if (hasExplicitSelfOperated(section.text)) {
      selfOperated = true;
      notes.push(`${section.fieldPath}: explicit self-operated / no-external-provider language`);
    }
    if (hits.length === 0 && hasAmbiguousVendorMention(section.text)) {
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
    return {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_EXTRACTION_SCHEMA_VERSION,
      disposition: "EXPLICIT_PROVIDER_CANDIDATE",
      applicationId,
      applicationVersionBasis: PUBLIC_PORTION_VERSION_BASIS,
      candidates,
      notes: [
        ...notes,
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
