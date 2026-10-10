import { ApplicationDetailsDownloadError, parseApplicationDetailsDownload } from "./application-details-download";
import { assertPortionDiagnosticAuthGate } from "./auth-gates";
import {
  PORTION_DIAGNOSTIC_APPLICATION_ID,
  PORTION_DIAGNOSTIC_GTLDRESULT_AC_ID,
  PORTION_DIAGNOSTIC_HTTP_CEILING,
} from "./constants";
import {
  createNodeGtldresultFetcher,
  defaultSleep,
  type GtldresultFetcher,
  type SleepFn,
  GtldresultSessionTransport,
} from "./gtldresult-session-transport";
import { NetworkTargetPolicyError } from "./network-target-policy";
import { sanitizeUrlForPersistence } from "./persisted-url-tier";
import {
  PUBLIC_PORTION_VERSION_BASIS,
  resolveApplicationVersionBasis,
  validatePublicPortionDocument,
  type PublicPortionVersionBasis,
} from "./public-portion-validation";
import { classifyViewstatusPageHtml } from "./viewstatus-page-classification";
import { buildDetailsUrl } from "./urls";

export const PORTION_DIAGNOSTIC_ALLOWED_SEQUENCE = [
  "details: GET application details for gtldresultAcId 170, at most 5 same-origin redirects",
  "validate-details: Application ID must be 1-1945-29108",
  "extract: official server-provided public-portion href; do not manufacture a URL",
  "portion: GET that href in the same in-memory session, at most 5 same-origin redirects",
  "validate-portion: Application ID 1-1945-29108, Q23 present, not a status hub, not an ICANN error page",
  "stop: one application only",
] as const;

export const PORTION_DIAGNOSTIC_CLASSIFICATIONS = [
  "PORTION_OK",
  "STOPPED_DETAILS_HTTP",
  "STOPPED_WRONG_APPLICATION_ID",
  "STOPPED_MISSING_DOWNLOAD_LINK",
  "STOPPED_AMBIGUOUS_DOWNLOAD_LINK",
  "STOPPED_CROSS_HOST_LINK",
  "STOPPED_NON_HTTPS_LINK",
  "STOPPED_PORTION_HTTP",
  "STOPPED_PORTION_APPLICATION_ID",
  "STOPPED_INCOMPLETE_Q23",
  "STOPPED_STATUS_HUB",
  "STOPPED_ICANN_ERROR_PAGE",
  "STOPPED_HARD_CAP",
  "STOPPED_TRANSPORT",
] as const;

export type PortionDiagnosticClassification = (typeof PORTION_DIAGNOSTIC_CLASSIFICATIONS)[number];

export type PortionDiagnosticPhase = "details" | "portion" | "sealed";

export class PortionDiagnosticHardStopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortionDiagnosticHardStopError";
  }
}

export interface PortionLiveDiagnosticReport {
  command: "portion-live-diagnostic";
  classification: PortionDiagnosticClassification;
  applicationId: typeof PORTION_DIAGNOSTIC_APPLICATION_ID;
  gtldresultAcId: typeof PORTION_DIAGNOSTIC_GTLDRESULT_AC_ID;
  detailsUrl: string;
  detailsApplicationId: string | null;
  serverProvidedHref: string | null;
  portionUrl: string | null;
  portionHttpStatus: number | null;
  applicationVersionBasis: PublicPortionVersionBasis;
  retrievedAt: string | null;
  q23Present: boolean;
  statusGridHub: boolean;
  icannErrorPage: boolean;
  sessionCookieSent: boolean;
  setCookieHeaderCount: number;
  sessionUpdatedDuringTransaction: boolean;
  httpRequestCount: number;
  requestCeiling: number;
  stoppedAfterOneApplication: true;
  allowedSequence: readonly string[];
  detail: string | null;
}

export interface PortionLiveDiagnosticOptions {
  sleep?: SleepFn;
  /** Clock for retrievedAt. Does not change applicationVersionBasis. */
  now?: () => string;
}

export interface PortionDiagnosticBudget {
  fetcher: GtldresultFetcher;
  requestCount: () => number;
  beginPhase: (phase: Exclude<PortionDiagnosticPhase, "sealed">) => void;
  authorizePortionUrl: (url: string) => void;
  seal: () => void;
}

const DETAILS_URL = buildDetailsUrl(PORTION_DIAGNOSTIC_GTLDRESULT_AC_ID);

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/$/, "");
  } catch {
    return url;
  }
}

function isGridCrawlUrl(url: string): boolean {
  const path = pathnameOf(url).toLowerCase();
  return (
    path.includes("/viewstatus") ||
    path.includes("statusgrid.pager") ||
    path === "/application-result/applicationstatus"
  );
}

function isPortionDownloadUrl(url: string): boolean {
  return pathnameOf(url).toLowerCase().includes("downloadapplication");
}

function isForeignDetailsUrl(url: string): boolean {
  const path = pathnameOf(url);
  const match = /\/applicationstatus\/applicationdetails\/(\d+)$/.exec(path);
  if (!match) return false;
  return Number(match[1]) !== PORTION_DIAGNOSTIC_GTLDRESULT_AC_ID;
}

/**
 * Hard cap in front of any fetcher. One details exchange and one authorized
 * public-portion href. Grid crawls and further applications are refused
 * before the socket call.
 */
export function createPortionDiagnosticBudget(inner: GtldresultFetcher): PortionDiagnosticBudget {
  let count = 0;
  let phase: PortionDiagnosticPhase = "details";
  let authorizedPortionUrl: string | null = null;

  const fetcher: GtldresultFetcher = async (url, init) => {
    if (phase === "sealed") {
      throw new PortionDiagnosticHardStopError(
        "diagnostic hard stop after one application: no further HTTP",
      );
    }
    if (count >= PORTION_DIAGNOSTIC_HTTP_CEILING) {
      throw new PortionDiagnosticHardStopError(
        `diagnostic HTTP ceiling ${PORTION_DIAGNOSTIC_HTTP_CEILING} exceeded`,
      );
    }
    if (isGridCrawlUrl(url)) {
      throw new PortionDiagnosticHardStopError("diagnostic cannot crawl the status grid");
    }
    if (isForeignDetailsUrl(url)) {
      throw new PortionDiagnosticHardStopError(
        "diagnostic is bound to gtldresultAcId 170",
      );
    }
    if (phase !== "portion" && isPortionDownloadUrl(url)) {
      throw new PortionDiagnosticHardStopError(
        "diagnostic refused a public-portion request before the details page was validated",
      );
    }
    if (isPortionDownloadUrl(url) && url !== authorizedPortionUrl) {
      throw new PortionDiagnosticHardStopError(
        "diagnostic refused a public-portion URL other than the server-provided href",
      );
    }
    count += 1;
    return inner(url, init);
  };

  return {
    fetcher,
    requestCount: () => count,
    beginPhase: (next) => {
      if (phase === "sealed") {
        throw new PortionDiagnosticHardStopError("diagnostic hard stop after one application");
      }
      phase = next;
    },
    authorizePortionUrl: (url) => {
      if (authorizedPortionUrl != null) {
        throw new PortionDiagnosticHardStopError("diagnostic authorizes only one public-portion href");
      }
      authorizedPortionUrl = url;
    },
    seal: () => {
      phase = "sealed";
    },
  };
}

function emptyReport(httpRequestCount: number): PortionLiveDiagnosticReport {
  return {
    command: "portion-live-diagnostic",
    classification: "STOPPED_TRANSPORT",
    applicationId: PORTION_DIAGNOSTIC_APPLICATION_ID,
    gtldresultAcId: PORTION_DIAGNOSTIC_GTLDRESULT_AC_ID,
    detailsUrl: DETAILS_URL,
    detailsApplicationId: null,
    serverProvidedHref: null,
    portionUrl: null,
    portionHttpStatus: null,
    applicationVersionBasis: resolveApplicationVersionBasis(),
    retrievedAt: null,
    q23Present: false,
    statusGridHub: false,
    icannErrorPage: false,
    sessionCookieSent: false,
    setCookieHeaderCount: 0,
    sessionUpdatedDuringTransaction: false,
    httpRequestCount,
    requestCeiling: PORTION_DIAGNOSTIC_HTTP_CEILING,
    stoppedAfterOneApplication: true,
    allowedSequence: PORTION_DIAGNOSTIC_ALLOWED_SEQUENCE,
    detail: null,
  };
}

function safeDetail(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.replace(/(_csrf|csrf|jsessionid|session)=([^&\s;]+)/gi, "$1=REDACTED");
}

function classifyDownloadError(err: ApplicationDetailsDownloadError): PortionDiagnosticClassification {
  switch (err.code) {
    case "WRONG_APPLICATION_ID":
    case "MISSING_APPLICATION_ID":
      return "STOPPED_WRONG_APPLICATION_ID";
    case "MISSING_DOWNLOAD_LINK":
      return "STOPPED_MISSING_DOWNLOAD_LINK";
    case "AMBIGUOUS_DOWNLOAD_LINK":
      return "STOPPED_AMBIGUOUS_DOWNLOAD_LINK";
    case "CROSS_HOST_LINK":
      return "STOPPED_CROSS_HOST_LINK";
    case "NON_HTTPS_LINK":
      return "STOPPED_NON_HTTPS_LINK";
    default: {
      const _exhaustive: never = err.code;
      return _exhaustive;
    }
  }
}

export function formatPortionLiveDiagnosticReport(report: PortionLiveDiagnosticReport): string {
  const lines = [
    "portion-live-diagnostic",
    `classification: ${report.classification}`,
    `application id: ${report.applicationId}`,
    `gtldresult ac id: ${report.gtldresultAcId}`,
    `details URL: ${report.detailsUrl}`,
    `details Application ID: ${report.detailsApplicationId ?? "none"}`,
    `server href: ${report.serverProvidedHref ?? "none"}`,
    `portion URL: ${report.portionUrl ?? "none"}`,
    `portion HTTP status: ${report.portionHttpStatus ?? "none"}`,
    `applicationVersionBasis: ${report.applicationVersionBasis}`,
    `retrievedAt: ${report.retrievedAt ?? "none"}`,
    `Q23 present: ${report.q23Present ? "true" : "false"}`,
    `status-grid hub: ${report.statusGridHub ? "true" : "false"}`,
    `ICANN_ERROR_PAGE: ${report.icannErrorPage ? "true" : "false"}`,
    `session cookie present: ${report.sessionCookieSent ? "yes" : "no"}`,
    `cookie header count: ${report.setCookieHeaderCount}`,
    `session updated during transaction: ${report.sessionUpdatedDuringTransaction ? "yes" : "no"}`,
    `http requests: ${report.httpRequestCount}`,
    `request ceiling: ${report.requestCeiling}`,
    "hard stop: one application",
  ];
  if (report.detail) lines.push(`detail: ${report.detail}`);
  return `${lines.join("\n")}\n${JSON.stringify(report, null, 2)}\n`;
}

export async function runPortionLiveDiagnostic(
  options: PortionLiveDiagnosticOptions = {},
  fetcher?: GtldresultFetcher,
): Promise<PortionLiveDiagnosticReport> {
  assertPortionDiagnosticAuthGate();

  const budget = createPortionDiagnosticBudget(fetcher ?? createNodeGtldresultFetcher());
  const transport = new GtldresultSessionTransport(budget.fetcher, options.sleep ?? defaultSleep);
  const now = options.now ?? (() => new Date().toISOString());

  const fail = (
    classification: PortionDiagnosticClassification,
    detail: string | null,
    partial?: Partial<PortionLiveDiagnosticReport>,
  ): PortionLiveDiagnosticReport => {
    budget.seal();
    const exchange = transport.getLastExchange();
    return {
      ...emptyReport(budget.requestCount()),
      ...partial,
      classification,
      detail,
      httpRequestCount: budget.requestCount(),
      requestCeiling: PORTION_DIAGNOSTIC_HTTP_CEILING,
      stoppedAfterOneApplication: true,
      allowedSequence: PORTION_DIAGNOSTIC_ALLOWED_SEQUENCE,
      command: "portion-live-diagnostic",
      applicationVersionBasis: PUBLIC_PORTION_VERSION_BASIS,
      sessionCookieSent: partial?.sessionCookieSent ?? exchange?.sessionCookieSent === true,
      setCookieHeaderCount: partial?.setCookieHeaderCount ?? exchange?.setCookieHeaderCount ?? 0,
      sessionUpdatedDuringTransaction:
        partial?.sessionUpdatedDuringTransaction ?? exchange?.sessionUpdatedDuringTransaction === true,
    };
  };

  try {
    budget.beginPhase("details");
    const details = await transport.get(DETAILS_URL);
    if (details.status < 200 || details.status >= 300) {
      return fail("STOPPED_DETAILS_HTTP", `details HTTP ${details.status}`);
    }
    const detailsHtml = Buffer.from(details.body).toString("utf8");
    const detailsKind = classifyViewstatusPageHtml(detailsHtml);
    if (detailsKind === "ICANN_ERROR_PAGE") {
      return fail("STOPPED_ICANN_ERROR_PAGE", "details page is ICANN_ERROR_PAGE", {
        icannErrorPage: true,
      });
    }
    if (detailsKind === "STATUS_GRID") {
      return fail("STOPPED_STATUS_HUB", "details response is a status-grid hub", {
        statusGridHub: true,
      });
    }

    let parsed;
    try {
      parsed = parseApplicationDetailsDownload(detailsHtml, {
        expectedApplicationId: PORTION_DIAGNOSTIC_APPLICATION_ID,
        detailsPageUrl: details.finalUrl || DETAILS_URL,
      });
    } catch (err) {
      if (err instanceof ApplicationDetailsDownloadError) {
        return fail(classifyDownloadError(err), err.message);
      }
      throw err;
    }

    const redactedHref = sanitizeUrlForPersistence(parsed.serverProvidedHref, "SAFE_DERIVED");
    const redactedPortionUrl = sanitizeUrlForPersistence(parsed.resolvedPortionUrl, "SAFE_DERIVED");
    budget.authorizePortionUrl(parsed.resolvedPortionUrl);
    budget.beginPhase("portion");
    await transport.waitBetweenRequests();
    const portion = await transport.get(parsed.resolvedPortionUrl);
    budget.seal();

    const portionHtml = Buffer.from(portion.body).toString("utf8");
    const portionKind = classifyViewstatusPageHtml(portionHtml);
    const exchange = transport.getLastExchange();
    const sessionFields = {
      detailsApplicationId: parsed.applicationId,
      serverProvidedHref: redactedHref,
      portionUrl: redactedPortionUrl,
      portionHttpStatus: portion.status,
      sessionCookieSent: exchange?.sessionCookieSent === true,
      setCookieHeaderCount: exchange?.setCookieHeaderCount ?? 0,
      sessionUpdatedDuringTransaction: exchange?.sessionUpdatedDuringTransaction === true,
    };

    if (portion.status < 200 || portion.status >= 300) {
      return fail("STOPPED_PORTION_HTTP", `public portion HTTP ${portion.status}`, sessionFields);
    }
    if (portionKind === "ICANN_ERROR_PAGE") {
      return fail("STOPPED_ICANN_ERROR_PAGE", "public portion is ICANN_ERROR_PAGE", {
        ...sessionFields,
        icannErrorPage: true,
      });
    }
    if (portionKind === "STATUS_GRID") {
      return fail("STOPPED_STATUS_HUB", "public portion response is a status-grid hub", {
        ...sessionFields,
        statusGridHub: true,
      });
    }

    const validation = validatePublicPortionDocument(portionHtml, {
      expectedApplicationId: PORTION_DIAGNOSTIC_APPLICATION_ID,
    });
    if (!validation.ok) {
      const classification =
        validation.reason === "application-id-mismatch"
          ? "STOPPED_PORTION_APPLICATION_ID"
          : "STOPPED_INCOMPLETE_Q23";
      return fail(classification, validation.reason, {
        ...sessionFields,
        q23Present: false,
      });
    }

    return {
      ...emptyReport(budget.requestCount()),
      ...sessionFields,
      classification: "PORTION_OK",
      q23Present: true,
      statusGridHub: false,
      icannErrorPage: false,
      applicationVersionBasis: validation.applicationVersionBasis,
      retrievedAt: now(),
      httpRequestCount: budget.requestCount(),
      detail: null,
    };
  } catch (err) {
    if (err instanceof NetworkTargetPolicyError) {
      return fail("STOPPED_CROSS_HOST_LINK", safeDetail(err));
    }
    if (err instanceof PortionDiagnosticHardStopError) {
      return fail("STOPPED_HARD_CAP", safeDetail(err));
    }
    return fail("STOPPED_TRANSPORT", safeDetail(err));
  }
}
