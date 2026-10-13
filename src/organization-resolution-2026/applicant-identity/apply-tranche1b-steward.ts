import type { ContentionMembershipSnapshotV1 } from "@/reveal-day-2026/contention-membership-types";
import type { Registry2026PublicationV2 } from "@/reveal-day-2026/publication-v2-types";
import { PINNED_APPLICATION_GRAPH_CONTENT_SHA256 } from "../constants";
import { hashOrganizationResolutionSnapshot } from "../semantic-hash";
import type {
  OrganizationResolutionSnapshot,
  ResolvedOrganization2026,
  Tranche1bStewardDecisionProvenance,
} from "../types";
import type { StewardReviewDossier } from "../review-types";
import { applyIdentityEvidencePackageToSnapshot } from "./apply-identity-evidence";
import {
  TRANCHE1B_APPROVED_TRANSITIONS,
  TRANCHE1B_EXPECTED_AMBIGUOUS_MAPPINGS,
  TRANCHE1B_EXPECTED_CANDIDATE_MAPPINGS,
  TRANCHE1B_EXPECTED_CONFIRMED_APPLICANT_LEGAL_NAMES,
  TRANCHE1B_EXPECTED_CONFIRMED_APPLICATIONS,
  TRANCHE1B_EXPECTED_CONFIRMED_BRAND_APPLICATIONS,
  TRANCHE1B_EXPECTED_CONFIRMED_CONTENTION_MEMBERSHIPS,
  TRANCHE1B_EXPECTED_CONFIRMED_ORGANIZATIONS,
  TRANCHE1B_EXPECTED_UNRESOLVED_APPLICANT_LEGAL_NAMES,
  TRANCHE1B_EXPECTED_UNRESOLVED_APPLICATIONS,
  TRANCHE1B_EXPECTED_UNRESOLVED_BRAND_APPLICATIONS,
  TRANCHE1B_EXPECT_PRE_SEMANTIC_HASH,
  tranche1bApprovedApplicantLegalNames,
  tranche1bConfirmEvidencePackage,
  tranche1bStewardDecisionProvenance,
  TRANCHE1_IDENTITY_EVIDENCE_PACKAGE,
} from "./steward-decision-tranche1b";

const CONFIRMING = new Set(["A", "B"]);

const NON_APPROVED_KEEP = [
  "Amazon Registry Services, Inc.",
  "AT&T Services, Inc.",
  "Taisho Pharmaceutical Co., Ltd.",
  "Corporation Service Company",
  "Registered Agents Inc",
  "Cam Connecting SARL",
  "ALIBABA INNOVATION PRIVATE LIMITED",
  "American Lebanese Syrian Associated Charities, Inc.",
  "NAME SPACE LLC",
  "TechEdge Limited",
  "Innovation Service Limited",
  "Internet DotTrademark Organisation Limited",
] as const;

const NON_APPROVED_AMBIGUOUS = [
  "CareCredit LLC",
  "ML 35 LLC",
  "Beijing Zitiao Network Technology Co., Ltd.",
  "Douyin Vision Co., Ltd.",
] as const;

const NON_APPROVED_NO_EVIDENCE = ["NextGEN TLDs GmbH", "NETDREAM PTE. LTD."] as const;

export type ApplyTranche1bStewardInput = {
  /** Snapshot after ORG-RES-BRAND-1 steward. */
  snapshot: OrganizationResolutionSnapshot;
  publication: Registry2026PublicationV2;
  contention: ContentionMembershipSnapshotV1;
  enforceExpectedCoverage?: boolean;
  generatedAt?: string;
  provenance?: Tranche1bStewardDecisionProvenance;
};

/**
 * Apply ORG-RES-TRANCHE-1B: attach CONFIRM-only dossiers from immutable 1A package,
 * then steward APPROVE exactly the nine authorized transitions.
 * Never approves KEEP_CANDIDATE / MARK_AMBIGUOUS / NO_EVIDENCE.
 * Never demotes existing CONFIRMED mappings.
 */
export function applyTranche1bStewardToSnapshot(
  input: ApplyTranche1bStewardInput,
): OrganizationResolutionSnapshot {
  if (!input.snapshot.stewardDecisionProvenance) {
    throw new Error("TRANCHE-1B steward requires prior ALL14 stewardDecisionProvenance");
  }
  if (!input.snapshot.web1StewardDecisionProvenance) {
    throw new Error("TRANCHE-1B steward requires prior web1StewardDecisionProvenance");
  }
  if (!input.snapshot.brand1StewardDecisionProvenance) {
    throw new Error("TRANCHE-1B steward requires prior brand1StewardDecisionProvenance");
  }
  if (
    input.snapshot.applicationPublicationPin.applicationGraphContentSha256 !==
    PINNED_APPLICATION_GRAPH_CONTENT_SHA256
  ) {
    throw new Error("TRANCHE-1B steward fail-closed: Application publication pin mismatch");
  }
  if (input.snapshot.semanticContentSha256 !== TRANCHE1B_EXPECT_PRE_SEMANTIC_HASH) {
    throw new Error(
      `TRANCHE-1B steward fail-closed: pre-approval semantic hash ${input.snapshot.semanticContentSha256} != ${TRANCHE1B_EXPECT_PRE_SEMANTIC_HASH}`,
    );
  }

  // Validate immutable 1A package contains exact approved CONFIRM dossiers / keys
  const fullByName = new Map(
    TRANCHE1_IDENTITY_EVIDENCE_PACKAGE.dossiers.map((d) => [d.applicantLegalName, d]),
  );
  for (const t of TRANCHE1B_APPROVED_TRANSITIONS) {
    const d = fullByName.get(t.applicantLegalName);
    if (!d) throw new Error(`TRANCHE-1B missing 1A dossier for "${t.applicantLegalName}"`);
    if (d.reviewRecommendation !== "CONFIRM") {
      throw new Error(
        `TRANCHE-1B "${t.applicantLegalName}" reviewRecommendation is ${d.reviewRecommendation}, expected CONFIRM`,
      );
    }
    if (d.candidateOrganizationKey !== t.organizationKey) {
      throw new Error(
        `TRANCHE-1B "${t.applicantLegalName}" key ${d.candidateOrganizationKey} != approved ${t.organizationKey}`,
      );
    }
    if (d.candidateCanonicalName !== t.canonicalName) {
      throw new Error(
        `TRANCHE-1B "${t.applicantLegalName}" canonical ${d.candidateCanonicalName} != approved ${t.canonicalName}`,
      );
    }
    if (d.resolutionState === ("CONFIRMED" as string)) {
      throw new Error(`TRANCHE-1A package must not pre-confirm "${t.applicantLegalName}"`);
    }
  }
  for (const name of [...NON_APPROVED_KEEP, ...NON_APPROVED_AMBIGUOUS, ...NON_APPROVED_NO_EVIDENCE]) {
    const d = fullByName.get(name);
    if (!d) throw new Error(`TRANCHE-1B expected non-approved 1A dossier missing: ${name}`);
    if (d.reviewRecommendation === "CONFIRM") {
      throw new Error(`TRANCHE-1B non-approved dossier "${name}" must not be CONFIRM`);
    }
  }

  const confirmPackage = tranche1bConfirmEvidencePackage();
  const withEvidence = applyIdentityEvidencePackageToSnapshot({
    snapshot: input.snapshot,
    package: confirmPackage,
    generatedAt: input.generatedAt,
    passLabel: "ORG-RES-TRANCHE-1A",
  });

  const approved = tranche1bApprovedApplicantLegalNames();
  const approvedSet = new Set(approved);
  const dossiers = withEvidence.stewardReviewDossiers ?? [];
  const dossierByName = new Map(dossiers.map((d) => [d.applicantLegalName, d]));

  for (const name of approved) {
    const dossier = dossierByName.get(name);
    if (!dossier) throw new Error(`Missing TRANCHE-1B approved dossier for "${name}"`);
    if (dossier.reviewRecommendation !== "CONFIRM") {
      throw new Error(
        `TRANCHE-1B approved dossier "${name}" recommendation is ${dossier.reviewRecommendation}`,
      );
    }
    if (dossier.resolutionState !== "CANDIDATE") {
      throw new Error(
        `TRANCHE-1B approved dossier "${name}" state is ${dossier.resolutionState}, expected CANDIDATE`,
      );
    }
    if (!dossier.candidateOrganizationId || !dossier.candidateOrganizationKey) {
      throw new Error(`TRANCHE-1B approved dossier "${name}" missing candidate organization identity`);
    }
    const expected = TRANCHE1B_APPROVED_TRANSITIONS.find((t) => t.applicantLegalName === name)!;
    if (dossier.candidateOrganizationKey !== expected.organizationKey) {
      throw new Error(
        `TRANCHE-1B approved dossier "${name}" key mismatch ${dossier.candidateOrganizationKey}`,
      );
    }
    if (dossier.evidenceIds.length === 0) {
      throw new Error(`TRANCHE-1B approved dossier "${name}" requires evidence refs`);
    }
    const strengths = dossier.evidenceIds.map((id) => {
      const ev = withEvidence.evidence.find((e) => e.evidenceId === id);
      if (!ev) throw new Error(`TRANCHE-1B approved dossier "${name}" missing evidence ${id}`);
      return ev.strength;
    });
    if (!strengths.some((s) => CONFIRMING.has(s))) {
      throw new Error(`TRANCHE-1B approved dossier "${name}" fails A/B evidence threshold`);
    }
  }

  // New Organization keys must not already be CONFIRMED product orgs
  const priorConfirmedKeys = new Set(
    input.snapshot.organizations.filter((o) => o.status === "CONFIRMED").map((o) => o.organizationKey),
  );
  for (const t of TRANCHE1B_APPROVED_TRANSITIONS) {
    if (priorConfirmedKeys.has(t.organizationKey)) {
      throw new Error(`TRANCHE-1B expected new Organization key already CONFIRMED: ${t.organizationKey}`);
    }
  }

  const provenance =
    input.provenance ?? tranche1bStewardDecisionProvenance(withEvidence.semanticContentSha256);

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

  // Preserve prior CONFIRMED mappings exactly
  for (const prior of input.snapshot.applicantIdentityMappings.filter(
    (m) => m.resolutionState === "CONFIRMED",
  )) {
    const next = mappings.get(prior.applicantLegalName);
    if (!next || next.resolutionState !== "CONFIRMED" || next.organizationId !== prior.organizationId) {
      throw new Error(`TRANCHE-1B must not demote/rewrite prior CONFIRMED ${prior.applicantLegalName}`);
    }
  }

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
  const confirmedSetIds = new Set<string>();
  for (const set of input.contention.contentionSets) {
    let setHasConfirmed = false;
    for (const member of set.members) {
      officialContentionMemberships += 1;
      const app = appById.get(member.applicationId);
      if (app && confirmedLegalNames.has(app.applicant)) {
        confirmedContentionMemberships += 1;
        setHasConfirmed = true;
      }
    }
    if (setHasConfirmed) confirmedSetIds.add(set.officialContentionSetId);
  }

  const applicantIdentityMappings = [...mappings.values()].sort((a, b) =>
    a.applicantLegalName.localeCompare(b.applicantLegalName),
  );
  const confirmedMappings = applicantIdentityMappings.filter((m) => m.resolutionState === "CONFIRMED");
  const confirmedApps = new Set(confirmedMappings.flatMap((m) => m.applicationIds));
  const confirmedOrgs = organizations.filter((o) => o.status === "CONFIRMED");

  let confirmedBrandApps = 0;
  let unresolvedBrandApps = 0;
  let unresolvedApps = 0;
  for (const m of applicantIdentityMappings) {
    for (const id of m.applicationIds) {
      const app = appById.get(id);
      const isBrand = Boolean(app?.designations?.brand);
      if (m.resolutionState === "CONFIRMED") {
        if (isBrand) confirmedBrandApps += 1;
      } else if (m.resolutionState === "UNRESOLVED") {
        unresolvedApps += 1;
        if (isBrand) unresolvedBrandApps += 1;
      }
    }
  }

  // Non-approved tranche names must remain non-CONFIRMED
  for (const name of [...NON_APPROVED_KEEP, ...NON_APPROVED_AMBIGUOUS, ...NON_APPROVED_NO_EVIDENCE]) {
    const m = mappings.get(name);
    if (m?.resolutionState === "CONFIRMED") {
      throw new Error(`TRANCHE-1B must not CONFIRMED non-approved dossier ${name}`);
    }
  }

  if (input.enforceExpectedCoverage !== false) {
    if (confirmedApps.size !== TRANCHE1B_EXPECTED_CONFIRMED_APPLICATIONS) {
      throw new Error(
        `TRANCHE-1B Confirmed Applications ${confirmedApps.size} != expected ${TRANCHE1B_EXPECTED_CONFIRMED_APPLICATIONS}`,
      );
    }
    if (confirmedBrandApps !== TRANCHE1B_EXPECTED_CONFIRMED_BRAND_APPLICATIONS) {
      throw new Error(
        `TRANCHE-1B Confirmed Brand Applications ${confirmedBrandApps} != expected ${TRANCHE1B_EXPECTED_CONFIRMED_BRAND_APPLICATIONS}`,
      );
    }
    if (confirmedContentionMemberships !== TRANCHE1B_EXPECTED_CONFIRMED_CONTENTION_MEMBERSHIPS) {
      throw new Error(
        `TRANCHE-1B Confirmed contention memberships ${confirmedContentionMemberships} != expected ${TRANCHE1B_EXPECTED_CONFIRMED_CONTENTION_MEMBERSHIPS}`,
      );
    }
    if (confirmedOrgs.length !== TRANCHE1B_EXPECTED_CONFIRMED_ORGANIZATIONS) {
      throw new Error(
        `TRANCHE-1B Confirmed Organizations ${confirmedOrgs.length} != expected ${TRANCHE1B_EXPECTED_CONFIRMED_ORGANIZATIONS}`,
      );
    }
    if (confirmedMappings.length !== TRANCHE1B_EXPECTED_CONFIRMED_APPLICANT_LEGAL_NAMES) {
      throw new Error(
        `TRANCHE-1B Confirmed Applicant legal names ${confirmedMappings.length} != expected ${TRANCHE1B_EXPECTED_CONFIRMED_APPLICANT_LEGAL_NAMES}`,
      );
    }
    const unresolvedNames = applicantIdentityMappings.filter((m) => m.resolutionState === "UNRESOLVED").length;
    const candidateNames = applicantIdentityMappings.filter((m) => m.resolutionState === "CANDIDATE").length;
    const ambiguousNames = applicantIdentityMappings.filter((m) => m.resolutionState === "AMBIGUOUS").length;
    if (unresolvedNames !== TRANCHE1B_EXPECTED_UNRESOLVED_APPLICANT_LEGAL_NAMES) {
      throw new Error(
        `TRANCHE-1B Unresolved Applicants ${unresolvedNames} != expected ${TRANCHE1B_EXPECTED_UNRESOLVED_APPLICANT_LEGAL_NAMES}`,
      );
    }
    if (candidateNames !== TRANCHE1B_EXPECTED_CANDIDATE_MAPPINGS) {
      throw new Error(
        `TRANCHE-1B Candidate mappings ${candidateNames} != expected ${TRANCHE1B_EXPECTED_CANDIDATE_MAPPINGS}`,
      );
    }
    if (ambiguousNames !== TRANCHE1B_EXPECTED_AMBIGUOUS_MAPPINGS) {
      throw new Error(
        `TRANCHE-1B Ambiguous mappings ${ambiguousNames} != expected ${TRANCHE1B_EXPECTED_AMBIGUOUS_MAPPINGS}`,
      );
    }
    if (unresolvedApps !== TRANCHE1B_EXPECTED_UNRESOLVED_APPLICATIONS) {
      throw new Error(
        `TRANCHE-1B Unresolved Applications ${unresolvedApps} != expected ${TRANCHE1B_EXPECTED_UNRESOLVED_APPLICATIONS}`,
      );
    }
    if (unresolvedBrandApps !== TRANCHE1B_EXPECTED_UNRESOLVED_BRAND_APPLICATIONS) {
      throw new Error(
        `TRANCHE-1B Unresolved Brand Applications ${unresolvedBrandApps} != expected ${TRANCHE1B_EXPECTED_UNRESOLVED_BRAND_APPLICATIONS}`,
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
    brand1StewardDecisionProvenance: input.snapshot.brand1StewardDecisionProvenance,
    tranche1bStewardDecisionProvenance: provenance,
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
      ...withEvidence.limitations.filter((l) => !l.includes("ORG-RES-TRANCHE-1B")),
      "Confirmed Organizations are a resolved subset only — not the complete 2026 Organization round count.",
      `Steward decision ${provenance.decisionId} applied by ${provenance.authority} — Build Agent is not the steward.`,
      "ORG-RES-TRANCHE-1B approves only the nine authorized 1A CONFIRM recommendations; residual Brand/unresolved coverage remains material.",
      `Confirmed contention set coverage after tranche (derived): ${confirmedSetIds.size} distinct official sets with ≥1 Confirmed membership.`,
    ],
  };

  return {
    ...draft,
    semanticContentSha256: hashOrganizationResolutionSnapshot(draft),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}
