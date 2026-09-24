import { resolveGtldresultTapestryUrl } from "./gtldresult-url-resolver";
import { NetworkTargetPolicyError } from "./network-target-policy";
import { extractLabeledApplicationIds } from "./public-portion-validation";

const ANCHOR_RE = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
const HREF_RE = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;
const DOWNLOAD_PHRASE = "download public portion of application";

export type DetailsDownloadFailureCode =
  | "WRONG_APPLICATION_ID"
  | "MISSING_APPLICATION_ID"
  | "MISSING_DOWNLOAD_LINK"
  | "AMBIGUOUS_DOWNLOAD_LINK"
  | "CROSS_HOST_LINK"
  | "NON_HTTPS_LINK";

export class ApplicationDetailsDownloadError extends Error {
  readonly code: DetailsDownloadFailureCode;

  constructor(code: DetailsDownloadFailureCode, message: string) {
    super(message);
    this.name = "ApplicationDetailsDownloadError";
    this.code = code;
  }
}

export interface ParsedApplicationDetailsDownload {
  applicationId: string;
  /** Href attribute text from the official anchor, after entity decoding. */
  serverProvidedHref: string;
  /** Same-origin HTTPS URL. Not a manufactured fallback. */
  resolvedPortionUrl: string;
}

function decodeHref(href: string): string {
  return href
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

function anchorText(inner: string): string {
  return inner
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function readHref(attrs: string): string | null {
  const match = HREF_RE.exec(attrs);
  if (!match) return null;
  const raw = match[1] ?? match[2] ?? match[3] ?? "";
  const href = decodeHref(raw);
  return href.length > 0 ? href : null;
}

/**
 * Bounded details-page parser.
 * Requires the labeled Application ID, then the official
 * "download public portion of application" anchor.
 * Preserves that href and resolves it same-origin. Fails closed when the
 * link is missing, ambiguous, cross-host, or not HTTPS.
 * Does not invent a download URL.
 */
export function parseApplicationDetailsDownload(
  html: string,
  input: { expectedApplicationId: string; detailsPageUrl: string },
): ParsedApplicationDetailsDownload {
  const labeledIds = extractLabeledApplicationIds(html);
  if (labeledIds.length === 0) {
    throw new ApplicationDetailsDownloadError(
      "MISSING_APPLICATION_ID",
      "details page has no labeled Application ID",
    );
  }
  if (labeledIds.length !== 1 || labeledIds[0] !== input.expectedApplicationId) {
    throw new ApplicationDetailsDownloadError(
      "WRONG_APPLICATION_ID",
      `details page Application ID ${labeledIds.join(",")} != ${input.expectedApplicationId}`,
    );
  }

  const hrefs: string[] = [];
  ANCHOR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ANCHOR_RE.exec(html)) !== null) {
    const text = anchorText(match[2] ?? "");
    if (!text.includes(DOWNLOAD_PHRASE)) continue;
    const href = readHref(match[1] ?? "");
    if (!href) {
      throw new ApplicationDetailsDownloadError(
        "MISSING_DOWNLOAD_LINK",
        "official download anchor has no href",
      );
    }
    hrefs.push(href);
  }

  if (hrefs.length === 0) {
    throw new ApplicationDetailsDownloadError(
      "MISSING_DOWNLOAD_LINK",
      "details page has no official public-portion download anchor",
    );
  }

  const resolved = new Map<string, string>();
  for (const href of hrefs) {
    let absolute: string;
    try {
      absolute = resolveGtldresultTapestryUrl(input.detailsPageUrl, href);
    } catch (err) {
      if (err instanceof NetworkTargetPolicyError) {
        const lower = href.trim().toLowerCase();
        const code: DetailsDownloadFailureCode =
          lower.startsWith("http://") ? "NON_HTTPS_LINK" : "CROSS_HOST_LINK";
        throw new ApplicationDetailsDownloadError(code, err.message);
      }
      throw err;
    }
    resolved.set(absolute, href);
  }

  if (resolved.size !== 1) {
    throw new ApplicationDetailsDownloadError(
      "AMBIGUOUS_DOWNLOAD_LINK",
      `details page has ${resolved.size} distinct public-portion download hrefs`,
    );
  }

  const [resolvedPortionUrl, serverProvidedHref] = [...resolved.entries()][0];
  return {
    applicationId: labeledIds[0],
    serverProvidedHref,
    resolvedPortionUrl,
  };
}
