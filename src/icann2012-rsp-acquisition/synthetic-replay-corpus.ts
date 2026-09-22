import { GTLDRESULT_PATHS } from "./constants";
import { MappingLiveOperatorCancellation } from "./mapping-live-operator-cancellation";
import { absoluteGtldresultUrl } from "./urls";

export const REGRESSION_MAPPING_LEADS = {
  BOSCH: { applicationId: "1-1945-29108", gtldresultAcId: 170 },
  HOTELS: { applicationId: "1-1016-75482", gtldresultAcId: 1589 },
  ABBOTT: { applicationId: "1-1765-99580", gtldresultAcId: 383 },
  DOCS: { applicationId: "1-1129-14280", gtldresultAcId: 1360 },
} as const;

export const SYNTHETIC_ROWS_PER_PAGE = 35 as const;

export interface SyntheticReplayOptions {
  applicationIds: readonly string[];
  rowsPerPage?: number;
  /** When set, final page repeats page-1 body to trigger hash loop detection. */
  loopOnLastPage?: boolean;
  /** Inject ambiguous row (missing ac) on page 2. */
  ambiguousRowOnPage2?: boolean;
  /** Page 3 next link points back to page 2 URL. */
  paginationUrlLoop?: boolean;
  /** Page 4 display range overlaps prior page. */
  overlappingRangeOnPage4?: boolean;
}

export interface SyntheticReplayCorpus {
  pagesByUrl: Map<string, string>;
  statusHubUrl: string;
  gridEntryUrl: string;
  expectedAcIdByApplicationId: Map<string, number>;
}

function regressionAcId(applicationId: string, fallback: number): number {
  for (const lead of Object.values(REGRESSION_MAPPING_LEADS)) {
    if (lead.applicationId === applicationId) return lead.gtldresultAcId;
  }
  return fallback;
}

function renderGridPageHtml(input: {
  rows: Array<{ applicationId: string; gtldresultAcId: number }>;
  displayStart: number;
  displayEnd: number;
  displayTotal: number;
  nextHref: string | null;
  extraRowHtml?: string;
}): string {
  const rowHtml = input.rows
    .map(
      (r) =>
        `<tr data-gtldresult-ac-id="${r.gtldresultAcId}" data-tas-application-id="${r.applicationId}">` +
        `<a href="/applicationstatus/viewstatus:viewapplicationdetails/${r.gtldresultAcId}">Details</a></tr>`,
    )
    .join("\n");
  const nextLink = input.nextHref
    ? `<a class="pager-next" href="${input.nextHref}">Next</a>`
    : "";
  return `<!DOCTYPE html><html><body>
<div class="grid-footer">Displaying ${input.displayStart} - ${input.displayEnd} of ${input.displayTotal}</div>
<table>${rowHtml}${input.extraRowHtml ?? ""}</table>
${nextLink}
</body></html>`;
}

export function buildSyntheticReplayCorpus(options: SyntheticReplayOptions): SyntheticReplayCorpus {
  const rowsPerPage = options.rowsPerPage ?? SYNTHETIC_ROWS_PER_PAGE;
  const ids = [...options.applicationIds];
  const expectedAcIdByApplicationId = new Map<string, number>();
  ids.forEach((applicationId, index) => {
    expectedAcIdByApplicationId.set(applicationId, regressionAcId(applicationId, 10_000 + index));
  });

  const pagesByUrl = new Map<string, string>();
  const statusHubUrl = absoluteGtldresultUrl(GTLDRESULT_PATHS.statusHub);
  const gridEntryUrl = absoluteGtldresultUrl(GTLDRESULT_PATHS.viewStatusGrid);

  pagesByUrl.set(
    statusHubUrl,
    `<html><body>status hub</body></html>`,
  );

  const pageUrls: string[] = [];
  const totalPages = Math.ceil(ids.length / rowsPerPage);

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    const pageNumber = pageIndex + 1;
    const startIdx = pageIndex * rowsPerPage;
    const slice = ids.slice(startIdx, startIdx + rowsPerPage);
    const displayStart = startIdx + 1;
    const displayEnd = startIdx + slice.length;
    const nextPageNumber = pageNumber + 1;
    let nextHref: string | null =
      pageNumber < totalPages
        ? GTLDRESULT_PATHS.gridPager(nextPageNumber)
        : null;

    if (options.paginationUrlLoop && pageNumber === 3) {
      nextHref = GTLDRESULT_PATHS.gridPager(2);
    }

    let extraRowHtml: string | undefined;
    if (options.ambiguousRowOnPage2 && pageNumber === 2) {
      extraRowHtml = `<tr data-tas-application-id="1-9999-99999"><td>missing ac</td></tr>`;
    }

    let displayStartAdj = displayStart;
    const displayEndAdj = displayEnd;
    if (options.overlappingRangeOnPage4 && pageNumber === 4) {
      displayStartAdj = displayStart - 5;
    }

    const html = renderGridPageHtml({
      rows: slice.map((applicationId) => ({
        applicationId,
        gtldresultAcId: expectedAcIdByApplicationId.get(applicationId)!,
      })),
      displayStart: displayStartAdj,
      displayEnd: displayEndAdj,
      displayTotal: ids.length,
      nextHref,
      extraRowHtml,
    });

    const pageUrl =
      pageNumber === 1
        ? gridEntryUrl
        : absoluteGtldresultUrl(GTLDRESULT_PATHS.gridPager(pageNumber));
    pageUrls.push(pageUrl);
    pagesByUrl.set(pageUrl, html);
  }

  if (options.loopOnLastPage && pageUrls.length >= 2) {
    const lastUrl = pageUrls[pageUrls.length - 1]!;
    const firstBody = pagesByUrl.get(pageUrls[0]!)!;
    pagesByUrl.set(lastUrl, firstBody);
  }

  return {
    pagesByUrl,
    statusHubUrl,
    gridEntryUrl,
    expectedAcIdByApplicationId,
  };
}

export function createSyntheticReplayFetcher(
  corpus: SyntheticReplayCorpus,
  options?: {
    statusHubSetCookie?: boolean;
    crossHostRedirectFrom?: string;
    /** Return this HTTP status instead of corpus body (403/429 rehearsal). */
    httpStatusForUrl?: Record<string, number>;
    /** After this many successful (2xx) responses, throw (operator abort rehearsal). */
    abortAfterSuccessfulResponses?: number;
    abortError?: Error;
  },
): (url: string) => Promise<{
  status: number;
  body: Uint8Array;
  headers: Record<string, string>;
  finalUrl: string;
}> {
  let successfulResponses = 0;

  return async (url: string) => {
    if (options?.crossHostRedirectFrom && url === options.crossHostRedirectFrom) {
      return {
        status: 302,
        body: new Uint8Array(),
        headers: { location: "https://other.icann.org/evil" },
        finalUrl: url,
      };
    }

    const forcedStatus = options?.httpStatusForUrl?.[url];
    if (forcedStatus != null) {
      return {
        status: forcedStatus,
        body: Buffer.from(`synthetic HTTP ${forcedStatus}`),
        headers: { "Content-Type": "text/plain" },
        finalUrl: url,
      };
    }

    const html = corpus.pagesByUrl.get(url);
    const headers: Record<string, string> = { "Content-Type": "text/html; charset=UTF-8" };
    if (url === corpus.statusHubUrl && options?.statusHubSetCookie !== false) {
      headers["set-cookie"] = "JSESSIONID=synthetic-test-session; Path=/; HttpOnly";
    }
    if (html != null) {
      successfulResponses += 1;
      if (
        options?.abortAfterSuccessfulResponses != null &&
        successfulResponses > options.abortAfterSuccessfulResponses
      ) {
        throw options.abortError ?? new MappingLiveOperatorCancellation();
      }
      return {
        status: 200,
        body: Buffer.from(html, "utf8"),
        headers,
        finalUrl: url,
      };
    }
    return {
      status: 404,
      body: Buffer.from("not found"),
      headers,
      finalUrl: url,
    };
  };
}

/** TEST_ONLY — never production evidence. */
export const SYNTHETIC_REPLAY_CORPUS_MARKER = "SYNTHETIC_REPLAY_CORPUS_TEST_ONLY" as const;
