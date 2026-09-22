import type { ViewstatusPageDiagnostics } from "./types";

const DISPLAY_RANGE_PATTERN =
  /Displaying\s+(\d+)\s*-\s*(\d+)\s+of\s+(\d+)/i;

const PAGER_HREF_PATTERN =
  /href="([^"]*viewstatus\.statusgrid\.pager\/(\d+)[^"]*)"/gi;

const ACTIVE_PAGER_PATTERN =
  /<[^>]+class="[^"]*\b(?:active|current|selected)\b[^"]*"[^>]*href="([^"]*viewstatus\.statusgrid\.pager\/(\d+)[^"]*)"[^>]*>/gi;

const PAGER_CONTROL_REGION_PATTERN =
  /<(nav|div|ul)\b[^>]*class="[^"]*\b(?:pager|pagination)[^"]*"[\s\S]*?<\/\1>/gi;

export interface ViewstatusPaginationExtraction {
  nextPageHref: string | null;
  paginationControlDrift: boolean;
}

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

function extractActivePagerPage(html: string): number | null {
  ACTIVE_PAGER_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  let active: number | null = null;
  while ((match = ACTIVE_PAGER_PATTERN.exec(html)) !== null) {
    active = Number(match[2]);
  }
  return active;
}

function hrefForPagerPage(html: string, pageNumber: number): string | null {
  PAGER_HREF_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PAGER_HREF_PATTERN.exec(html)) !== null) {
    if (Number(match[2]) === pageNumber) {
      return match[1]?.trim() ?? null;
    }
  }
  return null;
}

function nextHrefWithinControlRegion(regionHtml: string, activePage: number): string | null {
  const target = activePage + 1;
  PAGER_HREF_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PAGER_HREF_PATTERN.exec(regionHtml)) !== null) {
    if (Number(match[2]) === target) {
      return match[1]?.trim() ?? null;
    }
  }
  return null;
}

export function extractViewstatusPagination(html: string): ViewstatusPaginationExtraction {
  const activePage = extractActivePagerPage(html);
  if (activePage != null) {
    const nextByActive = hrefForPagerPage(html, activePage + 1);
    const controlNextHrefs: string[] = [];
    PAGER_CONTROL_REGION_PATTERN.lastIndex = 0;
    let regionMatch: RegExpExecArray | null;
    while ((regionMatch = PAGER_CONTROL_REGION_PATTERN.exec(html)) !== null) {
      const nextInRegion = nextHrefWithinControlRegion(regionMatch[0], activePage);
      if (nextInRegion) controlNextHrefs.push(nextInRegion);
    }
    const uniqueControls = [...new Set(controlNextHrefs)];
    const paginationControlDrift =
      uniqueControls.length > 1 && uniqueControls.some((href) => href !== uniqueControls[0]);
    const nextPageHref = uniqueControls[0] ?? nextByActive;
    return { nextPageHref, paginationControlDrift };
  }

  // Fallback: prefer explicit page-2 href over the terminal page link (e.g. pager/56).
  let pageTwoHref: string | null = null;
  let lastPagerHref: string | null = null;
  PAGER_HREF_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PAGER_HREF_PATTERN.exec(html)) !== null) {
    const page = Number(match[2]);
    const href = match[1]?.trim() ?? null;
    lastPagerHref = href;
    if (page === 2) pageTwoHref = href;
  }
  return { nextPageHref: pageTwoHref ?? lastPagerHref, paginationControlDrift: false };
}

/** @deprecated Prefer extractViewstatusPagination — kept for narrow call sites. */
export function extractViewstatusNextPageHref(html: string): string | null {
  return extractViewstatusPagination(html).nextPageHref;
}

export function buildViewstatusPageDiagnostics(
  html: string,
  parsedRowCount: number,
  quarantinedBlockCount: number,
): ViewstatusPageDiagnostics {
  const range = parseViewstatusDisplayRange(html);
  const pagination = extractViewstatusPagination(html);
  return {
    ...range,
    parsedRowCount,
    quarantinedBlockCount,
    nextPageHref: pagination.nextPageHref,
    paginationControlDrift: pagination.paginationControlDrift,
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
  if (diagnostics.paginationControlDrift) {
    throw new PaginationSafetyError("Pagination control drift: duplicate pager regions disagree");
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
