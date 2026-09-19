/**
 * Offline-verified 2012 Reveal Day aggregates (`icann2012-reveal-day-v1`).
 * Approved for incremental UI comparison denominators — not post-Reveal lifecycle.
 */
export const APPROVED_2012_BASELINE_BUNDLE = "icann2012-reveal-day-v1";

export const APPROVED_2012_BASELINE = {
  bundleId: APPROVED_2012_BASELINE_BUNDLE,
  baselineAt: "2012-06-13T12:00:00.000Z",
  sourceLabel: "ICANN 2012 Reveal Day export (Internet Archive–preserved CSV)",
  parserVersion: "icann2012-parser/1.1.0",
  applications: 1930,
  uniqueStrings: 1409,
  idnApplications: 116,
  distinctCountries: 60,
  distinctRegions: 5,
  communityDesignations: 84,
  geographicDesignations: 66,
  contentionMembershipApplications: 754,
  /** Set-entity headline count — not approved for UI comparison (234 vs 232). */
  extractedContentionSetEntities: 234,
  icannCitedContentionSetEntities: 232,
} as const;

export type Approved2012Baseline = typeof APPROVED_2012_BASELINE;
