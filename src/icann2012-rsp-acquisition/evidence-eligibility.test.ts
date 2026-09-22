import { copyFile, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import { parseRevealDayCsvText } from "@/normalization/parse-reveal-csv";
import {
  evaluateMappingArtifactEligibility,
  loadEvidenceSnapshotIndex,
} from "./artifact-eligibility";
import { acquirePilotLivePortions, acquirePilotPortions } from "./acquire";
import {
  assertAllowedGtldresultRedirect,
  assertAllowedGtldresultRequestUrl,
  NetworkTargetPolicyError,
} from "./network-target-policy";
import { buildPreflightReport, formatPreflightReport, isPilotLiveAuthorized } from "./preflight-report";
import { buildSyntheticRoundWideMappingFixture } from "./synthetic-mapping-fixture";
import {
  assertLiveStagingOutsideWorkspace,
  defaultLiveStagingRoot,
  isPathContainedIn,
} from "./staging-containment";
import { RSP_ACQUISITION_AUTH_ENV, RSP_PILOT_LIVE_AUTH_ENV } from "./constants";
import { buildPortionUrl } from "./urls";
import { CONFIRMED_2012_MAPPED_APPLICATION_COUNT, CONFIRMED_2012_PORTFOLIO_COUNT } from "@/historical-2012/confirmed-portfolios-constants";

const workspaceRoot = join(process.cwd());

describe("registry-2012-rsp-mapping eligibility (D2.5A-P0.1A)", () => {
  it("committed pilot mapping is TEST_ONLY+DRAFT and fails live preflight", async () => {
    const report = await buildPreflightReport({ workspaceRoot, operation: "pilot-live" });
    expect(report.artifactPurpose).toBe("TEST_ONLY");
    expect(report.approvalState).toBe("DRAFT");
    expect(report.productionEligible).toBe(false);
    expect(report.networkRequestsExpected).toBe(0);
    expect(report.blockingReasons.some((r) => r.includes("TEST_ONLY"))).toBe(true);
    expect(report.pilotApplicationToAcId).toHaveLength(25);
  });

  it("preflight pilot-live lists all 25 Application ID → AC ID rows", async () => {
    const report = await buildPreflightReport({ workspaceRoot, operation: "pilot-live" });
    const text = formatPreflightReport(report);
    expect(text).toContain("pilot Application ID → gtldresultAcId:");
    expect(report.pilotApplicationToAcId?.find((r) => r.applicationId === "1-1945-29108")?.gtldresultAcId).toBe(
      170,
    );
    expect(report.pilotApplicationToAcId).toHaveLength(25);
  });

  it("synthetic round-wide fixture generator produces 1930 unmistakable TEST_ONLY rows", async () => {
    const csvPath = join(
      workspaceRoot,
      "src/normalization/fixtures/icann2012-reveal-day-v1/sources/strings-1200utc-13jun12-en.csv",
    );
    const csv = await readFile(csvPath, "utf8");
    const rows = parseRevealDayCsvText(csv);
    expect(rows).toHaveLength(1930);
    const artifact = buildSyntheticRoundWideMappingFixture(rows.map((r) => r.applicationId));
    expect(artifact.entries).toHaveLength(1930);
    expect(artifact.artifactPurpose).toBe("TEST_ONLY");
    const snapshots = await loadEvidenceSnapshotIndex(workspaceRoot);
    const evaluation = evaluateMappingArtifactEligibility(artifact, snapshots);
    expect(evaluation.productionEligible).toBe(false);
    expect(evaluation.rowIssues.length).toBe(0);
  });

  it("rejects production rows with unknown snapshot, empty sourceUrl, and placeholder hash", async () => {
    const snapshots = await loadEvidenceSnapshotIndex(workspaceRoot);
    const evaluation = evaluateMappingArtifactEligibility(
      {
        mappingVersion: "registry-2012-rsp-mapping/1.0.0",
        artifactPurpose: "EVIDENCE",
        approvalState: "APPROVED",
        bundleId: "icann2012-rsp-public-portions-v1",
        scope: "test",
        entries: [
          {
            applicationId: "1-1945-29108",
            gtldresultAcId: 170,
            mappingSourceClass: "SYNTHETIC_TEST",
            evidenceSnapshotId: "missing-snap",
            sourceUrl: "",
            evidenceContentSha256: "0000000000000000000000000000000000000000000000000000000000000000",
          },
        ],
      },
      snapshots,
    );
    expect(evaluation.productionEligible).toBe(true);
    const codes = new Set(evaluation.rowIssues.map((i) => i.code));
    expect(codes.has("SYNTHETIC_SOURCE_CLASS")).toBe(true);
    expect(codes.has("UNKNOWN_EVIDENCE_SNAPSHOT")).toBe(true);
    expect(codes.has("EMPTY_SOURCE_URL")).toBe(true);
    expect(codes.has("PLACEHOLDER_EVIDENCE_HASH")).toBe(true);
  });

  it("STEWARD_APPROVED_MANUAL requires auditable committed evidence snapshot", async () => {
    const snapshots = await loadEvidenceSnapshotIndex(workspaceRoot);
    const evaluation = evaluateMappingArtifactEligibility(
      {
        mappingVersion: "registry-2012-rsp-mapping/1.0.0",
        artifactPurpose: "EVIDENCE",
        approvalState: "APPROVED",
        bundleId: "icann2012-rsp-public-portions-v1",
        scope: "test",
        entries: [
          {
            applicationId: "1-1945-29108",
            gtldresultAcId: 170,
            mappingSourceClass: "STEWARD_APPROVED_MANUAL",
            evidenceSnapshotId: null,
            sourceUrl: buildPortionUrl(170),
            evidenceContentSha256: "a".repeat(64),
          },
        ],
      },
      snapshots,
    );
    expect(evaluation.rowIssues.some((i) => i.code === "MANUAL_WITHOUT_AUDITABLE_EVIDENCE")).toBe(true);
  });

  it("legacy REGISTRY_HUB_RSP_ACQUISITION_AUTHORIZED does not authorize pilot-live", async () => {
    const prevLegacy = process.env[RSP_ACQUISITION_AUTH_ENV];
    const prevPilot = process.env[RSP_PILOT_LIVE_AUTH_ENV];
    process.env[RSP_ACQUISITION_AUTH_ENV] = "1";
    delete process.env[RSP_PILOT_LIVE_AUTH_ENV];
    expect(isPilotLiveAuthorized()).toBe(false);
    await expect(acquirePilotLivePortions({ workspaceRoot, stagingRoot: defaultLiveStagingRoot() })).rejects.toThrow(
      /PILOT_LIVE/,
    );
    process.env[RSP_ACQUISITION_AUTH_ENV] = prevLegacy;
    process.env[RSP_PILOT_LIVE_AUTH_ENV] = prevPilot;
  });

  it("mapping-live preflight reports auth gate with zero HTTP (engine implemented, replay-only in CI)", async () => {
    const report = await buildPreflightReport({ workspaceRoot, operation: "mapping-live" });
    expect(report.networkRequestsExpected).toBe(0);
    expect(report.blockingReasons).not.toContain("MAPPING_LIVE_NOT_IMPLEMENTED");
    expect(report.blockingReasons.some((r) => r.includes("MAPPING_AUTHORIZED"))).toBe(true);
  });

  it("network target policy allows gtldresult HTTPS only", () => {
    expect(() => assertAllowedGtldresultRequestUrl(buildPortionUrl(170))).not.toThrow();
    expect(() => assertAllowedGtldresultRequestUrl("http://gtldresult.icann.org/x")).toThrow(
      NetworkTargetPolicyError,
    );
    expect(() => assertAllowedGtldresultRequestUrl("https://evil.example/x")).toThrow(
      NetworkTargetPolicyError,
    );
    expect(() =>
      assertAllowedGtldresultRedirect(
        "https://gtldresult.icann.org/a",
        "https://gtldresult.icann.org/b",
      ),
    ).not.toThrow();
    expect(() =>
      assertAllowedGtldresultRedirect(
        "https://gtldresult.icann.org/a",
        "https://other.icann.org/b",
      ),
    ).toThrow(NetworkTargetPolicyError);
  });

  it("rejects live staging inside repository workspace", async () => {
    const inside = join(workspaceRoot, "src/normalization/fixtures/icann2012-rsp-public-portions-v1");
    await expect(assertLiveStagingOutsideWorkspace(inside, workspaceRoot)).rejects.toThrow(/outside/);
    const outside = await mkdtemp(join(tmpdir(), "rsp-outside-"));
    await expect(assertLiveStagingOutsideWorkspace(outside, workspaceRoot)).resolves.toBeUndefined();
    expect(isPathContainedIn(inside, workspaceRoot)).toBe(true);
  });

  it("pilot command remains dry-run with zero fetcher invocations", async () => {
    const result = await acquirePilotPortions({ workspaceRoot });
    expect(result.mode).toBe("dry-run");
    expect(result.stagingRoot).toBe(defaultLiveStagingRoot());
  });

  it("pilot-live with approved evidence mapping uses mock fetcher only when fully authorized", async () => {
    const staging = await mkdtemp(join(tmpdir(), "rsp-live-"));
    const tempWorkspace = await mkdtemp(join(tmpdir(), "rsp-ws-"));
    const bundleRoot = join(
      tempWorkspace,
      "src/normalization/fixtures/icann2012-rsp-public-portions-v1",
    );
    await mkdir(bundleRoot, { recursive: true });
    await copyFile(
      join(workspaceRoot, "src/normalization/fixtures/icann2012-rsp-public-portions-v1/pilot-manifest-25.json"),
      join(bundleRoot, "pilot-manifest-25.json"),
    );
    const snapId = "snap-pilot-live-test";
    await writeFile(
      join(bundleRoot, "raw-snapshots.json"),
      `${JSON.stringify(
        {
          snapshots: [
            {
              snapshotId: snapId,
              sourceId: "test",
              requestedUrl: buildPortionUrl(170),
              provenance: { contentSha256: "b".repeat(64) },
            },
          ],
        },
        null,
        2,
      )}\n`,
    );

    const mappingPath = join(staging, "approved-pilot-live.json");
    await writeFile(
      mappingPath,
      `${JSON.stringify(
        {
          mappingVersion: "registry-2012-rsp-mapping/1.0.0",
          artifactPurpose: "EVIDENCE",
          approvalState: "APPROVED",
          bundleId: "icann2012-rsp-public-portions-v1",
          scope: "pilot-25-test",
          entries: [
            {
              applicationId: "1-1945-29108",
              gtldresultAcId: 170,
              mappingSourceClass: "DETAILS_PAGE_PROBE",
              evidenceSnapshotId: snapId,
              sourceUrl: buildPortionUrl(170),
              evidenceContentSha256: "c".repeat(64),
            },
          ],
        },
        null,
        2,
      )}\n`,
    );

    const fetcher = vi.fn(async () => ({
      status: 200,
      body: Buffer.from('<div class="response" id="q23">backend</div>'),
    }));

    const prevLegacy = process.env[RSP_ACQUISITION_AUTH_ENV];
    const prevPilot = process.env[RSP_PILOT_LIVE_AUTH_ENV];
    process.env[RSP_PILOT_LIVE_AUTH_ENV] = "1";
    delete process.env[RSP_ACQUISITION_AUTH_ENV];

    const result = await acquirePilotLivePortions(
      {
        workspaceRoot: tempWorkspace,
        stagingRoot: staging,
        mappingArtifactPath: mappingPath,
        batchId: "eligibility-test",
      },
      fetcher,
    );

    expect(result.mode).toBe("live");
    expect(result.completed).toContain("1-1945-29108");
    expect(fetcher).toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledWith(buildPortionUrl(170));

    process.env[RSP_ACQUISITION_AUTH_ENV] = prevLegacy;
    process.env[RSP_PILOT_LIVE_AUTH_ENV] = prevPilot;
  });
});

describe("D2.4B confirmed portfolio regression (16 / 466)", () => {
  it("pins steward-confirmed portfolio slice counts", () => {
    expect(CONFIRMED_2012_PORTFOLIO_COUNT).toBe(16);
    expect(CONFIRMED_2012_MAPPED_APPLICATION_COUNT).toBe(466);
  });
});
