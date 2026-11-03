import {
  HISTORICAL_RSP_PROVIDER_IDENTITY_SCHEMA_VERSION,
  type HistoricalRspProviderIdentityDecision,
  type ProviderIdentityConfidence,
  type TrustedConfirmedOrganization,
} from "./types";
import {
  HistoricalRspProviderContractError,
  assertNoForbiddenProviderIdentityFields,
  assertNonEmptyString,
  deterministicProviderIdentityDecisionId,
  indexTrustedOrganizations,
} from "./validation";

export type BindExistingOrganizationInput = {
  providerNameAsStated: string;
  organizationKey: string;
  /** Optional override; defaults to trusted registry canonical name. */
  canonicalOrganizationName?: string;
  reviewer: string;
  reviewedAt: string;
  rationale: string;
  confidence: ProviderIdentityConfidence;
  /** Trusted confirmed organization universe (caller-supplied). */
  trustedConfirmedOrganizations: readonly TrustedConfirmedOrganization[];
  /** Optional explicit decision ID; otherwise deterministic from semantic inputs. */
  decisionId?: string;
  /** Raw payload for forbidden-field scanning (e.g. untrusted JSON). */
  rawPayload?: Record<string, unknown>;
};

export type CreateProviderOrganizationInput = {
  providerNameAsStated: string;
  /** Steward-supplied key — never auto-generated from the literal. */
  organizationKey: string;
  canonicalOrganizationName: string;
  reviewer: string;
  reviewedAt: string;
  rationale: string;
  confidence: ProviderIdentityConfidence;
  /**
   * Optional known keys for collision checking (existing confirmed + prior provider-origin).
   * When provided, CREATE must not collide with an existing key.
   */
  knownOrganizationKeys?: ReadonlySet<string> | readonly string[];
  decisionId?: string;
  rawPayload?: Record<string, unknown>;
};

function scanForbidden(rawPayload: Record<string, unknown> | undefined, built: object): void {
  assertNoForbiddenProviderIdentityFields({
    ...(rawPayload ?? {}),
    ...Object.fromEntries(
      Object.entries(built as Record<string, unknown>).filter(([k]) =>
        ["applicationIds", "memberApplicationIds", "ownedApplicationIds", "rspKey"].includes(k),
      ),
    ),
  });
  if (rawPayload) {
    assertNoForbiddenProviderIdentityFields(rawPayload);
  }
}

/**
 * Explicit steward BIND_EXISTING_ORGANIZATION decision.
 * Fails closed if organizationKey is not in the trusted confirmed universe.
 * Does not mutate applicant membership.
 */
export function createBindExistingOrganizationDecision(
  input: BindExistingOrganizationInput,
): HistoricalRspProviderIdentityDecision {
  scanForbidden(input.rawPayload, input);
  assertNonEmptyString(input.providerNameAsStated, "providerNameAsStated");
  assertNonEmptyString(input.organizationKey, "organizationKey");
  assertNonEmptyString(input.reviewer, "reviewer");
  assertNonEmptyString(input.reviewedAt, "reviewedAt");
  assertNonEmptyString(input.rationale, "rationale");

  const trusted = indexTrustedOrganizations(input.trustedConfirmedOrganizations);
  const org = trusted.get(input.organizationKey);
  if (!org) {
    throw new HistoricalRspProviderContractError(
      "UNKNOWN_ORGANIZATION_KEY",
      `BIND_EXISTING_ORGANIZATION references organizationKey not in trusted confirmed universe: ${input.organizationKey}`,
    );
  }

  const canonicalOrganizationName =
    input.canonicalOrganizationName ?? org.canonicalOrganizationName;
  if (canonicalOrganizationName !== org.canonicalOrganizationName) {
    throw new HistoricalRspProviderContractError(
      "CANONICAL_NAME_MISMATCH",
      `canonicalOrganizationName must match trusted registry for ${input.organizationKey}`,
    );
  }

  const decisionId =
    input.decisionId ??
    deterministicProviderIdentityDecisionId({
      operationType: "BIND_EXISTING_ORGANIZATION",
      providerNameAsStated: input.providerNameAsStated,
      organizationKey: input.organizationKey,
      canonicalOrganizationName,
      reviewState: "steward-approved",
      rationale: input.rationale,
    });

  return {
    schemaVersion: HISTORICAL_RSP_PROVIDER_IDENTITY_SCHEMA_VERSION,
    decisionId,
    operationType: "BIND_EXISTING_ORGANIZATION",
    providerNameAsStated: input.providerNameAsStated,
    organizationKey: input.organizationKey,
    canonicalOrganizationName,
    reviewState: "steward-approved",
    reviewer: input.reviewer,
    reviewedAt: input.reviewedAt,
    rationale: input.rationale,
    confidence: input.confidence,
    organizationOrigin: "existing-confirmed",
  };
}

/**
 * Explicit steward CREATE_PROVIDER_ORGANIZATION decision.
 * organizationKey must be steward-supplied — never derived from the literal.
 * No applicant membership fields are created or required.
 */
export function createProviderOrganizationDecision(
  input: CreateProviderOrganizationInput,
): HistoricalRspProviderIdentityDecision {
  scanForbidden(input.rawPayload, input);
  assertNonEmptyString(input.providerNameAsStated, "providerNameAsStated");
  assertNonEmptyString(input.organizationKey, "organizationKey");
  assertNonEmptyString(input.canonicalOrganizationName, "canonicalOrganizationName");
  assertNonEmptyString(input.reviewer, "reviewer");
  assertNonEmptyString(input.reviewedAt, "reviewedAt");
  assertNonEmptyString(input.rationale, "rationale");

  if (input.knownOrganizationKeys) {
    const known =
      input.knownOrganizationKeys instanceof Set
        ? input.knownOrganizationKeys
        : new Set(input.knownOrganizationKeys);
    if (known.has(input.organizationKey)) {
      throw new HistoricalRspProviderContractError(
        "ORGANIZATION_KEY_COLLISION",
        `CREATE_PROVIDER_ORGANIZATION organizationKey collides with known key: ${input.organizationKey}`,
      );
    }
  }

  const decisionId =
    input.decisionId ??
    deterministicProviderIdentityDecisionId({
      operationType: "CREATE_PROVIDER_ORGANIZATION",
      providerNameAsStated: input.providerNameAsStated,
      organizationKey: input.organizationKey,
      canonicalOrganizationName: input.canonicalOrganizationName,
      reviewState: "steward-approved",
      rationale: input.rationale,
    });

  return {
    schemaVersion: HISTORICAL_RSP_PROVIDER_IDENTITY_SCHEMA_VERSION,
    decisionId,
    operationType: "CREATE_PROVIDER_ORGANIZATION",
    providerNameAsStated: input.providerNameAsStated,
    organizationKey: input.organizationKey,
    canonicalOrganizationName: input.canonicalOrganizationName,
    reviewState: "steward-approved",
    reviewer: input.reviewer,
    reviewedAt: input.reviewedAt,
    rationale: input.rationale,
    confidence: input.confidence,
    organizationOrigin: "provider-origin",
  };
}

/**
 * Case/punctuation resemblance alone never binds identity.
 * Callers must use an explicit steward decision — this helper documents the rule.
 */
export function attemptImplicitAliasBind(input: {
  providerNameAsStated: string;
  candidateOrganizationKey: string;
  candidateCanonicalName: string;
}): never {
  void input;
  throw new HistoricalRspProviderContractError(
    "IMPLICIT_ALIAS_FORBIDDEN",
    "Provider identity binding requires an explicit steward decision; automatic alias/case/punctuation matching is forbidden",
  );
}

/**
 * Organization keys are never auto-generated from provider wording.
 */
export function attemptGenerateOrganizationKeyFromLiteral(providerNameAsStated: string): never {
  void providerNameAsStated;
  throw new HistoricalRspProviderContractError(
    "AUTO_KEY_GENERATION_FORBIDDEN",
    "organizationKey must be steward-supplied; automatic generation from provider wording is forbidden",
  );
}

/** Provider-origin decisions never carry applicant membership. */
export function providerOriginApplicantMembership(
  decision: HistoricalRspProviderIdentityDecision,
): {
  applicationIds: undefined;
  memberApplicationIds: undefined;
  ownedApplicationIds: undefined;
} {
  if (decision.organizationOrigin !== "provider-origin") {
    throw new HistoricalRspProviderContractError(
      "NOT_PROVIDER_ORIGIN",
      "providerOriginApplicantMembership applies only to provider-origin decisions",
    );
  }
  return {
    applicationIds: undefined,
    memberApplicationIds: undefined,
    ownedApplicationIds: undefined,
  };
}
