import { describe, expect, it } from "vitest";
import { deriveHistoricalRspCurrentAttribution } from "./current-attribution";
import {
  applyRelationshipWithoutMembershipMutation,
  assertEvidenceBindingMatches,
  buildUnresolvedHistoricalRspRelationship,
  createRelationshipFromLineageAlone,
  materializeIdentityConfirmedHistoricalRspRelationship,
} from "./historical-rsp-relationship";
import {
  attemptGenerateOrganizationKeyFromLiteral,
  attemptImplicitAliasBind,
  createBindExistingOrganizationDecision,
  createProviderOrganizationDecision,
  providerOriginApplicantMembership,
} from "./provider-identity";
import {
  FORBIDDEN_PROVIDER_IDENTITY_FIELDS,
  HISTORICAL_RSP_CURRENT_ATTRIBUTION_METHOD_VERSION,
  HISTORICAL_RSP_PROVIDER_IDENTITY_SCHEMA_VERSION,
  HISTORICAL_RSP_PROVIDER_RELATIONSHIP_SCHEMA_VERSION,
  type ApprovedHistoricalRspEvidenceRowInput,
  type HistoricalRspLineageInput,
  type TrustedConfirmedOrganization,
} from "./types";
import {
  HistoricalRspProviderContractError,
  assertNoForbiddenProviderIdentityFields,
  deterministicProviderIdentityDecisionId,
} from "./validation";

/** Synthetic only — outside real pilot Application ID space. */
const SYN_APP = "SYN-APP-90001";
const SYN_APP_OTHER = "SYN-APP-90002";
const SYN_SHA =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SYN_SHA_OTHER =
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const TRUSTED: TrustedConfirmedOrganization[] = [
  {
    organizationKey: "example-confirmed-org",
    canonicalOrganizationName: "Example Confirmed Organization, Inc.",
  },
];

const APPROVED_ROW: ApprovedHistoricalRspEvidenceRowInput = {
  approvalState: "APPROVED",
  applicationId: SYN_APP,
  sourceFieldPath: "Q23",
  evidenceLocator: "Q23@100:20",
  providerNameAsStated: "Example Registry Services, Inc.",
};

const PENDING_LINEAGE: HistoricalRspLineageInput = {
  lineageId: "hist-lineage:example-registry→example-successor",
  historicalOrganizationKey: "example-registry-services",
  historicalCanonicalName: "Example Registry Services, Inc.",
  currentOrganizationKey: "example-successor-registry",
  currentCanonicalName: "Example Successor Registry",
  relationshipType: "BUSINESS_LINE_SUCCESSION",
  stewardState: "pending-review",
  confidence: "high",
  effectiveDateOrYear: "2021-01",
  scopeNotes: "Synthetic pending lineage for contract tests",
  nonClaims: ["Synthetic pending lineage non-claim"],
};

const APPROVED_LINEAGE: HistoricalRspLineageInput = {
  ...PENDING_LINEAGE,
  stewardState: "steward-approved",
  nonClaims: [
    "Synthetic lineage does not imply selected RSP relationship",
    "Synthetic lineage is not SAME_ORGANIZATION",
  ],
};

describe("historical-rsp-provider-identity contracts", () => {
  it("1 — existing organization reuse does not change applicant membership", () => {
    const decision = createBindExistingOrganizationDecision({
      providerNameAsStated: "Example Registry Services, Inc.",
      organizationKey: "example-confirmed-org",
      reviewer: "synthetic-steward",
      reviewedAt: "2026-11-03T12:00:00Z",
      rationale: "Explicit synthetic bind for contract test",
      confidence: "high",
      trustedConfirmedOrganizations: TRUSTED,
    });
    const relationship = materializeIdentityConfirmedHistoricalRspRelationship({
      evidenceRow: APPROVED_ROW,
      approvedEvidenceArtifactSha256: SYN_SHA,
      identityDecision: {
        ...decision,
        providerNameAsStated: APPROVED_ROW.providerNameAsStated,
        organizationKey: "example-confirmed-org",
        canonicalOrganizationName: "Example Confirmed Organization, Inc.",
      },
    });
    const priorMembership = ["SYN-APP-70001", "SYN-APP-70002"] as const;
    const after = applyRelationshipWithoutMembershipMutation({
      relationship,
      existingMemberApplicationIds: priorMembership,
    });
    expect(after.memberApplicationIds).toEqual([...priorMembership]);
    expect(after.memberApplicationIds).not.toContain(SYN_APP);
    expect(after.relationshipApplicationId).toBe(SYN_APP);
    expect(after.membershipUnchanged).toBe(true);
  });

  it("2 — provider-origin organization has no applicant membership", () => {
    const decision = createProviderOrganizationDecision({
      providerNameAsStated: "Example Registry Services, Inc.",
      organizationKey: "example-registry-services",
      canonicalOrganizationName: "Example Registry Services, Inc.",
      reviewer: "synthetic-steward",
      reviewedAt: "2026-11-03T12:00:00Z",
      rationale: "New provider-origin identity — no applicant portfolio",
      confidence: "medium",
      knownOrganizationKeys: TRUSTED.map((t) => t.organizationKey),
    });
    expect(decision.organizationOrigin).toBe("provider-origin");
    expect(decision.operationType).toBe("CREATE_PROVIDER_ORGANIZATION");
    const membership = providerOriginApplicantMembership(decision);
    expect(membership.applicationIds).toBeUndefined();
    expect(membership.memberApplicationIds).toBeUndefined();
    expect(membership.ownedApplicationIds).toBeUndefined();
    expect(JSON.stringify(decision)).not.toMatch(/applicationIds|memberApplicationIds|ownedApplicationIds/);
  });

  it("3 — no automatic alias merge", () => {
    expect(() =>
      attemptImplicitAliasBind({
        providerNameAsStated: "example registry services, inc",
        candidateOrganizationKey: "example-confirmed-org",
        candidateCanonicalName: "Example Confirmed Organization, Inc.",
      }),
    ).toThrow(HistoricalRspProviderContractError);
    expect(() =>
      attemptImplicitAliasBind({
        providerNameAsStated: "example registry services, inc",
        candidateOrganizationKey: "example-confirmed-org",
        candidateCanonicalName: "Example Confirmed Organization, Inc.",
      }),
    ).toThrow(/explicit steward decision/i);
  });

  it("4 — no automatic new key from provider wording", () => {
    expect(() =>
      attemptGenerateOrganizationKeyFromLiteral("Example Registry Services, Inc."),
    ).toThrow(/steward-supplied/i);
  });

  it("5 — exact evidence preservation", () => {
    const unresolved = buildUnresolvedHistoricalRspRelationship({
      evidenceRow: APPROVED_ROW,
      approvedEvidenceArtifactSha256: SYN_SHA,
    });
    expect(unresolved.providerNameAsStated).toBe("Example Registry Services, Inc.");
    expect(unresolved.evidenceRef).toEqual({
      applicationId: SYN_APP,
      sourceFieldPath: "Q23",
      evidenceLocator: "Q23@100:20",
      providerNameAsStated: "Example Registry Services, Inc.",
      approvedEvidenceArtifactSha256: SYN_SHA,
    });
    expect(unresolved.organizationKey).toBeNull();
  });

  it("6 — evidence mismatch fails closed", () => {
    const decision = createProviderOrganizationDecision({
      providerNameAsStated: "Example Registry Services, Inc.",
      organizationKey: "example-registry-services",
      canonicalOrganizationName: "Example Registry Services, Inc.",
      reviewer: "synthetic-steward",
      reviewedAt: "2026-11-03T12:00:00Z",
      rationale: "synthetic",
      confidence: "high",
    });
    const relationship = materializeIdentityConfirmedHistoricalRspRelationship({
      evidenceRow: APPROVED_ROW,
      approvedEvidenceArtifactSha256: SYN_SHA,
      identityDecision: decision,
    });

    expect(() =>
      assertEvidenceBindingMatches({
        relationship,
        evidenceRow: { ...APPROVED_ROW, applicationId: SYN_APP_OTHER },
        approvedEvidenceArtifactSha256: SYN_SHA,
      }),
    ).toThrow(/applicationId/);

    expect(() =>
      assertEvidenceBindingMatches({
        relationship,
        evidenceRow: { ...APPROVED_ROW, providerNameAsStated: "Other Example Provider" },
        approvedEvidenceArtifactSha256: SYN_SHA,
      }),
    ).toThrow(/providerNameAsStated/);

    expect(() =>
      assertEvidenceBindingMatches({
        relationship,
        evidenceRow: APPROVED_ROW,
        approvedEvidenceArtifactSha256: SYN_SHA_OTHER,
      }),
    ).toThrow(/approvedEvidenceArtifactSha256/);

    expect(() =>
      materializeIdentityConfirmedHistoricalRspRelationship({
        evidenceRow: APPROVED_ROW,
        approvedEvidenceArtifactSha256: SYN_SHA,
        identityDecision: {
          ...decision,
          providerNameAsStated: "Other Example Provider",
        },
      }),
    ).toThrow(/providerNameAsStated/);
  });

  it("7 — unapproved evidence fails closed", () => {
    const decision = createProviderOrganizationDecision({
      providerNameAsStated: "Example Registry Services, Inc.",
      organizationKey: "example-registry-services",
      canonicalOrganizationName: "Example Registry Services, Inc.",
      reviewer: "synthetic-steward",
      reviewedAt: "2026-11-03T12:00:00Z",
      rationale: "synthetic",
      confidence: "high",
    });
    expect(() =>
      materializeIdentityConfirmedHistoricalRspRelationship({
        evidenceRow: {
          ...APPROVED_ROW,
          // @ts-expect-error intentional invalid approval state
          approvalState: "DRAFT",
        },
        approvedEvidenceArtifactSha256: SYN_SHA,
        identityDecision: decision,
      }),
    ).toThrow(/APPROVED/);
  });

  it("8 — forbidden ownership fields rejected", () => {
    for (const field of FORBIDDEN_PROVIDER_IDENTITY_FIELDS) {
      expect(() =>
        assertNoForbiddenProviderIdentityFields({ [field]: ["x"] }),
      ).toThrow(/rejects ownership/);
    }
    expect(() =>
      createProviderOrganizationDecision({
        providerNameAsStated: "Example Registry Services, Inc.",
        organizationKey: "example-registry-services",
        canonicalOrganizationName: "Example Registry Services, Inc.",
        reviewer: "synthetic-steward",
        reviewedAt: "2026-11-03T12:00:00Z",
        rationale: "synthetic",
        confidence: "high",
        rawPayload: {
          providerNameAsStated: "Example Registry Services, Inc.",
          organizationKey: "example-registry-services",
          memberApplicationIds: [SYN_APP],
        },
      }),
    ).toThrow(/memberApplicationIds/);

    expect(() =>
      createBindExistingOrganizationDecision({
        providerNameAsStated: "Example Registry Services, Inc.",
        organizationKey: "example-confirmed-org",
        reviewer: "synthetic-steward",
        reviewedAt: "2026-11-03T12:00:00Z",
        rationale: "synthetic",
        confidence: "high",
        trustedConfirmedOrganizations: TRUSTED,
        rawPayload: { rspKey: "evil-rsp" },
      }),
    ).toThrow(/rspKey/);
  });

  it("9 — no canonical rspKey namespace in valid contracts", () => {
    const decision = createBindExistingOrganizationDecision({
      providerNameAsStated: "Example Registry Services, Inc.",
      organizationKey: "example-confirmed-org",
      reviewer: "synthetic-steward",
      reviewedAt: "2026-11-03T12:00:00Z",
      rationale: "synthetic",
      confidence: "high",
      trustedConfirmedOrganizations: TRUSTED,
    });
    const relationship = materializeIdentityConfirmedHistoricalRspRelationship({
      evidenceRow: APPROVED_ROW,
      approvedEvidenceArtifactSha256: SYN_SHA,
      identityDecision: {
        ...decision,
        providerNameAsStated: APPROVED_ROW.providerNameAsStated,
      },
    });
    expect(JSON.stringify(decision)).not.toContain("rspKey");
    expect(JSON.stringify(relationship)).not.toContain("rspKey");
    expect(relationship.organizationKey).toBe("example-confirmed-org");
    expect(decision.schemaVersion).toBe(HISTORICAL_RSP_PROVIDER_IDENTITY_SCHEMA_VERSION);
    expect(relationship.schemaVersion).toBe(HISTORICAL_RSP_PROVIDER_RELATIONSHIP_SCHEMA_VERSION);
  });

  it("10 — lineage cannot create RSP evidence/relationship", () => {
    expect(() => createRelationshipFromLineageAlone(APPROVED_LINEAGE)).toThrow(
      /lineage record alone must never create/i,
    );
  });

  it("11 — current attribution requires steward-approved lineage", () => {
    const decision = createProviderOrganizationDecision({
      providerNameAsStated: "Example Registry Services, Inc.",
      organizationKey: "example-registry-services",
      canonicalOrganizationName: "Example Registry Services, Inc.",
      reviewer: "synthetic-steward",
      reviewedAt: "2026-11-03T12:00:00Z",
      rationale: "synthetic",
      confidence: "high",
    });
    const relationship = materializeIdentityConfirmedHistoricalRspRelationship({
      evidenceRow: APPROVED_ROW,
      approvedEvidenceArtifactSha256: SYN_SHA,
      identityDecision: decision,
    });
    expect(() =>
      deriveHistoricalRspCurrentAttribution({
        relationship,
        lineage: PENDING_LINEAGE,
      }),
    ).toThrow(/steward-approved lineage/i);
  });

  it("12 — relationship-type fidelity (BUSINESS_LINE_SUCCESSION preserved)", () => {
    const decision = createProviderOrganizationDecision({
      providerNameAsStated: "Example Registry Services, Inc.",
      organizationKey: "example-registry-services",
      canonicalOrganizationName: "Example Registry Services, Inc.",
      reviewer: "synthetic-steward",
      reviewedAt: "2026-11-03T12:00:00Z",
      rationale: "synthetic",
      confidence: "high",
    });
    const relationship = materializeIdentityConfirmedHistoricalRspRelationship({
      evidenceRow: APPROVED_ROW,
      approvedEvidenceArtifactSha256: SYN_SHA,
      identityDecision: decision,
    });
    const attribution = deriveHistoricalRspCurrentAttribution({
      relationship,
      lineage: APPROVED_LINEAGE,
    });
    expect(attribution.lineageRelationshipType).toBe("BUSINESS_LINE_SUCCESSION");
    expect(attribution.lineageRelationshipType).not.toBe("SAME_ENTITY_RENAME");
  });

  it("13 — no current-capability implication", () => {
    const decision = createProviderOrganizationDecision({
      providerNameAsStated: "Example Registry Services, Inc.",
      organizationKey: "example-registry-services",
      canonicalOrganizationName: "Example Registry Services, Inc.",
      reviewer: "synthetic-steward",
      reviewedAt: "2026-11-03T12:00:00Z",
      rationale: "synthetic",
      confidence: "high",
    });
    const relationship = materializeIdentityConfirmedHistoricalRspRelationship({
      evidenceRow: APPROVED_ROW,
      approvedEvidenceArtifactSha256: SYN_SHA,
      identityDecision: decision,
    });
    const attribution = deriveHistoricalRspCurrentAttribution({
      relationship,
      lineage: APPROVED_LINEAGE,
    });
    expect(attribution.attributionKind).toBe("HISTORICAL_FOOTPRINT");
    expect(attribution.claimsCurrentRspCapability).toBe(false);
    expect(attribution.methodVersion).toBe(HISTORICAL_RSP_CURRENT_ATTRIBUTION_METHOD_VERSION);
    expect(attribution.providerNameAsStated).toBe("Example Registry Services, Inc.");
  });

  it("14 — customer application is not provider ownership", () => {
    const decision = createProviderOrganizationDecision({
      providerNameAsStated: "Example Registry Services, Inc.",
      organizationKey: "example-registry-services",
      canonicalOrganizationName: "Example Registry Services, Inc.",
      reviewer: "synthetic-steward",
      reviewedAt: "2026-11-03T12:00:00Z",
      rationale: "synthetic",
      confidence: "high",
    });
    const relationship = materializeIdentityConfirmedHistoricalRspRelationship({
      evidenceRow: APPROVED_ROW,
      approvedEvidenceArtifactSha256: SYN_SHA,
      identityDecision: decision,
    });
    const attribution = deriveHistoricalRspCurrentAttribution({
      relationship,
      lineage: APPROVED_LINEAGE,
    });
    expect(relationship.nonClaims.join(" ")).toMatch(/ownership/i);
    expect(attribution.claimsApplicationOwnership).toBe(false);
    const membership = applyRelationshipWithoutMembershipMutation({
      relationship,
      existingMemberApplicationIds: [],
    });
    expect(membership.memberApplicationIds).toEqual([]);
  });

  it("BIND_EXISTING fails closed on unknown trusted key", () => {
    expect(() =>
      createBindExistingOrganizationDecision({
        providerNameAsStated: "Example Registry Services, Inc.",
        organizationKey: "not-in-trusted-universe",
        reviewer: "synthetic-steward",
        reviewedAt: "2026-11-03T12:00:00Z",
        rationale: "synthetic",
        confidence: "high",
        trustedConfirmedOrganizations: TRUSTED,
      }),
    ).toThrow(/not in trusted confirmed universe/);
  });

  it("CREATE fails closed on organization key collision", () => {
    expect(() =>
      createProviderOrganizationDecision({
        providerNameAsStated: "Example Registry Services, Inc.",
        organizationKey: "example-confirmed-org",
        canonicalOrganizationName: "Example Registry Services, Inc.",
        reviewer: "synthetic-steward",
        reviewedAt: "2026-11-03T12:00:00Z",
        rationale: "synthetic",
        confidence: "high",
        knownOrganizationKeys: ["example-confirmed-org"],
      }),
    ).toThrow(/collides/);
  });

  it("unresolved state forbids organization binding", () => {
    const unresolved = buildUnresolvedHistoricalRspRelationship({
      evidenceRow: APPROVED_ROW,
      approvedEvidenceArtifactSha256: SYN_SHA,
      relationshipState: "PENDING_IDENTITY_REVIEW",
    });
    expect(unresolved.relationshipState).toBe("PENDING_IDENTITY_REVIEW");
    expect(unresolved.organizationKey).toBeNull();
    expect(unresolved.providerIdentityDecisionId).toBeNull();
  });

  it("unresolved relationship cannot yield current attribution", () => {
    const unresolved = buildUnresolvedHistoricalRspRelationship({
      evidenceRow: APPROVED_ROW,
      approvedEvidenceArtifactSha256: SYN_SHA,
    });
    expect(() =>
      deriveHistoricalRspCurrentAttribution({
        relationship: unresolved,
        lineage: APPROVED_LINEAGE,
      }),
    ).toThrow(/IDENTITY_CONFIRMED/);
  });

  it("decision IDs are deterministic from semantic inputs", () => {
    const a = deterministicProviderIdentityDecisionId({
      operationType: "CREATE_PROVIDER_ORGANIZATION",
      providerNameAsStated: "Example Registry Services, Inc.",
      organizationKey: "example-registry-services",
      canonicalOrganizationName: "Example Registry Services, Inc.",
      reviewState: "steward-approved",
      rationale: "same rationale",
    });
    const b = deterministicProviderIdentityDecisionId({
      operationType: "CREATE_PROVIDER_ORGANIZATION",
      providerNameAsStated: "Example Registry Services, Inc.",
      organizationKey: "example-registry-services",
      canonicalOrganizationName: "Example Registry Services, Inc.",
      reviewState: "steward-approved",
      rationale: "same rationale",
    });
    expect(a).toBe(b);
  });

  it("lineage historical key mismatch fails closed", () => {
    const decision = createProviderOrganizationDecision({
      providerNameAsStated: "Example Registry Services, Inc.",
      organizationKey: "example-registry-services",
      canonicalOrganizationName: "Example Registry Services, Inc.",
      reviewer: "synthetic-steward",
      reviewedAt: "2026-11-03T12:00:00Z",
      rationale: "synthetic",
      confidence: "high",
    });
    const relationship = materializeIdentityConfirmedHistoricalRspRelationship({
      evidenceRow: APPROVED_ROW,
      approvedEvidenceArtifactSha256: SYN_SHA,
      identityDecision: decision,
    });
    expect(() =>
      deriveHistoricalRspCurrentAttribution({
        relationship,
        lineage: {
          ...APPROVED_LINEAGE,
          historicalOrganizationKey: "other-historical-org",
        },
      }),
    ).toThrow(/historicalOrganizationKey/);
  });
});
