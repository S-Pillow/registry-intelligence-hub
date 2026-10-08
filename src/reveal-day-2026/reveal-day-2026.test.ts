import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_CLAIM_ACTUALITY_STATE,
  evaluateApplicationActualityPromotion,
  organizationMetricsRemainGatedAfterApplicationPromotion,
  resolveMetricEligibilityWithActuality,
} from "./claim-actuality";
import {
  readClaimActualityState,
  writeClaimActualityState,
} from "./claim-actuality-persistence";
import { buildComparisonUnlockReport } from "./comparison-unlock";
import { assertNoFixtureContaminationInRealBuild } from "./contamination";
import { loadPublicationSnapshotFromPath, runDryRunIngestion } from "./dry-run";
import type { Registry2026PublicationSnapshot } from "./types";
import { PARSER_VERSION, PUBLICATION_SCHEMA_VERSION } from "./types";
import { validatePublicationSnapshot, validationFailed } from "./validate";
import { evaluateHumanApprovals } from "./human-approval";
import { PUBLICATION_SCHEMA_VERSION_V11 } from "./types";
import { recordActualityPromotion, readPromotionHistory } from "./promotion-history";
import { runSanityChecks } from "./sanity-checks";
import {
  getProjectDocsRootForContractTests,
  PROJECT_STORE_DOC_TEST_NAME,
  projectDocPath,
  shouldSkipProjectStoreDocContractTests,
} from "@/test/project-store-docs";

const skipProjectDocs = shouldSkipProjectStoreDocContractTests();
const rehearsalSnapshotPath = join(
  process.cwd(),
  "src/reveal-day-2026/fixtures/rehearsal-2026-pipeline-v1/publication.snapshot.json",
);

describe("2026 reveal-day ingestion", () => {
  const tempDirs: string[] = [];
  afterEach(async () => {
    for (const dir of tempDirs) await rm(dir, { recursive: true, force: true });
  });

  async function tempStatePath(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "claim-actuality-"));
    tempDirs.push(dir);
    return join(dir, "claim-actuality-state.json");
  }

  it("fails validation on unexpected fields and duplicate application ids", () => {
    const bad = {
      schemaVersion: PUBLICATION_SCHEMA_VERSION,
      publicationKind: "rehearsal-for-pipeline-only",
      snapshotId: "snap-test",
      publishedAt: "2026-01-01T00:00:00Z",
      retrievedAt: "2026-01-01T00:00:00Z",
      parserVersion: PARSER_VERSION,
      normalizerVersion: "registry-2026-normalizer/1.0.0",
      source: { name: "t", url: "https://example.com", evidenceClass: "rehearsal" },
      limitations: [],
      surpriseField: true,
      applications: [
        {
          id: "APP-1",
          string: "bad",
          applicant: "A",
          organization: "O",
          country: "US",
          region: "NA",
          category: "X",
          type: "G",
          returning: false,
          idn: false,
          replacement: null,
          contentionSet: null,
          confidence: 1,
        },
        {
          id: "APP-1",
          string: "also-bad",
          applicant: "B",
          organization: "O",
          country: "US",
          region: "NA",
          category: "X",
          type: "G",
          returning: false,
          idn: false,
          replacement: null,
          contentionSet: null,
          confidence: 1,
        },
      ],
    };
    const { issues } = validatePublicationSnapshot(bad, { enforceProductionRowBounds: false });
    expect(validationFailed(issues)).toBe(true);
    expect(issues.some((i) => i.code === "unexpected-field")).toBe(true);
    expect(issues.some((i) => i.code === "duplicate-application-id")).toBe(true);
  });

  it("dry-run produces diagnostics without writing claim actuality state", async () => {
    const statePath = await tempStatePath();
    const snapshot = await loadPublicationSnapshotFromPath(rehearsalSnapshotPath);
    const before = await readClaimActualityState(statePath);
    expect(before.round2026ApplicationActuality).toBe("NOT_PUBLISHED");

    const diagnostics = runDryRunIngestion(snapshot);
    expect(diagnostics.validation.ok).toBe(true);
    expect(diagnostics.contaminationCheck.blockedForRealPromotion).toBe(true);

    const after = await readClaimActualityState(statePath);
    expect(after).toEqual(before);
  });

  it("blocks rehearsal snapshot from actuality promotion (contamination guard)", async () => {
    const snapshot = await loadPublicationSnapshotFromPath(rehearsalSnapshotPath);
    const verdict = assertNoFixtureContaminationInRealBuild(snapshot, "promote");
    expect(verdict.ok).toBe(false);

    const diagnostics = runDryRunIngestion(snapshot);
    const result = evaluateApplicationActualityPromotion(
      snapshot,
      diagnostics,
      DEFAULT_CLAIM_ACTUALITY_STATE,
      evaluateHumanApprovals({ stewardApprovalId: "stew-1", productApprovalId: "prod-1" }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /rehearsal/i.test(e))).toBe(true);
  });

  it("blocks promotion without human approvals even when machine gates pass", () => {
    const snap = minimalProductionSnapshot(100);
    const withLineage: Registry2026PublicationSnapshot = {
      ...snap,
      schemaVersion: PUBLICATION_SCHEMA_VERSION_V11,
      lineage: minimalLineage(),
    };
    const diagnostics = runDryRunIngestion(withLineage);
    const withoutApproval = evaluateApplicationActualityPromotion(
      withLineage,
      diagnostics,
      DEFAULT_CLAIM_ACTUALITY_STATE,
    );
    expect(withoutApproval.ok).toBe(false);
    expect(withoutApproval.errors.some((e) => /approval/i.test(e))).toBe(true);
  });

  it("blocks immutable publication without raw lineage (no silent JSON path)", () => {
    const snap = minimalProductionSnapshot(100);
    const diagnostics = runDryRunIngestion(snap);
    const result = evaluateApplicationActualityPromotion(
      snap,
      diagnostics,
      DEFAULT_CLAIM_ACTUALITY_STATE,
      evaluateHumanApprovals({ stewardApprovalId: "stew-1", productApprovalId: "prod-1" }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /lineage/i.test(e))).toBe(true);
  });

  it("keeps organization metrics gated after application actuality promotion", () => {
    const promoted = {
      ...DEFAULT_CLAIM_ACTUALITY_STATE,
      round2026ApplicationActuality: "REAL_SOURCE_READY" as const,
      promotedAt: "2026-06-01T00:00:00Z",
      snapshotId: "snap-real",
      snapshotContentHash: "abc",
      promotionGates: {
        snapshotValidated: true,
        parserPassed: true,
        normalizationPassed: true,
        provenanceRecorded: true,
        validationPassed: true,
        contaminationClear: true,
      },
    };

    expect(organizationMetricsRemainGatedAfterApplicationPromotion(promoted)).toBe(true);

    for (const id of ["application-count", "idn-applications"]) {
      const resolved = resolveMetricEligibilityWithActuality(id, promoted);
      expect(resolved?.claimReadiness.round2026).toBe("REAL_SOURCE_READY");
      expect(resolved?.comparisonAllowed).toBe(true);
    }
    const unique = resolveMetricEligibilityWithActuality("unique-applied-strings", promoted);
    expect(unique?.claimReadiness.round2026).toBe("NOT_PUBLISHED");
    expect(unique?.comparisonAllowed).toBe(false);

    const org = resolveMetricEligibilityWithActuality("organization-round-count", promoted);
    expect(org?.comparisonAllowed).toBe(false);
    expect(org?.claimReadiness.round2026).not.toBe("REAL_SOURCE_READY");

    const unlock = buildComparisonUnlockReport(promoted);
    expect(unlock.summary.newlyUnlockedComparisonCount).toBeGreaterThanOrEqual(2);
    expect(unlock.metrics.find((m) => m.metricId === "unique-applied-strings")?.comparisonAllowed).toBe(false);
    expect(unlock.metrics.find((m) => m.metricId === "organization-round-count")?.comparisonAllowed).toBe(false);
  });

  it("comparison-unlock report lists gated vs newly eligible metrics", () => {
    const report = buildComparisonUnlockReport(DEFAULT_CLAIM_ACTUALITY_STATE);
    expect(report.metrics.every((m) => !m.comparisonAllowed)).toBe(true);
    expect(report.strictRule).toMatch(/organization intelligence/i);
  });

  it.skipIf(skipProjectDocs)(`${PROJECT_STORE_DOC_TEST_NAME} documents reveal-day ingestion in project docs`, async () => {
    const projectDocsRoot = getProjectDocsRootForContractTests();
    const doc = await readFile(projectDocPath(projectDocsRoot, "2026-reveal-day-ingestion.md"), "utf8");
    expect(doc).toContain("reveal-2026");
    expect(doc).toContain("rehearsal-for-pipeline-only");
    expect(doc).toContain("promote-actuality");
    expect(doc).toMatch(/NOT_PUBLISHED.*REAL_SOURCE_READY/);
  });

  it.skipIf(skipProjectDocs)(`${PROJECT_STORE_DOC_TEST_NAME} documents reveal-day operations drill with pass/fail criteria`, async () => {
    const projectDocsRoot = getProjectDocsRootForContractTests();
    const drill = await readFile(projectDocPath(projectDocsRoot, "reveal-day-operations-drill.md"), "utf8");
    expect(drill).toContain("intake-derive");
    expect(drill).toContain("promotion-history.jsonl");
    expect(drill).toContain("steward-approval");
    expect(drill).toContain("must NOT promote");
  });

  it("persists promotion only via explicit write", async () => {
    const statePath = await tempStatePath();
    const promoted = {
      ...DEFAULT_CLAIM_ACTUALITY_STATE,
      round2026ApplicationActuality: "REAL_SOURCE_READY" as const,
      promotedAt: "2026-06-01T00:00:00Z",
      snapshotId: "snap-real-test",
      snapshotContentHash: "deadbeef",
      promotionGates: DEFAULT_CLAIM_ACTUALITY_STATE.promotionGates,
    };
    await writeClaimActualityState(statePath, promoted);
    const text = await readFile(statePath, "utf8");
    const parsed = JSON.parse(text);
    expect(parsed.round2026ApplicationActuality).toBe("REAL_SOURCE_READY");
  });
});

function minimalProductionSnapshot(applicationCount: number): Registry2026PublicationSnapshot {
  const applications = Array.from({ length: applicationCount }, (_, i) => ({
    id: `APP-${90000 + i}`,
    string: `str${i}`,
    applicant: `Applicant ${i} LLC`,
    organization: `Org ${i}`,
    country: "US",
    region: "North America",
    category: "Technology",
    type: "Generic",
    returning: false,
    idn: false,
    replacement: null,
    contentionSet: null,
    confidence: 1,
  }));
  return {
    schemaVersion: PUBLICATION_SCHEMA_VERSION,
    publicationKind: "immutable-publication",
    snapshotId: "snap-immutable-test-100",
    publishedAt: "2026-06-01T12:00:00Z",
    retrievedAt: "2026-06-01T12:05:00Z",
    parserVersion: PARSER_VERSION,
    normalizerVersion: "registry-2026-normalizer/1.0.0",
    source: { name: "ICANN", url: "https://newgtldprogram.icann.org/", evidenceClass: "authoritative" },
    limitations: [],
    applications,
  };
}

function minimalLineage() {
  return {
    intakeAdapterVersion: "registry-2026-intake-adapter/1.0.0",
    wireSchemaVersion: "registry-2026-intake-wire/1.0.0",
    rawSha256: "a".repeat(64),
    pipelineSourceId: "icann-2026-reveal-day-drill-ndjson",
    pipelineSourceVersion: 1,
    manifestAttemptId: "attempt-test",
    fetchUrl: "https://example.com/drill.ndjson",
    retrievedAt: "2026-06-01T12:05:00Z",
    httpStatus: 200,
    adapterId: "fixture",
    adapterSchemaVersion: "fixture-adapter/1.0.0",
    redirectChain: [] as string[],
    responseHeaderDigest: null,
  };
}

describe("immutable publication row bounds", () => {
  it("rejects suspiciously small immutable snapshots", () => {
    const snap = minimalProductionSnapshot(12);
    const { issues } = validatePublicationSnapshot(snap, { enforceProductionRowBounds: true });
    expect(issues.some((i) => i.code === "row-count-low")).toBe(true);
  });

  it("accepts production-shaped snapshot at minimum row bound with 1.1.0 lineage", () => {
    const snap: Registry2026PublicationSnapshot = {
      ...minimalProductionSnapshot(100),
      schemaVersion: PUBLICATION_SCHEMA_VERSION_V11,
      lineage: minimalLineage(),
    };
    const { issues, snapshot } = validatePublicationSnapshot(snap, { enforceProductionRowBounds: true });
    expect(validationFailed(issues)).toBe(false);
    expect(snapshot?.applications.length).toBe(100);
  });
});

describe("promotion history and sanity immutability", () => {
  const tempDirs: string[] = [];
  afterEach(async () => {
    for (const dir of tempDirs) await rm(dir, { recursive: true, force: true });
  });

  async function tempStatePath(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "claim-actuality-"));
    tempDirs.push(dir);
    return join(dir, "claim-actuality-state.json");
  }

  it("records superseded then promoted entries without editing prior lines", async () => {
    const dir = await mkdtemp(join(tmpdir(), "promo-history-"));
    tempDirs.push(dir);
    const historyPath = join(dir, "promotion-history.jsonl");
    await recordActualityPromotion({
      historyPath,
      snapshotId: "snap-a",
      snapshotContentHash: "hash-a",
      rawSha256: "raw-a",
      stewardApprovalId: "stew-1",
      productApprovalId: "prod-1",
      previousSnapshotId: null,
    });
    await recordActualityPromotion({
      historyPath,
      snapshotId: "snap-b",
      snapshotContentHash: "hash-b",
      rawSha256: "raw-b",
      stewardApprovalId: "stew-2",
      productApprovalId: "prod-2",
      previousSnapshotId: "snap-a",
    });
    const history = await readPromotionHistory(historyPath);
    expect(history.length).toBe(3);
    expect(history[0].event).toBe("promoted");
    expect(history[1].event).toBe("superseded");
    expect(history[1].supersededBySnapshotId).toBe("snap-b");
    expect(history[2].event).toBe("promoted");
    expect(history[2].supersedesSnapshotId).toBe("snap-a");
  });

  it("dry-run and sanity checks do not mutate claim state", async () => {
    const statePath = await tempStatePath();
    const snap: Registry2026PublicationSnapshot = {
      ...minimalProductionSnapshot(100),
      schemaVersion: PUBLICATION_SCHEMA_VERSION_V11,
      lineage: minimalLineage(),
    };
    const before = await readClaimActualityState(statePath);
    const diagnostics = runDryRunIngestion(snap);
    runSanityChecks(snap, diagnostics, 100);
    const after = await readClaimActualityState(statePath);
    expect(after).toEqual(before);
  });
});
