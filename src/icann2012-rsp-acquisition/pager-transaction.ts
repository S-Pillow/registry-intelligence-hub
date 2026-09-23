import { sanitizeUrlForPersistence } from "./persisted-url-tier";
import { resolveGtldresultTapestryUrl } from "./gtldresult-url-resolver";
import {
  GtldresultSessionTransport,
  type SafePagerExchange,
} from "./gtldresult-session-transport";
import type { PersistedPagerTransaction } from "./types";
import { classifyViewstatusPageHtml } from "./viewstatus-page-classification";
import { PaginationSafetyError, parseViewstatusDisplayRange } from "./viewstatus-page-meta";

export interface PagerDisplayExpectation {
  displayStart: number;
  displayEnd: number;
  displayTotal: number;
}

export function isStatusGridPagerUrl(url: string): boolean {
  try {
    return /\/viewstatus\.statusgrid\.pager\/\d+\/?$/.test(new URL(url).pathname);
  } catch {
    return /viewstatus\.statusgrid\.pager\/\d+/.test(url);
  }
}

function redact(value: string | null): string | null {
  if (value == null) return null;
  return sanitizeUrlForPersistence(value, "SAFE_DERIVED");
}

export function toPersistedPagerTransaction(input: {
  serverProvidedHref: string | null;
  exchange: SafePagerExchange;
  displayStart: number | null;
  displayEnd: number | null;
  displayTotal: number | null;
}): PersistedPagerTransaction {
  return {
    serverProvidedHref: redact(input.serverProvidedHref),
    pagerRequestedUrl: redact(input.exchange.requestedUrl),
    pagerStatus: input.exchange.pagerStatus,
    redirectLocation: redact(input.exchange.redirectLocation),
    redirectCount: input.exchange.redirectCount,
    finalUrl: redact(input.exchange.finalUrl),
    sessionCookieSent: input.exchange.sessionCookieSent,
    intermediateSetCookieObserved: input.exchange.intermediateSetCookieObserved,
    displayStart: input.displayStart,
    displayEnd: input.displayEnd,
    displayTotal: input.displayTotal,
  };
}

/**
 * Fail closed when the document reached after the pager hop is an ICANN error
 * page, or when its display range is not the expected window.
 */
export function assertPagerTransactionGrid(html: string, expected: PagerDisplayExpectation): void {
  if (classifyViewstatusPageHtml(html) === "ICANN_ERROR_PAGE") {
    throw new PaginationSafetyError("final page is ICANN_ERROR_PAGE");
  }
  const range = parseViewstatusDisplayRange(html);
  const matches =
    range.displayStart === expected.displayStart &&
    range.displayEnd === expected.displayEnd &&
    range.displayTotal === expected.displayTotal;
  if (!matches) {
    throw new PaginationSafetyError(
      `final range is not ${expected.displayStart}-${expected.displayEnd} when ${expected.displayStart}-${expected.displayEnd} is expected`,
    );
  }
}

export interface PagerTransactionResult {
  html: string;
  httpStatus: number;
  transaction: PersistedPagerTransaction;
}

/**
 * Offline Tapestry pager hop:
 * GET the server href with the in-memory session, observe a redirect ourselves,
 * apply any intermediate Set-Cookie, then follow Location on the same origin.
 */
export async function executePagerTransaction(input: {
  transport: GtldresultSessionTransport;
  contextUrl: string;
  serverProvidedHref: string;
  expectedDisplay?: PagerDisplayExpectation;
}): Promise<PagerTransactionResult> {
  const requestedUrl = resolveGtldresultTapestryUrl(input.contextUrl, input.serverProvidedHref);
  const response = await input.transport.get(requestedUrl);
  const html = Buffer.from(response.body).toString("utf8");
  if (input.expectedDisplay) {
    assertPagerTransactionGrid(html, input.expectedDisplay);
  } else if (classifyViewstatusPageHtml(html) === "ICANN_ERROR_PAGE") {
    throw new PaginationSafetyError("final page is ICANN_ERROR_PAGE");
  }
  const exchange = input.transport.getLastExchange();
  if (!exchange) {
    throw new PaginationSafetyError("pager transaction produced no exchange record");
  }
  const range = parseViewstatusDisplayRange(html);
  return {
    html,
    httpStatus: response.status,
    transaction: toPersistedPagerTransaction({
      serverProvidedHref: input.serverProvidedHref,
      exchange,
      displayStart: range.displayStart,
      displayEnd: range.displayEnd,
      displayTotal: range.displayTotal,
    }),
  };
}
