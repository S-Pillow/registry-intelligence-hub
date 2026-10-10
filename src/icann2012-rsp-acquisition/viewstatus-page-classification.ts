export const VIEWSTATUS_PAGE_KINDS = [
  "STATUS_GRID",
  "ICANN_ERROR_PAGE",
  "UNKNOWN_NON_GRID",
] as const;

export type ViewstatusPageKind = (typeof VIEWSTATUS_PAGE_KINDS)[number];

const ICANN_ERROR_MARKERS = [
  /<title>\s*ICANN Error\s*<\/title>/i,
  /<title>\s*ICANN'?s Application Result\s*-\s*Error\s*<\/title>/i,
  /<h1[^>]*>\s*ICANN Error\s*<\/h1>/i,
  /<h1[^>]*>\s*Error\s*<\/h1>/i,
  /\bICANN Error page\b/i,
  /\bApplication Result Error\b/i,
  /class="[^"]*\berror-page\b/i,
] as const;

export function classifyViewstatusPageHtml(html: string): ViewstatusPageKind {
  if (ICANN_ERROR_MARKERS.some((pattern) => pattern.test(html))) {
    return "ICANN_ERROR_PAGE";
  }
  if (/Displaying\s+\d+\s*-\s*\d+\s+of\s+\d+/i.test(html)) {
    return "STATUS_GRID";
  }
  if (/viewstatus\.statusgrid\.pager/i.test(html) || /viewapplicationdetails/i.test(html)) {
    return "STATUS_GRID";
  }
  return "UNKNOWN_NON_GRID";
}

export function isRejectableNonGridPage(kind: ViewstatusPageKind): boolean {
  return kind === "ICANN_ERROR_PAGE" || kind === "UNKNOWN_NON_GRID";
}
