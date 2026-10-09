import {
  PINNED_2012_ORG_PROMOTION_REGISTRY_CONTENT_SHA256,
  PINNED_2026_APPLICATION_GRAPH_CONTENT_SHA256,
  PINNED_2026_ORG_RESOLUTION_SEMANTIC_SHA256,
} from "./constants";
import { unmatchedDoesNotImplyNewDisclosure } from "./eligibility";
import { hashCrossRoundOrganizationIdentitySnapshot } from "./semantic-hash";
import {
  APPROVED_CROSS_ROUND_PAIRS,
  EXPECTED_CONFIRMED_CROSS_ROUND_APPS_2012,
  EXPECTED_CONFIRMED_CROSS_ROUND_APPS_2026,
  EXPECTED_CONFIRMED_CROSS_ROUND_MAPPINGS,
  PRE_STEWARD_CROSS_ROUND_SEMANTIC_HASH,
  crossRoundStewardDecisionProvenance,
  type CrossRoundMappingStewardDecision,
  type CrossRoundStewardDecisionProvenance,
} from "./steward-decision";
import type { CrossRoundIdentityMapping, CrossRoundOrganizationIdentitySnapshot } from "./types";

const CONFIRMING = new Set(["A", "B"]);

export type ApplyCrossRoundStewardApprovalsInput = {
  snapshot: CrossRoundOrganizationIdentitySnapshot;
  enforceExpectedCoverage?: boolean;
  expectPreSemanticHash?: string;
  generatedAt?: string;
  provenance?: CrossRoundStewardDecisionProvenance;
};

/**
 * Apply explicit steward APPROVE for the two CONFIRM candidates only.
 * Research recommendations and non-approved states are retained.
 */
export function applyCrossRoundStewardApprovalsToSnapshot(
  input: ApplyCrossRoundStewardApprovalsInput,
): CrossRoundOrganizationIdentitySnapshot {
  const provenance = input.provenance ?? crossRoundStewardDecisionProvenance();
  const expectHash = input.expectPreSemanticHash ?? PRE_STEWARD_CROSS_ROUND_SEMANTIC_HASH;

  if (input.snapshot.semanticContentSha256 !== expectHash) {
    throw new Error(
      `Cross-round steward application fail-closed: expected pre-state hash ${expectHash}, got ${input.snapshot.semanticContentSha256}`,
    );
  }
  if (input.snapshot.pin2012.contentSha256 !== PINNED_2012_ORG_PROMOTION_REGISTRY_CONTENT_SHA256) {
    throw new Error("Cross-round steward application fail-closed: 2012 Organization pin mismatch");
  }
  if (input.snapshot.pin2026Resolution.contentSha256 !== PINNED_2026_ORG_RESOLUTION_SEMANTIC_SHA256) {
    throw new Error("Cross-round steward application fail-closed: 2026 resolution pin mismatch");
  }
  if (
    input.snapshot.pin2026Resolution.applicationGraphContentSha256 !==
    PINNED_2026_APPLICATION_GRAPH_CONTENT_SHA256
  ) {
    throw new Error("Cross-round steward application fail-closed: Application graph pin mismatch");
  }
  if (input.snapshot.quality.crossRoundConfirmed !== 0) {
    throw new Error("Cross-round steward application fail-closed: pre-state CONFIRMED must be 0");
  }

  const confirmMappings = input.snapshot.mappings.filter((m) => m.reviewRecommendation === "CONFIRM");
  if (confirmMappings.length !== APPROVED_CROSS_ROUND_PAIRS.length) {
    throw new Error(
      `Expected exactly ${APPROVED_CROSS_ROUND_PAIRS.length} CONFIRM recommendations, got ${confirmMappings.length}`,
    );
  }

  const approvedKey = (a: string, b: string) => `${a}↔${b}`;
  const approvedSet = new Set(
    APPROVED_CROSS_ROUND_PAIRS.map((p) => approvedKey(p.organization2026Id, p.organization2012Id)),
  );

  for (const pair of APPROVED_CROSS_ROUND_PAIRS) {
    const mapping = input.snapshot.mappings.find(
      (m) =>
        m.organization2026Id === pair.organization2026Id &&
        m.organization2012Id === pair.organization2012Id,
    );
    if (!mapping) {
      throw new Error(
        `Missing approved mapping ${pair.organization2026Id} ↔ ${pair.organization2012Id}`,
      );
    }
    if (mapping.state !== "CANDIDATE") {
      throw new Error(
        `Approved mapping ${mapping.crossRoundIdentityId} state is ${mapping.state}, expected CANDIDATE`,
      );
    }
    if (mapping.reviewRecommendation !== "CONFIRM") {
      throw new Error(
        `Approved mapping ${mapping.crossRoundIdentityId} recommendation is ${mapping.reviewRecommendation}`,
      );
    }
    if (mapping.relationshipType !== pair.relationshipType) {
      throw new Error(
        `Approved mapping relationship ${mapping.relationshipType} != ${pair.relationshipType}`,
      );
    }
    if (mapping.evidenceRefIds.length === 0) {
      throw new Error(`Approved mapping ${mapping.crossRoundIdentityId} requires evidence refs`);
    }
    if (!mapping.temporalAssessment) {
      throw new Error(`Approved mapping ${mapping.crossRoundIdentityId} requires temporalAssessment`);
    }
    if (mapping.temporalAssessment.acquisitionAfter2012) {
      throw new Error(
        `Approved SAME_ORGANIZATION mapping ${mapping.crossRoundIdentityId} cannot be acquisition-after-2012`,
      );
    }
    const strengths = mapping.evidenceRefIds.map((id) => {
      const ev = input.snapshot.evidence.find((e) => e.evidenceId === id);
      if (!ev) throw new Error(`Missing evidence ${id} for ${mapping.crossRoundIdentityId}`);
      return ev.strength;
    });
    if (!strengths.some((s) => CONFIRMING.has(s))) {
      throw new Error(`Approved mapping ${mapping.crossRoundIdentityId} fails A/B evidence threshold`);
    }
  }

  for (const m of confirmMappings) {
    if (!m.organization2012Id || !approvedSet.has(approvedKey(m.organization2026Id, m.organization2012Id))) {
      throw new Error(`Unexpected CONFIRM mapping not in steward approval set: ${m.crossRoundIdentityId}`);
    }
  }

  const mappingDecision: CrossRoundMappingStewardDecision = {
    decision: "APPROVE",
    decisionId: provenance.decisionId,
    authority: provenance.authority,
    decidedAt: provenance.decidedAt,
    priorState: "CANDIDATE",
  };

  const mappings: CrossRoundIdentityMapping[] = input.snapshot.mappings.map((m) => {
    if (!m.organization2012Id) return { ...m };
    if (!approvedSet.has(approvedKey(m.organization2026Id, m.organization2012Id))) {
      return { ...m };
    }
    return {
      ...m,
      state: "CONFIRMED",
      stewardDecision: mappingDecision,
      notes: [
        m.notes,
        `Prior state CANDIDATE; research recommendation CONFIRM retained; steward APPROVE ${provenance.decisionId}`,
      ]
        .filter(Boolean)
        .join(" | "),
    };
  });

  const confirmed = mappings.filter((m) => m.state === "CONFIRMED");
  const apps2026 = confirmed.reduce((sum, m) => sum + m.organization2026ApplicationCount, 0);
  const apps2012 = confirmed.reduce((sum, m) => sum + m.organization2012ApplicationCount, 0);

  if (input.enforceExpectedCoverage !== false) {
    if (confirmed.length !== EXPECTED_CONFIRMED_CROSS_ROUND_MAPPINGS) {
      throw new Error(
        `Confirmed cross-round mappings ${confirmed.length} != expected ${EXPECTED_CONFIRMED_CROSS_ROUND_MAPPINGS}`,
      );
    }
    if (apps2026 !== EXPECTED_CONFIRMED_CROSS_ROUND_APPS_2026) {
      throw new Error(
        `Confirmed cross-round 2026 Applications ${apps2026} != expected ${EXPECTED_CONFIRMED_CROSS_ROUND_APPS_2026}`,
      );
    }
    if (apps2012 !== EXPECTED_CONFIRMED_CROSS_ROUND_APPS_2012) {
      throw new Error(
        `Confirmed cross-round 2012 Applications ${apps2012} != expected ${EXPECTED_CONFIRMED_CROSS_ROUND_APPS_2012}`,
      );
    }
  }

  // Preserve non-approved states exactly
  const godaddy = mappings.find((m) => m.organization2026Key === "godaddy-registry-services");
  if (!godaddy || godaddy.state !== "REJECTED" || godaddy.relationshipType !== "ACQUIRED_AFTER_2012") {
    throw new Error("GoDaddy/Uniregistry REJECTED / ACQUIRED_AFTER_2012 must be preserved");
  }
  const echo = mappings.find((m) => m.organization2026Key === "echostar");
  if (!echo || echo.state !== "AMBIGUOUS" || echo.relationshipType !== "SUCCESSOR_ENTITY_REVIEW_REQUIRED") {
    throw new Error("EchoStar/Dish AMBIGUOUS / SUCCESSOR_ENTITY_REVIEW_REQUIRED must be preserved");
  }
  const unmatched = mappings.filter((m) => m.state === "UNMATCHED");
  if (unmatched.length !== 10) {
    throw new Error(`Expected 10 UNMATCHED mappings, got ${unmatched.length}`);
  }

  const recommendConfirm = mappings.filter((m) => m.reviewRecommendation === "CONFIRM");
  const quality = {
    examined2026ConfirmedOrganizations: input.snapshot.quality.examined2026ConfirmedOrganizations,
    available2012ConfirmedOrganizations: input.snapshot.quality.available2012ConfirmedOrganizations,
    candidateMappings: mappings.filter((m) => m.state === "CANDIDATE").length,
    recommendConfirm: recommendConfirm.length,
    recommendReject: mappings.filter((m) => m.reviewRecommendation === "REJECT").length,
    recommendAmbiguous: mappings.filter((m) => m.reviewRecommendation === "AMBIGUOUS").length,
    noPlausibleConfirmed2012Match: mappings.filter((m) => m.reviewRecommendation === "NO_MATCH").length,
    crossRoundConfirmed: confirmed.length,
    crossRoundCandidate: mappings.filter((m) => m.state === "CANDIDATE").length,
    crossRoundAmbiguous: mappings.filter((m) => m.state === "AMBIGUOUS").length,
    crossRoundRejected: mappings.filter((m) => m.state === "REJECTED").length,
    unmatched2026Organizations: unmatched.length,
    applicationsInRecommendConfirmMappings: recommendConfirm.reduce(
      (sum, m) => sum + m.organization2026ApplicationCount,
      0,
    ),
    applicationsRepresentedByConfirmedCrossRound2026: apps2026,
    applicationsRepresentedByConfirmedCrossRound2012: apps2012,
    returningClassificationsFinalized: 0 as const,
    newClassificationsFinalized: 0 as const,
    expandedClassificationsFinalized: 0 as const,
    contractedClassificationsFinalized: 0 as const,
    categoryInferencesCreated: 0 as const,
  };

  const draft: Omit<CrossRoundOrganizationIdentitySnapshot, "semanticContentSha256" | "generatedAt"> = {
    schemaVersion: input.snapshot.schemaVersion,
    methodVersion: input.snapshot.methodVersion,
    registryVersion: input.snapshot.registryVersion,
    pin2012: input.snapshot.pin2012,
    pin2026Resolution: input.snapshot.pin2026Resolution,
    evidence: input.snapshot.evidence,
    mappings: mappings.sort((a, b) => a.crossRoundIdentityId.localeCompare(b.crossRoundIdentityId)),
    quality,
    stewardDecisionProvenance: provenance,
    limitations: [
      unmatchedDoesNotImplyNewDisclosure(),
      "Confirmed cross-round identities are a resolved subset only (CONFIRMED_SUBSET_READY_WITH_LIMITATION) — not complete-round returning/new.",
      "Returning/new/expanded/contracted classifications remain 0 until RETURNING-NEW-1.",
      "GoDaddy/Uniregistry remains REJECTED (ACQUIRED_AFTER_2012) — not rewritten as the 2012 participant.",
      "EchoStar/Dish remains AMBIGUOUS (SUCCESSOR_ENTITY_REVIEW_REQUIRED).",
      `Steward decision ${provenance.decisionId} applied by ${provenance.authority} — Build Agent is not the steward.`,
      "Category/sector inference is out of scope.",
      "Contention Org Name is irrelevant to cross-round Organization identity.",
    ],
  };

  const semanticContentSha256 = hashCrossRoundOrganizationIdentitySnapshot(draft);
  if (semanticContentSha256 === expectHash) {
    throw new Error("Steward application must change semantic hash");
  }

  return {
    ...draft,
    semanticContentSha256,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}
