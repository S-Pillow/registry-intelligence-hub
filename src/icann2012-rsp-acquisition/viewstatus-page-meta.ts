import type { ViewstatusPageDiagnostics } from "./types";

const DISPLAY_RANGE_PATTERN =
  /Displaying\s+(\d+)\s*-\s*(\d+)\s+of\s+(\d+)/i;

/** Tapestry pager / next links — follow server hrefs only (may include _csrf query). */
const NEXT_PAGE_HREF_PATTERN =
  /<a\b[^>]*\bhref="([^"]*(?:viewstatus\.statusgrid\.pager|viewstatus\/)[^"]*)"[^>]*>/gi;

export function parseViewstatusDisplayRange(html: string): {
  displayStart: number | null;
  displayEnd: number | null;
  displayTotal: number | null;
} {
  const match = DISPLAY_RANGE_PATTERN.exec(html);
  if (!match) {
    return { displayStart: null, displayEnd: null, displayTotal: null };
  }
  return {
    displayStart: Number(match[1]),
    displayEnd: Number(match[2]),
    displayTotal: Number(match[3]),
  };
}

export function extractViewstatusNextPageHref(html: string): string | null {
  NEXT_PAGE_HREF_PATTERN.lastIndex = 0;
  let candidate: string | null = null;
  let match: RegExpExecArray | null;
  while ((match = NEXT_PAGE_HREF_PATTERN.exec(html)) !== null) {
    const href = match[1]?.trim();
    if (!href || href === "#") continue;
    if (/pager\/(\d+)/i.test(href) || /viewstatus\/?$/i.test(href)) {
      candidate = href;
    }
  }
  return candidate;
}

export function buildViewstatusPageDiagnostics(
  html: string,
  parsedRowCount: number,
  quarantinedBlockCount: number,
): ViewstatusPageDiagnostics {
  const range = parseViewstatusDisplayRange(html);
  return {
    ...range,
    parsedRowCount,
    quarantinedBlockCount,
    nextPageHref: extractViewstatusNextPageHref(html),
  };
}

export class PaginationSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaginationSafetyError";
  }
}

export interface PaginationSafetyState {
  visitedUrls: Set<string>;
  visitedContentHashes: Set<string>;
  lastDisplayEnd: number | null;
}

export function createPaginationSafetyState(): PaginationSafetyState {
  return {
    visitedUrls: new Set(),
    visitedContentHashes: new Set(),
    lastDisplayEnd: null,
  };
}

export function assertPaginationAdvance(
  state: PaginationSafetyState,
  resolvedUrl: string,
  contentSha256: string,
  diagnostics: ViewstatusPageDiagnostics,
  pageOrdinal: number,
  pageCap: number,
): void {
  if (pageOrdinal > pageCap) {
    throw new PaginationSafetyError(`Pagination safety cap exceeded (${pageCap} pages)`);
  }
  if (state.visitedUrls.has(resolvedUrl)) {
    throw new PaginationSafetyError(`Pagination loop: repeated URL ${resolvedUrl}`);
  }
  if (state.visitedContentHashes.has(contentSha256)) {
    throw new PaginationSafetyError(`Pagination loop: repeated page body hash on page ${pageOrdinal}`);
  }
  state.visitedUrls.add(resolvedUrl);
  state.visitedContentHashes.add(contentSha256);

  const { displayStart, displayEnd } = diagnostics;
  if (displayStart != null && displayEnd != null) {
    if (state.lastDisplayEnd != null) {
      if (displayStart <= state.lastDisplayEnd) {
        throw new PaginationSafetyError(
          `Non-advancing display range: ${displayStart}-${displayEnd} after end ${state.lastDisplayEnd}`,
        );
      }
      if (displayStart !== state.lastDisplayEnd + 1) {
        throw new PaginationSafetyError(
          `Display range gap: expected start ${state.lastDisplayEnd + 1}, got ${displayStart}`,
        );
      }
    }
    state.lastDisplayEnd = displayEnd;
  }
}
