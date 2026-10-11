import type { ContentionMembershipSnapshotV1 } from "@/reveal-day-2026/contention-membership-types";
import type { Registry2026PublicationV2 } from "@/reveal-day-2026/publication-v2-types";
import { PINNED_APPLICATION_GRAPH_CONTENT_SHA256 } from "../constants";
import { hashOrganizationResolutionSnapshot } from "../semantic-hash";
import type { Brand1StewardDecisionProvenance, OrganizationResolutionSnapshot, ResolvedOrganization2026 } from "../types";
import type { StewardReviewDossier } from "../review-types";
import {
  BRAND1_EXPECTED_CONFIRMED_APPLICANT_LEGAL_NAMES,
  BRAND1_EXPECTED_CONFIRMED_APPLICATIONS,
  BRAND1_EXPECTED_CONFIRMED_CONTENTION_MEMBERSHIPS,
  BRAND1_EXPECTED_CONFIRMED_ORGANIZATIONS,
  BRAND1_IDENTITY_EVIDENCE_PACKAGE,
  brand1ApprovedConfirmApplicantLegalNames,
  brand1StewardDecisionProvenance,
} from "./steward-decision-brand1";
import { applyIdentityEvidencePackageToSnapshot } from "./apply-identity-evidence";

const CONFIRMING = new Set(["A", "B"]);

/** WEB-1 families that must remain Confirmed after BRAND-1. */
export const BRAND1_PRESERVED_WEB1_ORG_KEYS = [
  "identity-digital",
  "namecheap",
  "red-rock",
  "xserver",
  "alibaba-group",
] as const;

export type ApplyBrand1StewardInput = {
  /** Snapshot after ORG-RES-WEB-1 steward. */
  snapshot: OrganizationResolutionSnapshot;
  publication: Registry2026PublicationV2;
  contention: ContentionMembershipSnapshotV1;
  enforceExpectedCoverage?: boolean;
  generatedAt?: string;
  provenance?: Brand1StewardDecisionProvenance;
};

/**
 * Apply ORG-RES-BRAND-1 identity evidence then steward APPROVE for CONFIRM dossiers.
 * Requires prior WEB-1 steward provenance. Never auto-changes conflicting CONFIRMED mappings.
 * Brand-alone / website-alone cannot confirm.
 */
export function applyBrand1StewardToSnapshot(input: ApplyBrand1StewardInput): OrganizationResolutionSnapshot {
  if (!input.snapshot.stewardDecisionProvenance) {
    throw new Error("BRAND-1 steward requires prior ALL14 stewardDecisionProvenance");
  }
  if (!input.snapshot.web1StewardDecisionProvenance) {
    throw new Error("BRAND-1 steward requires prior web1StewardDecisionProvenance");
  }
  if (
    input.snapshot.applicationPublicationPin.applicationGraphContentSha256 !==
    PINNED_APPLICATION_GRAPH_CONTENT_SHA256
  ) {
    throw new Error("BRAND-1 steward fail-closed: Application publication pin mismatch");
  }

  const withEvidence = applyIdentityEvidencePackageToSnapshot({
    snapshot: input.snapshot,
    package: BRAND1_IDENTITY_EVIDENCE_PACKAGE,
    generatedAt: input.generatedAt,
    passLabel: "ORG-RES-BRAND-1",
  });

  const approved = brand1ApprovedConfirmApplicantLegalNames();
  const approvedSet = new Set(approved);
  const dossiers = withEvidence.stewardReviewDossiers ?? [];
  const dossierByName = new Map(dossiers.map((d) => [d.applicantLegalName, d]));

  for (const name of approved) {
    const dossier = dossierByName.get(name);
    if (!dossier) throw new Error(`Missing BRAND-1 approved dossier for "${name}"`);
    if (dossier.reviewRecommendation !== "CONFIRM") {
      throw new Error(`BRAND-1 approved dossier "${name}" recommendation is ${dossier.reviewRecommendation}`);
    }
    if (dossier.resolutionState !== "CANDIDATE") {
      throw new Error(`BRAND-1 approved dossier "${name}" state is ${dossier.resolutionState}, expected CANDIDATE`);
    }
    if (!dossier.candidateOrganizationId || !dossier.candidateOrganizationKey) {
      throw new Error(`BRAND-1 approved dossier "${name}" missing candidate organization identity`);
    }
    if (dossier.evidenceIds.length === 0) {
      throw new Error(`BRAND-1 approved dossier "${name}" requires evidence refs`);
    }
    const strengths = dossier.evidenceIds.map((id) => {
      const ev = withEvidence.evidence.find((e) => e.evidenceId === id);
      if (!ev) throw new Error(`BRAND-1 approved dossier "${name}" missing evidence ${id}`);
      return ev.strength;
    });
    if (!strengths.some((s) => CONFIRMING.has(s))) {
      throw new Error(`BRAND-1 approved dossier "${name}" fails A/B evidence threshold`);
    }
    // Brand/website-only guard: require A/B that is self-identity or ownership — not APS website title alone
    const hasStrongIdentity = dossier.evidenceIds.some((id) => {
      const ev = withEvidence.evidence.find((e) => e.evidenceId === id)!;
      if (!CONFIRMING.has(ev.strength)) return false;
      const title = ev.title ?? "";
      if (/self-identity|direct parent|ultimate parent|ultimate control|affiliate|ownership/i.test(title)) {
        return true;
      }
      return !/website/i.test(title);
    });
    if (!hasStrongIdentity) {
      throw new Error(`BRAND-1 approved dossier "${name}" cannot confirm from website/Brand-only evidence`);
    }
  }

  const provenance =
    input.provenance ?? brand1StewardDecisionProvenance(withEvidence.semanticContentSha256);

  const mappings = new Map(
    withEvidence.applicantIdentityMappings.map((m) => [m.applicantLegalName, { ...m }]),
  );
  const organizations = withEvidence.organizations.map((o) => ({
    ...o,
    applicantLegalNames: [...o.applicantLegalNames],
    memberApplicationIds: [...o.memberApplicationIds],
    evidenceRefIds: [...o.evidenceRefIds],
  }));
  const orgById = new Map(organizations.map((o) => [o.organizationId, o]));

  const nextDossiers: StewardReviewDossier[] = dossiers.map((d) => {
    if (!approvedSet.has(d.applicantLegalName)) return { ...d };
    const mapping = mappings.get(d.applicantLegalName)!;
    const org = orgById.get(d.candidateOrganizationId!);
    if (!org) throw new Error(`Missing organization ${d.candidateOrganizationId}`);
    if (org.organizationKey !== d.candidateOrganizationKey) {
      throw new Error(`Organization key mismatch for ${d.applicantLegalName}`);
    }

    const priorState = mapping.resolutionState;
    mapping.resolutionState = "CONFIRMED";
    mapping.reason = `${mapping.reason} | Steward APPROVE ${provenance.decisionId}`;
    org.status = "CONFIRMED";
    org.confidence = org.confidence === "low" ? "medium" : org.confidence;
    org.reviewState = "steward-approved";
    org.stewardDecision = `APPROVE ${provenance.decisionId} by ${provenance.authority} on ${provenance.decidedAt}`;
    org.notes = [
      org.notes,
      `Prior state ${priorState}; research recommendation CONFIRM retained; steward approved ${provenance.decisionId}`,
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
      priorResolutionState: priorState,
    };
  });

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

  // Preserve WEB-1 families
  for (const key of BRAND1_PRESERVED_WEB1_ORG_KEYS) {
    const org = organizations.find((o) => o.organizationKey === key);
    if (!org || org.status !== "CONFIRMED") {
      throw new Error(`BRAND-1 must preserve WEB-1 Confirmed Organization ${key}`);
    }
  }
  for (const jtName of ["Japan Business Systems, Inc.", "Japan Tobacco Inc."]) {
    const jtMapping = mappings.get(jtName);
    if (jtMapping?.resolutionState === "CONFIRMED") {
      throw new Error(`BRAND-1 must not Confirm ${jtName} (jt.com) without new sufficient evidence`);
    }
  }

  if (input.enforceExpectedCoverage !== false) {
    if (confirmedApps.size !== BRAND1_EXPECTED_CONFIRMED_APPLICATIONS) {
      throw new Error(
        `BRAND-1 Confirmed Applications ${confirmedApps.size} != expected ${BRAND1_EXPECTED_CONFIRMED_APPLICATIONS}`,
      );
    }
    if (confirmedContentionMemberships !== BRAND1_EXPECTED_CONFIRMED_CONTENTION_MEMBERSHIPS) {
      throw new Error(
        `BRAND-1 Confirmed contention memberships ${confirmedContentionMemberships} != expected ${BRAND1_EXPECTED_CONFIRMED_CONTENTION_MEMBERSHIPS}`,
      );
    }
    if (confirmedOrgs.length !== BRAND1_EXPECTED_CONFIRMED_ORGANIZATIONS) {
      throw new Error(
        `BRAND-1 Confirmed Organizations ${confirmedOrgs.length} != expected ${BRAND1_EXPECTED_CONFIRMED_ORGANIZATIONS}`,
      );
    }
    if (confirmedMappings.length !== BRAND1_EXPECTED_CONFIRMED_APPLICANT_LEGAL_NAMES) {
      throw new Error(
        `BRAND-1 Confirmed Applicant legal names ${confirmedMappings.length} != expected ${BRAND1_EXPECTED_CONFIRMED_APPLICANT_LEGAL_NAMES}`,
      );
    }
  }

  organizations.sort((a, b) => a.organizationId.localeCompare(b.organizationId));
  nextDossiers.sort((a, b) => a.applicantLegalName.localeCompare(b.applicantLegalName));

  const draft: Omit<OrganizationResolutionSnapshot, "semanticContentSha256" | "generatedAt"> = {
    schemaVersion: withEvidence.schemaVersion,
    methodVersion: withEvidence.methodVersion,
    registryVersion: withEvidence.registryVersion,
    applicationPublicationPin: withEvidence.applicationPublicationPin,
    organizations: organizations as ResolvedOrganization2026[],
    applicantIdentityMappings,
    candidateClusters: withEvidence.candidateClusters,
    evidence: withEvidence.evidence,
    stewardReviewDossiers: nextDossiers,
    stewardDecisionProvenance: input.snapshot.stewardDecisionProvenance,
    web1StewardDecisionProvenance: input.snapshot.web1StewardDecisionProvenance,
    brand1StewardDecisionProvenance: provenance,
    quality: {
      ...withEvidence.quality,
      candidateOrganizationMappings: applicantIdentityMappings.filter((m) => m.resolutionState === "CANDIDATE")
        .length,
      confirmedOrganizationMappings: confirmedMappings.length,
      ambiguousMappings: applicantIdentityMappings.filter((m) => m.resolutionState === "AMBIGUOUS").length,
      unresolvedApplicantLegalNames: applicantIdentityMappings.filter((m) => m.resolutionState === "UNRESOLVED")
        .length,
      applicationsCoveredByConfirmedOrganizations: confirmedApps.size,
      confirmedApplicationCoverageRatio:
        withEvidence.quality.observedApplications === 0
          ? 0
          : confirmedApps.size / withEvidence.quality.observedApplications,
      confirmedOrganizationCount: confirmedOrgs.length,
      candidateOrganizationCount: organizations.filter((o) => o.status === "CANDIDATE").length,
      ambiguousOrganizationCount: organizations.filter((o) => o.status === "AMBIGUOUS").length,
      productEligibleOrganizationCount: confirmedOrgs.length,
      confirmedContentionMemberships,
      officialContentionMemberships,
      confirmedContentionMembershipCoverageRatio:
        officialContentionMemberships === 0
          ? 0
          : confirmedContentionMemberships / officialContentionMemberships,
    },
    limitations: [
      ...withEvidence.limitations.filter((l) => !l.includes("ORG-RES-BRAND-1")),
      "Confirmed Organizations are a resolved subset only — not the complete 2026 Organization round count.",
      `Steward decision ${provenance.decisionId} applied by ${provenance.authority} — Build Agent is not the steward.`,
      "Brand designation is a discovery/corroboration signal; confirmation requires Website + legal-name self-identity (or equivalent) without conflict.",
      "Applied-for Brand strings are not Organization identities.",
    ],
  };

  return {
    ...draft,
    semanticContentSha256: hashOrganizationResolutionSnapshot(draft),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}
