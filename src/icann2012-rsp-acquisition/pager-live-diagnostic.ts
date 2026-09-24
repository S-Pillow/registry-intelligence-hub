import { assertPagerDiagnosticAuthGate } from "./auth-gates";
import { GTLDRESULT_PATHS } from "./constants";
import {
  createNodeGtldresultFetcher,
  defaultSleep,
  PagerTransactionError,
  type GtldresultFetcher,
  type GtldresultHttpResponse,
  type SleepFn,
  GtldresultSessionTransport,
} from "./gtldresult-session-transport";
import { NetworkTargetPolicyError } from "./network-target-policy";
import { executePagerTransaction } from "./pager-transaction";
import { sanitizeUrlForPersistence } from "./persisted-url-tier";
import { resolveGtldresultTapestryUrl } from "./gtldresult-url-resolver";
import { absoluteGtldresultUrl } from "./urls";
import { classifyViewstatusPageHtml } from "./viewstatus-page-classification";
import { parseViewstatusGridHtml } from "./viewstatus-parser";
import {
  extractViewstatusPagination,
  PaginationSafetyError,
  parseViewstatusDisplayRange,
} from "./viewstatus-page-meta";

/**
 * Three exchanges, each at most one request plus five same-origin redirects.
 * 3 × (1 + 5) = 18 HTTP calls. Logical page 3 and portion downloads are refused
 * before the socket call.
 */
export const PAGER_DIAGNOSTIC_MAX_REDIRECTS_PER_EXCHANGE = 5;
export const PAGER_DIAGNOSTIC_EXCHANGE_COUNT = 3;
export const PAGER_DIAGNOSTIC_HTTP_CEILING =
  PAGER_DIAGNOSTIC_EXCHANGE_COUNT * (1 + PAGER_DIAGNOSTIC_MAX_REDIRECTS_PER_EXCHANGE);

export const PAGER_DIAGNOSTIC_ALLOWED_SEQUENCE = [
  "session-establish: GET status hub, at most 5 same-origin redirects",
  "page-1: GET viewstatus grid, at most 5 same-origin redirects",
  "pager-2: GET the selected logical page 2 server href once",
  "pager-2-redirects: follow that response's same-origin redirects, at most 5",
  "validate-grid-and-stop: do not request logical page 3 or any portion download",
] as const;

export const PAGER_DIAGNOSTIC_EXPECTED = {
  displayStart: 36,
  displayEnd: 70,
  displayTotal: 1930,
  parsedRowCount: 35,
} as const;

export const PAGER_DIAGNOSTIC_CLASSIFICATIONS = [
  "PAGER_PAGE2_OK",
  "STOPPED_ICANN_ERROR_PAGE",
  "STOPPED_UNEXPECTED_PAGE_SIZE",
  "STOPPED_ROW_COUNT_MISMATCH",
  "STOPPED_NO_SESSION",
  "STOPPED_REDIRECT_LOST_SESSION",
  "STOPPED_CROSS_HOST_REDIRECT",
  "STOPPED_REDIRECT_LOOP",
  "STOPPED_PAGER_SELECTION",
  "STOPPED_PAGE1_HTTP",
  "STOPPED_HARD_CAP",
  "STOPPED_TRANSPORT",
] as const;

export type PagerDiagnosticClassification = (typeof PAGER_DIAGNOSTIC_CLASSIFICATIONS)[number];

export type PagerDiagnosticPhase = "session" | "page1" | "pager" | "sealed";

export class PagerDiagnosticHardStopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PagerDiagnosticHardStopError";
  }
}

export interface PagerLiveDiagnosticReport {
  command: "pager-live-diagnostic";
  classification: PagerDiagnosticClassification;
  pagerLabelSelected: number | null;
  serverProvidedHref: string | null;
  pagerStatus: number | null;
  redirectCount: number;
  redirectLocationPath: string | null;
  finalUrl: string | null;
  sessionCookieSent: boolean;
  setCookieHeaderCount: number;
  sessionUpdatedDuringTransaction: boolean;
  displayStart: number | null;
  displayEnd: number | null;
  displayTotal: number | null;
  parsedRowCount: number | null;
  icannErrorPage: boolean;
  httpRequestCount: number;
  requestCeiling: number;
  stoppedAfterLogicalPage: 2;
  allowedSequence: readonly string[];
  detail: string | null;
}

export interface PagerLiveDiagnosticOptions {
  sleep?: SleepFn;
}

export function redirectLocationPath(location: string | null): string | null {
  if (location == null) return null;
  const redacted = sanitizeUrlForPersistence(location, "SAFE_DERIVED");
  if (redacted.startsWith("https://") || redacted.startsWith("http://") || redacted.startsWith("//")) {
    try {
      const url = new URL(redacted.startsWith("//") ? `https:${redacted}` : redacted);
      return `${url.pathname}${url.search}`;
    } catch {
      return redacted;
    }
  }
  return redacted;
}

function emptyReport(httpRequestCount: number): PagerLiveDiagnosticReport {
  return {
    command: "pager-live-diagnostic",
    classification: "STOPPED_TRANSPORT",
    pagerLabelSelected: null,
    serverProvidedHref: null,
    pagerStatus: null,
    redirectCount: 0,
    redirectLocationPath: null,
    finalUrl: null,
    sessionCookieSent: false,
    setCookieHeaderCount: 0,
    sessionUpdatedDuringTransaction: false,
    displayStart: null,
    displayEnd: null,
    displayTotal: null,
    parsedRowCount: null,
    icannErrorPage: false,
    httpRequestCount,
    requestCeiling: PAGER_DIAGNOSTIC_HTTP_CEILING,
    stoppedAfterLogicalPage: 2,
    allowedSequence: PAGER_DIAGNOSTIC_ALLOWED_SEQUENCE,
    detail: null,
  };
}

function isPortionUrl(url: string): boolean {
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    path = url;
  }
  const lower = path.toLowerCase();
  return (
    lower.includes("downloadapplication") ||
    lower.includes("applicationdetails") ||
    lower.includes(":download")
  );
}

function isPagerUrl(url: string): boolean {
  try {
    return /\/viewstatus\.statusgrid\.pager\/\d+\/?$/.test(new URL(url).pathname);
  } catch {
    return /viewstatus\.statusgrid\.pager\/\d+/.test(url);
  }
}

export interface PagerDiagnosticBudget {
  fetcher: GtldresultFetcher;
  requestCount: () => number;
  beginPhase: (phase: Exclude<PagerDiagnosticPhase, "sealed">) => void;
  authorizePagerUrl: (url: string) => void;
  seal: () => void;
}

/**
 * Hard cap in front of any fetcher. Refuses portion downloads, any pager URL
 * other than the single authorized logical-page-2 href, and any call after seal
 * or past the 18-request ceiling. The inner fetcher is not invoked on refusal.
 */
export function createPagerDiagnosticBudget(inner: GtldresultFetcher): PagerDiagnosticBudget {
  let count = 0;
  let phase: PagerDiagnosticPhase = "session";
  let authorizedPagerUrl: string | null = null;

  const fetcher: GtldresultFetcher = async (url, init) => {
    if (phase === "sealed") {
      throw new PagerDiagnosticHardStopError(
        "diagnostic hard stop after logical page 2: no further HTTP",
      );
    }
    if (count >= PAGER_DIAGNOSTIC_HTTP_CEILING) {
      throw new PagerDiagnosticHardStopError(
        `diagnostic HTTP ceiling ${PAGER_DIAGNOSTIC_HTTP_CEILING} exceeded`,
      );
    }
    if (isPortionUrl(url)) {
      throw new PagerDiagnosticHardStopError("diagnostic cannot download application portions");
    }
    if (isPagerUrl(url) && url !== authorizedPagerUrl) {
      throw new PagerDiagnosticHardStopError(
        "diagnostic refused a pager URL other than the selected logical page 2 href",
      );
    }
    if (phase !== "pager" && isPagerUrl(url)) {
      throw new PagerDiagnosticHardStopError("diagnostic refused a pager request before page 2 was selected");
    }
    count += 1;
    return inner(url, init);
  };

  return {
    fetcher,
    requestCount: () => count,
    beginPhase: (next) => {
      if (phase === "sealed") {
        throw new PagerDiagnosticHardStopError("diagnostic hard stop after logical page 2");
      }
      phase = next;
    },
    authorizePagerUrl: (url) => {
      if (authorizedPagerUrl != null) {
        throw new PagerDiagnosticHardStopError("diagnostic authorizes only one pager href");
      }
      authorizedPagerUrl = url;
    },
    seal: () => {
      phase = "sealed";
    },
  };
}

function classifyTransportError(err: unknown): PagerDiagnosticClassification | null {
  if (err instanceof PagerDiagnosticHardStopError) return "STOPPED_HARD_CAP";
  if (err instanceof NetworkTargetPolicyError) return "STOPPED_CROSS_HOST_REDIRECT";
  if (err instanceof PagerTransactionError || err instanceof PaginationSafetyError || err instanceof Error) {
    const message = err.message;
    if (message.includes("pager request receives no session cookie")) return "STOPPED_NO_SESSION";
    if (message.includes("redirect loses session state")) return "STOPPED_REDIRECT_LOST_SESSION";
    if (message.includes("redirect loop")) return "STOPPED_REDIRECT_LOOP";
    if (message.includes("cross-host") || message.includes("off-origin")) {
      return "STOPPED_CROSS_HOST_REDIRECT";
    }
    if (
      err instanceof PagerDiagnosticHardStopError ||
      message.includes("diagnostic hard stop") ||
      message.includes("diagnostic HTTP ceiling") ||
      message.includes("diagnostic refused") ||
      message.includes("diagnostic cannot")
    ) {
      return "STOPPED_HARD_CAP";
    }
  }
  return null;
}

function safeDetail(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.replace(/(_csrf|csrf|jsessionid|session)=([^&\s;]+)/gi, "$1=REDACTED");
}

function classifyFinalGrid(html: string): {
  classification: PagerDiagnosticClassification;
  icannErrorPage: boolean;
  displayStart: number | null;
  displayEnd: number | null;
  displayTotal: number | null;
  parsedRowCount: number;
  detail: string | null;
} {
  const icannErrorPage = classifyViewstatusPageHtml(html) === "ICANN_ERROR_PAGE";
  const range = parseViewstatusDisplayRange(html);
  const parsedRowCount = parseViewstatusGridHtml(html).rows.length;
  if (icannErrorPage) {
    return {
      classification: "STOPPED_ICANN_ERROR_PAGE",
      icannErrorPage: true,
      ...range,
      parsedRowCount,
      detail: "final page is ICANN_ERROR_PAGE",
    };
  }
  const rangeMatches =
    range.displayStart === PAGER_DIAGNOSTIC_EXPECTED.displayStart &&
    range.displayEnd === PAGER_DIAGNOSTIC_EXPECTED.displayEnd &&
    range.displayTotal === PAGER_DIAGNOSTIC_EXPECTED.displayTotal;
  if (!rangeMatches) {
    const observed =
      range.displayStart == null
        ? "no display range"
        : `${range.displayStart}-${range.displayEnd} of ${range.displayTotal}`;
    return {
      classification: "STOPPED_UNEXPECTED_PAGE_SIZE",
      icannErrorPage: false,
      ...range,
      parsedRowCount,
      detail: `stopped after logical page 2; observed range ${observed}`,
    };
  }
  if (parsedRowCount !== PAGER_DIAGNOSTIC_EXPECTED.parsedRowCount) {
    return {
      classification: "STOPPED_ROW_COUNT_MISMATCH",
      icannErrorPage: false,
      ...range,
      parsedRowCount,
      detail: `stopped after logical page 2; parsed row count ${parsedRowCount}`,
    };
  }
  return {
    classification: "PAGER_PAGE2_OK",
    icannErrorPage: false,
    ...range,
    parsedRowCount,
    detail: null,
  };
}

export function formatPagerLiveDiagnosticReport(report: PagerLiveDiagnosticReport): string {
  const range =
    report.displayStart == null
      ? "none"
      : `${report.displayStart} - ${report.displayEnd} of ${report.displayTotal}`;
  const lines = [
    "pager-live-diagnostic",
    `classification: ${report.classification}`,
    `pager label selected: ${report.pagerLabelSelected ?? "none"}`,
    `server href: ${report.serverProvidedHref ?? "none"}`,
    `pager HTTP status: ${report.pagerStatus ?? "none"}`,
    `redirect count: ${report.redirectCount}`,
    `redirect location path: ${report.redirectLocationPath ?? "none"}`,
    `final URL: ${report.finalUrl ?? "none"}`,
    `session cookie present: ${report.sessionCookieSent ? "yes" : "no"}`,
    `Set-Cookie count: ${report.setCookieHeaderCount}`,
    `session updated during transaction: ${report.sessionUpdatedDuringTransaction ? "yes" : "no"}`,
    `final display range: ${range}`,
    `parsed row count: ${report.parsedRowCount ?? "none"}`,
    `ICANN_ERROR_PAGE: ${report.icannErrorPage ? "true" : "false"}`,
    `http requests: ${report.httpRequestCount}`,
    `request ceiling: ${report.requestCeiling}`,
    "hard stop: after logical page 2 (no page 3, no portion crawl)",
  ];
  if (report.detail) lines.push(`detail: ${report.detail}`);
  return `${lines.join("\n")}\n${JSON.stringify(report, null, 2)}\n`;
}

export async function runPagerLiveDiagnostic(
  options: PagerLiveDiagnosticOptions = {},
  fetcher?: GtldresultFetcher,
): Promise<PagerLiveDiagnosticReport> {
  assertPagerDiagnosticAuthGate();

  const budget = createPagerDiagnosticBudget(fetcher ?? createNodeGtldresultFetcher());
  const transport = new GtldresultSessionTransport(budget.fetcher, options.sleep ?? defaultSleep);
  const hubUrl = absoluteGtldresultUrl(GTLDRESULT_PATHS.statusHub);
  const gridUrl = absoluteGtldresultUrl(GTLDRESULT_PATHS.viewStatusGrid);

  const fail = (classification: PagerDiagnosticClassification, detail: string | null, partial?: Partial<PagerLiveDiagnosticReport>) => {
    budget.seal();
    return {
      ...emptyReport(budget.requestCount()),
      ...partial,
      classification,
      detail,
      httpRequestCount: budget.requestCount(),
      requestCeiling: PAGER_DIAGNOSTIC_HTTP_CEILING,
      stoppedAfterLogicalPage: 2 as const,
      allowedSequence: PAGER_DIAGNOSTIC_ALLOWED_SEQUENCE,
      command: "pager-live-diagnostic" as const,
    };
  };

  try {
    budget.beginPhase("session");
    await transport.get(hubUrl);
    budget.beginPhase("page1");
    const page1: GtldresultHttpResponse = await transport.get(gridUrl);
    if (page1.status < 200 || page1.status >= 300) {
      return fail("STOPPED_PAGE1_HTTP", `page 1 HTTP ${page1.status}`);
    }
    const page1Html = Buffer.from(page1.body).toString("utf8");
    if (classifyViewstatusPageHtml(page1Html) === "ICANN_ERROR_PAGE") {
      return fail("STOPPED_ICANN_ERROR_PAGE", "page 1 is ICANN_ERROR_PAGE", { icannErrorPage: true });
    }
    const pagination = extractViewstatusPagination(page1Html);
    if (
      pagination.paginationControlDrift ||
      pagination.nextLogicalPage !== 2 ||
      !pagination.nextPageHref
    ) {
      return fail(
        "STOPPED_PAGER_SELECTION",
        pagination.paginationDriftDetail ?? "logical page 2 href was not selected",
        { pagerLabelSelected: pagination.nextLogicalPage },
      );
    }

    const pagerUrl = resolveGtldresultTapestryUrl(gridUrl, pagination.nextPageHref);
    budget.authorizePagerUrl(pagerUrl);
    budget.beginPhase("pager");
    await transport.waitBetweenRequests();
    const result = await executePagerTransaction({
      transport,
      contextUrl: gridUrl,
      serverProvidedHref: pagination.nextPageHref,
      rejectIcannErrorPage: false,
    });
    budget.seal();

    const exchange = transport.getLastExchange();
    const grid = classifyFinalGrid(result.html);
    const serverProvidedHref = sanitizeUrlForPersistence(pagination.nextPageHref, "SAFE_DERIVED");
    return {
      ...emptyReport(budget.requestCount()),
      classification: grid.classification,
      pagerLabelSelected: pagination.nextLogicalPage,
      serverProvidedHref,
      pagerStatus: exchange?.pagerStatus ?? result.httpStatus,
      redirectCount: exchange?.redirectCount ?? result.transaction.redirectCount,
      redirectLocationPath: redirectLocationPath(exchange?.redirectLocation ?? null),
      finalUrl: sanitizeUrlForPersistence(exchange?.finalUrl ?? result.transaction.finalUrl ?? "", "SAFE_DERIVED"),
      sessionCookieSent: exchange?.sessionCookieSent === true,
      setCookieHeaderCount: exchange?.setCookieHeaderCount ?? 0,
      sessionUpdatedDuringTransaction: exchange?.sessionUpdatedDuringTransaction === true,
      displayStart: grid.displayStart,
      displayEnd: grid.displayEnd,
      displayTotal: grid.displayTotal,
      parsedRowCount: grid.parsedRowCount,
      icannErrorPage: grid.icannErrorPage,
      httpRequestCount: budget.requestCount(),
      detail: grid.detail,
    };
  } catch (err) {
    const classification = classifyTransportError(err) ?? "STOPPED_TRANSPORT";
    const exchange = transport.getLastExchange();
    return fail(classification, safeDetail(err), {
      pagerStatus: exchange?.pagerStatus ?? null,
      redirectCount: exchange?.redirectCount ?? 0,
      redirectLocationPath: redirectLocationPath(exchange?.redirectLocation ?? null),
      finalUrl: exchange?.finalUrl
        ? sanitizeUrlForPersistence(exchange.finalUrl, "SAFE_DERIVED")
        : null,
      sessionCookieSent: exchange?.sessionCookieSent === true,
      setCookieHeaderCount: exchange?.setCookieHeaderCount ?? 0,
      sessionUpdatedDuringTransaction: exchange?.sessionUpdatedDuringTransaction === true,
    });
  }
}
