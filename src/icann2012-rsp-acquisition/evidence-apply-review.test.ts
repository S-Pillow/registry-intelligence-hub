import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { networkPolicyForCommand } from "./command-mode";
import {
  EvidenceApplyReviewError,
  evaluateEvidencePromotionCompatibility,
  formatEvidenceApplyReviewReceipt,
  PILOT_PROMOTION_READINESS_REVIEW_WRAPPER_SCHEMA_VERSION,
  PILOT_Q23_EXTRACTION_WRAPPER_SCHEMA_VERSION,
  runEvidenceApplyReview,
} from "./evidence-apply-review";
import {
  HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
  type HistoricalRspEvidenceApprovalPacket,
} from "./historical-rsp-evidence-approval";
import {
  HISTORICAL_RSP_APPROVED_EVIDENCE_ROW_SCHEMA_VERSION,
  HISTORICAL_RSP_APPROVED_EVIDENCE_SCHEMA_VERSION,
} from "./historical-rsp-approved-evidence";
import { HISTORICAL_RSP_EVIDENCE_CANDIDATE_SCHEMA_VERSION } from "./historical-rsp-evidence-candidate";
import { sha256Hex } from "@/normalization/hashes";

const REAL_EXTRACTION =
  "/var/lib/registry-intelligence-hub/icann2012-rsp-pilot-evidence/pilot-2026-11-01-rih-2012-rsp-1h-1h14/q23-extraction.json";
const REAL_REVIEW =
  "/var/lib/registry-intelligence-hub/icann2012-rsp-pilot-steward-review/pilot-2026-11-01-rih-2012-rsp-1h-1h15/promotion-readiness-review.json";
const EXPECTED_1H14_SHA =
  "b7f72c89451488ee855b8b668bafa45c36ae7ce061316ce8ba5cbdca184b1d2e";
const EXPECTED_1H15_SHA =
  "ac035d32946197bfd9d950c448036aac59e74bcfc4527ceeb7595e1e2c21729a";

function sha256(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

type Cand = {
  schemaVersion: typeof HISTORICAL_RSP_EVIDENCE_CANDIDATE_SCHEMA_VERSION;
  applicationId: string;
  providerNameAsStated: string;
  sourceFieldPath: "Q23" | "Q24" | "Q25";
  evidenceClassification: "PUBLIC_ICANN";
  applicationVersionBasis: "current_public_portion";
  reviewState: "REQUIRES_STEWARD_REVIEW";
  evidenceLocator: string;
  evidenceExcerpt?: string;
  roleAsStated?: string;
};

function makeCandidate(overrides: Partial<Cand> & Pick<Cand, "applicationId" | "providerNameAsStated" | "evidenceLocator">): Cand {
  return {
    schemaVersion: HISTORICAL_RSP_EVIDENCE_CANDIDATE_SCHEMA_VERSION,
    sourceFieldPath: "Q23",
    evidenceClassification: "PUBLIC_ICANN",
    applicationVersionBasis: "current_public_portion",
    reviewState: "REQUIRES_STEWARD_REVIEW",
    evidenceExcerpt: "Registry operations are outsourced to and performed by Example Vendor.",
    roleAsStated: "registry services provider",
    ...overrides,
  };
}

function makeExtraction(candidates: Cand[]) {
  const byApp = new Map<string, Cand[]>();
  for (const c of candidates) {
    const list = byApp.get(c.applicationId) ?? [];
    list.push(c);
    byApp.set(c.applicationId, list);
  }
  const results = [...byApp.entries()].map(([applicationId, cands]) => ({
    schemaVersion: "historical-rsp-evidence-extraction/1.0.0",
    disposition: "EXPLICIT_PROVIDER_CANDIDATE",
    applicationId,
    applicationVersionBasis: "current_public_portion",
    candidates: cands,
    notes: [],
  }));
  return {
    schemaVersion: "rih-2012-rsp-pilot-q23-extraction/1.0.0",
    artifactPurpose: "EVIDENCE",
    reviewState: "REQUIRES_STEWARD_REVIEW",
    extractionToolingSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    deterministicPayloadHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    sourcePilotId: "synthetic-pilot",
    sourceDocumentCount: results.length,
    sourceDocumentShaMap: {},
    results,
    dispositionCounts: { EXPLICIT_PROVIDER_CANDIDATE: results.length },
    totalCandidateCount: candidates.length,
    candidateCountsBySourceFieldPath: { Q23: candidates.length, Q24: 0, Q25: 0 },
  };
}

function makeReview(input: {
  extractionSha: string;
  candidates: Cand[];
  classification?: string;
  readiness?: string;
}) {
  const classification = input.classification ?? "ACCEPT_EVIDENCE_CANDIDATE";
  const readiness = input.readiness ?? "READY_FOR_EVIDENCE_PROMOTION";
  const rows = input.candidates.map((c, rowIndex) => ({
    rowIndex,
    applicationId: c.applicationId,
    sourceFieldPath: c.sourceFieldPath,
    providerNameAsStated: c.providerNameAsStated,
    roleAsStated: c.roleAsStated ?? null,
    evidenceLocator: c.evidenceLocator,
    evidenceExcerpt: c.evidenceExcerpt ?? null,
    sourceCandidateReviewState: c.reviewState,
    evidenceClassification: c.evidenceClassification,
    applicationVersionBasis: c.applicationVersionBasis,
    prior1h10FidelityClassification: null,
    reviewBasis: "DIRECT_1H15_SOURCE_REVIEW",
    stewardReviewClassification: classification,
    reviewNotes: "synthetic",
  }));
  const apps = [...new Set(input.candidates.map((c) => c.applicationId))];
  return {
    schemaVersion: "rih-2012-rsp-pilot-promotion-readiness-review/1.0.0",
    artifactPurpose: "REVIEW",
    reviewState: "DRAFT",
    reviewedAt: "2026-11-03T00:00:00.000Z",
    reviewerRole: "STEWARD",
    reviewerIdentity: "SYNTHETIC",
    sourcePilotId: "synthetic-pilot",
    sourceExtractionArtifactSha256: input.extractionSha,
    sourceExtractionDeterministicPayloadHash:
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    sourceExtractionToolingSha:
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    candidateRowCount: rows.length,
    candidateBearingApplicationCount: apps.length,
    clearProviderApplicationCount: apps.length,
    rowClassificationCounts: { [classification]: rows.length },
    applicationPromotionReadinessCounts: { [readiness]: apps.length },
    rows,
    applicationLevelReadiness: apps.map((applicationId) => ({
      applicationId,
      candidateRowCount: input.candidates.filter((c) => c.applicationId === applicationId)
        .length,
      acceptedRowCount:
        classification === "ACCEPT_EVIDENCE_CANDIDATE"
          ? input.candidates.filter((c) => c.applicationId === applicationId).length
          : 0,
      rejectedRowCount:
        classification === "REJECT_EVIDENCE_CANDIDATE"
          ? input.candidates.filter((c) => c.applicationId === applicationId).length
          : 0,
      correctionNeededRowCount:
        classification === "NEEDS_CORRECTION"
          ? input.candidates.filter((c) => c.applicationId === applicationId).length
          : 0,
      literalProviderNameSet: [
        ...new Set(
          input.candidates
            .filter((c) => c.applicationId === applicationId)
            .map((c) => c.providerNameAsStated),
        ),
      ],
      applicationPromotionReadiness: readiness,
    })),
    protectedNonCandidateCases: [],
    nextStateClassification: "PILOT_PROVIDER_EVIDENCE_READY_FOR_PROMOTION",
    notes: [],
  };
}

async function seedPair(
  label: string,
  mutate?: {
    extraction?: (doc: ReturnType<typeof makeExtraction>) => unknown;
    review?: (doc: ReturnType<typeof makeReview>, extractionSha: string) => unknown;
    candidates?: Cand[];
  },
) {
  const dir = await mkdtemp(join(tmpdir(), `rsp-ear-${label}-`));
  const candidates =
    mutate?.candidates ??
    [
      makeCandidate({
        applicationId: "1-1000-1",
        providerNameAsStated: "Example Vendor, Inc",
        evidenceLocator: "Q23@10:20",
      }),
      makeCandidate({
        applicationId: "1-1000-2",
        providerNameAsStated: "Other Provider",
        evidenceLocator: "Q23@30:40",
        sourceFieldPath: "Q24",
      }),
    ];
  let extractionDoc = makeExtraction(candidates) as ReturnType<typeof makeExtraction>;
  if (mutate?.extraction) {
    extractionDoc = mutate.extraction(extractionDoc) as typeof extractionDoc;
  }
  const extractionPath = join(dir, "q23-extraction.json");
  const extractionText = `${JSON.stringify(extractionDoc, null, 2)}\n`;
  await writeFile(extractionPath, extractionText);
  const extractionSha = sha256(extractionText);

  let reviewDoc = makeReview({ extractionSha, candidates });
  if (mutate?.review) {
    reviewDoc = mutate.review(reviewDoc, extractionSha) as typeof reviewDoc;
  }
  const reviewPath = join(dir, "promotion-readiness-review.json");
  const reviewText = `${JSON.stringify(reviewDoc, null, 2)}\n`;
  await writeFile(reviewPath, reviewText);
  const reviewSha = sha256(reviewText);

  return {
    dir,
    extractionPath,
    reviewPath,
    extractionSha,
    reviewSha,
    extractionBytes: Buffer.from(extractionText, "utf8"),
    reviewBytes: Buffer.from(reviewText, "utf8"),
    candidates,
    readyCount: reviewDoc.applicationLevelReadiness.filter(
      (a) => a.applicationPromotionReadiness === "READY_FOR_EVIDENCE_PROMOTION",
    ).length,
    candidateCount: candidates.length,
  };
}

async function writePacket(
  dir: string,
  name: string,
  packet: HistoricalRspEvidenceApprovalPacket,
): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, `${JSON.stringify(packet, null, 2)}\n`);
  return path;
}

const tempDirs: string[] = [];
afterEach(async () => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

describe("RIH-2012-RSP-VISIBILITY-1H16 evidence-apply-review", () => {
  it("command network policy is zero HTTP", () => {
    const policy = networkPolicyForCommand("evidence-apply-review");
    expect(policy.allowsOutboundHttp).toBe(false);
    expect(policy.requiresPilotLiveAuth).toBe(false);
    expect(policy.requiresMappingLiveAuth).toBe(false);
    expect(policy.requiresPagerDiagnosticAuth).toBe(false);
    expect(policy.requiresPortionDiagnosticAuth).toBe(false);
  });

  it("1 — valid APPROVE writes one immutable approved derivative", async () => {
    const seed = await seedPair("approve-ok");
    tempDirs.push(seed.dir);
    const packetPath = await writePacket(seed.dir, "approve.json", {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
      sourceExtractionSha256: seed.extractionSha,
      stewardReviewSha256: seed.reviewSha,
      decision: "APPROVE",
      reviewer: "SYNTHETIC_TEST_STEWARD",
      reviewedAt: "2026-11-03T12:00:00.000Z",
      expectedCandidateRowCount: seed.candidateCount,
      expectedReadyApplicationCount: seed.readyCount,
    });
    const outputPath = join(seed.dir, "approved-evidence.json");

    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      throw new Error("HTTP forbidden in evidence-apply-review");
    }) as typeof fetch;

    let receipt;
    try {
      receipt = await runEvidenceApplyReview({
        extractionPath: seed.extractionPath,
        stewardReviewPath: seed.reviewPath,
        approvalPacketPath: packetPath,
        outputPath,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(fetchCalls).toBe(0);
    expect(receipt.outcome).toBe("APPROVED");
    expect(receipt.networkRequests).toBe(0);
    expect(receipt.mechanicalEligibility).toBe(true);
    expect(receipt.approvedOutputPath).toBe(outputPath);
    expect(receipt.extractionUnchanged).toBe(true);
    expect(receipt.reviewUnchanged).toBe(true);
    expect(await readFile(seed.extractionPath)).toEqual(seed.extractionBytes);
    expect(await readFile(seed.reviewPath)).toEqual(seed.reviewBytes);

    const approved = JSON.parse(await readFile(outputPath, "utf8")) as {
      schemaVersion: string;
      artifactPurpose: string;
      approvalState: string;
      approvedEvidenceRowCount: number;
      approvedEvidenceRows: Array<Record<string, unknown>>;
    };
    expect(approved.schemaVersion).toBe(HISTORICAL_RSP_APPROVED_EVIDENCE_SCHEMA_VERSION);
    expect(approved.artifactPurpose).toBe("EVIDENCE");
    expect(approved.approvalState).toBe("APPROVED");
    expect(approved.approvedEvidenceRowCount).toBe(2);
    expect(approved.approvedEvidenceRows[0]!.schemaVersion).toBe(
      HISTORICAL_RSP_APPROVED_EVIDENCE_ROW_SCHEMA_VERSION,
    );
    expect(approved.approvedEvidenceRows.every((r) => r.approvalState === "APPROVED")).toBe(
      true,
    );
    expect(JSON.stringify(approved).includes('"rspKey"')).toBe(false);
    expect(formatEvidenceApplyReviewReceipt(receipt)).toContain("networkRequests: 0");

    // Determinism for identical inputs
    const out2 = join(seed.dir, "approved-evidence-2.json");
    const receipt2 = await runEvidenceApplyReview({
      extractionPath: seed.extractionPath,
      stewardReviewPath: seed.reviewPath,
      approvalPacketPath: packetPath,
      outputPath: out2,
    });
    expect(receipt2.approvedOutputSha256).toBe(receipt.approvedOutputSha256);
    expect(await readFile(out2)).toEqual(await readFile(outputPath));
  });

  it("2 — HOLD writes nothing", async () => {
    const seed = await seedPair("hold");
    tempDirs.push(seed.dir);
    const packetPath = await writePacket(seed.dir, "hold.json", {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
      sourceExtractionSha256: seed.extractionSha,
      stewardReviewSha256: seed.reviewSha,
      decision: "HOLD",
      reviewer: "SYNTHETIC_TEST_STEWARD",
      reviewedAt: "2026-11-03T12:00:00.000Z",
      expectedCandidateRowCount: seed.candidateCount,
      expectedReadyApplicationCount: seed.readyCount,
    });
    const outputPath = join(seed.dir, "approved-evidence.json");
    const receipt = await runEvidenceApplyReview({
      extractionPath: seed.extractionPath,
      stewardReviewPath: seed.reviewPath,
      approvalPacketPath: packetPath,
      outputPath,
    });
    expect(receipt.outcome).toBe("HOLD_NO_PROMOTION");
    expect(receipt.approvedOutputPath).toBeNull();
    await expect(access(outputPath)).rejects.toThrow();
    expect(await readFile(seed.extractionPath)).toEqual(seed.extractionBytes);
  });

  it("3 — REJECT writes nothing", async () => {
    const seed = await seedPair("reject");
    tempDirs.push(seed.dir);
    const packetPath = await writePacket(seed.dir, "reject.json", {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
      sourceExtractionSha256: seed.extractionSha,
      stewardReviewSha256: seed.reviewSha,
      decision: "REJECT",
      reviewer: "SYNTHETIC_TEST_STEWARD",
      reviewedAt: "2026-11-03T12:00:00.000Z",
      expectedCandidateRowCount: seed.candidateCount,
      expectedReadyApplicationCount: seed.readyCount,
    });
    const outputPath = join(seed.dir, "approved-evidence.json");
    const receipt = await runEvidenceApplyReview({
      extractionPath: seed.extractionPath,
      stewardReviewPath: seed.reviewPath,
      approvalPacketPath: packetPath,
      outputPath,
    });
    expect(receipt.outcome).toBe("REJECT_NO_PROMOTION");
    await expect(access(outputPath)).rejects.toThrow();
  });

  it("4 — wrong extraction SHA rejects", async () => {
    const seed = await seedPair("bad-ext-sha");
    tempDirs.push(seed.dir);
    const packetPath = await writePacket(seed.dir, "approve.json", {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
      sourceExtractionSha256:
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      stewardReviewSha256: seed.reviewSha,
      decision: "APPROVE",
      reviewer: "SYNTHETIC_TEST_STEWARD",
      reviewedAt: "2026-11-03T12:00:00.000Z",
      expectedCandidateRowCount: seed.candidateCount,
      expectedReadyApplicationCount: seed.readyCount,
    });
    await expect(
      runEvidenceApplyReview({
        extractionPath: seed.extractionPath,
        stewardReviewPath: seed.reviewPath,
        approvalPacketPath: packetPath,
        outputPath: join(seed.dir, "out.json"),
      }),
    ).rejects.toThrow(/Packet binding failed/);
  });

  it("5 — wrong review SHA rejects", async () => {
    const seed = await seedPair("bad-rev-sha");
    tempDirs.push(seed.dir);
    const packetPath = await writePacket(seed.dir, "approve.json", {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
      sourceExtractionSha256: seed.extractionSha,
      stewardReviewSha256:
        "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      decision: "APPROVE",
      reviewer: "SYNTHETIC_TEST_STEWARD",
      reviewedAt: "2026-11-03T12:00:00.000Z",
      expectedCandidateRowCount: seed.candidateCount,
      expectedReadyApplicationCount: seed.readyCount,
    });
    await expect(
      runEvidenceApplyReview({
        extractionPath: seed.extractionPath,
        stewardReviewPath: seed.reviewPath,
        approvalPacketPath: packetPath,
        outputPath: join(seed.dir, "out.json"),
      }),
    ).rejects.toThrow(/Packet binding failed/);
  });

  it("6 — review bound to another extraction rejects", async () => {
    const seed = await seedPair("rev-bound-other", {
      review: (doc) => ({
        ...doc,
        sourceExtractionArtifactSha256:
          "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      }),
    });
    tempDirs.push(seed.dir);
    const packetPath = await writePacket(seed.dir, "approve.json", {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
      sourceExtractionSha256: seed.extractionSha,
      stewardReviewSha256: seed.reviewSha,
      decision: "APPROVE",
      reviewer: "SYNTHETIC_TEST_STEWARD",
      reviewedAt: "2026-11-03T12:00:00.000Z",
      expectedCandidateRowCount: seed.candidateCount,
      expectedReadyApplicationCount: seed.readyCount,
    });
    const err = await runEvidenceApplyReview({
      extractionPath: seed.extractionPath,
      stewardReviewPath: seed.reviewPath,
      approvalPacketPath: packetPath,
      outputPath: join(seed.dir, "out.json"),
    }).catch((e) => e);
    expect(err).toBeInstanceOf(EvidenceApplyReviewError);
    expect((err as EvidenceApplyReviewError).receipt?.outcome).toBe("APPROVE_REJECTED");
    expect((err as EvidenceApplyReviewError).message).toMatch(
      /bound to a different extraction SHA/,
    );
  });

  it("7 — one unreviewed extraction candidate rejects", async () => {
    const seed = await seedPair("unreviewed", {
      review: (doc) => ({
        ...doc,
        rows: doc.rows.slice(0, 1),
        candidateRowCount: 1,
        applicationLevelReadiness: doc.applicationLevelReadiness.slice(0, 1),
      }),
    });
    tempDirs.push(seed.dir);
    const packetPath = await writePacket(seed.dir, "approve.json", {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
      sourceExtractionSha256: seed.extractionSha,
      stewardReviewSha256: seed.reviewSha,
      decision: "APPROVE",
      reviewer: "SYNTHETIC_TEST_STEWARD",
      reviewedAt: "2026-11-03T12:00:00.000Z",
      expectedCandidateRowCount: 1,
      expectedReadyApplicationCount: 1,
    });
    const err = await runEvidenceApplyReview({
      extractionPath: seed.extractionPath,
      stewardReviewPath: seed.reviewPath,
      approvalPacketPath: packetPath,
      outputPath: join(seed.dir, "out.json"),
    }).catch((e) => e);
    expect(err).toBeInstanceOf(EvidenceApplyReviewError);
    expect((err as EvidenceApplyReviewError).receipt?.rejectReasons.join(" ")).toMatch(
      /Unreviewed extraction/,
    );
  });

  it("8 — one phantom review candidate rejects", async () => {
    const seed = await seedPair("phantom", {
      review: (doc) => ({
        ...doc,
        rows: [
          ...doc.rows,
          {
            ...doc.rows[0],
            applicationId: "1-9999-9",
            providerNameAsStated: "Phantom Provider",
            evidenceLocator: "Q23@999:1",
            rowIndex: 99,
          },
        ],
        candidateRowCount: doc.rows.length + 1,
      }),
    });
    tempDirs.push(seed.dir);
    const packetPath = await writePacket(seed.dir, "approve.json", {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
      sourceExtractionSha256: seed.extractionSha,
      stewardReviewSha256: seed.reviewSha,
      decision: "APPROVE",
      reviewer: "SYNTHETIC_TEST_STEWARD",
      reviewedAt: "2026-11-03T12:00:00.000Z",
      expectedCandidateRowCount: seed.candidateCount + 1,
      expectedReadyApplicationCount: seed.readyCount,
    });
    const err = await runEvidenceApplyReview({
      extractionPath: seed.extractionPath,
      stewardReviewPath: seed.reviewPath,
      approvalPacketPath: packetPath,
      outputPath: join(seed.dir, "out.json"),
    }).catch((e) => e);
    expect((err as EvidenceApplyReviewError).receipt?.rejectReasons.join(" ")).toMatch(
      /Phantom review/,
    );
  });

  it("9 — duplicate row identity rejects", async () => {
    const dup = makeCandidate({
      applicationId: "1-1000-1",
      providerNameAsStated: "Example Vendor, Inc",
      evidenceLocator: "Q23@10:20",
    });
    const seed = await seedPair("dup", {
      candidates: [dup, { ...dup }],
    });
    tempDirs.push(seed.dir);
    const packetPath = await writePacket(seed.dir, "approve.json", {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
      sourceExtractionSha256: seed.extractionSha,
      stewardReviewSha256: seed.reviewSha,
      decision: "APPROVE",
      reviewer: "SYNTHETIC_TEST_STEWARD",
      reviewedAt: "2026-11-03T12:00:00.000Z",
      expectedCandidateRowCount: 2,
      expectedReadyApplicationCount: 1,
    });
    const err = await runEvidenceApplyReview({
      extractionPath: seed.extractionPath,
      stewardReviewPath: seed.reviewPath,
      approvalPacketPath: packetPath,
      outputPath: join(seed.dir, "out.json"),
    }).catch((e) => e);
    expect((err as EvidenceApplyReviewError).receipt?.rejectReasons.join(" ")).toMatch(
      /Duplicate/,
    );
  });

  it("10 — one REJECT_EVIDENCE_CANDIDATE rejects", async () => {
    const seed = await seedPair("class-reject", {
      review: (doc) => ({
        ...doc,
        rows: doc.rows.map((r, i) =>
          i === 0
            ? { ...r, stewardReviewClassification: "REJECT_EVIDENCE_CANDIDATE" }
            : r,
        ),
        applicationLevelReadiness: doc.applicationLevelReadiness.map((a) => ({
          ...a,
          applicationPromotionReadiness: "NOT_READY_FOR_EVIDENCE_PROMOTION",
        })),
      }),
    });
    tempDirs.push(seed.dir);
    const packetPath = await writePacket(seed.dir, "approve.json", {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
      sourceExtractionSha256: seed.extractionSha,
      stewardReviewSha256: seed.reviewSha,
      decision: "APPROVE",
      reviewer: "SYNTHETIC_TEST_STEWARD",
      reviewedAt: "2026-11-03T12:00:00.000Z",
      expectedCandidateRowCount: seed.candidateCount,
      expectedReadyApplicationCount: 0,
    });
    const err = await runEvidenceApplyReview({
      extractionPath: seed.extractionPath,
      stewardReviewPath: seed.reviewPath,
      approvalPacketPath: packetPath,
      outputPath: join(seed.dir, "out.json"),
    }).catch((e) => e);
    expect((err as EvidenceApplyReviewError).receipt?.rejectReasons.join(" ")).toMatch(
      /REJECT_EVIDENCE_CANDIDATE/,
    );
  });

  it("11 — one NEEDS_CORRECTION rejects", async () => {
    const seed = await seedPair("needs-corr", {
      review: (doc) => ({
        ...doc,
        rows: doc.rows.map((r, i) =>
          i === 0 ? { ...r, stewardReviewClassification: "NEEDS_CORRECTION" } : r,
        ),
        applicationLevelReadiness: doc.applicationLevelReadiness.map((a) => ({
          ...a,
          applicationPromotionReadiness: "NOT_READY_FOR_EVIDENCE_PROMOTION",
        })),
      }),
    });
    tempDirs.push(seed.dir);
    const packetPath = await writePacket(seed.dir, "approve.json", {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
      sourceExtractionSha256: seed.extractionSha,
      stewardReviewSha256: seed.reviewSha,
      decision: "APPROVE",
      reviewer: "SYNTHETIC_TEST_STEWARD",
      reviewedAt: "2026-11-03T12:00:00.000Z",
      expectedCandidateRowCount: seed.candidateCount,
      expectedReadyApplicationCount: 0,
    });
    const err = await runEvidenceApplyReview({
      extractionPath: seed.extractionPath,
      stewardReviewPath: seed.reviewPath,
      approvalPacketPath: packetPath,
      outputPath: join(seed.dir, "out.json"),
    }).catch((e) => e);
    expect((err as EvidenceApplyReviewError).receipt?.rejectReasons.join(" ")).toMatch(
      /NEEDS_CORRECTION/,
    );
  });

  it("12 — one application not promotion-ready rejects", async () => {
    const seed = await seedPair("not-ready", {
      review: (doc) => ({
        ...doc,
        applicationLevelReadiness: doc.applicationLevelReadiness.map((a, i) =>
          i === 0
            ? {
                ...a,
                applicationPromotionReadiness: "NOT_READY_FOR_EVIDENCE_PROMOTION",
              }
            : a,
        ),
      }),
    });
    tempDirs.push(seed.dir);
    const packetPath = await writePacket(seed.dir, "approve.json", {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
      sourceExtractionSha256: seed.extractionSha,
      stewardReviewSha256: seed.reviewSha,
      decision: "APPROVE",
      reviewer: "SYNTHETIC_TEST_STEWARD",
      reviewedAt: "2026-11-03T12:00:00.000Z",
      expectedCandidateRowCount: seed.candidateCount,
      expectedReadyApplicationCount: 1,
    });
    const err = await runEvidenceApplyReview({
      extractionPath: seed.extractionPath,
      stewardReviewPath: seed.reviewPath,
      approvalPacketPath: packetPath,
      outputPath: join(seed.dir, "out.json"),
    }).catch((e) => e);
    expect((err as EvidenceApplyReviewError).receipt?.rejectReasons.join(" ")).toMatch(
      /not READY_FOR_EVIDENCE_PROMOTION/,
    );
  });

  it("13 — candidate not PUBLIC_ICANN rejects", async () => {
    const seed = await seedPair("not-public", {
      extraction: (doc) => ({
        ...doc,
        results: doc.results.map((r, i) =>
          i === 0
            ? {
                ...r,
                candidates: r.candidates.map((c, j) =>
                  j === 0
                    ? { ...c, evidenceClassification: "OTHER_SOURCE" }
                    : c,
                ),
              }
            : r,
        ),
      }),
    });
    tempDirs.push(seed.dir);
    const packetPath = await writePacket(seed.dir, "approve.json", {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
      sourceExtractionSha256: seed.extractionSha,
      stewardReviewSha256: seed.reviewSha,
      decision: "APPROVE",
      reviewer: "SYNTHETIC_TEST_STEWARD",
      reviewedAt: "2026-11-03T12:00:00.000Z",
      expectedCandidateRowCount: seed.candidateCount,
      expectedReadyApplicationCount: seed.readyCount,
    });
    const err = await runEvidenceApplyReview({
      extractionPath: seed.extractionPath,
      stewardReviewPath: seed.reviewPath,
      approvalPacketPath: packetPath,
      outputPath: join(seed.dir, "out.json"),
    }).catch((e) => e);
    expect((err as EvidenceApplyReviewError).receipt?.rejectReasons.join(" ")).toMatch(
      /PUBLIC_ICANN/,
    );
  });

  it("14 — candidate not current_public_portion rejects", async () => {
    const seed = await seedPair("bad-basis", {
      extraction: (doc) => ({
        ...doc,
        results: doc.results.map((r, i) =>
          i === 0
            ? {
                ...r,
                candidates: r.candidates.map((c, j) =>
                  j === 0
                    ? { ...c, applicationVersionBasis: "other_basis" }
                    : c,
                ),
              }
            : r,
        ),
      }),
    });
    tempDirs.push(seed.dir);
    const packetPath = await writePacket(seed.dir, "approve.json", {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
      sourceExtractionSha256: seed.extractionSha,
      stewardReviewSha256: seed.reviewSha,
      decision: "APPROVE",
      reviewer: "SYNTHETIC_TEST_STEWARD",
      reviewedAt: "2026-11-03T12:00:00.000Z",
      expectedCandidateRowCount: seed.candidateCount,
      expectedReadyApplicationCount: seed.readyCount,
    });
    const err = await runEvidenceApplyReview({
      extractionPath: seed.extractionPath,
      stewardReviewPath: seed.reviewPath,
      approvalPacketPath: packetPath,
      outputPath: join(seed.dir, "out.json"),
    }).catch((e) => e);
    expect((err as EvidenceApplyReviewError).receipt?.rejectReasons.join(" ")).toMatch(
      /current_public_portion/,
    );
  });

  it("15 — candidate not REQUIRES_STEWARD_REVIEW rejects", async () => {
    const seed = await seedPair("bad-review-state", {
      extraction: (doc) => ({
        ...doc,
        results: doc.results.map((r, i) =>
          i === 0
            ? {
                ...r,
                candidates: r.candidates.map((c, j) =>
                  j === 0 ? { ...c, reviewState: "APPROVED" } : c,
                ),
              }
            : r,
        ),
      }),
    });
    tempDirs.push(seed.dir);
    const packetPath = await writePacket(seed.dir, "approve.json", {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
      sourceExtractionSha256: seed.extractionSha,
      stewardReviewSha256: seed.reviewSha,
      decision: "APPROVE",
      reviewer: "SYNTHETIC_TEST_STEWARD",
      reviewedAt: "2026-11-03T12:00:00.000Z",
      expectedCandidateRowCount: seed.candidateCount,
      expectedReadyApplicationCount: seed.readyCount,
    });
    const err = await runEvidenceApplyReview({
      extractionPath: seed.extractionPath,
      stewardReviewPath: seed.reviewPath,
      approvalPacketPath: packetPath,
      outputPath: join(seed.dir, "out.json"),
    }).catch((e) => e);
    expect((err as EvidenceApplyReviewError).receipt?.rejectReasons.join(" ")).toMatch(
      /REQUIRES_STEWARD_REVIEW/,
    );
  });

  it("16 — prohibited rspKey / normalized provider identity rejects", async () => {
    const seed = await seedPair("rspkey", {
      extraction: (doc) => ({
        ...doc,
        results: doc.results.map((r, i) =>
          i === 0
            ? {
                ...r,
                candidates: r.candidates.map((c, j) =>
                  j === 0 ? { ...c, rspKey: "evil" } : c,
                ),
              }
            : r,
        ),
      }),
    });
    tempDirs.push(seed.dir);
    const packetPath = await writePacket(seed.dir, "approve.json", {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
      sourceExtractionSha256: seed.extractionSha,
      stewardReviewSha256: seed.reviewSha,
      decision: "APPROVE",
      reviewer: "SYNTHETIC_TEST_STEWARD",
      reviewedAt: "2026-11-03T12:00:00.000Z",
      expectedCandidateRowCount: seed.candidateCount,
      expectedReadyApplicationCount: seed.readyCount,
    });
    const err = await runEvidenceApplyReview({
      extractionPath: seed.extractionPath,
      stewardReviewPath: seed.reviewPath,
      approvalPacketPath: packetPath,
      outputPath: join(seed.dir, "out.json"),
    }).catch((e) => e);
    expect((err as EvidenceApplyReviewError).receipt?.rejectReasons.join(" ")).toMatch(
      /prohibited field/,
    );
  });

  it("17 — packet expected counts mismatch rejects", async () => {
    const seed = await seedPair("count-mismatch");
    tempDirs.push(seed.dir);
    const packetPath = await writePacket(seed.dir, "approve.json", {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
      sourceExtractionSha256: seed.extractionSha,
      stewardReviewSha256: seed.reviewSha,
      decision: "APPROVE",
      reviewer: "SYNTHETIC_TEST_STEWARD",
      reviewedAt: "2026-11-03T12:00:00.000Z",
      expectedCandidateRowCount: 99,
      expectedReadyApplicationCount: seed.readyCount,
    });
    const err = await runEvidenceApplyReview({
      extractionPath: seed.extractionPath,
      stewardReviewPath: seed.reviewPath,
      approvalPacketPath: packetPath,
      outputPath: join(seed.dir, "out.json"),
    }).catch((e) => e);
    expect((err as EvidenceApplyReviewError).receipt?.rejectReasons.join(" ")).toMatch(
      /expectedCandidateRowCount/,
    );
  });

  it("18 — output collision with extraction rejects", async () => {
    const seed = await seedPair("collide-ext");
    tempDirs.push(seed.dir);
    const packetPath = await writePacket(seed.dir, "approve.json", {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
      sourceExtractionSha256: seed.extractionSha,
      stewardReviewSha256: seed.reviewSha,
      decision: "APPROVE",
      reviewer: "SYNTHETIC_TEST_STEWARD",
      reviewedAt: "2026-11-03T12:00:00.000Z",
      expectedCandidateRowCount: seed.candidateCount,
      expectedReadyApplicationCount: seed.readyCount,
    });
    await expect(
      runEvidenceApplyReview({
        extractionPath: seed.extractionPath,
        stewardReviewPath: seed.reviewPath,
        approvalPacketPath: packetPath,
        outputPath: seed.extractionPath,
      }),
    ).rejects.toThrow(/Output path collision/);
  });

  it("19 — output collision with review rejects", async () => {
    const seed = await seedPair("collide-rev");
    tempDirs.push(seed.dir);
    const packetPath = await writePacket(seed.dir, "approve.json", {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
      sourceExtractionSha256: seed.extractionSha,
      stewardReviewSha256: seed.reviewSha,
      decision: "APPROVE",
      reviewer: "SYNTHETIC_TEST_STEWARD",
      reviewedAt: "2026-11-03T12:00:00.000Z",
      expectedCandidateRowCount: seed.candidateCount,
      expectedReadyApplicationCount: seed.readyCount,
    });
    await expect(
      runEvidenceApplyReview({
        extractionPath: seed.extractionPath,
        stewardReviewPath: seed.reviewPath,
        approvalPacketPath: packetPath,
        outputPath: seed.reviewPath,
      }),
    ).rejects.toThrow(/Output path collision/);
  });

  it("20 — output collision with packet rejects", async () => {
    const seed = await seedPair("collide-pkt");
    tempDirs.push(seed.dir);
    const packetPath = await writePacket(seed.dir, "approve.json", {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
      sourceExtractionSha256: seed.extractionSha,
      stewardReviewSha256: seed.reviewSha,
      decision: "APPROVE",
      reviewer: "SYNTHETIC_TEST_STEWARD",
      reviewedAt: "2026-11-03T12:00:00.000Z",
      expectedCandidateRowCount: seed.candidateCount,
      expectedReadyApplicationCount: seed.readyCount,
    });
    await expect(
      runEvidenceApplyReview({
        extractionPath: seed.extractionPath,
        stewardReviewPath: seed.reviewPath,
        approvalPacketPath: packetPath,
        outputPath: packetPath,
      }),
    ).rejects.toThrow(/Output path collision/);
  });

  it("21 — pre-existing output rejects", async () => {
    const seed = await seedPair("exists");
    tempDirs.push(seed.dir);
    const outputPath = join(seed.dir, "approved-evidence.json");
    await writeFile(outputPath, "{}\n");
    const packetPath = await writePacket(seed.dir, "approve.json", {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
      sourceExtractionSha256: seed.extractionSha,
      stewardReviewSha256: seed.reviewSha,
      decision: "APPROVE",
      reviewer: "SYNTHETIC_TEST_STEWARD",
      reviewedAt: "2026-11-03T12:00:00.000Z",
      expectedCandidateRowCount: seed.candidateCount,
      expectedReadyApplicationCount: seed.readyCount,
    });
    await expect(
      runEvidenceApplyReview({
        extractionPath: seed.extractionPath,
        stewardReviewPath: seed.reviewPath,
        approvalPacketPath: packetPath,
        outputPath,
      }),
    ).rejects.toThrow(/already exists/);
  });

  it("22 — source extraction mutation between validation and write rejects", async () => {
    const seed = await seedPair("mut-ext");
    tempDirs.push(seed.dir);
    const packetPath = await writePacket(seed.dir, "approve.json", {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
      sourceExtractionSha256: seed.extractionSha,
      stewardReviewSha256: seed.reviewSha,
      decision: "APPROVE",
      reviewer: "SYNTHETIC_TEST_STEWARD",
      reviewedAt: "2026-11-03T12:00:00.000Z",
      expectedCandidateRowCount: seed.candidateCount,
      expectedReadyApplicationCount: seed.readyCount,
    });
    await expect(
      runEvidenceApplyReview({
        extractionPath: seed.extractionPath,
        stewardReviewPath: seed.reviewPath,
        approvalPacketPath: packetPath,
        outputPath: join(seed.dir, "out.json"),
        testBeforeExclusiveWrite: async () => {
          await writeFile(seed.extractionPath, `${seed.extractionBytes.toString("utf8")} \n`);
        },
      }),
    ).rejects.toThrow(/extraction artifact changed/);
    await expect(access(join(seed.dir, "out.json"))).rejects.toThrow();
  });

  it("23 — review mutation between validation and write rejects", async () => {
    const seed = await seedPair("mut-rev");
    tempDirs.push(seed.dir);
    const packetPath = await writePacket(seed.dir, "approve.json", {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
      sourceExtractionSha256: seed.extractionSha,
      stewardReviewSha256: seed.reviewSha,
      decision: "APPROVE",
      reviewer: "SYNTHETIC_TEST_STEWARD",
      reviewedAt: "2026-11-03T12:00:00.000Z",
      expectedCandidateRowCount: seed.candidateCount,
      expectedReadyApplicationCount: seed.readyCount,
    });
    await expect(
      runEvidenceApplyReview({
        extractionPath: seed.extractionPath,
        stewardReviewPath: seed.reviewPath,
        approvalPacketPath: packetPath,
        outputPath: join(seed.dir, "out.json"),
        testBeforeExclusiveWrite: async () => {
          await writeFile(seed.reviewPath, `${seed.reviewBytes.toString("utf8")} \n`);
        },
      }),
    ).rejects.toThrow(/steward review artifact changed/);
    await expect(access(join(seed.dir, "out.json"))).rejects.toThrow();
  });

  it("24 — source/review bytes unchanged after successful approval", async () => {
    const seed = await seedPair("unchanged");
    tempDirs.push(seed.dir);
    const packetPath = await writePacket(seed.dir, "approve.json", {
      schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
      sourceExtractionSha256: seed.extractionSha,
      stewardReviewSha256: seed.reviewSha,
      decision: "APPROVE",
      reviewer: "SYNTHETIC_TEST_STEWARD",
      reviewedAt: "2026-11-03T12:00:00.000Z",
      expectedCandidateRowCount: seed.candidateCount,
      expectedReadyApplicationCount: seed.readyCount,
    });
    const receipt = await runEvidenceApplyReview({
      extractionPath: seed.extractionPath,
      stewardReviewPath: seed.reviewPath,
      approvalPacketPath: packetPath,
      outputPath: join(seed.dir, "out.json"),
    });
    expect(receipt.outcome).toBe("APPROVED");
    expect(await readFile(seed.extractionPath)).toEqual(seed.extractionBytes);
    expect(await readFile(seed.reviewPath)).toEqual(seed.reviewBytes);
  });

  it("25 — command network policy is zero HTTP (durable)", () => {
    expect(networkPolicyForCommand("evidence-apply-review").allowsOutboundHttp).toBe(false);
  });

  describe("1H16-R1 integrity hardening", () => {
    it("R1 — missing readiness entry rejects", async () => {
      const seed = await seedPair("r1-missing-ready", {
        review: (doc) => ({
          ...doc,
          applicationLevelReadiness: doc.applicationLevelReadiness.slice(0, 1),
        }),
      });
      tempDirs.push(seed.dir);
      const packetPath = await writePacket(seed.dir, "approve.json", {
        schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
        sourceExtractionSha256: seed.extractionSha,
        stewardReviewSha256: seed.reviewSha,
        decision: "APPROVE",
        reviewer: "SYNTHETIC_TEST_STEWARD",
        reviewedAt: "2026-11-03T12:00:00.000Z",
        expectedCandidateRowCount: seed.candidateCount,
        expectedReadyApplicationCount: 1,
      });
      const err = await runEvidenceApplyReview({
        extractionPath: seed.extractionPath,
        stewardReviewPath: seed.reviewPath,
        approvalPacketPath: packetPath,
        outputPath: join(seed.dir, "out.json"),
      }).catch((e) => e);
      expect(err).toBeInstanceOf(EvidenceApplyReviewError);
      expect((err as EvidenceApplyReviewError).receipt?.rejectReasons.join(" ")).toMatch(
        /Missing applicationLevelReadiness/,
      );
    });

    it("R1 — duplicate readiness entry rejects", async () => {
      const seed = await seedPair("r1-dup-ready", {
        review: (doc) => ({
          ...doc,
          applicationLevelReadiness: [
            ...doc.applicationLevelReadiness,
            { ...doc.applicationLevelReadiness[0]! },
          ],
        }),
      });
      tempDirs.push(seed.dir);
      const packetPath = await writePacket(seed.dir, "approve.json", {
        schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
        sourceExtractionSha256: seed.extractionSha,
        stewardReviewSha256: seed.reviewSha,
        decision: "APPROVE",
        reviewer: "SYNTHETIC_TEST_STEWARD",
        reviewedAt: "2026-11-03T12:00:00.000Z",
        expectedCandidateRowCount: seed.candidateCount,
        expectedReadyApplicationCount: seed.readyCount,
      });
      const err = await runEvidenceApplyReview({
        extractionPath: seed.extractionPath,
        stewardReviewPath: seed.reviewPath,
        approvalPacketPath: packetPath,
        outputPath: join(seed.dir, "out.json"),
      }).catch((e) => e);
      expect((err as EvidenceApplyReviewError).receipt?.rejectReasons.join(" ")).toMatch(
        /Duplicate applicationLevelReadiness/,
      );
    });

    it("R1 — phantom readiness application rejects", async () => {
      const seed = await seedPair("r1-phantom-ready", {
        review: (doc) => ({
          ...doc,
          applicationLevelReadiness: [
            ...doc.applicationLevelReadiness,
            {
              applicationId: "1-0000-phantom",
              candidateRowCount: 1,
              acceptedRowCount: 1,
              rejectedRowCount: 0,
              correctionNeededRowCount: 0,
              literalProviderNameSet: ["Phantom"],
              applicationPromotionReadiness: "READY_FOR_EVIDENCE_PROMOTION",
            },
          ],
        }),
      });
      tempDirs.push(seed.dir);
      const packetPath = await writePacket(seed.dir, "approve.json", {
        schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
        sourceExtractionSha256: seed.extractionSha,
        stewardReviewSha256: seed.reviewSha,
        decision: "APPROVE",
        reviewer: "SYNTHETIC_TEST_STEWARD",
        reviewedAt: "2026-11-03T12:00:00.000Z",
        expectedCandidateRowCount: seed.candidateCount,
        expectedReadyApplicationCount: seed.readyCount,
      });
      const err = await runEvidenceApplyReview({
        extractionPath: seed.extractionPath,
        stewardReviewPath: seed.reviewPath,
        approvalPacketPath: packetPath,
        outputPath: join(seed.dir, "out.json"),
      }).catch((e) => e);
      expect((err as EvidenceApplyReviewError).receipt?.rejectReasons.join(" ")).toMatch(
        /Phantom applicationLevelReadiness/,
      );
    });

    it("R1 — wrong candidateRowCount rejects", async () => {
      const seed = await seedPair("r1-wrong-count", {
        review: (doc) => ({
          ...doc,
          applicationLevelReadiness: doc.applicationLevelReadiness.map((a, i) =>
            i === 0 ? { ...a, candidateRowCount: 99 } : a,
          ),
        }),
      });
      tempDirs.push(seed.dir);
      const packetPath = await writePacket(seed.dir, "approve.json", {
        schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
        sourceExtractionSha256: seed.extractionSha,
        stewardReviewSha256: seed.reviewSha,
        decision: "APPROVE",
        reviewer: "SYNTHETIC_TEST_STEWARD",
        reviewedAt: "2026-11-03T12:00:00.000Z",
        expectedCandidateRowCount: seed.candidateCount,
        expectedReadyApplicationCount: seed.readyCount,
      });
      const err = await runEvidenceApplyReview({
        extractionPath: seed.extractionPath,
        stewardReviewPath: seed.reviewPath,
        approvalPacketPath: packetPath,
        outputPath: join(seed.dir, "out.json"),
      }).catch((e) => e);
      expect((err as EvidenceApplyReviewError).receipt?.rejectReasons.join(" ")).toMatch(
        /candidateRowCount mismatches/,
      );
    });

    it("R1 — wrong extraction wrapper schema rejects", async () => {
      const seed = await seedPair("r1-bad-ext-schema", {
        extraction: (doc) => ({
          ...doc,
          schemaVersion: "rih-2012-rsp-pilot-q23-extraction/9.9.9",
        }),
      });
      tempDirs.push(seed.dir);
      const packetPath = await writePacket(seed.dir, "approve.json", {
        schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
        sourceExtractionSha256: seed.extractionSha,
        stewardReviewSha256: seed.reviewSha,
        decision: "APPROVE",
        reviewer: "SYNTHETIC_TEST_STEWARD",
        reviewedAt: "2026-11-03T12:00:00.000Z",
        expectedCandidateRowCount: seed.candidateCount,
        expectedReadyApplicationCount: seed.readyCount,
      });
      await expect(
        runEvidenceApplyReview({
          extractionPath: seed.extractionPath,
          stewardReviewPath: seed.reviewPath,
          approvalPacketPath: packetPath,
          outputPath: join(seed.dir, "out.json"),
        }),
      ).rejects.toThrow(/Extraction wrapper schema rejected/);
    });

    it("R1 — wrong steward-review wrapper schema rejects", async () => {
      const seed = await seedPair("r1-bad-rev-schema", {
        review: (doc) => ({
          ...doc,
          schemaVersion: "rih-2012-rsp-pilot-promotion-readiness-review/9.9.9",
        }),
      });
      tempDirs.push(seed.dir);
      const packetPath = await writePacket(seed.dir, "approve.json", {
        schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
        sourceExtractionSha256: seed.extractionSha,
        stewardReviewSha256: seed.reviewSha,
        decision: "APPROVE",
        reviewer: "SYNTHETIC_TEST_STEWARD",
        reviewedAt: "2026-11-03T12:00:00.000Z",
        expectedCandidateRowCount: seed.candidateCount,
        expectedReadyApplicationCount: seed.readyCount,
      });
      await expect(
        runEvidenceApplyReview({
          extractionPath: seed.extractionPath,
          stewardReviewPath: seed.reviewPath,
          approvalPacketPath: packetPath,
          outputPath: join(seed.dir, "out.json"),
        }),
      ).rejects.toThrow(/Steward review wrapper schema rejected/);
    });

    it("R1 — packet SHA and decision derive from identical single-read bytes", async () => {
      const seed = await seedPair("r1-packet-bytes");
      tempDirs.push(seed.dir);
      const packetBody: HistoricalRspEvidenceApprovalPacket = {
        schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
        sourceExtractionSha256: seed.extractionSha,
        stewardReviewSha256: seed.reviewSha,
        decision: "APPROVE",
        reviewer: "SYNTHETIC_TEST_STEWARD",
        reviewedAt: "2026-11-03T12:00:00.000Z",
        expectedCandidateRowCount: seed.candidateCount,
        expectedReadyApplicationCount: seed.readyCount,
      };
      const packetPath = await writePacket(seed.dir, "approve.json", packetBody);
      const packetBytes = await readFile(packetPath);
      const expectedPacketSha = sha256Hex(packetBytes);
      const receipt = await runEvidenceApplyReview({
        extractionPath: seed.extractionPath,
        stewardReviewPath: seed.reviewPath,
        approvalPacketPath: packetPath,
        outputPath: join(seed.dir, "out.json"),
      });
      expect(receipt.outcome).toBe("APPROVED");
      expect(receipt.approvalPacketSha256).toBe(expectedPacketSha);
      expect(receipt.decision).toBe("APPROVE");
      expect(receipt.approvalPacketUnchanged).toBe(true);
      expect(PILOT_Q23_EXTRACTION_WRAPPER_SCHEMA_VERSION).toBe(
        "rih-2012-rsp-pilot-q23-extraction/1.0.0",
      );
      expect(PILOT_PROMOTION_READINESS_REVIEW_WRAPPER_SCHEMA_VERSION).toBe(
        "rih-2012-rsp-pilot-promotion-readiness-review/1.0.0",
      );
    });

    it("R1 — approval packet mutation before write rejects", async () => {
      const seed = await seedPair("r1-mut-packet");
      tempDirs.push(seed.dir);
      const packetPath = await writePacket(seed.dir, "approve.json", {
        schemaVersion: HISTORICAL_RSP_EVIDENCE_APPROVAL_SCHEMA_VERSION,
        sourceExtractionSha256: seed.extractionSha,
        stewardReviewSha256: seed.reviewSha,
        decision: "APPROVE",
        reviewer: "SYNTHETIC_TEST_STEWARD",
        reviewedAt: "2026-11-03T12:00:00.000Z",
        expectedCandidateRowCount: seed.candidateCount,
        expectedReadyApplicationCount: seed.readyCount,
      });
      await expect(
        runEvidenceApplyReview({
          extractionPath: seed.extractionPath,
          stewardReviewPath: seed.reviewPath,
          approvalPacketPath: packetPath,
          outputPath: join(seed.dir, "out.json"),
          testBeforeExclusiveWrite: async () => {
            const current = await readFile(packetPath);
            await writeFile(packetPath, `${current.toString("utf8")} \n`);
          },
        }),
      ).rejects.toThrow(/approval packet changed/);
      await expect(access(join(seed.dir, "out.json"))).rejects.toThrow();
    });
  });

  it("read-only real 1H14/1H15 compatibility check performs no writes", async () => {
    const extractionBytes = await readFile(REAL_EXTRACTION);
    const reviewBytes = await readFile(REAL_REVIEW);
    expect(sha256(extractionBytes)).toBe(EXPECTED_1H14_SHA);
    expect(sha256(reviewBytes)).toBe(EXPECTED_1H15_SHA);

    const compat = evaluateEvidencePromotionCompatibility({
      extractionBytes,
      stewardReviewBytes: reviewBytes,
    });
    expect(compat.extractionSha256).toBe(EXPECTED_1H14_SHA);
    expect(compat.stewardReviewSha256).toBe(EXPECTED_1H15_SHA);
    expect(compat.extractionCandidateCount).toBe(34);
    expect(compat.reviewedCandidateCount).toBe(34);
    expect(compat.acceptCount).toBe(34);
    expect(compat.rejectCount).toBe(0);
    expect(compat.needsCorrectionCount).toBe(0);
    expect(compat.expectedCandidateBearingApplicationCount).toBe(19);
    expect(compat.readinessEntryCount).toBe(19);
    expect(compat.readyApplicationCount).toBe(19);
    expect(compat.applicationReadinessReconciliation.ok).toBe(true);
    expect(compat.applicationReadinessReconciliation.missingApplicationIds).toEqual([]);
    expect(compat.applicationReadinessReconciliation.duplicateApplicationIds).toEqual([]);
    expect(compat.applicationReadinessReconciliation.phantomApplicationIds).toEqual([]);
    expect(compat.applicationReadinessReconciliation.candidateRowCountMismatches).toEqual([]);
    expect(compat.reconciliation.ok).toBe(true);
    expect(compat.prohibitedIdentityFieldHits).toEqual([]);
    expect(compat.mechanicallyEligibleIgnoringPacket).toBe(true);
    expect(compat.errors).toEqual([]);

    // Inputs unchanged
    expect(sha256(await readFile(REAL_EXTRACTION))).toBe(EXPECTED_1H14_SHA);
    expect(sha256(await readFile(REAL_REVIEW))).toBe(EXPECTED_1H15_SHA);
  });
});
