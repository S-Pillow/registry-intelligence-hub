import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { parseRevealDayCsvText } from "@/normalization/parse-reveal-csv";
import { networkPolicyForCommand } from "./command-mode";
import { mappingLiveCheckpointPath } from "./mapping-checkpoint";
import { runMappingLive } from "./mapping-live";
import {
  applyMechanicalMappingApproval,
  assertRspMappingReviewPacket,
  RSP_MAPPING_REVIEW_SCHEMA_VERSION,
  validateMappingApprovalPacket,
  type RspMappingReviewPacket,
} from "./mapping-review-approval";
import { MAPPING_REVIEW_FAILURE_CLASSIFICATIONS } from "./mapping-review-failure-classification";
import {
  formatMappingReviewReport,
  runMappingReview,
  type MappingReviewReport,
} from "./mapping-review";
import {
  buildSyntheticReplayCorpus,
  createSyntheticReplayFetcher,
  REGRESSION_MAPPING_LEADS,
} from "./synthetic-replay-corpus";
import { RSP_MAPPING_LIVE_AUTH_ENV } from "./constants";
import { loadRspMappingArtifact } from "./load-manifest";
import { loadPilotManifest } from "./load-manifest";
import { stagingIndexPageFetchMetadataPath } from "./bundle-paths";

const workspaceRoot = join(process.cwd());
const noSleep = async () => undefined;

describe("D2.5A-P0.2A mapping-review (zero HTTP)", () => {
  it("mapping-review command mode never opens outbound HTTP", () => {
    expect(networkPolicyForCommand("mapping-review").allowsOutboundHttp).toBe(false);
  });

  it("exposes failure classification vocabulary", () => {
    expect(MAPPING_REVIEW_FAILURE_CLASSIFICATIONS).toContain("EXACT_COMPLETE");
    expect(MAPPING_REVIEW_FAILURE_CLASSIFICATIONS).toContain("PARTIAL_MAPPING");
    expect(MAPPING_REVIEW_FAILURE_CLASSIFICATIONS).toContain("INTEGRITY_FAILURE");
  });

  it("passes full round-wide synthetic staging run with leads and pilot rows", async () => {
    const csv = await readFile(
      join(
        workspaceRoot,
        "src/normalization/fixtures/icann2012-reveal-day-v1/sources/strings-1200utc-13jun12-en.csv",
      ),
      "utf8",
    );
    const applicationIds = parseRevealDayCsvText(csv).map((r) => r.applicationId);
    const corpus = buildSyntheticReplayCorpus({ applicationIds });
    const staging = await mkdtemp(join(tmpdir(), "rsp-review-"));
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";

    try {
      await runMappingLive(
        {
          workspaceRoot,
          stagingRoot: staging,
          runId: "review-exact",
          forceNewRun: true,
          sleep: noSleep,
        },
        createSyntheticReplayFetcher(corpus),
      );

      const report = await runMappingReview({ workspaceRoot, runDir: staging });
      expect(report.runId).toBe("review-exact");
      expect(report.mappingArtifactSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(report.artifactPurpose).toBe("EVIDENCE");
      expect(report.approvalState).toBe("DRAFT");
      expect(report.expectedApplicationCount).toBe(1930);
      expect(report.mappedCount).toBe(1930);
      expect(report.roundWideExact).toBe(true);
      expect(report.validationLeadsMatched).toBe(true);
      expect(report.pilotResolvedCount).toBe(25);
      expect(report.pilotExpectedCount).toBe(25);
      expect(report.pilotRows).toHaveLength(25);
      expect(report.mappingReviewPass).toBe(true);
      expect(report.reviewHold).toBe(false);
      expect(report.failureClassification).toBe("EXACT_COMPLETE");
      expect(report.pilotOnlyExactCandidate).toBe(false);

      for (const lead of Object.values(REGRESSION_MAPPING_LEADS)) {
        const check = report.validationLeadChecks.find((c) => c.applicationId === lead.applicationId);
        expect(check?.matched).toBe(true);
      }

      const formatted = formatMappingReviewReport(report);
      expect(formatted).toContain('"reviewVersion": "registry-hub-rsp-mapping-review-report/1.0.0"');
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("holds review when validation lead gtldresultAcId mismatches (no auto-fix)", async () => {
    const csv = await readFile(
      join(
        workspaceRoot,
        "src/normalization/fixtures/icann2012-reveal-day-v1/sources/strings-1200utc-13jun12-en.csv",
      ),
      "utf8",
    );
    const applicationIds = parseRevealDayCsvText(csv).map((r) => r.applicationId);
    const corpus = buildSyntheticReplayCorpus({ applicationIds });
    const staging = await mkdtemp(join(tmpdir(), "rsp-review-"));
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";

    try {
      const live = await runMappingLive(
        {
          workspaceRoot,
          stagingRoot: staging,
          runId: "lead-mismatch",
          forceNewRun: true,
          sleep: noSleep,
        },
        createSyntheticReplayFetcher(corpus),
      );

      const artifact = JSON.parse(await readFile(live.mappingArtifactPath, "utf8"));
      const bosch = artifact.entries.find(
        (e: { applicationId: string }) => e.applicationId === REGRESSION_MAPPING_LEADS.BOSCH.applicationId,
      );
      bosch.gtldresultAcId = 999;
      await writeFile(live.mappingArtifactPath, `${JSON.stringify(artifact, null, 2)}\n`);

      const report = await runMappingReview({ workspaceRoot, runDir: staging });
      expect(report.validationLeadsMatched).toBe(false);
      expect(report.reviewHold).toBe(true);
      expect(report.mappingReviewPass).toBe(false);
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("reports PILOT_ONLY_EXACT candidate when round-wide incomplete but 25/25 pilot mapped", async () => {
    const manifest = await loadPilotManifest(workspaceRoot);
    const pilotIds = manifest.entries.map((e) => e.applicationId);
    const corpus = buildSyntheticReplayCorpus({ applicationIds: pilotIds, rowsPerPage: 5 });
    const staging = await mkdtemp(join(tmpdir(), "rsp-review-"));
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";

    try {
      await runMappingLive(
        {
          workspaceRoot,
          stagingRoot: staging,
          runId: "pilot-only-candidate",
          forceNewRun: true,
          sleep: noSleep,
        },
        createSyntheticReplayFetcher(corpus),
      );

      const report = await runMappingReview({ workspaceRoot, runDir: staging });
      expect(report.roundWideExact).toBe(false);
      expect(report.pilotResolvedCount).toBe(25);
      expect(report.pilotOnlyExactCandidate).toBe(true);
      expect(["PARTIAL_MAPPING", "PAGINATION_DRIFT"]).toContain(report.failureClassification);
      expect(report.approvalState).toBe("DRAFT");
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("rejects APPROVE for wrong SHA or wrong runId", async () => {
    const report = {
      runId: "run-a",
      mappingArtifactSha256: "a".repeat(64),
      mappingReviewPass: true,
      reviewHold: false,
      integrityFailures: [],
      roundWideExact: true,
    } as unknown as MappingReviewReport;

    const base: RspMappingReviewPacket = {
      reviewVersion: RSP_MAPPING_REVIEW_SCHEMA_VERSION,
      mappingArtifactSha256: "a".repeat(64),
      runId: "run-a",
      reviewer: "steward@test",
      reviewedAt: "2026-09-22T00:00:00.000Z",
      decision: "APPROVE",
    };

    expect(validateMappingApprovalPacket(report, base).mechanicalApproveEligible).toBe(true);

    const wrongSha = validateMappingApprovalPacket(report, {
      ...base,
      mappingArtifactSha256: "b".repeat(64),
    });
    expect(wrongSha.mechanicalApproveEligible).toBe(false);
    expect(wrongSha.errors.some((e) => /sha256/i.test(e))).toBe(true);

    const wrongRun = validateMappingApprovalPacket(report, { ...base, runId: "run-b" });
    expect(wrongRun.mechanicalApproveEligible).toBe(false);
    expect(wrongRun.errors.some((e) => /runId/i.test(e))).toBe(true);
  });

  it("rejects APPROVE when round-wide incomplete even if pilot-only exact", async () => {
    const report = {
      runId: "partial",
      mappingArtifactSha256: "c".repeat(64),
      mappingReviewPass: true,
      reviewHold: false,
      integrityFailures: [],
      roundWideExact: false,
      pilotOnlyExactCandidate: true,
    } as unknown as MappingReviewReport;

    const packet: RspMappingReviewPacket = {
      reviewVersion: RSP_MAPPING_REVIEW_SCHEMA_VERSION,
      mappingArtifactSha256: "c".repeat(64),
      runId: "partial",
      reviewer: "steward@test",
      reviewedAt: "2026-09-22T00:00:00.000Z",
      decision: "APPROVE",
    };

    const result = validateMappingApprovalPacket(report, packet);
    expect(result.mechanicalApproveEligible).toBe(false);
    expect(result.errors.some((e) => /ROUND_WIDE_EXACT/i.test(e))).toBe(true);
  });

  it("mechanical DRAFT→APPROVED only with synthetic APPROVE matching SHA + pass", async () => {
    const csv = await readFile(
      join(
        workspaceRoot,
        "src/normalization/fixtures/icann2012-reveal-day-v1/sources/strings-1200utc-13jun12-en.csv",
      ),
      "utf8",
    );
    const applicationIds = parseRevealDayCsvText(csv).map((r) => r.applicationId);
    const corpus = buildSyntheticReplayCorpus({ applicationIds });
    const staging = await mkdtemp(join(tmpdir(), "rsp-review-"));
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";

    try {
      const live = await runMappingLive(
        {
          workspaceRoot,
          stagingRoot: staging,
          runId: "mechanical-approve",
          forceNewRun: true,
          sleep: noSleep,
        },
        createSyntheticReplayFetcher(corpus),
      );

      const report = await runMappingReview({ workspaceRoot, runDir: staging });
      const artifact = await loadRspMappingArtifact(live.mappingArtifactPath);
      expect(artifact.approvalState).toBe("DRAFT");

      const packet = assertRspMappingReviewPacket({
        reviewVersion: RSP_MAPPING_REVIEW_SCHEMA_VERSION,
        mappingArtifactSha256: report.mappingArtifactSha256,
        runId: report.runId,
        reviewer: "SYNTHETIC_TEST_STEWARD",
        reviewedAt: "2026-09-22T12:00:00.000Z",
        decision: "APPROVE",
        notes: "vitest synthetic only — not committed",
      });

      const approved = applyMechanicalMappingApproval(artifact, report, packet);
      expect(approved.approvalState).toBe("APPROVED");
      expect(approved.scope).toBe("ROUND_WIDE_EXACT");
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("classifies integrity failure when page HTML SHA diverges from checkpoint", async () => {
    const csv = await readFile(
      join(
        workspaceRoot,
        "src/normalization/fixtures/icann2012-reveal-day-v1/sources/strings-1200utc-13jun12-en.csv",
      ),
      "utf8",
    );
    const applicationIds = parseRevealDayCsvText(csv).map((r) => r.applicationId);
    const corpus = buildSyntheticReplayCorpus({ applicationIds });
    const staging = await mkdtemp(join(tmpdir(), "rsp-review-"));
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";

    try {
      await runMappingLive(
        {
          workspaceRoot,
          stagingRoot: staging,
          runId: "integrity-fail",
          forceNewRun: true,
          sleep: noSleep,
        },
        createSyntheticReplayFetcher(corpus),
      );

      const ck = JSON.parse(await readFile(mappingLiveCheckpointPath(staging), "utf8"));
      const htmlPath = join(staging, "sources/index/integrity-fail/page-0001.html");
      await writeFile(htmlPath, "<html><body>tampered</body></html>");

      const report = await runMappingReview({ workspaceRoot, runDir: staging });
      expect(report.failureClassification).toBe("INTEGRITY_FAILURE");
      expect(report.integrityFailures.length).toBeGreaterThan(0);
      expect(report.mappingReviewPass).toBe(false);
      expect(ck.runId).toBe("integrity-fail");
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("rejects persisted cookie/CSRF material in fetch metadata", async () => {
    const csv = await readFile(
      join(
        workspaceRoot,
        "src/normalization/fixtures/icann2012-reveal-day-v1/sources/strings-1200utc-13jun12-en.csv",
      ),
      "utf8",
    );
    const applicationIds = parseRevealDayCsvText(csv).map((r) => r.applicationId);
    const corpus = buildSyntheticReplayCorpus({ applicationIds });
    const staging = await mkdtemp(join(tmpdir(), "rsp-review-"));
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";

    try {
      await runMappingLive(
        {
          workspaceRoot,
          stagingRoot: staging,
          runId: "cookie-leak",
          forceNewRun: true,
          sleep: noSleep,
        },
        createSyntheticReplayFetcher(corpus),
      );

      const metaPath = stagingIndexPageFetchMetadataPath(staging, "cookie-leak", 1);
      const meta = JSON.parse(await readFile(metaPath, "utf8"));
      meta.debugCookie = "JSESSIONID=leaked";
      await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`);

      const report = await runMappingReview({ workspaceRoot, runDir: staging });
      expect(report.integrityFailures.some((f) => /cookie|session/i.test(f))).toBe(true);
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });
});
