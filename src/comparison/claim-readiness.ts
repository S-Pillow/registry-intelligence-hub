/** Data actuality / claim readiness for a round — orthogonal to method readiness. */
export type ClaimReadiness =
  | "HISTORICAL_ONLY"
  | "REHEARSAL_ONLY"
  | "REAL_SOURCE_READY"
  | "NOT_PUBLISHED";

export type RoundClaimReadiness = {
  round2012: ClaimReadiness;
  round2026: ClaimReadiness;
};
