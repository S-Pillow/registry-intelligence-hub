import type { ViewstatusPageDiagnostics } from "./types";
import { resolveGtldresultTapestryUrl } from "./gtldresult-url-resolver";
import { sanitizeUrlForPersistence } from "./persisted-url-tier";

const DISPLAY_RANGE_PATTERN =
  /Displaying\s+(\d+)\s*-\s*(\d+)\s+of\s+(\d+)/i;

const CONTROL_REGION_PATTERN =
  /<(ul|nav|div|ol)\b[^>]*class="[^"]*\b(?:pager|pagination)\b[^"]*"[\s\S]*?<\/\1>/gi;

export interface ViewstatusPaginationExtraction {
  currentPage: number | null;
  nextLogicalPage: number | null;
  nextPageHref: string | null;
  paginationControlDrift: boolean;
  paginationDriftDetail: string | null;
}

interface ParsedPagerAnchor {
  href: string;
  logicalPage: number | null;
  explicitNext: boolean;
  current: boolean;
  identityConflict: boolean;
}

interface ControlSelection {
  currentPage: number | null;
  nextLogicalPage: number | null;
  nextHref: string | null;
  drift: boolean;
  detail: string | null;
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

function readAttr(attrs: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(attrs);
  if (!match) return null;
  return (match[1] ?? match[2] ?? "").replace(/&amp;/gi, "&");
}

function classList(attrs: string): string[] {
  return (readAttr(attrs, "class") ?? "").split(/\s+/).filter(Boolean);
}

function hasCurrentClass(tokens: string[]): boolean {
  return tokens.some((token) => /^(?:active|current|selected)$/i.test(token));
}

function isNavigableHref(href: string): boolean {
  const trimmed = href.trim();
  return trimmed.length > 0 && trimmed !== "#";
}

/** Compare pager hrefs after redacting session query values. Path identity is preserved. */
export function structuralPagerHref(href: string): string {
  const decoded = href.trim().replace(/&amp;/gi, "&");
  let url: URL;
  try {
    url = new URL(decoded, "https://gtldresult.icann.org");
  } catch {
    return sanitizeUrlForPersistence(decoded, "SAFE_DERIVED");
  }
  if (url.searchParams.has("_csrf")) url.searchParams.set("_csrf", "REDACTED");
  const params = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const search = params.length
    ? `?${params.map(([key, value]) => `${key}=${value}`).join("&")}`
    : "";
  return `${url.pathname}${search}`;
}

function logicalPageFromLabel(
  text: string,
  title: string | null,
): { page: number | null; conflict: boolean } {
  const textPage = /^\d+$/.test(text) ? Number(text) : null;
  const titleMatch = title?.match(/\bgo to page\s+(\d+)\b/i);
  const titlePage = titleMatch ? Number(titleMatch[1]) : null;
  if (textPage != null && titlePage != null && textPage !== titlePage) {
    return { page: null, conflict: true };
  }
  return { page: textPage ?? titlePage, conflict: false };
}

function buildAnchor(containerAttrs: string, anchorAttrs: string, innerHtml: string): ParsedPagerAnchor {
  const text = innerHtml.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const href = readAttr(anchorAttrs, "href") ?? "";
  const labeled = logicalPageFromLabel(text, readAttr(anchorAttrs, "title"));
  const tokens = classList(anchorAttrs);
  const rel = readAttr(anchorAttrs, "rel") ?? "";
  const explicitNext =
    labeled.page == null &&
    (tokens.some((token) => /^(?:pager-next|next)$/i.test(token)) ||
      rel.split(/\s+/).some((token) => token.toLowerCase() === "next"));
  const current =
    hasCurrentClass(classList(containerAttrs)) ||
    hasCurrentClass(tokens) ||
    (readAttr(containerAttrs, "aria-current") ?? "").toLowerCase() === "page" ||
    (readAttr(anchorAttrs, "aria-current") ?? "").toLowerCase() === "page";
  return {
    href,
    logicalPage: labeled.page,
    explicitNext,
    current,
    identityConflict: labeled.conflict,
  };
}

function parseControlLinks(regionHtml: string): ParsedPagerAnchor[] {
  if (/<li\b/i.test(regionHtml)) {
    const links: ParsedPagerAnchor[] = [];
    const liPattern = /<li\b([^>]*)>([\s\S]*?)<\/li>/gi;
    let match: RegExpExecArray | null;
    while ((match = liPattern.exec(regionHtml)) !== null) {
      const anchor = /<a\b([^>]*)>([\s\S]*?)<\/a>/i.exec(match[2] ?? "");
      if (!anchor) continue;
      links.push(buildAnchor(match[1] ?? "", anchor[1] ?? "", anchor[2] ?? ""));
    }
    return links;
  }

  const links: ParsedPagerAnchor[] = [];
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(regionHtml)) !== null) {
    links.push(buildAnchor("", match[1] ?? "", match[2] ?? ""));
  }
  return links;
}

function extractControlRegions(html: string): string[] {
  const regions: string[] = [];
  CONTROL_REGION_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CONTROL_REGION_PATTERN.exec(html)) !== null) {
    regions.push(match[0]);
  }
  return regions;
}

function parseLooseExplicitNext(html: string): ParsedPagerAnchor[] {
  const links: ParsedPagerAnchor[] = [];
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(html)) !== null) {
    const attrs = match[1] ?? "";
    const tokens = classList(attrs);
    const rel = readAttr(attrs, "rel") ?? "";
    const marked =
      tokens.some((token) => /^(?:pager-next|next)$/i.test(token)) ||
      rel.split(/\s+/).some((token) => token.toLowerCase() === "next");
    if (!marked) continue;
    links.push(buildAnchor("", attrs, match[2] ?? ""));
  }
  return links;
}

function drifted(detail: string, currentPage: number | null = null): ControlSelection {
  return {
    currentPage,
    nextLogicalPage: null,
    nextHref: null,
    drift: true,
    detail,
  };
}

function selectControl(links: ParsedPagerAnchor[]): ControlSelection {
  if (links.some((link) => link.identityConflict)) {
    return drifted("logical page label conflict");
  }

  const numbered = links.filter((link) => link.logicalPage != null);
  if (numbered.length > 0) {
    const currentPages = [
      ...new Set(
        links
          .filter((link) => link.current && link.logicalPage != null)
          .map((link) => link.logicalPage as number),
      ),
    ];
    if (currentPages.length !== 1) {
      return drifted(
        currentPages.length === 0
          ? "current page cannot be established"
          : "current page markers disagree",
      );
    }
    const currentPage = currentPages[0]!;
    const target = currentPage + 1;
    const nextLinks = numbered.filter(
      (link) => link.logicalPage === target && isNavigableHref(link.href),
    );
    const explicit = links.filter((link) => link.explicitNext && isNavigableHref(link.href));
    if (nextLinks.length === 0) {
      if (explicit.length > 0) {
        return drifted("explicit next disagrees with numbered pager", currentPage);
      }
      return {
        currentPage,
        nextLogicalPage: null,
        nextHref: null,
        drift: false,
        detail: null,
      };
    }
    const structs = nextLinks.map((link) => structuralPagerHref(link.href));
    if (new Set(structs).size > 1) {
      return drifted("adjacent page has conflicting hrefs", currentPage);
    }
    if (explicit.length > 0) {
      const explicitStructs = new Set(explicit.map((link) => structuralPagerHref(link.href)));
      if (explicitStructs.size !== 1 || !explicitStructs.has(structs[0]!)) {
        return drifted("explicit next disagrees with adjacent logical page", currentPage);
      }
    }
    return {
      currentPage,
      nextLogicalPage: target,
      nextHref: nextLinks[0]!.href,
      drift: false,
      detail: null,
    };
  }

  const unlabeledPager = links.filter(
    (link) =>
      /viewstatus\.statusgrid\.pager\/\d+/i.test(link.href) &&
      !link.explicitNext &&
      isNavigableHref(link.href),
  );
  if (unlabeledPager.length > 0) {
    return drifted("pager href without a logical page label");
  }

  const explicit = links.filter((link) => link.explicitNext && isNavigableHref(link.href));
  if (explicit.length === 0) {
    return {
      currentPage: null,
      nextLogicalPage: null,
      nextHref: null,
      drift: false,
      detail: null,
    };
  }
  const structs = explicit.map((link) => structuralPagerHref(link.href));
  if (new Set(structs).size > 1) {
    return drifted("explicit next hrefs disagree");
  }
  return {
    currentPage: null,
    nextLogicalPage: null,
    nextHref: explicit[0]!.href,
    drift: false,
    detail: null,
  };
}

function extractionFromSelection(selection: ControlSelection): ViewstatusPaginationExtraction {
  if (selection.drift) {
    return {
      currentPage: selection.currentPage,
      nextLogicalPage: null,
      nextPageHref: null,
      paginationControlDrift: true,
      paginationDriftDetail: selection.detail,
    };
  }
  return {
    currentPage: selection.currentPage,
    nextLogicalPage: selection.nextLogicalPage,
    nextPageHref: selection.nextHref,
    paginationControlDrift: false,
    paginationDriftDetail: null,
  };
}

/**
 * Select the adjacent logical page (current+1) from server-provided pager anchors.
 * Logical page identity is the visible label (and matching "Go to page N" title),
 * never the Tapestry numeric segment in the href.
 * NEXT_PAGE_SELECTION_DEFECT: choosing the last/highest pager anchor (pager/56 on page 1).
 */
export function extractViewstatusPagination(html: string): ViewstatusPaginationExtraction {
  const regions = extractControlRegions(html);
  if (regions.length === 0) {
    return extractionFromSelection(selectControl(parseLooseExplicitNext(html)));
  }

  const selections = regions.map((region) => selectControl(parseControlLinks(region)));
  const drift = selections.find((selection) => selection.drift);
  if (drift) return extractionFromSelection(drift);

  const currentPages = [
    ...new Set(
      selections
        .map((selection) => selection.currentPage)
        .filter((page): page is number => page != null),
    ),
  ];
  if (currentPages.length > 1) {
    return extractionFromSelection(drifted("duplicate pager regions disagree on current page"));
  }

  const established = selections.filter((selection) => selection.currentPage != null);
  const comparable = established.length > 0 ? established : selections;
  const structuralNext = comparable.map((selection) =>
    selection.nextHref ? structuralPagerHref(selection.nextHref) : "",
  );
  if (new Set(structuralNext).size > 1) {
    return extractionFromSelection(
      drifted(
        "duplicate pager regions disagree on adjacent href",
        currentPages[0] ?? null,
      ),
    );
  }

  const chosen =
    comparable.find((selection) => selection.nextHref) ??
    comparable[0] ??
    selections[0];
  if (!chosen) {
    return {
      currentPage: null,
      nextLogicalPage: null,
      nextPageHref: null,
      paginationControlDrift: false,
      paginationDriftDetail: null,
    };
  }
  return extractionFromSelection(chosen);
}

/** @deprecated Prefer extractViewstatusPagination — kept for narrow call sites. */
export function extractViewstatusNextPageHref(html: string): string | null {
  return extractViewstatusPagination(html).nextPageHref;
}

export function buildViewstatusPageDiagnostics(
  html: string,
  parsedRowCount: number,
  quarantinedBlockCount: number,
  contextUrl?: string,
): ViewstatusPageDiagnostics {
  const range = parseViewstatusDisplayRange(html);
  const pagination = extractViewstatusPagination(html);
  const rawHref = pagination.paginationControlDrift ? null : pagination.nextPageHref;
  const serverProvidedHref =
    rawHref == null ? null : sanitizeUrlForPersistence(rawHref, "SAFE_DERIVED");
  let effectiveRequestUrl: string | null = null;
  if (rawHref && contextUrl) {
    try {
      effectiveRequestUrl = sanitizeUrlForPersistence(
        resolveGtldresultTapestryUrl(contextUrl, rawHref),
        "SAFE_DERIVED",
      );
    } catch {
      effectiveRequestUrl = null;
    }
  }
  return {
    ...range,
    parsedRowCount,
    quarantinedBlockCount,
    nextPageHref: rawHref,
    paginationControlDrift: pagination.paginationControlDrift,
    currentPage: pagination.currentPage,
    nextLogicalPage: pagination.paginationControlDrift ? null : pagination.nextLogicalPage,
    serverProvidedHref,
    effectiveRequestUrl,
    paginationDriftDetail: pagination.paginationDriftDetail,
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
    throw new PaginationSafetyError(
      diagnostics.paginationDriftDetail
        ? `Pagination drift: ${diagnostics.paginationDriftDetail}`
        : "Pagination control drift: duplicate pager regions disagree",
    );
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
