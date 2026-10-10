import { describe, expect, it } from "vitest";
import {
  APPLICATION_ACTUALITY_METRIC_IDS,
  CONTENTION_ACTUALITY_METRIC_IDS,
  DEFAULT_CLAIM_ACTUALITY_STATE,
  DEFAULT_CONTENTION_ACTUALITY_STATE,
  resolveMetricEligibilityWithActuality,
  type ClaimActualityState,
  type ContentionActualityState,
} from "@/reveal-day-2026/claim-actuality";
import {
  METRIC_ELIGIBILITY_CATALOG,
  METRIC_ELIGIBILITY_CATALOG_VERSION,
  getMetricEligibility,
} from "./metric-eligibility-catalog";
import { resolveMetricEligibility } from "./metric-eligibility";

function promotedApplication(): ClaimActualityState {
  return {
    ...DEFAULT_CLAIM_ACTUALITY_STATE,
    round2026ApplicationActuality: "REAL_SOURCE_READY",
    promotedAt: "2026-10-08T00:00:00Z",
    snapshotId: "snap-aps-2026-applications-reveal-day-v1",
    snapshotContentHash: "09e75b1c83baa2a7466033de991332f396b108dc3d8c0775d3c17d99ec6b45d2",
    rawSha256: "a3e2bdba5d3950e87f173e3f576413d9600a6651c99b6946c35bcfd0b9d3553b",
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

function promotedContention(): ContentionActualityState {
  return {
    round2026ContentionActuality: "REAL_SOURCE_READY",
    snapshotId: "snap-aps-2026-contention-reveal-day-v1",
    sidecarContentHash: "480b378bab0b4d643e86d9b967f91777dcab147566747df577b469cb209825e7",
    rawSha256: "86f2ebd3764d1f3ea21d5d844cff004e271a443a3431e8ac440da7f72c67e2bf",
    applicationPublicationPinHash: "09e75b1c83baa2a7466033de991332f396b108dc3d8c0775d3c17d99ec6b45d2",
  };
}

describe("2026 metric eligibility rebaseline (catalog/2.0.0)", () => {
  it("bumps catalog version and keeps unique metric ids", () => {
    expect(METRIC_ELIGIBILITY_CATALOG_VERSION).toBe("metric-eligibility-catalog/2.0.0");
    const ids = METRIC_ELIGIBILITY_CATALOG.map((e) => e.metricId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("publication actuality REAL does not unlock unique strings under partial coverage", () => {
    const resolved = resolveMetricEligibilityWithActuality("unique-applied-strings", promotedApplication());
    expect(resolved?.methodReadiness).toBe("BLOCKED_COVERAGE");
    expect(resolved?.claimReadiness.round2026).toBe("NOT_PUBLISHED");
    expect(resolved?.comparisonAllowed).toBe(false);
    expect(resolved?.advancesWithApplicationActuality).toBe(false);
    expect(APPLICATION_ACTUALITY_METRIC_IDS).not.toContain("unique-applied-strings");
  });

  it("application count may be REAL_SOURCE_READY from official aggregate while observed records stay distinct", () => {
    const apps = resolveMetricEligibilityWithActuality("application-count", promotedApplication());
    const observed = resolveMetricEligibilityWithActuality("observed-application-records", promotedApplication());
    expect(apps?.sourceChannel).toBe("OFFICIAL_AGGREGATE");
    expect(apps?.claimReadiness.round2026).toBe("REAL_SOURCE_READY");
    expect(apps?.comparisonAllowed).toBe(true);
    expect(apps?.crossRoundStatus).toBe("READY_WITH_LIMITATION");
    expect(apps?.disclosureKeys).toContain("not-applications-length");
    expect(observed?.sourceChannel).toBe("ROW_DERIVED");
    expect(observed?.disclosureKeys).toContain("not-round-total");
  });

  it("applicant count 481 remains distinct from 480 observed names", () => {
    const official = resolveMetricEligibilityWithActuality("applicant-count", promotedApplication());
    const observed = resolveMetricEligibilityWithActuality("observed-applicant-legal-names", promotedApplication());
    expect(official?.sourceChannel).toBe("OFFICIAL_AGGREGATE");
    expect(official?.disclosureKeys).toContain("applicant-not-organization");
    expect(observed?.sourceChannel).toBe("ROW_DERIVED");
    expect(observed?.disclosureKeys).toContain("not-official-481");
    expect(official?.metricId).not.toBe(observed?.metricId);
  });

  it("IDN may be official-aggregate eligible independently of row completeness", () => {
    const idn = resolveMetricEligibilityWithActuality("idn-applications", promotedApplication());
    expect(idn?.sourceChannel).toBe("OFFICIAL_AGGREGATE");
    expect(idn?.claimReadiness.round2026).toBe("REAL_SOURCE_READY");
    expect(idn?.crossRoundStatus).toBe("READY_WITH_LIMITATION");
    expect(idn?.disclosureKeys).toContain("row-equality-not-coverage-proof");
  });

  it("Brand eligible 2026 only with no 2012 comparison", () => {
    const brand = resolveMetricEligibilityWithActuality("brand-applications", promotedApplication());
    expect(brand?.claimReadiness.round2026).toBe("REAL_SOURCE_READY");
    expect(brand?.crossRoundStatus).toBe("NOT_APPLICABLE");
    expect(brand?.claimReadiness.round2012).toBe("NOT_PUBLISHED");
  });

  it("Community 2026 orientation eligible but cross-round blocked semantics", () => {
    const community = resolveMetricEligibilityWithActuality("community-applications", promotedApplication());
    expect(community?.claimReadiness.round2026).toBe("REAL_SOURCE_READY");
    expect(community?.crossRoundStatus).toBe("BLOCKED_SEMANTICS");
  });

  it("Geographic 2026 eligible with self-identified disclosure but cross-round blocked", () => {
    const geo = resolveMetricEligibilityWithActuality("geographic-applications", promotedApplication());
    expect(geo?.claimReadiness.round2026).toBe("REAL_SOURCE_READY");
    expect(geo?.disclosureKeys).toContain("self-identified-geographic");
    expect(geo?.crossRoundStatus).toBe("BLOCKED_SEMANTICS");
  });

  it("Variants orientation eligible", () => {
    const variants = resolveMetricEligibilityWithActuality("variant-applications", promotedApplication());
    expect(variants?.claimReadiness.round2026).toBe("REAL_SOURCE_READY");
    expect(variants?.sourceChannel).toBe("OFFICIAL_AGGREGATE");
  });

  it("replacement relationship metric uses relationship grain", () => {
    const repl = resolveMetricEligibilityWithActuality("replacement-relationships", promotedApplication());
    expect(repl?.grain).toMatch(/relationship/i);
    expect(repl?.disclosureKeys).toContain("not-extra-applications");
    expect(repl?.claimReadiness.round2026).toBe("REAL_SOURCE_READY");
  });

  it("official contention metrics require contention evidence/pin and not Application actuality alone", () => {
    for (const id of ["initial-contention-sets", "initial-contention-memberships"] as const) {
      const appOnly = resolveMetricEligibilityWithActuality(id, promotedApplication());
      expect(appOnly?.claimReadiness.round2026).toBe("NOT_PUBLISHED");
      expect(CONTENTION_ACTUALITY_METRIC_IDS).toContain(id);
      expect(APPLICATION_ACTUALITY_METRIC_IDS).not.toContain(id);

      const withContention = resolveMetricEligibilityWithActuality(
        id,
        promotedApplication(),
        promotedContention(),
      );
      expect(withContention?.claimReadiness.round2026).toBe("REAL_SOURCE_READY");
      expect(withContention?.sourceChannel).toBe("OFFICIAL_CONTENTION");
    }
  });

  it("contention actuality fails closed without pin fields", () => {
    const incomplete: ContentionActualityState = {
      ...DEFAULT_CONTENTION_ACTUALITY_STATE,
      round2026ContentionActuality: "REAL_SOURCE_READY",
      sidecarContentHash: null,
      applicationPublicationPinHash: null,
    };
    const resolved = resolveMetricEligibilityWithActuality(
      "initial-contention-sets",
      promotedApplication(),
      incomplete,
    );
    expect(resolved?.claimReadiness.round2026).toBe("NOT_PUBLISHED");
  });

  it("exact-string remains separate and partial/blocked for complete claims", () => {
    const exact = resolveMetricEligibilityWithActuality("exact-applied-string-competition", promotedApplication());
    expect(exact?.sourceChannel).toBe("CALCULATED_EXACT_STRING");
    expect(exact?.methodReadiness).toBe("BLOCKED_COVERAGE");
    expect(exact?.claimReadiness.round2026).toBe("NOT_PUBLISHED");
    expect(exact?.disclosureKeys).toContain("not-official-contention");
  });

  it("organizations, returning/new, and categories remain blocked", () => {
    for (const id of [
      "organization-round-count",
      "returning-participant-identity",
      "category-mix",
    ] as const) {
      const resolved = resolveMetricEligibilityWithActuality(id, promotedApplication(), promotedContention());
      expect(resolved?.methodReadiness).toBe("BLOCKED_SOURCE");
      expect(resolved?.claimReadiness.round2026).not.toBe("REAL_SOURCE_READY");
      expect(resolved?.comparisonAllowed).toBe(false);
    }
  });

  it("cross-round matrix matches accepted eligibility decisions", () => {
    expect(getMetricEligibility("application-count")?.crossRoundStatus).toBe("READY_WITH_LIMITATION");
    expect(getMetricEligibility("idn-applications")?.crossRoundStatus).toBe("READY_WITH_LIMITATION");
    expect(getMetricEligibility("unique-applied-strings")?.crossRoundStatus).toBe("BLOCKED_COVERAGE");
    expect(getMetricEligibility("community-applications")?.crossRoundStatus).toBe("BLOCKED_SEMANTICS");
    expect(getMetricEligibility("geographic-applications")?.crossRoundStatus).toBe("BLOCKED_SEMANTICS");
    expect(getMetricEligibility("initial-contention-sets")?.crossRoundStatus).toBe("BLOCKED_METHOD");
    expect(getMetricEligibility("exact-applied-string-competition")?.crossRoundStatus).toBe("BLOCKED_COVERAGE");
    expect(getMetricEligibility("organization-round-count")?.crossRoundStatus).toBe("BLOCKED_SOURCE");
  });

  it("publication actuality and metric eligibility remain separate concepts", () => {
    expect(promotedApplication().round2026ApplicationActuality).toBe("REAL_SOURCE_READY");
    expect(resolveMetricEligibilityWithActuality("unique-applied-strings", promotedApplication())
      ?.claimReadiness.round2026).toBe("NOT_PUBLISHED");
    expect(resolveMetricEligibility("unique-applied-strings")?.claimReadiness.round2026).toBe("NOT_PUBLISHED");
  });

  it("2012 claim readiness for approved historical count metrics remains REAL_SOURCE_READY", () => {
    for (const id of ["application-count", "unique-applied-strings", "idn-applications"] as const) {
      expect(getMetricEligibility(id)?.claimReadiness.round2012).toBe("REAL_SOURCE_READY");
    }
  });
});
