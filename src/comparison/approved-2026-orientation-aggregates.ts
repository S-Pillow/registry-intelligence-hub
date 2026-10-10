/**
 * Approved Reveal Day 2026 official/announcement designation aggregates.
 *
 * Browser 2.x carries official Application/Applicant totals on the document.
 * Designation orientation counts (IDN/Brand/Community/Geographic/Variant) are
 * OFFICIAL_AGGREGATE channel facts from metric-eligibility-catalog/2.0.0 that are
 * not yet duplicated on the browser document shape — bind them here as a tested
 * source constant (same pattern as APPROVED_2012_BASELINE).
 *
 * Do not use these for blocked cross-round Community/Geographic deltas.
 * Do not treat designations as market sectors/categories.
 */
export const APPROVED_2026_ORIENTATION_AGGREGATES = {
  asOfLabel: "ICANN 2026 Reveal Day official/announcement aggregates",
  idnApplications: 21,
  brandApplications: 333,
  communityApplications: 16,
  /** Self-identified Geographic designation only. */
  geographicApplicationsSelfIdentified: 15,
  variantApplications: 9,
} as const;

export type Approved2026OrientationAggregates = typeof APPROVED_2026_ORIENTATION_AGGREGATES;
