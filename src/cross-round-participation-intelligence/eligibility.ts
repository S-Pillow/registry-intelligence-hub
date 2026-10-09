import type { CrossRoundParticipationIntelligenceSnapshot } from "./types";

export function confirmedReturningSubsetReady(
  snapshot: CrossRoundParticipationIntelligenceSnapshot,
): boolean {
  return (
    snapshot.summary.confirmedReturningOrganizations > 0 &&
    snapshot.eligibilityNotes.confirmedReturning === "CONFIRMED_SUBSET_READY_WITH_LIMITATION"
  );
}

export function confirmedPortfolioChangeSubsetReady(
  snapshot: CrossRoundParticipationIntelligenceSnapshot,
): boolean {
  return confirmedReturningSubsetReady(snapshot);
}

/** Complete-round returning remains blocked. */
export function completeReturningMetricEligible(
  snapshot: CrossRoundParticipationIntelligenceSnapshot,
): boolean {
  void snapshot;
  return false;
}

/** New Organization metric remains blocked — unmatched ≠ new. */
export function newOrganizationMetricEligible(
  snapshot: CrossRoundParticipationIntelligenceSnapshot,
): boolean {
  return snapshot.summary.newOrganizationMetric.status !== "BLOCKED_SOURCE";
}

export const NEW_ORGANIZATION_BLOCKED_REASON =
  "Absence of a confirmed 2012 match does not establish new participation because historical Organization resolution is incomplete.";
