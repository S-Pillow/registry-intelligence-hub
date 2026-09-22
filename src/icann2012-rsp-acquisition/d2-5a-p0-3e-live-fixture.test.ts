import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH } from "@/historical-2012/approved-corpus-hash";
import { buildIndexPageFetchMetadata } from "./fetch-metadata-contract";
import { mappingLiveCheckpointPath } from "./mapping-checkpoint";
import {
  stagingIndexPageFetchMetadataPath,
  stagingIndexPageHtmlPath,
  stagingMappingArtifactPath,
} from "./bundle-paths";
import { assertNoSensitiveArtifactMaterial } from "./sensitive-artifact-guard";
import { runMappingDryRun } from "./mapping-dry-run";
import { parseRevealDayCsvText } from "@/normalization/parse-reveal-csv";
import { sha256Hex } from "@/normalization/hashes";
import { resolveGtldresultTapestryUrl } from "./gtldresult-url-resolver";
import {
  defaultSanitizedLiveMappingRunDir,
  sanitizedLivePageHtmlPath,
} from "./grid-evidence-paths";
import { SANITIZED_LIVE_PAGE_0001_CONTENT_SHA256 } from "./sanitized-live-fixture-constants";
import {
  enforceSanitizedLiveFixtureGate,
  loadSanitizedLiveProvenanceManifest,
  pathExists,
  requireSanitizedLiveFixturesFromEnv,
} from "./sanitized-live-fixture-gate";
import { mergeGridRowsIntoMapping, parseViewstatusGridHtml } from "./viewstatus-parser";
import {
  buildViewstatusPageDiagnostics,
  extractViewstatusPagination,
} from "./viewstatus-page-meta";
import { classifyViewstatusPageHtml } from "./viewstatus-page-classification";
import { sanitizeUrlForPersistence } from "./persisted-url-tier";
import {
  buildSyntheticReplayCorpus,
  createSyntheticReplayFetcher,
  SYNTHETIC_ROWS_PER_PAGE,
} from "./synthetic-replay-corpus";
import { runMappingLive } from "./mapping-live";
import { runMappingReview } from "./mapping-review";
import { RSP_MAPPING_LIVE_AUTH_ENV } from "./constants";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { networkPolicyForCommand } from "./command-mode";

const workspaceRoot = join(process.cwd());
const noSleep = async () => undefined;

function renderLiveTwoRowPage(input: {
  rows: Array<{ applicationId: string; gtldresultAcId: number }>;
  displayStart: number;
  displayEnd: number;
  displayTotal: number;
}): string {
  const rowHtml = input.rows
    .map(
      (row) =>
        `<tr><td><a href="/applicationstatus/viewstatus:viewapplicationdetails/${row.gtldresultAcId}">Details</a></td></tr>` +
        `<tr class="detail"><td>Application ID: <span>${row.applicationId}</span></td></tr>`,
    )
    .join("");
  return `<!DOCTYPE html><html><body>
<div>Displaying ${input.displayStart} - ${input.displayEnd} of ${input.displayTotal}</div>
<nav class="pager">
  <a class="current" href="/application-result/applicationstatus/viewstatus.statusgrid.pager/1">1</a>
  <a href="/application-result/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=SECRET">2</a>
  <a href="/application-result/applicationstatus/viewstatus.statusgrid.pager/56">56</a>
</nav>
<table>${rowHtml}</table>
<nav class="pager">
  <a class="current" href="/application-result/applicationstatus/viewstatus.statusgrid.pager/1">1</a>
  <a href="/application-result/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=SECRET">2</a>
  <a href="/application-result/applicationstatus/viewstatus.statusgrid.pager/56">56</a>
</nav>
</body></html>`;
}

describe("D2.5A-P0.3E live-fixture remediation (zero HTTP)", () => {
  it("mapping-dry-run and pilot-live command modes never open outbound HTTP", () => {
    expect(networkPolicyForCommand("mapping-dry-run").allowsOutboundHttp).toBe(false);
    expect(networkPolicyForCommand("pilot").allowsOutboundHttp).toBe(false);
  });

  it("pairs summary + detail tr rows (58570→1001)", () => {
    const html = renderLiveTwoRowPage({
      rows: [
        { applicationId: "1-1311-58570", gtldresultAcId: 1001 },
        { applicationId: "1-1318-83013", gtldresultAcId: 922 },
        { applicationId: "1-1926-49360", gtldresultAcId: 189 },
      ],
      displayStart: 1,
      displayEnd: 3,
      displayTotal: 1930,
    });
    const { rows, quarantinedBlocks } = parseViewstatusGridHtml(html);
    expect(quarantinedBlocks).toHaveLength(0);
    const map = mergeGridRowsIntoMapping(rows);
    expect(map.get("1-1311-58570")).toBe(1001);
    expect(map.get("1-1318-83013")).toBe(922);
    expect(map.get("1-1926-49360")).toBe(189);
  });

  it("selects active-page+1 pager href (pager/2 not pager/56)", () => {
    const html = renderLiveTwoRowPage({
      rows: [{ applicationId: "1-1311-58570", gtldresultAcId: 1001 }],
      displayStart: 1,
      displayEnd: 1,
      displayTotal: 1930,
    });
    const pagination = extractViewstatusPagination(html);
    expect(pagination.paginationControlDrift).toBe(false);
    expect(pagination.nextPageHref).toContain("pager/2");
    expect(pagination.nextPageHref).not.toContain("pager/56");
  });

  it("resolves /applicationstatus paths under /application-result mount", () => {
    const context =
      "https://gtldresult.icann.org/application-result/applicationstatus/viewstatus/";
    const resolved = resolveGtldresultTapestryUrl(
      context,
      "/applicationstatus/viewstatus.statusgrid.pager/2",
    );
    expect(resolved).toBe(
      "https://gtldresult.icann.org/application-result/applicationstatus/viewstatus.statusgrid.pager/2",
    );
  });

  it("redacts _csrf only in SAFE_DERIVED URLs", () => {
    const raw =
      "/application-result/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=abc123";
    expect(sanitizeUrlForPersistence(raw, "RESTRICTED_RAW_SOURCE")).toBe(raw);
    expect(sanitizeUrlForPersistence(raw, "SAFE_DERIVED")).toBe(
      "/application-result/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=REDACTED",
    );
  });

  it("classifies ICANN Error page and rejects as grid", () => {
    const html = `<html><head><title>ICANN Error</title></head><body>ICANN Error page</body></html>`;
    expect(classifyViewstatusPageHtml(html)).toBe("ICANN_ERROR_PAGE");
  });

  it("replays 1930-application synthetic round with 35 rows per page", async () => {
    const csv = await readFile(
      join(
        workspaceRoot,
        "src/normalization/fixtures/icann2012-reveal-day-v1/sources/strings-1200utc-13jun12-en.csv",
      ),
      "utf8",
    );
    const applicationIds = parseRevealDayCsvText(csv).map((r) => r.applicationId);
    expect(applicationIds).toHaveLength(1930);
    const corpus = buildSyntheticReplayCorpus({
      applicationIds,
      rowsPerPage: SYNTHETIC_ROWS_PER_PAGE,
    });
    const staging = await mkdtemp(join(tmpdir(), "rsp-p03e-replay-"));
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";
    try {
      const live = await runMappingLive(
        {
          workspaceRoot,
          stagingRoot: staging,
          runId: "replay-1930",
          forceNewRun: true,
          sleep: noSleep,
        },
        createSyntheticReplayFetcher(corpus),
      );
      expect(live.reconciliation.exact).toBe(true);
      expect(live.reconciliation.expectedCount).toBe(1930);
      const review = await runMappingReview({ workspaceRoot, runDir: staging });
      expect(review.roundWideExact).toBe(true);
      expect(review.failureClassification).toBe("EXACT_COMPLETE");
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("uses artifact-only pilotResolvedCount for simulated P0.3C empty artifact (0/25)", async () => {
    const staging = await mkdtemp(join(tmpdir(), "rsp-p03c-empty-"));
    const runId = "mapping-20260922-vps-01";
    try {
      const html = renderLiveTwoRowPage({
        rows: [{ applicationId: "1-1311-58570", gtldresultAcId: 1001 }],
        displayStart: 1,
        displayEnd: 1,
        displayTotal: 1930,
      });
      const htmlBytes = Buffer.from(html, "utf8");
      const contentSha256 = sha256Hex(htmlBytes);
      await mkdir(stagingIndexPageHtmlPath(staging, runId, 1).replace(/page-0001\.html$/, ""), {
        recursive: true,
      });
      await writeFile(stagingIndexPageHtmlPath(staging, runId, 1), htmlBytes);
      const metadata = buildIndexPageFetchMetadata({
        pageOrdinal: 1,
        resolvedUrl:
          "https://gtldresult.icann.org/application-result/applicationstatus/viewstatus/?_csrf=LIVE",
        httpStatus: 200,
        contentLength: htmlBytes.byteLength,
        contentSha256,
        retrievedAt: new Date().toISOString(),
        runId,
        displayStart: 1,
        displayEnd: 1,
        displayTotal: 1930,
        parsedRowCount: 0,
        quarantinedBlockCount: 0,
        nextPageHref:
          "/application-result/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=LIVE",
      });
      await writeFile(
        stagingIndexPageFetchMetadataPath(staging, runId, 1),
        `${JSON.stringify(metadata, null, 2)}\n`,
      );
      await writeFile(
        mappingLiveCheckpointPath(staging),
        `${JSON.stringify(
          {
            checkpointVersion: "icann2012-rsp-mapping-live-checkpoint/1.0.0",
            runId,
            corpusContentHash: APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH,
            state: "failed",
            stopReason: "pagination ended before exact reconciliation",
            lastCompletedPageOrdinal: 1,
            pages: [
              {
                pageOrdinal: 1,
                snapshotId: "snap-test-p1",
                contentSha256,
                resolvedUrl: metadata.resolvedUrl,
                diagnostics: {
                  displayStart: 1,
                  displayEnd: 1,
                  displayTotal: 1930,
                  parsedRowCount: 0,
                  quarantinedBlockCount: 0,
                  nextPageHref: metadata.nextPageHref,
                },
              },
            ],
            mappings: {},
            applicationPageOrdinal: {},
          },
          null,
          2,
        )}\n`,
      );
      await mkdir(join(staging, "registry-2012-rsp-mapping", runId), { recursive: true });
      await writeFile(
        stagingMappingArtifactPath(staging, runId),
        `${JSON.stringify(
          {
            mappingVersion: "registry-2012-rsp-mapping/1.0.0",
            artifactPurpose: "EVIDENCE",
            approvalState: "DRAFT",
            bundleId: "icann2012-rsp-public-portions-v1",
            scope: "ROUND_WIDE_EXACT",
            entries: [],
          },
          null,
          2,
        )}\n`,
      );

      const report = await runMappingReview({ workspaceRoot, runDir: staging });
      expect(report.pilotResolvedCount).toBe(0);
      expect(report.pilotExpectedCount).toBe(25);
      expect(report.pilotOnlyExactCandidate).toBe(false);
      expect(report.pilotValidationHintsPresent).toBe(true);
      expect(report.pageSnapshotCount).toBe(1);
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("persists _csrf=REDACTED in SAFE_DERIVED fetch metadata only", () => {
    const metadata = buildIndexPageFetchMetadata({
      pageOrdinal: 1,
      resolvedUrl:
        "https://gtldresult.icann.org/application-result/applicationstatus/viewstatus/?_csrf=SECRET",
      httpStatus: 200,
      contentLength: 10,
      contentSha256: "a".repeat(64),
      retrievedAt: new Date().toISOString(),
      runId: "test",
      parsedRowCount: 0,
      quarantinedBlockCount: 0,
      nextPageHref: "/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=SECRET",
    });
    expect(metadata.resolvedUrl).toContain("_csrf=SECRET");
    expect(metadata.resolvedUrlSafe).toContain("_csrf=REDACTED");
    expect(metadata.nextPageHrefSafe).toContain("_csrf=REDACTED");
    assertNoSensitiveArtifactMaterial(JSON.stringify(metadata), "page-0001.fetch.json");
  });

  it("mapping-dry-run performs zero HTTP", async () => {
    expect(networkPolicyForCommand("mapping-dry-run").allowsOutboundHttp).toBe(false);
    const result = await runMappingDryRun({ workspaceRoot });
    expect(result.gridRowsParsed).toBe(0);
  });

  it("classifies sanitized-live page-0002 as ICANN error when present", async () => {
    const fixturePath = sanitizedLivePageHtmlPath(workspaceRoot, 2);
    if (!(await pathExists(fixturePath))) {
      const offline = `<html><head><title>ICANN Error</title></head><body><h1>ICANN Error</h1></body></html>`;
      expect(classifyViewstatusPageHtml(offline)).toBe("ICANN_ERROR_PAGE");
      return;
    }
    const manifest = await loadSanitizedLiveProvenanceManifest(workspaceRoot);
    const pin = manifest.pages.find((p) => p.pageOrdinal === 2);
    const html = await readFile(fixturePath, "utf8");
    if (pin) {
      expect(sha256Hex(Buffer.from(html, "utf8"))).toBe(pin.contentSha256);
    }
    expect(classifyViewstatusPageHtml(html)).toBe("ICANN_ERROR_PAGE");
  });

  it("parses committed sanitized-live page-0001 (primary regression)", async () => {
    const requireFixtures = requireSanitizedLiveFixturesFromEnv();
    let gateResult: Awaited<ReturnType<typeof enforceSanitizedLiveFixtureGate>> = null;
    try {
      gateResult = await enforceSanitizedLiveFixtureGate(workspaceRoot, { requireFixtures });
    } catch (error) {
      if (requireFixtures) throw error;
      return;
    }
    if (!gateResult) {
      return;
    }
    const fixturePath = sanitizedLivePageHtmlPath(workspaceRoot, 1);
    const html = await readFile(fixturePath, "utf8");
    expect(sha256Hex(Buffer.from(html, "utf8"))).toBe(SANITIZED_LIVE_PAGE_0001_CONTENT_SHA256);
    const { rows, quarantinedBlocks } = parseViewstatusGridHtml(html);
    expect(quarantinedBlocks).toHaveLength(0);
    expect(rows).toHaveLength(35);
    const diagnostics = buildViewstatusPageDiagnostics(html, rows.length, 0);
    expect(diagnostics.displayStart).toBe(1);
    expect(diagnostics.displayEnd).toBe(35);
    expect(diagnostics.displayTotal).toBe(1930);
    const map = mergeGridRowsIntoMapping(rows);
    expect(map.get("1-1311-58570")).toBe(1001);
    expect(map.get("1-1318-83013")).toBe(922);
    expect(map.get("1-1926-49360")).toBe(189);
    expect(defaultSanitizedLiveMappingRunDir(workspaceRoot)).toContain("mapping-20260922-vps-01");
  });
});
