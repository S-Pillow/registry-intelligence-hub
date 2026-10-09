import type { CrossRoundOrganizationIdentitySnapshot } from "./types";

/**
 * Count steward-approved CONFIRMED cross-round mappings.
 * Does NOT unlock returning/new product metrics (RETURNING-NEW-1 is separate).
 */
export function stewardApprovedCrossRoundIdentityCount(
  snapshot: CrossRoundOrganizationIdentitySnapshot,
): number {
  return snapshot.mappings.filter((m) => m.state === "CONFIRMED" && m.stewardDecision !== null).length;
}

/**
 * Confirmed-subset cross-round identity readiness (post CROSS-ROUND-ID-1A).
 * Supports later RETURNING-NEW-1 — does not publish returning/new counts.
 */
export function confirmedSubsetCrossRoundIdentityReady(
  snapshot: CrossRoundOrganizationIdentitySnapshot,
): boolean {
  return stewardApprovedCrossRoundIdentityCount(snapshot) > 0;
}

/** Returning/new product metrics stay blocked until RETURNING-NEW-1. */
export function returningNewProductEligible(
  snapshot: CrossRoundOrganizationIdentitySnapshot,
): boolean {
  void snapshot;
  return false;
}

export function expandedContractedProductEligible(
  snapshot: CrossRoundOrganizationIdentitySnapshot,
): boolean {
  void snapshot;
  return false;
}

export function crossRoundPortfolioConcentrationEligible(
  snapshot: CrossRoundOrganizationIdentitySnapshot,
): boolean {
  void snapshot;
  return false;
}

export function unmatchedDoesNotImplyNewDisclosure(): string {
  return (
    "Absence of a confirmed 2012 match is not proof that a 2026 Organization is NEW. " +
    "The 2012 confirmed Organization layer is a partial resolved subset; unmatched cases may be " +
    "genuinely new, historically present but unresolved in 2012, represented by another legal entity, " +
    "acquired/reorganized, or otherwise outside the confirmed historical subset."
  );
}
