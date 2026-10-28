import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadFixtureBundle } from "./load-bundle";
import { observationsFromParsedRecords } from "./observations";
import { normalizeFromObservations } from "./normalize";
import { parseBundle } from "./parse";
import {
  applyOrganizationPromotions,
  buildOrganizationPromotionReport,
  portfolioSizeByLegalNameFromRows,
  validatePromotionOperation,
} from "./organization-promotion";
import { buildOrganizationPromotionReportForBundle } from "./organization-promotion-report";
import { normalizeAndPersist, runNormalization } from "./pipeline";
import type { OrganizationPromotionOperation, OrganizationPromotionRegistry } from "./types";
import { ORGANIZATION_PROMOTION_METHOD_VERSION, ORGANIZATION_PROMOTION_REGISTRY_VERSION } from "./types";
import { readFile } from "node:fs/promises";
import { parseRevealDayCsvText } from "./parse-reveal-csv";

const workspaceRoot = join(import.meta.dirname, "..", "..");
const fullRoundBundleId = "icann2012-reveal-day-v1";

function baseOp(overrides: Partial<OrganizationPromotionOperation>): OrganizationPromotionOperation {
  return {
    opId: "org-prom-test",
    opVersion: 1,
    organizationKey: "test-org",
    canonicalOrganizationName: "Test Org",
    promotionState: "CONFIRMED",
    confidence: "high",
    reviewState: "steward-approved",
    methodVersion: ORGANIZATION_PROMOTION_METHOD_VERSION,
    evidence: ["Test evidence"],
    applicationIds: ["1-1099-17190"],
    reason: "Test",
    author: "test",
    createdAt: "2012-06-13T12:00:00.000Z",
    ...overrides,
  };
}

describe("organization promotion", () => {
  it("rejects CONFIRMED without evidence or steward approval", () => {
    expect(() => validatePromotionOperation(baseOp({ evidence: [] }))).toThrow(/evidence/i);
    expect(() => validatePromotionOperation(baseOp({ reviewState: "pending-review" }))).toThrow(/steward-approved/i);
    expect(() => validatePromotionOperation(baseOp({ confidence: "low" }))).toThrow(/confidence/i);
  });

  it("blocks silent merge when an application appears in two promotion ops", async () => {
    const loaded = await loadFixtureBundle(fullRoundBundleId, workspaceRoot);
    const parsed = parseBundle(loaded);
    const observations = observationsFromParsedRecords(parsed);
    const emptyPromotions: typeof loaded = {
      ...loaded,
      organizationPromotions: {
        registryVersion: ORGANIZATION_PROMOTION_REGISTRY_VERSION,
        methodVersion: ORGANIZATION_PROMOTION_METHOD_VERSION,
        operations: [],
      },
    };
    const entities = normalizeFromObservations(emptyPromotions, parsed, observations);

    const badRegistry: OrganizationPromotionRegistry = {
      registryVersion: ORGANIZATION_PROMOTION_REGISTRY_VERSION,
      methodVersion: ORGANIZATION_PROMOTION_METHOD_VERSION,
      operations: [
        baseOp({ opId: "a", organizationKey: "a", applicationIds: ["1-1099-17190"] }),
        baseOp({ opId: "b", organizationKey: "b", applicationIds: ["1-1099-17190"] }),
      ],
    };

    expect(() => applyOrganizationPromotions(entities, badRegistry)).toThrow(/Silent merge blocked/);
  });

  it("replays promotion registry deterministically on full-round rebuild", async () => {
    const dir = await mkdtemp(join(tmpdir(), "org-prom-"));
    try {
      const first = await normalizeAndPersist({ bundleId: fullRoundBundleId, workspaceRoot, storeRoot: dir });
      const second = await runNormalization({ bundleId: fullRoundBundleId, workspaceRoot, storeRoot: dir });
      expect(first.manifest.outputContentHash).toBe(second.manifest.outputContentHash);

      const promoted = first.entities.filter(
        (e) => e.entityKind === "organization" && e.promotion,
      );
      expect(promoted.length).toBe(20);
      expect(first.entities.filter((e) => e.entityKind === "applicant" && e.organizationPromotion).length).toBe(502);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("leaves non-promoted applications UNRESOLVED while applications stay NORMALIZED", async () => {
    const loaded = await loadFixtureBundle(fullRoundBundleId, workspaceRoot);
    const parsed = parseBundle(loaded);
    const observations = observationsFromParsedRecords(parsed);
    const entities = normalizeFromObservations(loaded, parsed, observations);

    const unresolvedApplicant = entities.find(
      (e) => e.entityKind === "applicant" && !e.organizationPromotion,
    );
    expect(unresolvedApplicant).toBeDefined();

    const apps = entities.filter((e) => e.entityKind === "application");
    expect(
      apps.every((a) => a.reconciliationState === "NORMALIZED" || a.reconciliationState === "MISSING_REFERENCE"),
    ).toBe(true);
  });

  it("reports promotion states and high-impact coverage for reveal day", async () => {
    const report = await buildOrganizationPromotionReportForBundle(fullRoundBundleId, workspaceRoot);
    expect(report.methodVersion).toBe(ORGANIZATION_PROMOTION_METHOD_VERSION);
    expect(report.promotionOperationCount).toBe(20);
    expect(report.promotedApplicationCount).toBe(502);
    expect(report.unresolvedApplicationCount).toBe(1930 - 502);
    expect(report.applicationsByPromotionState.CONFIRMED).toBeGreaterThan(400);
    expect(report.applicationsByPromotionState.CANDIDATE).toBe(18);
    expect(report.applicationsByPromotionState.AMBIGUOUS).toBe(17);
    expect(report.highImpactCoverageComplete).toBe(true);
    expect(report.portfolioMetricsComparable).toBe(true);
    expect(report.returningMetricsComparable).toBe(false);
  });

  it("documents portfolio concentration impact for top promoted orgs", async () => {
    const csv = await readFile(
      join(workspaceRoot, "src/normalization/fixtures/icann2012-reveal-day-v1/sources/strings-1200utc-13jun12-en.csv"),
      "utf8",
    );
    const rows = parseRevealDayCsvText(csv);
    const loaded = await loadFixtureBundle(fullRoundBundleId, workspaceRoot);
    const parsed = parseBundle(loaded);
    const report = buildOrganizationPromotionReport({
      bundleId: fullRoundBundleId,
      registry: loaded.organizationPromotions,
      entities: normalizeFromObservations(loaded, parsed, observationsFromParsedRecords(parsed)),
      applicationCount: rows.length,
      portfolioSizeByLegalName: portfolioSizeByLegalNameFromRows(rows),
    });
    const google = report.topPromotedPortfolios.find((p) => p.organizationKey === "google-charleston-road");
    expect(google?.applicationCount).toBe(101);
    expect(google?.promotionState).toBe("CONFIRMED");
  });
});
