import type { QuarantineReason } from "./types";
import { classifyViewstatusPageHtml } from "./viewstatus-page-classification";

/**
 * Official public-portion documents are the current published portion.
 * An ICANN download alone does not establish the original submission.
 */
export const PUBLIC_PORTION_VERSION_BASIS = "current_public_portion" as const;

export type PublicPortionVersionBasis = typeof PUBLIC_PORTION_VERSION_BASIS;

const Q23_DOM_ID = /id\s*=\s*["']q23(?:_agb)?["']/i;
const Q23_HEADING =
  /(?:Question\s+23\b|\b23\s*[\.\)])\s*[:\-]?\s*Registry\s+Services\b/i;
const Q23_DEFINED = /Registry\s+services\s+are\s+defined\s+as\s+the\s+following/i;
const LABELED_APPLICATION_ID =
  /Application\s*ID(?:\s*<\/[^>]+>|\s)*[:#]?\s*(?:<\/[^>]+>\s*)*(1-\d+-\d+)/gi;
const DOWNLOAD_PHRASE = "download public portion of application";

export interface PublicPortionValidationOptions {
  expectedApplicationId?: string;
}

export type PublicPortionValidationResult =
  | { ok: true; applicationVersionBasis: PublicPortionVersionBasis; applicationId: string | null }
  | { ok: false; reason: QuarantineReason; applicationVersionBasis: PublicPortionVersionBasis };

export function portionDocumentHasQ23Section(html: string): boolean {
  return Q23_DOM_ID.test(html) || Q23_HEADING.test(html) || Q23_DEFINED.test(html);
}

export function extractLabeledApplicationIds(html: string): string[] {
  const ids: string[] = [];
  LABELED_APPLICATION_ID.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LABELED_APPLICATION_ID.exec(html)) !== null) {
    const id = match[1];
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function hasOfficialDownloadPhrase(html: string): boolean {
  return html.toLowerCase().includes(DOWNLOAD_PHRASE);
}

/**
 * Recognize a public-portion Question 23 section.
 * Accepts the historical `id="q23"` anchor and the question-text form ICANN
 * now emits. Status-grid hubs, ICANN error pages, and application-details
 * pages (download link, no Q23 section) fail closed.
 */
export function validatePublicPortionDocument(
  html: string,
  options: PublicPortionValidationOptions = {},
): PublicPortionValidationResult {
  const applicationVersionBasis = PUBLIC_PORTION_VERSION_BASIS;
  const pageKind = classifyViewstatusPageHtml(html);
  if (pageKind === "STATUS_GRID" || pageKind === "ICANN_ERROR_PAGE") {
    return { ok: false, reason: "incomplete-portion-q23", applicationVersionBasis };
  }
  if (hasOfficialDownloadPhrase(html) && !portionDocumentHasQ23Section(html)) {
    return { ok: false, reason: "incomplete-portion-q23", applicationVersionBasis };
  }
  if (!portionDocumentHasQ23Section(html)) {
    return { ok: false, reason: "incomplete-portion-q23", applicationVersionBasis };
  }

  const labeledIds = extractLabeledApplicationIds(html);
  if (options.expectedApplicationId) {
    if (labeledIds.length !== 1 || labeledIds[0] !== options.expectedApplicationId) {
      return { ok: false, reason: "application-id-mismatch", applicationVersionBasis };
    }
  } else if (labeledIds.length > 1) {
    return { ok: false, reason: "application-id-mismatch", applicationVersionBasis };
  }

  return {
    ok: true,
    applicationVersionBasis,
    applicationId: labeledIds[0] ?? null,
  };
}

export function resolveApplicationVersionBasis(explicit?: string | null): PublicPortionVersionBasis {
  if (explicit == null || explicit === "" || explicit === PUBLIC_PORTION_VERSION_BASIS) {
    return PUBLIC_PORTION_VERSION_BASIS;
  }
  if (explicit === "original_submission") {
    throw new Error(
      "original_submission is not established by an official ICANN public portion alone",
    );
  }
  throw new Error(`unsupported applicationVersionBasis: ${explicit}`);
}
