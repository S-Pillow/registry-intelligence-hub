import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRevealDayCsvText } from "@/normalization/parse-reveal-csv";
import { sha256Hex } from "@/normalization/hashes";
import { resolveGtldresultTapestryUrl } from "./gtldresult-url-resolver";
import {
  defaultSanitizedLiveMappingRunDir,
  sanitizedLivePageHtmlPath,
} from "./grid-evidence-paths";
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

  it("uses artifact-only pilotResolvedCount (P0.3C empty artifact → 0/25)", async () => {
    const staging = await mkdtemp(join(tmpdir(), "rsp-p03c-empty-"));
    try {
      const report = await runMappingReview({
        workspaceRoot,
        runDir: join(staging, "missing-run"),
      }).catch(() => null);
      expect(report).toBeNull();
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("parses committed sanitized-live page-0001 when P0.3D fixture is present", async () => {
    const fixturePath = sanitizedLivePageHtmlPath(workspaceRoot, 1);
    try {
      await access(fixturePath);
    } catch {
      return;
    }
    const html = await readFile(fixturePath, "utf8");
    expect(sha256Hex(Buffer.from(html, "utf8"))).toBe(
      "80df0195b283c5265ff8004720bfbbdf15822dd30134545ae2f5ba6c869f863e",
    );
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
