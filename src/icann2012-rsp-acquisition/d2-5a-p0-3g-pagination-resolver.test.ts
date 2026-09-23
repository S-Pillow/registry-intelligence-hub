import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "@/normalization/hashes";
import { stagingIndexPageFetchMetadataPath, stagingIndexPageHtmlPath } from "./bundle-paths";
import { GTLDRESULT_PATHS, RSP_MAPPING_LIVE_AUTH_ENV } from "./constants";
import { sanitizedLiveFixtureManifestPath } from "./sanitized-live-fixture-gate";
import {
  SANITIZED_LIVE_FIXTURE_MANIFEST_FILE_BODY_SHA256,
  SANITIZED_LIVE_PAGE_0001_SANITIZED_SHA256,
  SANITIZED_LIVE_PAGE_0002_SANITIZED_SHA256,
} from "./sanitized-live-fixture-constants";
import { sanitizedLivePageHtmlPath } from "./grid-evidence-paths";
import { resolveGtldresultTapestryUrl } from "./gtldresult-url-resolver";
import { NetworkTargetPolicyError } from "./network-target-policy";
import { readMappingLiveCheckpoint, mappingLiveCheckpointPath } from "./mapping-checkpoint";
import { runMappingLive } from "./mapping-live";
import {
  MAPPING_REVIEW_FAILURE_CLASSIFICATIONS,
  RSP_MAPPING_DIAGNOSTIC_CODE_DEFECTS,
} from "./mapping-review-failure-classification";
import { loadRevealDayApplicationIds } from "./canonical-reconciliation";
import {
  buildSyntheticReplayCorpus,
  createSyntheticReplayFetcher,
  SYNTHETIC_REPLAY_CORPUS_MARKER,
} from "./synthetic-replay-corpus";
import { absoluteGtldresultUrl } from "./urls";
import { classifyViewstatusPageHtml } from "./viewstatus-page-classification";
import {
  assertPaginationAdvance,
  buildViewstatusPageDiagnostics,
  createPaginationSafetyState,
  extractViewstatusPagination,
  type ViewstatusPaginationExtraction,
} from "./viewstatus-page-meta";

const workspaceRoot = join(process.cwd());
const noSleep = async () => undefined;
const GRID_CONTEXT = absoluteGtldresultUrl(GTLDRESULT_PATHS.viewStatusGrid);

function pagerRegion(links: string): string {
  return `<ul class="pagination">${links}</ul>`;
}

function activePage(label: number): string {
  return `<li class="active" aria-current="page"><a aria-disabled="true" href="#">${label}</a></li>`;
}

function pageLink(label: number, href: string): string {
  return `<li><a title="Go to page ${label}" href="${href}">${label}</a></li>`;
}

describe("D2.5A-P0.3G pagination resolver (offline)", () => {
  it("canonical page 1 current page is 1 and next logical page is 2, never 56", async () => {
    const html = await readFile(sanitizedLivePageHtmlPath(workspaceRoot, 1), "utf8");
    const pagination = extractViewstatusPagination(html);
    expect(pagination.paginationControlDrift).toBe(false);
    expect(pagination.currentPage).toBe(1);
    expect(pagination.nextLogicalPage).toBe(2);
    expect(pagination.nextPageHref).toBe(
      "/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=REDACTED",
    );
    expect(pagination.nextPageHref).not.toContain("pager/56");

    const diagnostics = buildViewstatusPageDiagnostics(html, 35, 0, GRID_CONTEXT);
    expect(diagnostics.serverProvidedHref).toBe(
      "/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=REDACTED",
    );
    expect(diagnostics.effectiveRequestUrl).toBe(
      "https://gtldresult.icann.org/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=REDACTED",
    );
    expect(diagnostics.effectiveRequestUrl).not.toContain("/application-result/");
  });

  it("follows the adjacent logical page href when the tapestry segment differs", () => {
    const html = `<div>Displaying 1 - 35 of 1930</div>${pagerRegion(
      [
        activePage(1),
        pageLink(2, "/applicationstatus/viewstatus.statusgrid.pager/17?_csrf=REDACTED"),
        pageLink(56, "/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=REDACTED"),
      ].join(""),
    )}`;
    const pagination = extractViewstatusPagination(html);
    expect(pagination.paginationControlDrift).toBe(false);
    expect(pagination.currentPage).toBe(1);
    expect(pagination.nextLogicalPage).toBe(2);
    expect(pagination.nextPageHref).toContain("pager/17");
    expect(pagination.nextPageHref).not.toContain("pager/2");
    expect(pagination.nextPageHref).not.toContain("pager/56");
  });

  it("fails closed when the current page cannot be established", () => {
    const html = pagerRegion(
      [
        `<li><a href="#">1</a></li>`,
        pageLink(2, "/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=REDACTED"),
        pageLink(56, "/applicationstatus/viewstatus.statusgrid.pager/56?_csrf=REDACTED"),
      ].join(""),
    );
    const pagination = extractViewstatusPagination(html);
    expect(pagination.paginationControlDrift).toBe(true);
    expect(pagination.nextPageHref).toBeNull();
    expect(pagination.paginationDriftDetail).toMatch(/current page cannot be established/);
  });

  it("treats agreeing duplicate controls as one next href after csrf redaction", () => {
    const top = pagerRegion(
      [
        activePage(1),
        pageLink(2, "/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=AAA"),
        pageLink(56, "/applicationstatus/viewstatus.statusgrid.pager/56?_csrf=AAA"),
      ].join(""),
    );
    const bottom = pagerRegion(
      [
        activePage(1),
        pageLink(2, "/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=BBB"),
        pageLink(56, "/applicationstatus/viewstatus.statusgrid.pager/56?_csrf=BBB"),
      ].join(""),
    );
    const pagination = extractViewstatusPagination(`${top}<table></table>${bottom}`);
    expect(pagination.paginationControlDrift).toBe(false);
    expect(pagination.nextLogicalPage).toBe(2);
    expect(pagination.nextPageHref).toContain("pager/2");
    expect(pagination.nextPageHref).not.toContain("pager/56");
  });

  it("fails closed when duplicate controls disagree on the page 2 href", () => {
    const top = pagerRegion(
      [activePage(1), pageLink(2, "/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=REDACTED")].join(
        "",
      ),
    );
    const bottom = pagerRegion(
      [
        activePage(1),
        pageLink(2, "/applicationstatus/viewstatus.statusgrid.pager/56?_csrf=REDACTED"),
      ].join(""),
    );
    const pagination: ViewstatusPaginationExtraction = extractViewstatusPagination(
      `${top}<table></table>${bottom}`,
    );
    expect(pagination.paginationControlDrift).toBe(true);
    expect(pagination.nextPageHref).toBeNull();
    expect(pagination.paginationDriftDetail).toMatch(/disagree/);
  });

  it("fails closed when one control lists conflicting hrefs for the adjacent page", () => {
    const html = pagerRegion(
      [
        activePage(1),
        pageLink(2, "/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=REDACTED"),
        pageLink(2, "/applicationstatus/viewstatus.statusgrid.pager/9?_csrf=REDACTED"),
      ].join(""),
    );
    const pagination = extractViewstatusPagination(html);
    expect(pagination.paginationControlDrift).toBe(true);
    expect(pagination.nextPageHref).toBeNull();
  });

  it("keeps status-grid pager links on the server /applicationstatus path", () => {
    const resolved = resolveGtldresultTapestryUrl(
      GRID_CONTEXT,
      "/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=SECRET",
    );
    expect(resolved).toBe(
      "https://gtldresult.icann.org/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=SECRET",
    );
    expect(resolved).not.toContain("/application-result/");
  });

  it("does not rewrite unrelated root-relative links", () => {
    const asset = resolveGtldresultTapestryUrl(
      GRID_CONTEXT,
      "/assets/meta/7b8cb600/images/icon-export.png",
    );
    expect(asset).toBe("https://gtldresult.icann.org/assets/meta/7b8cb600/images/icon-export.png");
    expect(asset).not.toContain("/application-result/assets");

    const form = resolveGtldresultTapestryUrl(
      GRID_CONTEXT,
      "/applicationstatus/viewstatus.applicationstatusform",
    );
    expect(form).toBe(
      "https://gtldresult.icann.org/applicationstatus/viewstatus.applicationstatusform",
    );
    expect(form).not.toContain("/application-result/applicationstatus/viewstatus.applicationstatusform");
  });

  it("rejects cross-host links", () => {
    expect(() =>
      resolveGtldresultTapestryUrl(
        GRID_CONTEXT,
        "https://evil.example/applicationstatus/viewstatus.statusgrid.pager/2",
      ),
    ).toThrow(NetworkTargetPolicyError);
    expect(() =>
      resolveGtldresultTapestryUrl(GRID_CONTEXT, "http://gtldresult.icann.org/applicationstatus/viewstatus.statusgrid.pager/2"),
    ).toThrow(NetworkTargetPolicyError);
  });

  it("redacts sensitive query values on persisted server and effective URLs", () => {
    const html = `<div>Displaying 1 - 35 of 1930</div>${pagerRegion(
      [activePage(1), pageLink(2, "/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=SECRET")].join(
        "",
      ),
    )}`;
    const diagnostics = buildViewstatusPageDiagnostics(html, 35, 0, GRID_CONTEXT);
    expect(diagnostics.serverProvidedHref).toBe(
      "/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=REDACTED",
    );
    expect(diagnostics.effectiveRequestUrl).toBe(
      "https://gtldresult.icann.org/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=REDACTED",
    );
    expect(diagnostics.effectiveRequestUrl).not.toContain("/application-result/");
    expect(diagnostics.effectiveRequestUrl).toContain("_csrf=REDACTED");
    expect(diagnostics.effectiveRequestUrl).not.toContain("SECRET");
    expect(diagnostics.nextPageHref).toContain("_csrf=SECRET");
  });

  it("keeps canonical page 2 classified as ICANN_ERROR_PAGE", async () => {
    const html = await readFile(sanitizedLivePageHtmlPath(workspaceRoot, 2), "utf8");
    expect(classifyViewstatusPageHtml(html)).toBe("ICANN_ERROR_PAGE");
    const pagination = extractViewstatusPagination(html);
    expect(pagination.nextPageHref).toBeNull();
  });

  it("records resolver defects in diagnostic vocabulary without extending the run failure enum", () => {
    expect(RSP_MAPPING_DIAGNOSTIC_CODE_DEFECTS).toEqual([
      "REQUEST_PATH_RESOLUTION_DEFECT",
      "NEXT_PAGE_SELECTION_DEFECT",
    ]);
    for (const code of RSP_MAPPING_DIAGNOSTIC_CODE_DEFECTS) {
      expect(MAPPING_REVIEW_FAILURE_CLASSIFICATIONS).not.toContain(code);
    }
  });

  it("keeps sanitized fixture hashes unchanged", async () => {
    const page1 = await readFile(sanitizedLivePageHtmlPath(workspaceRoot, 1));
    const page2 = await readFile(sanitizedLivePageHtmlPath(workspaceRoot, 2));
    const manifest = await readFile(sanitizedLiveFixtureManifestPath(workspaceRoot));
    expect(sha256Hex(page1)).toBe(SANITIZED_LIVE_PAGE_0001_SANITIZED_SHA256);
    expect(sha256Hex(page1)).toBe(
      "c49a1d1c28c1396d78e8ce23a631a809e8bb4a01588e97aadf4ad581b0d9d95f",
    );
    expect(sha256Hex(page2)).toBe(SANITIZED_LIVE_PAGE_0002_SANITIZED_SHA256);
    expect(sha256Hex(page2)).toBe(
      "918be5343f7b7f8f6a44df28cf176f7c06ff9a3396f3a26650c866e248855485",
    );
    expect(sha256Hex(manifest)).toBe(SANITIZED_LIVE_FIXTURE_MANIFEST_FILE_BODY_SHA256);
    expect(sha256Hex(manifest)).toBe(
      "8c964d2ca13952bf22bfc64da71fbe4fef1a3b0ded66a2aab65ef32b37bc4453",
    );
  });

  it("keeps pagination loop, gap, and overlap protection", () => {
    const state = createPaginationSafetyState();
    const page = (start: number, end: number) => ({
      displayStart: start,
      displayEnd: end,
      displayTotal: 1930,
      parsedRowCount: end - start + 1,
      quarantinedBlockCount: 0,
      nextPageHref: null,
      paginationControlDrift: false,
    });
    assertPaginationAdvance(state, "https://gtldresult.icann.org/p/1", "a".repeat(64), page(1, 35), 1, 60);
    expect(() =>
      assertPaginationAdvance(state, "https://gtldresult.icann.org/p/1", "b".repeat(64), page(36, 70), 2, 60),
    ).toThrow(/Pagination loop/);

    const overlap = createPaginationSafetyState();
    assertPaginationAdvance(overlap, "https://gtldresult.icann.org/p/1", "a".repeat(64), page(1, 35), 1, 60);
    expect(() =>
      assertPaginationAdvance(overlap, "https://gtldresult.icann.org/p/2", "b".repeat(64), page(30, 40), 2, 60),
    ).toThrow(/Non-advancing display range/);

    const gap = createPaginationSafetyState();
    assertPaginationAdvance(gap, "https://gtldresult.icann.org/p/1", "a".repeat(64), page(1, 35), 1, 60);
    expect(() =>
      assertPaginationAdvance(gap, "https://gtldresult.icann.org/p/2", "c".repeat(64), page(40, 70), 2, 60),
    ).toThrow(/Display range gap/);
  });

  it("stops a synthetic overlap crawl before accepting a non-advancing range", async () => {
    const ids = (await loadRevealDayApplicationIds(workspaceRoot)).slice(0, 140);
    const corpus = buildSyntheticReplayCorpus({
      applicationIds: ids,
      overlappingRangeOnPage4: true,
    });
    const staging = await mkdtemp(join(tmpdir(), "rsp-p03g-overlap-"));
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";
    try {
      const live = await runMappingLive(
        {
          workspaceRoot,
          stagingRoot: staging,
          runId: "overlap-resolver",
          forceNewRun: true,
          sleep: noSleep,
        },
        createSyntheticReplayFetcher(corpus),
      );
      expect(live.stoppedEarly).toBe(true);
      expect(live.stopReason).toMatch(/Non-advancing display range/);
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("advances canonical page 1 onto a TEST_ONLY valid page 2 at the server pager/2 URL", async () => {
    const page1Html = await readFile(sanitizedLivePageHtmlPath(workspaceRoot, 1), "utf8");
    const pagination = extractViewstatusPagination(page1Html);
    expect(pagination.nextLogicalPage).toBe(2);
    expect(pagination.nextPageHref).toBe(
      "/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=REDACTED",
    );
    const nextUrl = resolveGtldresultTapestryUrl(GRID_CONTEXT, pagination.nextPageHref!);
    expect(nextUrl).toBe(
      "https://gtldresult.icann.org/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=REDACTED",
    );
    expect(nextUrl).not.toContain("/application-result/");

    const syntheticPage2 = `<!DOCTYPE html><html><body>
<!-- ${SYNTHETIC_REPLAY_CORPUS_MARKER} -->
<p>TEST_ONLY corrected page 2 continuation. Not a captured ICANN response.</p>
<div>Displaying 36 - 36 of 1930</div>
<ul class="pagination"><li class="active" aria-current="page"><a href="#">2</a></li></ul>
<table>
<tr><td><a href="/applicationstatus/viewstatus:viewapplicationdetails/900002">Details</a></td></tr>
<tr class="detail"><td>Application ID: <span>1-9999-00002</span></td></tr>
</table>
<ul class="pagination"><li class="active" aria-current="page"><a href="#">2</a></li></ul>
</body></html>`;
    expect(classifyViewstatusPageHtml(syntheticPage2)).toBe("STATUS_GRID");
    expect(syntheticPage2).toContain("TEST_ONLY");

    const statusHubUrl = absoluteGtldresultUrl(GTLDRESULT_PATHS.statusHub);
    const requested: string[] = [];
    const fetcher = async (url: string) => {
      requested.push(url);
      const headers: Record<string, string> = { "Content-Type": "text/html; charset=UTF-8" };
      if (url === statusHubUrl) {
        headers["set-cookie"] = "SESSION=advance-replay; Path=/; HttpOnly";
      }
      const body =
        url === statusHubUrl
          ? "<html><body>hub</body></html>"
          : url === GRID_CONTEXT
            ? page1Html
            : url === nextUrl
              ? syntheticPage2
              : null;
      if (body == null) {
        return {
          status: 404,
          body: Buffer.from("missing"),
          headers: { "Content-Type": "text/plain" },
          finalUrl: url,
        };
      }
      return {
        status: 200,
        body: Buffer.from(body, "utf8"),
        headers,
        finalUrl: url,
      };
    };

    const staging = await mkdtemp(join(tmpdir(), "rsp-p03g-corrected-"));
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";
    const runId = "corrected-page2";
    try {
      const live = await runMappingLive(
        {
          workspaceRoot,
          stagingRoot: staging,
          runId,
          forceNewRun: true,
          sleep: noSleep,
        },
        fetcher,
      );
      expect(live.pagesFetched).toBe(2);
      expect(live.stoppedEarly).toBe(true);
      expect(live.stopReason).toMatch(/pagination ended/);
      expect(requested).toContain(nextUrl);
      expect(requested.some((url) => url.includes("pager/56"))).toBe(false);
      expect(
        requested.some(
          (url) =>
            url.includes("/applicationstatus/viewstatus.statusgrid.pager/2") &&
            !url.includes("/application-result/"),
        ),
      ).toBe(true);

      const checkpoint = await readMappingLiveCheckpoint(mappingLiveCheckpointPath(staging));
      expect(JSON.stringify(checkpoint)).not.toContain("advance-replay");
      const page2 = checkpoint?.pages.find((page) => page.pageOrdinal === 2);
      expect(page2?.diagnostics.pageKind).toBe("STATUS_GRID");
      expect(page2?.diagnostics.displayStart).toBe(36);
      expect(checkpoint?.mappings["1-9999-00002"]).toBe(900002);
      const page1 = checkpoint?.pages.find((page) => page.pageOrdinal === 1);
      expect(page1?.diagnostics.serverProvidedHref).toBe(
        "/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=REDACTED",
      );
      expect(page1?.diagnostics.effectiveRequestUrl).toBe(nextUrl);

      const metadata = JSON.parse(
        await readFile(stagingIndexPageFetchMetadataPath(staging, runId, 1), "utf8"),
      ) as { serverProvidedHref?: string; effectiveRequestUrl?: string };
      expect(metadata.serverProvidedHref).toContain("pager/2");
      expect(metadata.serverProvidedHref).toContain("_csrf=REDACTED");
      expect(metadata.effectiveRequestUrl).toBe(nextUrl);
      expect(metadata.effectiveRequestUrl).not.toContain("/application-result/");
      expect(metadata.effectiveRequestUrl).not.toContain("SECRET");

      const storedPage2 = await readFile(stagingIndexPageHtmlPath(staging, runId, 2), "utf8");
      expect(storedPage2).toContain(SYNTHETIC_REPLAY_CORPUS_MARKER);
      expect(classifyViewstatusPageHtml(storedPage2)).toBe("STATUS_GRID");
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });
});
