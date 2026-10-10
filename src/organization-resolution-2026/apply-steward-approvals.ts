import type { ContentionMembershipSnapshotV1 } from "@/reveal-day-2026/contention-membership-types";
import type { Registry2026PublicationV2 } from "@/reveal-day-2026/publication-v2-types";
import { PINNED_APPLICATION_GRAPH_CONTENT_SHA256 } from "./constants";
import { hashOrganizationResolutionSnapshot } from "./semantic-hash";
import {
  APPROVED_CONFIRM_APPLICANT_LEGAL_NAMES,
  EXPECTED_CONFIRMED_APPLICANT_LEGAL_NAMES,
  EXPECTED_CONFIRMED_APPLICATIONS,
  EXPECTED_CONFIRMED_CONTENTION_MEMBERSHIPS,
  EXPECTED_CONFIRMED_ORGANIZATIONS,
  PRE_STEWARD_SEMANTIC_HASH,
  stewardDecisionProvenance,
  type StewardDecisionProvenance,
} from "./steward-decision";
import type { OrganizationResolutionSnapshot, ResolvedOrganization2026 } from "./types";
import type { StewardReviewDossier } from "./review-types";

const CONFIRMING = new Set(["A", "B"]);

export type ApplyStewardApprovalsInput = {
  snapshot: OrganizationResolutionSnapshot;
  publication: Registry2026PublicationV2;
  contention: ContentionMembershipSnapshotV1;
  /** When true (default), enforce expected 669/483/14 acceptance totals. */
  enforceExpectedCoverage?: boolean;
  expectPreSemanticHash?: string;
  generatedAt?: string;
  provenance?: StewardDecisionProvenance;
};

/**
 * Apply explicit steward APPROVE decisions: CANDIDATE → CONFIRMED for exact approved dossiers only.
 * Research recommendations are retained; provenance records the steward decision.
 */
export function applyStewardApprovalsToSnapshot(
  input: ApplyStewardApprovalsInput,
): OrganizationResolutionSnapshot {
  const provenance = input.provenance ?? stewardDecisionProvenance();
  const expectHash = input.expectPreSemanticHash ?? PRE_STEWARD_SEMANTIC_HASH;
  if (input.snapshot.semanticContentSha256 !== expectHash) {
    throw new Error(
      `Steward application fail-closed: expected pre-state semantic hash ${expectHash}, got ${input.snapshot.semanticContentSha256}`,
    );
  }
  if (
    input.snapshot.applicationPublicationPin.applicationGraphContentSha256 !==
    PINNED_APPLICATION_GRAPH_CONTENT_SHA256
  ) {
    throw new Error("Steward application fail-closed: Application publication pin mismatch");
  }

  const dossiers = input.snapshot.stewardReviewDossiers ?? [];
  const dossierByName = new Map(dossiers.map((d) => [d.applicantLegalName, d]));
  const approvedSet = new Set<string>(APPROVED_CONFIRM_APPLICANT_LEGAL_NAMES);

  for (const name of APPROVED_CONFIRM_APPLICANT_LEGAL_NAMES) {
    const dossier = dossierByName.get(name);
    if (!dossier) {
      throw new Error(`Missing approved dossier for "${name}" — fail closed`);
    }
    if (dossier.reviewRecommendation !== "CONFIRM") {
      throw new Error(`Approved dossier "${name}" recommendation is ${dossier.reviewRecommendation}, expected CONFIRM`);
    }
    if (dossier.resolutionState !== "CANDIDATE") {
      throw new Error(`Approved dossier "${name}" state is ${dossier.resolutionState}, expected CANDIDATE`);
    }
    if (!dossier.candidateOrganizationId || !dossier.candidateOrganizationKey) {
      throw new Error(`Approved dossier "${name}" missing candidate organization identity`);
    }
    if (dossier.evidenceIds.length === 0) {
      throw new Error(`Approved dossier "${name}" requires evidence refs`);
    }
    const strengths = dossier.evidenceIds.map((id) => {
      const ev = input.snapshot.evidence.find((e) => e.evidenceId === id);
      if (!ev) throw new Error(`Approved dossier "${name}" missing evidence ${id}`);
      return ev.strength;
    });
    if (!strengths.some((s) => CONFIRMING.has(s))) {
      throw new Error(`Approved dossier "${name}" fails A/B evidence threshold`);
    }
  }

  // Fail closed if CONFIRM dossiers outside the approved set exist with different identities than package
  const confirmDossiers = dossiers.filter((d) => d.reviewRecommendation === "CONFIRM");
  if (confirmDossiers.length !== APPROVED_CONFIRM_APPLICANT_LEGAL_NAMES.length) {
    throw new Error(
      `Expected exactly ${APPROVED_CONFIRM_APPLICANT_LEGAL_NAMES.length} CONFIRM dossiers, got ${confirmDossiers.length}`,
    );
  }
  for (const d of confirmDossiers) {
    if (!approvedSet.has(d.applicantLegalName)) {
      throw new Error(`Unexpected CONFIRM dossier not in steward approval set: ${d.applicantLegalName}`);
    }
  }

  const mappings = new Map(
    input.snapshot.applicantIdentityMappings.map((m) => [m.applicantLegalName, { ...m }]),
  );
  const organizations = input.snapshot.organizations.map((o) => ({
    ...o,
    applicantLegalNames: [...o.applicantLegalNames],
    memberApplicationIds: [...o.memberApplicationIds],
    evidenceRefIds: [...o.evidenceRefIds],
  }));
  const orgById = new Map(organizations.map((o) => [o.organizationId, o]));

  const nextDossiers: StewardReviewDossier[] = dossiers.map((d) => {
    if (!approvedSet.has(d.applicantLegalName)) {
      return { ...d };
    }
    const mapping = mappings.get(d.applicantLegalName);
    if (!mapping) throw new Error(`Missing mapping for approved "${d.applicantLegalName}"`);
    if (mapping.resolutionState !== "CANDIDATE") {
      throw new Error(`Mapping "${d.applicantLegalName}" not CANDIDATE before steward approval`);
    }
    if (mapping.organizationId !== d.candidateOrganizationId) {
      throw new Error(
        `Changed candidate organizationId for "${d.applicantLegalName}": mapping ${mapping.organizationId} vs dossier ${d.candidateOrganizationId}`,
      );
    }

    const org = orgById.get(d.candidateOrganizationId!);
    if (!org) {
      throw new Error(`Missing organization entity ${d.candidateOrganizationId} for "${d.applicantLegalName}"`);
    }
    if (org.organizationKey !== d.candidateOrganizationKey) {
      throw new Error(
        `Changed candidate organizationKey for "${d.applicantLegalName}": ${org.organizationKey} vs ${d.candidateOrganizationKey}`,
      );
    }

    mapping.resolutionState = "CONFIRMED";
    mapping.reason = `${mapping.reason} | Steward APPROVE ${provenance.decisionId}`;
    org.status = "CONFIRMED";
    org.confidence = org.confidence === "low" ? "medium" : org.confidence;
    org.reviewState = "steward-approved";
    org.stewardDecision = `APPROVE ${provenance.decisionId} by ${provenance.authority} on ${provenance.decidedAt}`;
    org.notes = [
      org.notes,
      `Prior state CANDIDATE; research recommendation CONFIRM retained; steward approved ${provenance.decisionId}`,
    ]
      .filter(Boolean)
      .join(" | ");

    return {
      ...d,
      resolutionState: "CONFIRMED",
      stewardDecision: "APPROVE",
      stewardDecisionId: provenance.decisionId,
      stewardDecisionAuthority: provenance.authority,
      stewardDecidedAt: provenance.decidedAt,
      priorResolutionState: "CANDIDATE",
    };
  });

  // Recompute contention memberships for confirmed applicants
  const appById = new Map(input.publication.applications.map((a) => [a.applicationId, a]));
  const confirmedLegalNames = new Set(
    [...mappings.values()].filter((m) => m.resolutionState === "CONFIRMED").map((m) => m.applicantLegalName),
  );
  let confirmedContentionMemberships = 0;
  let officialContentionMemberships = 0;
  for (const set of input.contention.contentionSets) {
    for (const member of set.members) {
      officialContentionMemberships += 1;
      const app = appById.get(member.applicationId);
      if (app && confirmedLegalNames.has(app.applicant)) {
        confirmedContentionMemberships += 1;
      }
    }
  }

  const applicantIdentityMappings = [...mappings.values()].sort((a, b) =>
    a.applicantLegalName.localeCompare(b.applicantLegalName),
  );
  const confirmedMappings = applicantIdentityMappings.filter((m) => m.resolutionState === "CONFIRMED");
  const confirmedApps = new Set(confirmedMappings.flatMap((m) => m.applicationIds));
  const confirmedOrgs = organizations.filter((o) => o.status === "CONFIRMED");

  if (input.enforceExpectedCoverage !== false) {
    if (confirmedApps.size !== EXPECTED_CONFIRMED_APPLICATIONS) {
      throw new Error(
        `Confirmed Applications ${confirmedApps.size} != expected ${EXPECTED_CONFIRMED_APPLICATIONS}`,
      );
    }
    if (confirmedContentionMemberships !== EXPECTED_CONFIRMED_CONTENTION_MEMBERSHIPS) {
      throw new Error(
        `Confirmed contention memberships ${confirmedContentionMemberships} != expected ${EXPECTED_CONFIRMED_CONTENTION_MEMBERSHIPS}`,
      );
    }
    if (confirmedOrgs.length !== EXPECTED_CONFIRMED_ORGANIZATIONS) {
      throw new Error(
        `Confirmed Organizations ${confirmedOrgs.length} != expected ${EXPECTED_CONFIRMED_ORGANIZATIONS}`,
      );
    }
    if (confirmedMappings.length !== EXPECTED_CONFIRMED_APPLICANT_LEGAL_NAMES) {
      throw new Error(
        `Confirmed Applicant legal names ${confirmedMappings.length} != expected ${EXPECTED_CONFIRMED_APPLICANT_LEGAL_NAMES}`,
      );
    }
  }

  organizations.sort((a, b) => a.organizationId.localeCompare(b.organizationId));
  nextDossiers.sort((a, b) => a.applicantLegalName.localeCompare(b.applicantLegalName));

  const draft: Omit<OrganizationResolutionSnapshot, "semanticContentSha256" | "generatedAt"> = {
    schemaVersion: input.snapshot.schemaVersion,
    methodVersion: input.snapshot.methodVersion,
    registryVersion: input.snapshot.registryVersion,
    applicationPublicationPin: input.snapshot.applicationPublicationPin,
    organizations: organizations as ResolvedOrganization2026[],
    applicantIdentityMappings,
    candidateClusters: input.snapshot.candidateClusters,
    evidence: input.snapshot.evidence,
    stewardReviewDossiers: nextDossiers,
    stewardDecisionProvenance: provenance,
    quality: {
      ...input.snapshot.quality,
      candidateOrganizationMappings: applicantIdentityMappings.filter((m) => m.resolutionState === "CANDIDATE")
        .length,
      confirmedOrganizationMappings: confirmedMappings.length,
      ambiguousMappings: applicantIdentityMappings.filter((m) => m.resolutionState === "AMBIGUOUS").length,
      unresolvedApplicantLegalNames: applicantIdentityMappings.filter((m) => m.resolutionState === "UNRESOLVED")
        .length,
      applicationsCoveredByConfirmedOrganizations: confirmedApps.size,
      confirmedApplicationCoverageRatio:
        input.snapshot.quality.observedApplications === 0
          ? 0
          : confirmedApps.size / input.snapshot.quality.observedApplications,
      confirmedOrganizationCount: confirmedOrgs.length,
      candidateOrganizationCount: organizations.filter((o) => o.status === "CANDIDATE").length,
      ambiguousOrganizationCount: organizations.filter((o) => o.status === "AMBIGUOUS").length,
      productEligibleOrganizationCount: confirmedOrgs.length,
      returningNewClassificationsCreated: 0,
      crossRoundIdentitiesCreated: 0,
      categoryInferencesCreated: 0,
      confirmedContentionMemberships,
      officialContentionMemberships,
      confirmedContentionMembershipCoverageRatio:
        officialContentionMemberships === 0
          ? 0
          : confirmedContentionMemberships / officialContentionMemberships,
    },
    limitations: [
      ...input.snapshot.limitations.filter(
        (l) => !l.includes("ORG-RES-2026-2 research recommendations are not steward approvals"),
      ),
      "Confirmed Organizations are a resolved subset only — not the complete 2026 Organization round count.",
      "Confirmed-subset portfolio / contention coverage requires disclosure; unresolved Applications are not Unknown Organization.",
      `Steward decision ${provenance.decisionId} applied by ${provenance.authority} — Build Agent is not the steward.`,
    ],
  };

  const semanticContentSha256 = hashOrganizationResolutionSnapshot(draft);
  if (semanticContentSha256 === expectHash) {
    throw new Error("Steward application must change semantic hash");
  }

  return {
    ...draft,
    semanticContentSha256,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}
