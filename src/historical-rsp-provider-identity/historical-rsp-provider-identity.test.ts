import { describe, expect, it } from "vitest";
import {
  HISTORICAL_RSP_APPROVED_EVIDENCE_ROW_SCHEMA_VERSION,
  HISTORICAL_RSP_APPROVED_EVIDENCE_SCHEMA_VERSION,
  type HistoricalRspApprovedEvidenceArtifact,
  type HistoricalRspApprovedEvidenceRow,
} from "@/icann2012-rsp-acquisition/historical-rsp-approved-evidence";
import type { HistoricalOrganizationLineageRecord } from "@/historical-organization-lineage/types";
import {
  assertAttributionEligibleLineage,
  deriveHistoricalRspCurrentAttribution,
  deriveHistoricalRspCurrentAttributionFromUnknown,
} from "./current-attribution";
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
  type TrustedConfirmedOrganization,
} from "./types";
import {
  approvedEvidenceRowIdentity,
  assertNoForbiddenProviderIdentityFields,
  deterministicProviderIdentityDecisionId,
  validateProviderIdentityDecision,
} from "./validation";

/** Synthetic only — outside real pilot Application ID space. */
const SYN_APP = "SYN-APP-90001";
const SYN_APP_OTHER = "SYN-APP-90002";
const SYN_SHA =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SYN_SHA_OTHER =
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SYN_REVIEW_SHA =
  "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

const TRUSTED: TrustedConfirmedOrganization[] = [
  {
    organizationKey: "example-confirmed-org",
    canonicalOrganizationName: "Example Confirmed Organization, Inc.",
  },
];

function makeApprovedRow(
  overrides: Partial<HistoricalRspApprovedEvidenceRow> = {},
): HistoricalRspApprovedEvidenceRow {
  return {
    schemaVersion: HISTORICAL_RSP_APPROVED_EVIDENCE_ROW_SCHEMA_VERSION,
    applicationId: SYN_APP,
    providerNameAsStated: "Example Registry Services, Inc.",
    sourceFieldPath: "Q23",
    evidenceClassification: "PUBLIC_ICANN",
    applicationVersionBasis: "current_public_portion",
    evidenceLocator: "Q23@100:20",
    roleAsStated: "back-end registry services",
    approvalState: "APPROVED",
    approvalBasis: "STEWARD_REVIEW",
    ...overrides,
  };
}

function makeApprovedArtifact(
  rows: HistoricalRspApprovedEvidenceRow[] = [makeApprovedRow()],
): HistoricalRspApprovedEvidenceArtifact {
  return {
    schemaVersion: HISTORICAL_RSP_APPROVED_EVIDENCE_SCHEMA_VERSION,
    artifactPurpose: "EVIDENCE",
    approvalState: "APPROVED",
    sourceExtractionSha256: SYN_SHA,
    sourceExtractionDeterministicPayloadHash: null,
    sourceExtractionToolingSha: null,
    stewardReviewSha256: SYN_REVIEW_SHA,
    approvalPacketSha256: SYN_REVIEW_SHA,
    reviewer: "synthetic-steward",
    reviewedAt: "2026-11-03T12:00:00Z",
    sourceApplicationCount: 1,
    candidateBearingApplicationCount: 1,
    approvedApplicationCount: new Set(rows.map((r) => r.applicationId)).size,
    approvedEvidenceRowCount: rows.length,
    approvedEvidenceRows: rows,
  };
}

function selectorFromRow(row: HistoricalRspApprovedEvidenceRow) {
  return {
    applicationId: row.applicationId,
    sourceFieldPath: row.sourceFieldPath,
    evidenceLocator: row.evidenceLocator,
    providerNameAsStated: row.providerNameAsStated,
    roleAsStated: row.roleAsStated ?? null,
  };
}

function makeCreateDecision(artifactSha = SYN_SHA) {
  return createProviderOrganizationDecision({
    providerNameAsStated: "Example Registry Services, Inc.",
    organizationKey: "example-registry-services",
    canonicalOrganizationName: "Example Registry Services, Inc.",
    reviewer: "synthetic-steward",
    reviewedAt: "2026-11-03T12:00:00Z",
    rationale: "Synthetic provider-origin identity for contract tests",
    confidence: "high",
    provenance: {
      sourceApprovedEvidenceArtifactSha256: artifactSha,
      identityReviewArtifactSha256: SYN_REVIEW_SHA,
    },
  });
}

function makeApprovedLineage(
  overrides: Partial<HistoricalOrganizationLineageRecord> = {},
): HistoricalOrganizationLineageRecord {
  return {
    lineageId: "hist-lineage:example-registry→example-successor",
    historicalOrganizationId: "organization:promoted:example-registry-services",
    historicalOrganizationKey: "example-registry-services",
    historicalCanonicalName: "Example Registry Services, Inc.",
    historicalRoundYear: 2012,
    currentOrganizationId: "organization:resolved-2026:example-successor-registry",
    currentOrganizationKey: "example-successor-registry",
    currentCanonicalName: "Example Successor Registry",
    relationshipType: "BUSINESS_LINE_SUCCESSION",
    effectiveDateOrYear: "2021-01",
    displayLabel: "Synthetic lineage: Example Registry Services",
    displaySummary: "Synthetic BUSINESS_LINE_SUCCESSION for contract tests",
    aliases: ["Example Registry", "Example Successor"],
    evidence: [
      {
        evidenceId: "syn-hl-ev-1",
        strength: "A",
        sourceType: "steward-note",
        sourceIdentifier: "synthetic-lineage-fixture#1",
        evidenceAsOf: "2021-01-01",
        retrievedAt: "2026-11-03",
        supportsClaim: "Synthetic succession claim for tests",
        limitations: "Synthetic fixture only",
        summary: "Synthetic evidence entry for lineage contract tests",
      },
    ],
    stewardState: "steward-approved",
    confidence: "high",
    scopeNotes: "Synthetic lineage scope for contract tests",
    nonClaims: [
      "Synthetic lineage does not imply selected RSP relationship",
      "Synthetic lineage is not SAME_ORGANIZATION",
    ],
    ...overrides,
  };
}

describe("historical-rsp-provider-identity contracts (1H19-R1)", () => {
  it("1 — existing organization reuse does not change applicant membership", () => {
    const artifact = makeApprovedArtifact();
    const row = artifact.approvedEvidenceRows[0]!;
    const decision = createBindExistingOrganizationDecision({
      providerNameAsStated: row.providerNameAsStated,
      organizationKey: "example-confirmed-org",
      reviewer: "synthetic-steward",
      reviewedAt: "2026-11-03T12:00:00Z",
      rationale: "Explicit synthetic bind for contract test",
      confidence: "high",
      trustedConfirmedOrganizations: TRUSTED,
      provenance: {
        sourceApprovedEvidenceArtifactSha256: SYN_SHA,
        identityReviewArtifactSha256: SYN_REVIEW_SHA,
      },
    });
    const relationship = materializeIdentityConfirmedHistoricalRspRelationship({
      approvedEvidenceArtifact: artifact,
      verifiedApprovedEvidenceArtifactSha256: SYN_SHA,
      evidenceSelector: selectorFromRow(row),
      identityDecision: decision,
    });
    const priorMembership = ["SYN-APP-70001", "SYN-APP-70002"] as const;
    const after = applyRelationshipWithoutMembershipMutation({
      relationship,
      existingMemberApplicationIds: priorMembership,
    });
    expect(after.memberApplicationIds).toEqual([...priorMembership]);
    expect(after.memberApplicationIds).not.toContain(SYN_APP);
    expect(after.membershipUnchanged).toBe(true);
  });

  it("2 — provider-origin organization has no applicant membership", () => {
    const decision = makeCreateDecision();
    expect(decision.organizationOrigin).toBe("provider-origin");
    const membership = providerOriginApplicantMembership(decision);
    expect(membership.applicationIds).toBeUndefined();
    expect(membership.memberApplicationIds).toBeUndefined();
    expect(JSON.stringify(decision)).not.toMatch(
      /applicationIds|memberApplicationIds|ownedApplicationIds/,
    );
  });

  it("3 — no automatic alias merge", () => {
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
    const artifact = makeApprovedArtifact();
    const row = artifact.approvedEvidenceRows[0]!;
    const unresolved = buildUnresolvedHistoricalRspRelationship({
      approvedEvidenceArtifact: artifact,
      verifiedApprovedEvidenceArtifactSha256: SYN_SHA,
      evidenceSelector: selectorFromRow(row),
    });
    expect(unresolved.providerNameAsStated).toBe("Example Registry Services, Inc.");
    expect(unresolved.evidenceRef.roleAsStated).toBe("back-end registry services");
    expect(unresolved.evidenceRef.approvedEvidenceArtifactSha256).toBe(SYN_SHA);
    expect(unresolved.organizationKey).toBeNull();
  });

  it("6a — wrong application ID fails closed", () => {
    const artifact = makeApprovedArtifact();
    const row = artifact.approvedEvidenceRows[0]!;
    expect(() =>
      materializeIdentityConfirmedHistoricalRspRelationship({
        approvedEvidenceArtifact: artifact,
        verifiedApprovedEvidenceArtifactSha256: SYN_SHA,
        evidenceSelector: { ...selectorFromRow(row), applicationId: SYN_APP_OTHER },
        identityDecision: makeCreateDecision(),
      }),
    ).toThrow(/does not exist/);
  });

  it("6b — wrong provider literal fails closed", () => {
    const artifact = makeApprovedArtifact();
    const row = artifact.approvedEvidenceRows[0]!;
    expect(() =>
      materializeIdentityConfirmedHistoricalRspRelationship({
        approvedEvidenceArtifact: artifact,
        verifiedApprovedEvidenceArtifactSha256: SYN_SHA,
        evidenceSelector: {
          ...selectorFromRow(row),
          providerNameAsStated: "Other Example Provider",
        },
        identityDecision: makeCreateDecision(),
      }),
    ).toThrow(/does not exist/);
  });

  it("6c — wrong source field fails closed", () => {
    const artifact = makeApprovedArtifact();
    const row = artifact.approvedEvidenceRows[0]!;
    expect(() =>
      materializeIdentityConfirmedHistoricalRspRelationship({
        approvedEvidenceArtifact: artifact,
        verifiedApprovedEvidenceArtifactSha256: SYN_SHA,
        evidenceSelector: { ...selectorFromRow(row), sourceFieldPath: "Q24" },
        identityDecision: makeCreateDecision(),
      }),
    ).toThrow(/does not exist/);
  });

  it("6d — wrong evidence locator fails closed", () => {
    const artifact = makeApprovedArtifact();
    const row = artifact.approvedEvidenceRows[0]!;
    expect(() =>
      materializeIdentityConfirmedHistoricalRspRelationship({
        approvedEvidenceArtifact: artifact,
        verifiedApprovedEvidenceArtifactSha256: SYN_SHA,
        evidenceSelector: { ...selectorFromRow(row), evidenceLocator: "Q23@999:1" },
        identityDecision: makeCreateDecision(),
      }),
    ).toThrow(/does not exist/);
  });

  it("6e — wrong approved-artifact SHA fails closed on decision provenance", () => {
    const artifact = makeApprovedArtifact();
    const row = artifact.approvedEvidenceRows[0]!;
    // Decision reviewed against SYN_SHA; materializing with other SHA fails provenance match
    // (artifact trust still needs a syntactically valid SHA; row lookup uses that SHA only as
    // external verification token — mismatch is enforced via decision provenance).
    expect(() =>
      materializeIdentityConfirmedHistoricalRspRelationship({
        approvedEvidenceArtifact: artifact,
        verifiedApprovedEvidenceArtifactSha256: SYN_SHA_OTHER,
        evidenceSelector: selectorFromRow(row),
        identityDecision: makeCreateDecision(SYN_SHA),
      }),
    ).toThrow(/sourceApprovedEvidenceArtifactSha256/);
  });

  it("6f — missing row in approved artifact fails closed", () => {
    const artifact = makeApprovedArtifact([]);
    expect(() =>
      materializeIdentityConfirmedHistoricalRspRelationship({
        approvedEvidenceArtifact: artifact,
        verifiedApprovedEvidenceArtifactSha256: SYN_SHA,
        evidenceSelector: selectorFromRow(makeApprovedRow()),
        identityDecision: makeCreateDecision(),
      }),
    ).toThrow(/does not exist/);
  });

  it("6g — duplicate matching row fails closed", () => {
    const row = makeApprovedRow();
    const artifact = makeApprovedArtifact([row, { ...row }]);
    expect(() =>
      materializeIdentityConfirmedHistoricalRspRelationship({
        approvedEvidenceArtifact: artifact,
        verifiedApprovedEvidenceArtifactSha256: SYN_SHA,
        evidenceSelector: selectorFromRow(row),
        identityDecision: makeCreateDecision(),
      }),
    ).toThrow(/not unique/);
  });

  it("6h — identity decision provenance for different artifact fails closed", () => {
    const artifact = makeApprovedArtifact();
    const row = artifact.approvedEvidenceRows[0]!;
    const decisionForOtherArtifact = makeCreateDecision(SYN_SHA_OTHER);
    expect(() =>
      materializeIdentityConfirmedHistoricalRspRelationship({
        approvedEvidenceArtifact: artifact,
        verifiedApprovedEvidenceArtifactSha256: SYN_SHA,
        evidenceSelector: selectorFromRow(row),
        identityDecision: decisionForOtherArtifact,
      }),
    ).toThrow(/sourceApprovedEvidenceArtifactSha256/);
  });

  it("6i — tampered decisionId fails closed", () => {
    const artifact = makeApprovedArtifact();
    const row = artifact.approvedEvidenceRows[0]!;
    const decision = makeCreateDecision();
    const tampered = { ...decision, decisionId: "hist-rsp-pid:deadbeef" };
    expect(() => validateProviderIdentityDecision(tampered)).toThrow(/decisionId does not match/);
    expect(() =>
      materializeIdentityConfirmedHistoricalRspRelationship({
        approvedEvidenceArtifact: artifact,
        verifiedApprovedEvidenceArtifactSha256: SYN_SHA,
        evidenceSelector: selectorFromRow(row),
        identityDecision: tampered,
      }),
    ).toThrow(/decisionId does not match/);
  });

  it("7 — unapproved evidence artifact fails closed", () => {
    const artifact = {
      ...makeApprovedArtifact(),
      approvalState: "DRAFT" as unknown as "APPROVED",
    };
    expect(() =>
      materializeIdentityConfirmedHistoricalRspRelationship({
        approvedEvidenceArtifact: artifact,
        verifiedApprovedEvidenceArtifactSha256: SYN_SHA,
        evidenceSelector: selectorFromRow(makeApprovedRow()),
        identityDecision: makeCreateDecision(),
      }),
    ).toThrow(/approvalState must be APPROVED/);
  });

  it("8 — forbidden ownership fields rejected", () => {
    for (const field of FORBIDDEN_PROVIDER_IDENTITY_FIELDS) {
      expect(() => assertNoForbiddenProviderIdentityFields({ [field]: ["x"] })).toThrow(
        /rejects ownership/,
      );
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
        provenance: {
          sourceApprovedEvidenceArtifactSha256: SYN_SHA,
          identityReviewArtifactSha256: SYN_REVIEW_SHA,
        },
        rawPayload: { memberApplicationIds: [SYN_APP], rspKey: "evil" },
      }),
    ).toThrow(/memberApplicationIds|rspKey/);
  });

  it("9 — no canonical rspKey namespace in valid contracts", () => {
    const artifact = makeApprovedArtifact();
    const row = artifact.approvedEvidenceRows[0]!;
    const decision = makeCreateDecision();
    const relationship = materializeIdentityConfirmedHistoricalRspRelationship({
      approvedEvidenceArtifact: artifact,
      verifiedApprovedEvidenceArtifactSha256: SYN_SHA,
      evidenceSelector: selectorFromRow(row),
      identityDecision: decision,
    });
    expect(JSON.stringify(decision)).not.toContain("rspKey");
    expect(JSON.stringify(relationship)).not.toContain("rspKey");
    expect(decision.schemaVersion).toBe(HISTORICAL_RSP_PROVIDER_IDENTITY_SCHEMA_VERSION);
    expect(relationship.schemaVersion).toBe(HISTORICAL_RSP_PROVIDER_RELATIONSHIP_SCHEMA_VERSION);
    expect(decision.provenance.sourceApprovedEvidenceArtifactSha256).toBe(SYN_SHA);
    expect(decision.provenance.identityReviewArtifactSha256).toBe(SYN_REVIEW_SHA);
  });

  it("10 — lineage cannot create RSP evidence/relationship", () => {
    expect(() => createRelationshipFromLineageAlone(makeApprovedLineage())).toThrow(
      /lineage record alone must never create/i,
    );
  });

  it("11 — current attribution requires steward-approved lineage", () => {
    const artifact = makeApprovedArtifact();
    const row = artifact.approvedEvidenceRows[0]!;
    const relationship = materializeIdentityConfirmedHistoricalRspRelationship({
      approvedEvidenceArtifact: artifact,
      verifiedApprovedEvidenceArtifactSha256: SYN_SHA,
      evidenceSelector: selectorFromRow(row),
      identityDecision: makeCreateDecision(),
    });
    expect(() =>
      deriveHistoricalRspCurrentAttribution({
        relationship,
        lineage: makeApprovedLineage({ stewardState: "pending-review" }),
      }),
    ).toThrow(/steward-approved lineage/i);
  });

  it("12 — relationship-type fidelity (BUSINESS_LINE_SUCCESSION preserved)", () => {
    const artifact = makeApprovedArtifact();
    const row = artifact.approvedEvidenceRows[0]!;
    const relationship = materializeIdentityConfirmedHistoricalRspRelationship({
      approvedEvidenceArtifact: artifact,
      verifiedApprovedEvidenceArtifactSha256: SYN_SHA,
      evidenceSelector: selectorFromRow(row),
      identityDecision: makeCreateDecision(),
    });
    const attribution = deriveHistoricalRspCurrentAttribution({
      relationship,
      lineage: makeApprovedLineage(),
    });
    expect(attribution.lineageRelationshipType).toBe("BUSINESS_LINE_SUCCESSION");
    expect(attribution.lineageRelationshipType).not.toBe("SAME_ENTITY_RENAME");
  });

  it("13 — no current-capability implication", () => {
    const artifact = makeApprovedArtifact();
    const row = artifact.approvedEvidenceRows[0]!;
    const relationship = materializeIdentityConfirmedHistoricalRspRelationship({
      approvedEvidenceArtifact: artifact,
      verifiedApprovedEvidenceArtifactSha256: SYN_SHA,
      evidenceSelector: selectorFromRow(row),
      identityDecision: makeCreateDecision(),
    });
    const attribution = deriveHistoricalRspCurrentAttribution({
      relationship,
      lineage: makeApprovedLineage(),
    });
    expect(attribution.attributionKind).toBe("HISTORICAL_FOOTPRINT");
    expect(attribution.claimsCurrentRspCapability).toBe(false);
    expect(attribution.methodVersion).toBe(HISTORICAL_RSP_CURRENT_ATTRIBUTION_METHOD_VERSION);
  });

  it("14 — customer application is not provider ownership", () => {
    const artifact = makeApprovedArtifact();
    const row = artifact.approvedEvidenceRows[0]!;
    const relationship = materializeIdentityConfirmedHistoricalRspRelationship({
      approvedEvidenceArtifact: artifact,
      verifiedApprovedEvidenceArtifactSha256: SYN_SHA,
      evidenceSelector: selectorFromRow(row),
      identityDecision: makeCreateDecision(),
    });
    const attribution = deriveHistoricalRspCurrentAttribution({
      relationship,
      lineage: makeApprovedLineage(),
    });
    expect(attribution.claimsApplicationOwnership).toBe(false);
    expect(
      applyRelationshipWithoutMembershipMutation({
        relationship,
        existingMemberApplicationIds: [],
      }).memberApplicationIds,
    ).toEqual([]);
  });

  it("malformed lineage shell is insufficient for attribution", () => {
    const artifact = makeApprovedArtifact();
    const row = artifact.approvedEvidenceRows[0]!;
    const relationship = materializeIdentityConfirmedHistoricalRspRelationship({
      approvedEvidenceArtifact: artifact,
      verifiedApprovedEvidenceArtifactSha256: SYN_SHA,
      evidenceSelector: selectorFromRow(row),
      identityDecision: makeCreateDecision(),
    });
    const shell = {
      historicalOrganizationKey: "example-registry-services",
      currentOrganizationKey: "example-successor-registry",
      stewardState: "steward-approved",
    };
    expect(() =>
      deriveHistoricalRspCurrentAttributionFromUnknown({
        relationship,
        lineage: shell,
      }),
    ).toThrow();
    expect(() => assertAttributionEligibleLineage(shell as never)).toThrow();
  });

  it("lineage with empty evidence fails closed", () => {
    expect(() =>
      assertAttributionEligibleLineage(makeApprovedLineage({ evidence: [] })),
    ).toThrow(/evidence-backed lineage/i);
  });

  it("approvedEvidenceRowIdentity parity with evidence-apply-review semantics", () => {
    // Mirror of evidenceRowIdentity in evidence-apply-review.ts
    const legacy = (input: {
      applicationId: string;
      sourceFieldPath: string;
      providerNameAsStated: string;
      evidenceLocator: string;
      roleAsStated?: string | null;
    }) =>
      [
        input.applicationId,
        input.sourceFieldPath,
        input.providerNameAsStated,
        input.evidenceLocator,
        input.roleAsStated == null ? "" : input.roleAsStated,
      ].join("\u0001");
    const row = makeApprovedRow();
    expect(approvedEvidenceRowIdentity(row)).toBe(legacy(row));
    expect(approvedEvidenceRowIdentity({ ...row, roleAsStated: null })).toBe(
      legacy({ ...row, roleAsStated: null }),
    );
  });

  it("decision IDs are deterministic and caller override is unavailable", () => {
    const a = makeCreateDecision();
    const b = makeCreateDecision();
    expect(a.decisionId).toBe(b.decisionId);
    expect(a.decisionId).toBe(deterministicProviderIdentityDecisionId(a));
    validateProviderIdentityDecision(a);
  });

  it("unresolved state forbids organization binding", () => {
    const artifact = makeApprovedArtifact();
    const unresolved = buildUnresolvedHistoricalRspRelationship({
      approvedEvidenceArtifact: artifact,
      verifiedApprovedEvidenceArtifactSha256: SYN_SHA,
      evidenceSelector: selectorFromRow(artifact.approvedEvidenceRows[0]!),
      relationshipState: "PENDING_IDENTITY_REVIEW",
    });
    expect(unresolved.organizationKey).toBeNull();
    expect(unresolved.providerIdentityDecisionId).toBeNull();
  });

  it("assertEvidenceBindingMatches succeeds for confirmed materialization", () => {
    const artifact = makeApprovedArtifact();
    const row = artifact.approvedEvidenceRows[0]!;
    const relationship = materializeIdentityConfirmedHistoricalRspRelationship({
      approvedEvidenceArtifact: artifact,
      verifiedApprovedEvidenceArtifactSha256: SYN_SHA,
      evidenceSelector: selectorFromRow(row),
      identityDecision: makeCreateDecision(),
    });
    expect(() =>
      assertEvidenceBindingMatches({
        relationship,
        approvedEvidenceArtifact: artifact,
        verifiedApprovedEvidenceArtifactSha256: SYN_SHA,
        evidenceSelector: selectorFromRow(row),
      }),
    ).not.toThrow();
  });
});
