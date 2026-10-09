import type { CrossRoundOrganizationIdentitySnapshot } from "./types";

/**
 * CROSS-ROUND-ID-1 alone never unlocks returning/new/expanded/contracted product metrics.
 * Only later steward-approved CONFIRMED mappings may unlock confirmed-subset claims.
 */
export function stewardApprovedCrossRoundIdentityCount(
  snapshot: CrossRoundOrganizationIdentitySnapshot,
): number {
  return snapshot.mappings.filter((m) => m.state === "CONFIRMED" && m.stewardDecision !== null).length;
}

export function returningNewProductEligible(snapshot: CrossRoundOrganizationIdentitySnapshot): boolean {
  return stewardApprovedCrossRoundIdentityCount(snapshot) > 0;
}

export function expandedContractedProductEligible(
  snapshot: CrossRoundOrganizationIdentitySnapshot,
): boolean {
  return returningNewProductEligible(snapshot);
}

export function crossRoundPortfolioConcentrationEligible(
  snapshot: CrossRoundOrganizationIdentitySnapshot,
): boolean {
  return returningNewProductEligible(snapshot);
}

export function unmatchedDoesNotImplyNewDisclosure(): string {
  return (
    "Absence of a confirmed 2012 match is not proof that a 2026 Organization is NEW. " +
    "The 2012 confirmed Organization layer is a partial resolved subset; unmatched cases may be " +
    "genuinely new, historically present but unresolved in 2012, represented by another legal entity, " +
    "acquired/reorganized, or otherwise outside the confirmed historical subset."
  );
}
