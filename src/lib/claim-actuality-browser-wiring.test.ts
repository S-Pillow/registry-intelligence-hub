import { describe, expect, it } from "vitest";
import {
  APPLICATION_ACTUALITY_METRIC_IDS,
  DEFAULT_CLAIM_ACTUALITY_STATE,
  type ClaimActualityState,
} from "@/reveal-day-2026/claim-actuality";
import { buildCommandCenterRoundPulse } from "@/comparison/historical-2012-ui-adapter";
import {
  exploreCrossRoundComparisonAllowed,
  getExploreHistoricalIntelligencePolicy,
} from "@/comparison/explore-eligibility-consumer";
import fixture from "@/data/fixtures/registry-applications.json";
import {
  assertHubCrossRoundDeltaAllowed,
  resolveHubMetricEligibility,
} from "@/lib/hub-metric-eligibility";
import {
  loadClaimActualityStateFromEnv,
  parseClaimActualityStateJson,
} from "@/lib/claim-actuality-server";

export function approvedApplicationActualityPromotionFixture(): ClaimActualityState {
  return {
    ...DEFAULT_CLAIM_ACTUALITY_STATE,
    round2026ApplicationActuality: "REAL_SOURCE_READY",
    promotedAt: "2026-06-01T12:00:00.000Z",
    snapshotId: "snap-real-browser-wiring-test",
    snapshotContentHash: "abc123",
    rawSha256: "deadbeef",
    stewardApprovalId: "stew-test",
    productApprovalId: "prod-test",
    promotionGates: {
      snapshotValidated: true,
      parserPassed: true,
      normalizationPassed: true,
      provenanceRecorded: true,
      validationPassed: true,
      contaminationClear: true,
    },
  };
}

describe("claim actuality browser wiring (acceptance)", () => {
  it("1 — no promoted state matches static catalog: NOT_PUBLISHED, no cross-round deltas", () => {
    for (const metricId of APPLICATION_ACTUALITY_METRIC_IDS) {
      const resolved = resolveHubMetricEligibility(metricId);
      expect(resolved?.claimReadiness.round2026).toBe("NOT_PUBLISHED");
      expect(resolved?.comparisonAllowed).toBe(false);
      expect(() => assertHubCrossRoundDeltaAllowed(metricId)).toThrow(/Cross-round delta blocked/);
    }
    expect(exploreCrossRoundComparisonAllowed("application-count")).toBe(false);
    const pulse = buildCommandCenterRoundPulse(fixture.applications);
    expect(pulse.every((m) => !m.comparisonAllowed)).toBe(true);
  });

  it("2 — rehearsal / non-promotable state unlocks nothing", () => {
    const rehearsalAttempt: ClaimActualityState = {
      ...DEFAULT_CLAIM_ACTUALITY_STATE,
      round2026ApplicationActuality: "NOT_PUBLISHED",
      promotionGates: {
        snapshotValidated: true,
        parserPassed: true,
        normalizationPassed: true,
        provenanceRecorded: true,
        validationPassed: true,
        contaminationClear: false,
      },
    };
    for (const metricId of APPLICATION_ACTUALITY_METRIC_IDS) {
      expect(resolveHubMetricEligibility(metricId, rehearsalAttempt)?.comparisonAllowed).toBe(false);
    }
    expect(getExploreHistoricalIntelligencePolicy(rehearsalAttempt).allMetricsDenyReal2026Identity).toBe(true);
  });

  it("3 — approved real snapshot promotion unlocks only the three application count metrics", () => {
    const promoted = approvedApplicationActualityPromotionFixture();
    for (const metricId of APPLICATION_ACTUALITY_METRIC_IDS) {
      const resolved = resolveHubMetricEligibility(metricId, promoted);
      expect(resolved?.claimReadiness.round2026).toBe("REAL_SOURCE_READY");
      expect(resolved?.comparisonAllowed).toBe(true);
      expect(() => assertHubCrossRoundDeltaAllowed(metricId, promoted)).not.toThrow();
    }
    expect(exploreCrossRoundComparisonAllowed("application-count", promoted)).toBe(true);
    expect(exploreCrossRoundComparisonAllowed("unique-applied-strings", promoted)).toBe(true);
    expect(exploreCrossRoundComparisonAllowed("idn-applications", promoted)).toBe(true);
  });

  it("4 — org, portfolio, returning identity, categories, post-Reveal metrics stay gated after application promotion", () => {
    const promoted = approvedApplicationActualityPromotionFixture();
    const stillGated = [
      "organization-round-count",
      "portfolio-concentration-round-wide",
      "returning-participant-identity",
      "category-mix",
      "historical-market-demand",
      "contention-set-count",
      "distinct-regions",
    ];
    for (const metricId of stillGated) {
      const resolved = resolveHubMetricEligibility(metricId, promoted);
      expect(resolved?.comparisonAllowed).toBe(false);
      expect(resolved?.claimReadiness.round2026).not.toBe("REAL_SOURCE_READY");
    }
    expect(getExploreHistoricalIntelligencePolicy(promoted).allMetricsDenyReal2026Identity).toBe(true);
  });
});

describe("loadPromotedClaimActualityState production inputs", () => {
  it("parses env-injected JSON when REGISTRY_HUB_CLAIM_ACTUALITY_STATE_JSON is set", () => {
    const payload = approvedApplicationActualityPromotionFixture();
    const previous = process.env.REGISTRY_HUB_CLAIM_ACTUALITY_STATE_JSON;
    process.env.REGISTRY_HUB_CLAIM_ACTUALITY_STATE_JSON = JSON.stringify(payload);
    try {
      const loaded = loadClaimActualityStateFromEnv();
      expect(loaded?.round2026ApplicationActuality).toBe("REAL_SOURCE_READY");
      expect(loaded?.snapshotId).toBe(payload.snapshotId);
    } finally {
      if (previous === undefined) delete process.env.REGISTRY_HUB_CLAIM_ACTUALITY_STATE_JSON;
      else process.env.REGISTRY_HUB_CLAIM_ACTUALITY_STATE_JSON = previous;
    }
  });

  it("rejects unsupported claim actuality state versions in env JSON", () => {
    expect(() => parseClaimActualityStateJson(JSON.stringify({ version: "claim-actuality-state/0.0.0" }))).toThrow(
      /Unsupported claim actuality state version/,
    );
  });
});
