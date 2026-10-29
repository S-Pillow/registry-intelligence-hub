import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseRevealDayCsvText } from "@/normalization/parse-reveal-csv";
import { sha256Hex } from "@/normalization/hashes";
import { isProductionEligibleArtifact } from "./artifact-eligibility";
import { stagingMappingApprovedArtifactPath, stagingMappingArtifactPath } from "./bundle-paths";
import { networkPolicyForCommand } from "./command-mode";
import { RSP_MAPPING_LIVE_AUTH_ENV } from "./constants";
import { loadRspMappingArtifact } from "./load-manifest";
import { mappingLiveCheckpointPath } from "./mapping-checkpoint";
import { runMappingLive } from "./mapping-live";
import {
  formatMappingApplyReviewReceipt,
  MappingApplyReviewError,
  runMappingApplyReview,
} from "./mapping-apply-review";
import type { ApprovalState, ArtifactPurpose } from "./types";
import {
  assertRspMappingReviewPacket,
  RSP_MAPPING_REVIEW_SCHEMA_VERSION,
} from "./mapping-review-approval";
import { runMappingReview, type MappingReviewReport } from "./mapping-review";
import {
  buildSyntheticReplayCorpus,
  createSyntheticReplayFetcher,
} from "./synthetic-replay-corpus";

const workspaceRoot = join(process.cwd());
const noSleep = async () => undefined;

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);

function stubReport(overrides: Partial<MappingReviewReport> = {}): MappingReviewReport {
  return {
    reviewVersion: "registry-hub-rsp-mapping-review-report/1.0.0",
    runId: "stub-run",
    mappingArtifactPath: "/tmp/mapping.json",
    mappingArtifactSha256: SHA_A,
    artifactPurpose: "EVIDENCE",
    approvalState: "DRAFT",
    corpusContentHash: "corpus",
    corpusPinValid: true,
    expectedApplicationCount: 1930,
    mappedCount: 1930,
    missingApplicationIds: [],
    extraApplicationIds: [],
    duplicateApplicationIds: [],
    duplicateGtldresultAcIds: [],
    pageSnapshotCount: 1,
    failedPageOrdinals: [],
    quarantinedPageOrdinals: [],
    roundWideExact: true,
    pilotResolvedCount: 25,
    pilotExpectedCount: 25,
    pilotRows: [],
    validationLeadsMatched: true,
    validationLeadChecks: [],
    pilotOnlyExactCandidate: false,
    failureClassification: "EXACT_COMPLETE",
    secondaryFailureFlags: [],
    pilotValidationHintsPresent: true,
    nonGridPageOrdinals: [],
    integrityFailures: [],
    mappingReviewPass: true,
    reviewHold: false,
    reviewHoldReasons: [],
    checkpointConsistentWithArtifact: true,
    paginationDiagnosticsConsistent: true,
    ...overrides,
  };
}

async function writePacket(
  dir: string,
  name: string,
  body: Record<string, unknown>,
): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  return path;
}

async function seedMinimalDraftStaging(
  runId: string,
  opts: { artifactPurpose?: ArtifactPurpose; approvalState?: ApprovalState } = {},
): Promise<{
  staging: string;
  draftPath: string;
  draftSha: string;
  draftBytes: Buffer;
  checkpointPath: string;
}> {
  const staging = await mkdtemp(join(tmpdir(), "rsp-apply-review-"));
  const draftPath = stagingMappingArtifactPath(staging, runId);
  const checkpointPath = mappingLiveCheckpointPath(staging);
  await mkdir(join(staging, "registry-2012-rsp-mapping", runId), { recursive: true });
  // Minimal checkpoint so resolveMappingRunLayout finds the run.
  await writeFile(
    checkpointPath,
    `${JSON.stringify(
      {
        checkpointVersion: "icann2012-rsp-mapping-live-checkpoint/1.0.0",
        runId,
        corpusContentHash: "stub",
        state: "completed",
        lastCompletedPageOrdinal: 0,
        pages: [],
        mappings: {},
        applicationPageOrdinal: {},
      },
      null,
      2,
    )}\n`,
  );
  const artifact = {
    mappingVersion: "registry-2012-rsp-mapping/1.0.0",
    artifactPurpose: opts.artifactPurpose ?? "EVIDENCE",
    approvalState: opts.approvalState ?? "DRAFT",
    bundleId: "synthetic-apply-review",
    scope: "ROUND_WIDE_EXACT",
    entries: [
      {
        applicationId: "1-1-1",
        gtldresultAcId: 1,
        mappingSourceClass: "STATUS_GRID",
        evidenceSnapshotId: "snap-1",
        sourceUrl: "https://gtldresult.icann.org/applicationstatus/viewstatus",
        evidenceContentSha256: SHA_A,
      },
    ],
  };
  const text = `${JSON.stringify(artifact, null, 2)}\n`;
  await writeFile(draftPath, text, "utf8");
  return {
    staging,
    draftPath,
    draftSha: sha256Hex(Buffer.from(text, "utf8")),
    draftBytes: Buffer.from(text, "utf8"),
    checkpointPath,
  };
}

async function expectApproveEligibleReject(
  seed: Awaited<ReturnType<typeof seedMinimalDraftStaging>>,
  runId: string,
  outputPath?: string,
): Promise<MappingApplyReviewError> {
  const packetPath = await writePacket(seed.staging, "approve.json", {
    reviewVersion: RSP_MAPPING_REVIEW_SCHEMA_VERSION,
    mappingArtifactSha256: seed.draftSha,
    runId,
    reviewer: "SYNTHETIC_TEST_STEWARD",
    reviewedAt: "2026-10-29T12:00:00.000Z",
    decision: "APPROVE",
    notes: "synthetic only",
  });
  let caught: unknown;
  try {
    await runMappingApplyReview({
      workspaceRoot,
      runDir: seed.staging,
      reviewPacketPath: packetPath,
      outputPath,
      reviewReportOverride: stubReport({
        runId,
        mappingArtifactSha256: seed.draftSha,
      }),
    });
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(MappingApplyReviewError);
  return caught as MappingApplyReviewError;
}

describe("RIH-2012-RSP-VISIBILITY-1E mapping-apply-review", () => {
  it("command mode is zero-network", () => {
    expect(networkPolicyForCommand("mapping-apply-review").allowsOutboundHttp).toBe(false);
    expect(networkPolicyForCommand("mapping-apply-review").requiresPilotLiveAuth).toBe(false);
    expect(networkPolicyForCommand("mapping-apply-review").requiresMappingLiveAuth).toBe(false);
  });

  it("rejects malformed packets fail-closed", async () => {
    const seed = await seedMinimalDraftStaging("malformed");
    try {
      const cases: Array<{ name: string; body: Record<string, unknown> }> = [
        {
          name: "missing-reviewer.json",
          body: {
            reviewVersion: RSP_MAPPING_REVIEW_SCHEMA_VERSION,
            mappingArtifactSha256: SHA_A,
            runId: "malformed",
            reviewedAt: "2026-10-29T00:00:00.000Z",
            decision: "APPROVE",
          },
        },
        {
          name: "invalid-decision.json",
          body: {
            reviewVersion: RSP_MAPPING_REVIEW_SCHEMA_VERSION,
            mappingArtifactSha256: SHA_A,
            runId: "malformed",
            reviewer: "SYNTHETIC",
            reviewedAt: "2026-10-29T00:00:00.000Z",
            decision: "MAYBE",
          },
        },
        {
          name: "malformed-sha.json",
          body: {
            reviewVersion: RSP_MAPPING_REVIEW_SCHEMA_VERSION,
            mappingArtifactSha256: "not-a-sha",
            runId: "malformed",
            reviewer: "SYNTHETIC",
            reviewedAt: "2026-10-29T00:00:00.000Z",
            decision: "APPROVE",
          },
        },
        {
          name: "missing-run-id.json",
          body: {
            reviewVersion: RSP_MAPPING_REVIEW_SCHEMA_VERSION,
            mappingArtifactSha256: SHA_A,
            runId: "   ",
            reviewer: "SYNTHETIC",
            reviewedAt: "2026-10-29T00:00:00.000Z",
            decision: "APPROVE",
          },
        },
      ];

      for (const c of cases) {
        const packetPath = await writePacket(seed.staging, c.name, c.body);
        await expect(
          runMappingApplyReview({
            workspaceRoot,
            runDir: seed.staging,
            reviewPacketPath: packetPath,
            reviewReportOverride: stubReport({
              runId: "malformed",
              mappingArtifactSha256: seed.draftSha,
            }),
          }),
        ).rejects.toThrow();
        await expect(access(stagingMappingApprovedArtifactPath(seed.staging, "malformed"))).rejects.toThrow();
        expect(await readFile(seed.draftPath)).toEqual(seed.draftBytes);
      }
    } finally {
      await rm(seed.staging, { recursive: true, force: true });
    }
  });

  it("HOLD — NO PROMOTION and leaves DRAFT unchanged", async () => {
    const seed = await seedMinimalDraftStaging("hold-run");
    try {
      const packetPath = await writePacket(seed.staging, "hold.json", {
        reviewVersion: RSP_MAPPING_REVIEW_SCHEMA_VERSION,
        mappingArtifactSha256: seed.draftSha,
        runId: "hold-run",
        reviewer: "SYNTHETIC_TEST_STEWARD",
        reviewedAt: "2026-10-29T12:00:00.000Z",
        decision: "HOLD",
        notes: "synthetic only",
      });
      const receipt = await runMappingApplyReview({
        workspaceRoot,
        runDir: seed.staging,
        reviewPacketPath: packetPath,
        reviewReportOverride: stubReport({
          runId: "hold-run",
          mappingArtifactSha256: seed.draftSha,
        }),
      });
      expect(receipt.outcome).toBe("HOLD_NO_PROMOTION");
      expect(formatMappingApplyReviewReceipt(receipt)).toContain("HOLD — NO PROMOTION");
      expect(receipt.approvedOutputPath).toBeNull();
      expect(receipt.networkRequests).toBe(0);
      expect(receipt.originalArtifactUnchanged).toBe(true);
      await expect(access(stagingMappingApprovedArtifactPath(seed.staging, "hold-run"))).rejects.toThrow();
      expect(await readFile(seed.draftPath)).toEqual(seed.draftBytes);
    } finally {
      await rm(seed.staging, { recursive: true, force: true });
    }
  });

  it("REJECT — NO PROMOTION and leaves DRAFT unchanged", async () => {
    const seed = await seedMinimalDraftStaging("reject-run");
    try {
      const packetPath = await writePacket(seed.staging, "reject.json", {
        reviewVersion: RSP_MAPPING_REVIEW_SCHEMA_VERSION,
        mappingArtifactSha256: seed.draftSha,
        runId: "reject-run",
        reviewer: "SYNTHETIC_TEST_STEWARD",
        reviewedAt: "2026-10-29T12:00:00.000Z",
        decision: "REJECT",
      });
      const receipt = await runMappingApplyReview({
        workspaceRoot,
        runDir: seed.staging,
        reviewPacketPath: packetPath,
        reviewReportOverride: stubReport({
          runId: "reject-run",
          mappingArtifactSha256: seed.draftSha,
        }),
      });
      expect(receipt.outcome).toBe("REJECT_NO_PROMOTION");
      expect(formatMappingApplyReviewReceipt(receipt)).toContain("REJECT — NO PROMOTION");
      expect(receipt.approvedOutputPath).toBeNull();
      expect(receipt.originalArtifactUnchanged).toBe(true);
      await expect(access(stagingMappingApprovedArtifactPath(seed.staging, "reject-run"))).rejects.toThrow();
      expect(await readFile(seed.draftPath)).toEqual(seed.draftBytes);
    } finally {
      await rm(seed.staging, { recursive: true, force: true });
    }
  });

  it("wrong artifact SHA fails closed with no approved output", async () => {
    const seed = await seedMinimalDraftStaging("bad-sha");
    try {
      const packetPath = await writePacket(seed.staging, "approve-bad-sha.json", {
        reviewVersion: RSP_MAPPING_REVIEW_SCHEMA_VERSION,
        mappingArtifactSha256: SHA_B,
        runId: "bad-sha",
        reviewer: "SYNTHETIC_TEST_STEWARD",
        reviewedAt: "2026-10-29T12:00:00.000Z",
        decision: "APPROVE",
      });
      await expect(
        runMappingApplyReview({
          workspaceRoot,
          runDir: seed.staging,
          reviewPacketPath: packetPath,
          reviewReportOverride: stubReport({
            runId: "bad-sha",
            mappingArtifactSha256: seed.draftSha,
          }),
        }),
      ).rejects.toThrow(/Packet binding failed/);
      await expect(access(stagingMappingApprovedArtifactPath(seed.staging, "bad-sha"))).rejects.toThrow();
      expect(await readFile(seed.draftPath)).toEqual(seed.draftBytes);
    } finally {
      await rm(seed.staging, { recursive: true, force: true });
    }
  });

  it("wrong run ID fails closed with no approved output", async () => {
    const seed = await seedMinimalDraftStaging("bad-run");
    try {
      const packetPath = await writePacket(seed.staging, "approve-bad-run.json", {
        reviewVersion: RSP_MAPPING_REVIEW_SCHEMA_VERSION,
        mappingArtifactSha256: seed.draftSha,
        runId: "other-run",
        reviewer: "SYNTHETIC_TEST_STEWARD",
        reviewedAt: "2026-10-29T12:00:00.000Z",
        decision: "APPROVE",
      });
      await expect(
        runMappingApplyReview({
          workspaceRoot,
          runDir: seed.staging,
          reviewPacketPath: packetPath,
          reviewReportOverride: stubReport({
            runId: "bad-run",
            mappingArtifactSha256: seed.draftSha,
          }),
        }),
      ).rejects.toThrow(/Packet binding failed/);
      await expect(access(stagingMappingApprovedArtifactPath(seed.staging, "bad-run"))).rejects.toThrow();
      expect(await readFile(seed.draftPath)).toEqual(seed.draftBytes);
    } finally {
      await rm(seed.staging, { recursive: true, force: true });
    }
  });

  it("review failure fails closed", async () => {
    const seed = await seedMinimalDraftStaging("fail-review");
    try {
      const packetPath = await writePacket(seed.staging, "approve.json", {
        reviewVersion: RSP_MAPPING_REVIEW_SCHEMA_VERSION,
        mappingArtifactSha256: seed.draftSha,
        runId: "fail-review",
        reviewer: "SYNTHETIC_TEST_STEWARD",
        reviewedAt: "2026-10-29T12:00:00.000Z",
        decision: "APPROVE",
      });
      await expect(
        runMappingApplyReview({
          workspaceRoot,
          runDir: seed.staging,
          reviewPacketPath: packetPath,
          reviewReportOverride: stubReport({
            runId: "fail-review",
            mappingArtifactSha256: seed.draftSha,
            mappingReviewPass: false,
            failureClassification: "PARTIAL_MAPPING",
            roundWideExact: false,
          }),
        }),
      ).rejects.toBeInstanceOf(MappingApplyReviewError);
      await expect(access(stagingMappingApprovedArtifactPath(seed.staging, "fail-review"))).rejects.toThrow();
    } finally {
      await rm(seed.staging, { recursive: true, force: true });
    }
  });

  it("review hold fails closed", async () => {
    const seed = await seedMinimalDraftStaging("hold-block");
    try {
      const packetPath = await writePacket(seed.staging, "approve.json", {
        reviewVersion: RSP_MAPPING_REVIEW_SCHEMA_VERSION,
        mappingArtifactSha256: seed.draftSha,
        runId: "hold-block",
        reviewer: "SYNTHETIC_TEST_STEWARD",
        reviewedAt: "2026-10-29T12:00:00.000Z",
        decision: "APPROVE",
      });
      await expect(
        runMappingApplyReview({
          workspaceRoot,
          runDir: seed.staging,
          reviewPacketPath: packetPath,
          reviewReportOverride: stubReport({
            runId: "hold-block",
            mappingArtifactSha256: seed.draftSha,
            reviewHold: true,
            reviewHoldReasons: ["validation lead mismatch"],
            mappingReviewPass: false,
          }),
        }),
      ).rejects.toBeInstanceOf(MappingApplyReviewError);
      await expect(access(stagingMappingApprovedArtifactPath(seed.staging, "hold-block"))).rejects.toThrow();
    } finally {
      await rm(seed.staging, { recursive: true, force: true });
    }
  });

  it("integrity failure fails closed", async () => {
    const seed = await seedMinimalDraftStaging("integrity");
    try {
      const packetPath = await writePacket(seed.staging, "approve.json", {
        reviewVersion: RSP_MAPPING_REVIEW_SCHEMA_VERSION,
        mappingArtifactSha256: seed.draftSha,
        runId: "integrity",
        reviewer: "SYNTHETIC_TEST_STEWARD",
        reviewedAt: "2026-10-29T12:00:00.000Z",
        decision: "APPROVE",
      });
      await expect(
        runMappingApplyReview({
          workspaceRoot,
          runDir: seed.staging,
          reviewPacketPath: packetPath,
          reviewReportOverride: stubReport({
            runId: "integrity",
            mappingArtifactSha256: seed.draftSha,
            integrityFailures: ["page HTML SHA mismatch"],
            mappingReviewPass: false,
            failureClassification: "INTEGRITY_FAILURE",
          }),
        }),
      ).rejects.toBeInstanceOf(MappingApplyReviewError);
      await expect(access(stagingMappingApprovedArtifactPath(seed.staging, "integrity"))).rejects.toThrow();
    } finally {
      await rm(seed.staging, { recursive: true, force: true });
    }
  });

  it("non-exact round-wide fails closed", async () => {
    const seed = await seedMinimalDraftStaging("non-exact");
    try {
      const packetPath = await writePacket(seed.staging, "approve.json", {
        reviewVersion: RSP_MAPPING_REVIEW_SCHEMA_VERSION,
        mappingArtifactSha256: seed.draftSha,
        runId: "non-exact",
        reviewer: "SYNTHETIC_TEST_STEWARD",
        reviewedAt: "2026-10-29T12:00:00.000Z",
        decision: "APPROVE",
      });
      await expect(
        runMappingApplyReview({
          workspaceRoot,
          runDir: seed.staging,
          reviewPacketPath: packetPath,
          reviewReportOverride: stubReport({
            runId: "non-exact",
            mappingArtifactSha256: seed.draftSha,
            roundWideExact: false,
            mappingReviewPass: true,
            pilotOnlyExactCandidate: true,
          }),
        }),
      ).rejects.toBeInstanceOf(MappingApplyReviewError);
      await expect(access(stagingMappingApprovedArtifactPath(seed.staging, "non-exact"))).rejects.toThrow();
    } finally {
      await rm(seed.staging, { recursive: true, force: true });
    }
  });

  describe("R1 output collision guards", () => {
    it("rejects outputPath equal to DRAFT mapping.json before write", async () => {
      const seed = await seedMinimalDraftStaging("collide-draft");
      try {
        const err = await expectApproveEligibleReject(seed, "collide-draft", seed.draftPath);
        expect(err.message).toMatch(/Output path collision|DRAFT mapping\.json/);
        expect(await readFile(seed.draftPath)).toEqual(seed.draftBytes);
        const draft = await loadRspMappingArtifact(seed.draftPath);
        expect(draft.approvalState).toBe("DRAFT");
      } finally {
        await rm(seed.staging, { recursive: true, force: true });
      }
    });

    it("rejects outputPath equal to review packet before write", async () => {
      const seed = await seedMinimalDraftStaging("collide-packet");
      try {
        const packetPath = await writePacket(seed.staging, "approve.json", {
          reviewVersion: RSP_MAPPING_REVIEW_SCHEMA_VERSION,
          mappingArtifactSha256: seed.draftSha,
          runId: "collide-packet",
          reviewer: "SYNTHETIC_TEST_STEWARD",
          reviewedAt: "2026-10-29T12:00:00.000Z",
          decision: "APPROVE",
        });
        const packetBytes = await readFile(packetPath);
        await expect(
          runMappingApplyReview({
            workspaceRoot,
            runDir: seed.staging,
            reviewPacketPath: packetPath,
            outputPath: packetPath,
            reviewReportOverride: stubReport({
              runId: "collide-packet",
              mappingArtifactSha256: seed.draftSha,
            }),
          }),
        ).rejects.toThrow(/Output path collision|review packet|already exists/);
        expect(await readFile(packetPath)).toEqual(packetBytes);
        expect(await readFile(seed.draftPath)).toEqual(seed.draftBytes);
      } finally {
        await rm(seed.staging, { recursive: true, force: true });
      }
    });

    it("rejects existing approved derivative without overwrite", async () => {
      const seed = await seedMinimalDraftStaging("collide-existing");
      try {
        const approvedPath = stagingMappingApprovedArtifactPath(seed.staging, "collide-existing");
        const preexisting = `${JSON.stringify({ marker: "preexisting-approved" }, null, 2)}\n`;
        await writeFile(approvedPath, preexisting, "utf8");
        const existingBytes = await readFile(approvedPath);
        const err = await expectApproveEligibleReject(seed, "collide-existing");
        expect(err.message).toMatch(/already exists|exclusive/);
        expect(await readFile(approvedPath)).toEqual(existingBytes);
        expect(await readFile(seed.draftPath)).toEqual(seed.draftBytes);
      } finally {
        await rm(seed.staging, { recursive: true, force: true });
      }
    });

    it("rejects outputPath equal to mapping checkpoint before write", async () => {
      const seed = await seedMinimalDraftStaging("collide-ckpt");
      try {
        const checkpointBytes = await readFile(seed.checkpointPath);
        const err = await expectApproveEligibleReject(seed, "collide-ckpt", seed.checkpointPath);
        expect(err.message).toMatch(/Output path collision|checkpoint/);
        expect(await readFile(seed.checkpointPath)).toEqual(checkpointBytes);
        expect(await readFile(seed.draftPath)).toEqual(seed.draftBytes);
      } finally {
        await rm(seed.staging, { recursive: true, force: true });
      }
    });
  });

  describe("R1 source lifecycle lock", () => {
    it("rejects TEST_ONLY + DRAFT source", async () => {
      const seed = await seedMinimalDraftStaging("life-test-only", {
        artifactPurpose: "TEST_ONLY",
        approvalState: "DRAFT",
      });
      try {
        const err = await expectApproveEligibleReject(seed, "life-test-only");
        expect(err.message).toMatch(/Source lifecycle rejected/);
        await expect(
          access(stagingMappingApprovedArtifactPath(seed.staging, "life-test-only")),
        ).rejects.toThrow();
        expect(await readFile(seed.draftPath)).toEqual(seed.draftBytes);
      } finally {
        await rm(seed.staging, { recursive: true, force: true });
      }
    });

    it("rejects EVIDENCE + APPROVED source (no re-approve)", async () => {
      const seed = await seedMinimalDraftStaging("life-approved", {
        artifactPurpose: "EVIDENCE",
        approvalState: "APPROVED",
      });
      try {
        const err = await expectApproveEligibleReject(seed, "life-approved");
        expect(err.message).toMatch(/Source lifecycle rejected/);
        await expect(
          access(stagingMappingApprovedArtifactPath(seed.staging, "life-approved")),
        ).rejects.toThrow();
        expect(await readFile(seed.draftPath)).toEqual(seed.draftBytes);
      } finally {
        await rm(seed.staging, { recursive: true, force: true });
      }
    });

    it("EVIDENCE + DRAFT remains approvable under stub mechanical eligibility", async () => {
      const seed = await seedMinimalDraftStaging("life-ok");
      try {
        const packetPath = await writePacket(seed.staging, "approve.json", {
          reviewVersion: RSP_MAPPING_REVIEW_SCHEMA_VERSION,
          mappingArtifactSha256: seed.draftSha,
          runId: "life-ok",
          reviewer: "SYNTHETIC_TEST_STEWARD",
          reviewedAt: "2026-10-29T12:00:00.000Z",
          decision: "APPROVE",
        });
        const receipt = await runMappingApplyReview({
          workspaceRoot,
          runDir: seed.staging,
          reviewPacketPath: packetPath,
          reviewReportOverride: stubReport({
            runId: "life-ok",
            mappingArtifactSha256: seed.draftSha,
          }),
        });
        expect(receipt.outcome).toBe("APPROVED");
        expect(await readFile(seed.draftPath)).toEqual(seed.draftBytes);
        const approved = await loadRspMappingArtifact(receipt.approvedOutputPath!);
        expect(approved.artifactPurpose).toBe("EVIDENCE");
        expect(approved.approvalState).toBe("APPROVED");
      } finally {
        await rm(seed.staging, { recursive: true, force: true });
      }
    });
  });

  describe("R1 packet binding for HOLD/REJECT", () => {
    it("HOLD wrong SHA fails closed (not HOLD_NO_PROMOTION)", async () => {
      const seed = await seedMinimalDraftStaging("hold-bad-sha");
      try {
        const packetPath = await writePacket(seed.staging, "hold.json", {
          reviewVersion: RSP_MAPPING_REVIEW_SCHEMA_VERSION,
          mappingArtifactSha256: SHA_B,
          runId: "hold-bad-sha",
          reviewer: "SYNTHETIC_TEST_STEWARD",
          reviewedAt: "2026-10-29T12:00:00.000Z",
          decision: "HOLD",
        });
        await expect(
          runMappingApplyReview({
            workspaceRoot,
            runDir: seed.staging,
            reviewPacketPath: packetPath,
            reviewReportOverride: stubReport({
              runId: "hold-bad-sha",
              mappingArtifactSha256: seed.draftSha,
            }),
          }),
        ).rejects.toThrow(/Packet binding failed/);
        expect(await readFile(seed.draftPath)).toEqual(seed.draftBytes);
      } finally {
        await rm(seed.staging, { recursive: true, force: true });
      }
    });

    it("HOLD wrong run ID fails closed", async () => {
      const seed = await seedMinimalDraftStaging("hold-bad-run");
      try {
        const packetPath = await writePacket(seed.staging, "hold.json", {
          reviewVersion: RSP_MAPPING_REVIEW_SCHEMA_VERSION,
          mappingArtifactSha256: seed.draftSha,
          runId: "other-run",
          reviewer: "SYNTHETIC_TEST_STEWARD",
          reviewedAt: "2026-10-29T12:00:00.000Z",
          decision: "HOLD",
        });
        await expect(
          runMappingApplyReview({
            workspaceRoot,
            runDir: seed.staging,
            reviewPacketPath: packetPath,
            reviewReportOverride: stubReport({
              runId: "hold-bad-run",
              mappingArtifactSha256: seed.draftSha,
            }),
          }),
        ).rejects.toThrow(/Packet binding failed/);
      } finally {
        await rm(seed.staging, { recursive: true, force: true });
      }
    });

    it("REJECT wrong SHA fails closed (not REJECT_NO_PROMOTION)", async () => {
      const seed = await seedMinimalDraftStaging("rej-bad-sha");
      try {
        const packetPath = await writePacket(seed.staging, "reject.json", {
          reviewVersion: RSP_MAPPING_REVIEW_SCHEMA_VERSION,
          mappingArtifactSha256: SHA_B,
          runId: "rej-bad-sha",
          reviewer: "SYNTHETIC_TEST_STEWARD",
          reviewedAt: "2026-10-29T12:00:00.000Z",
          decision: "REJECT",
        });
        await expect(
          runMappingApplyReview({
            workspaceRoot,
            runDir: seed.staging,
            reviewPacketPath: packetPath,
            reviewReportOverride: stubReport({
              runId: "rej-bad-sha",
              mappingArtifactSha256: seed.draftSha,
            }),
          }),
        ).rejects.toThrow(/Packet binding failed/);
      } finally {
        await rm(seed.staging, { recursive: true, force: true });
      }
    });

    it("REJECT wrong run ID fails closed", async () => {
      const seed = await seedMinimalDraftStaging("rej-bad-run");
      try {
        const packetPath = await writePacket(seed.staging, "reject.json", {
          reviewVersion: RSP_MAPPING_REVIEW_SCHEMA_VERSION,
          mappingArtifactSha256: seed.draftSha,
          runId: "other-run",
          reviewer: "SYNTHETIC_TEST_STEWARD",
          reviewedAt: "2026-10-29T12:00:00.000Z",
          decision: "REJECT",
        });
        await expect(
          runMappingApplyReview({
            workspaceRoot,
            runDir: seed.staging,
            reviewPacketPath: packetPath,
            reviewReportOverride: stubReport({
              runId: "rej-bad-run",
              mappingArtifactSha256: seed.draftSha,
            }),
          }),
        ).rejects.toThrow(/Packet binding failed/);
      } finally {
        await rm(seed.staging, { recursive: true, force: true });
      }
    });
  });

  describe("synthetic EXACT_COMPLETE APPROVE path", () => {
    let staging = "";
    let draftPath = "";
    let draftBytesBefore = Buffer.alloc(0);
    let draftSha = "";
    const runId = "apply-review-exact";

    beforeAll(async () => {
      const csv = await readFile(
        join(
          workspaceRoot,
          "src/normalization/fixtures/icann2012-reveal-day-v1/sources/strings-1200utc-13jun12-en.csv",
        ),
        "utf8",
      );
      const applicationIds = parseRevealDayCsvText(csv).map((r) => r.applicationId);
      const corpus = buildSyntheticReplayCorpus({ applicationIds });
      staging = await mkdtemp(join(tmpdir(), "rsp-apply-exact-"));
      const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";
      try {
        const live = await runMappingLive(
          {
            workspaceRoot,
            stagingRoot: staging,
            runId,
            forceNewRun: true,
            sleep: noSleep,
          },
          createSyntheticReplayFetcher(corpus),
        );
        draftPath = live.mappingArtifactPath;
        draftBytesBefore = await readFile(draftPath);
        draftSha = sha256Hex(draftBytesBefore);
      } finally {
        process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      }
    }, 120_000);

    afterAll(async () => {
      if (staging) await rm(staging, { recursive: true, force: true });
    });

    it("valid APPROVE writes approved derivative; DRAFT unchanged; eligibility + determinism + zero HTTP", async () => {
      const report = await runMappingReview({ workspaceRoot, runDir: staging });
      expect(report.mappingReviewPass).toBe(true);
      expect(report.roundWideExact).toBe(true);
      expect(report.mappingArtifactSha256).toBe(draftSha);

      const packetBody = {
        reviewVersion: RSP_MAPPING_REVIEW_SCHEMA_VERSION,
        mappingArtifactSha256: draftSha,
        runId: report.runId,
        reviewer: "SYNTHETIC_TEST_STEWARD",
        reviewedAt: "2026-10-29T12:00:00.000Z",
        decision: "APPROVE" as const,
        notes: "vitest synthetic only — not a real steward packet",
      };
      assertRspMappingReviewPacket(packetBody);

      const packetPath = await writePacket(staging, "synthetic-approve.json", packetBody);

      const originalFetch = globalThis.fetch;
      let fetchCalls = 0;
      globalThis.fetch = (async () => {
        fetchCalls += 1;
        throw new Error("HTTP forbidden in mapping-apply-review");
      }) as typeof fetch;

      let receipt1;
      try {
        receipt1 = await runMappingApplyReview({
          workspaceRoot,
          runDir: staging,
          reviewPacketPath: packetPath,
        });
      } finally {
        globalThis.fetch = originalFetch;
      }

      expect(fetchCalls).toBe(0);
      expect(receipt1.outcome).toBe("APPROVED");
      expect(receipt1.networkRequests).toBe(0);
      expect(receipt1.mechanicalEligibility).toBe(true);
      expect(receipt1.originalArtifactUnchanged).toBe(true);
      expect(receipt1.approvedOutputPath).toBeTruthy();
      expect(await readFile(receipt1.approvedOutputPath!)).toEqual(
        await readFile(stagingMappingApprovedArtifactPath(staging, runId)),
      );
      expect(await readFile(draftPath)).toEqual(draftBytesBefore);

      const approved = await loadRspMappingArtifact(receipt1.approvedOutputPath!);
      expect(approved.artifactPurpose).toBe("EVIDENCE");
      expect(approved.approvalState).toBe("APPROVED");
      expect(approved.scope).toBe("ROUND_WIDE_EXACT");
      expect(approved.entries).toEqual(
        (await loadRspMappingArtifact(draftPath)).entries,
      );
      expect(isProductionEligibleArtifact(approved)).toBe(true);

      // Determinism: second apply with same packet → byte-identical approved artifact.
      const out2 = join(staging, "mapping.approved.rerun.json");
      const receipt2 = await runMappingApplyReview({
        workspaceRoot,
        runDir: staging,
        reviewPacketPath: packetPath,
        outputPath: out2,
      });
      expect(receipt2.approvedOutputSha256).toBe(receipt1.approvedOutputSha256);
      expect(await readFile(out2)).toEqual(await readFile(receipt1.approvedOutputPath!));
      expect(await readFile(draftPath)).toEqual(draftBytesBefore);

      expect(formatMappingApplyReviewReceipt(receipt1)).toContain("networkRequests: 0");
    }, 120_000);
  });
});
