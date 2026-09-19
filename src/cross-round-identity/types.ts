export const CROSS_ROUND_IDENTITY_METHOD_VERSION = "cross-round-identity/1.0.0";
export const CROSS_ROUND_IDENTITY_REGISTRY_VERSION = "cross-round-identity-registry/1.0.0";

export type CrossRoundIdentityReviewState =
  | "pending-steward"
  | "steward-approved"
  | "rejected";

export type CrossRoundIdentityConfidence = "high" | "medium" | "low";

export type CrossRoundIdentityLink = {
  linkId: string;
  round2012OrganizationKey: string;
  /** Synthetic rehearsal key or future resolved 2026 org key — never implied as live publication identity without review. */
  round2026OrganizationKey: string;
  purpose: "method-rehearsal-only" | "steward-approved-identity";
  confidence: CrossRoundIdentityConfidence;
  reviewState: CrossRoundIdentityReviewState;
  methodVersion: string;
  evidence: string[];
  matchingSignals: string[];
  createdAt: string;
};

export type CrossRoundIdentityLinkRegistry = {
  registryVersion: string;
  methodVersion: string;
  links: CrossRoundIdentityLink[];
};

export type ResolvedCrossRoundIdentityLink = CrossRoundIdentityLink & {
  rehearsalFixtureOrganizationLabel?: string;
};
