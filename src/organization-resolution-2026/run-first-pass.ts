import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Registry2026PublicationV2 } from "@/reveal-day-2026/publication-v2-types";
import type { ContentionMembershipSnapshotV1 } from "@/reveal-day-2026/contention-membership-types";
import {
  buildOrganizationResolutionSnapshot,
  emptyOrganizationResolutionRegistry,
} from "./build-resolution";
import { loadConfirmed2012ApplicantAliases } from "./load-2012-confirmed-aliases";
import {
  operatorReviewMarkdownSummary,
  operatorReviewTsv,
  stewardReviewQueueTsv,
} from "./operator-review";
import type { OrganizationResolutionRegistry, OrganizationResolutionSnapshot } from "./types";
import {
  confirmedResolutionCoverageDisclosure,
  organizationMetricsProductEligible,
} from "./eligibility";
import {
  buildResearchQueue,
  existingCandidateLegalNamesFromSnapshot,
  RESEARCH_QUEUE_METHOD,
} from "./research-queue";
import { applyResearchPackageToSnapshot } from "./apply-research";
import { applyStewardApprovalsToSnapshot } from "./apply-steward-approvals";
import { applyWeb1StewardToSnapshot } from "./applicant-identity/apply-web1-steward";
import { RESEARCH_PACKAGE_2026_2 } from "./fixtures/research-package-2026-2";
import type { ResearchPackage } from "./review-types";

export const DEFAULT_PUBLICATION_RELATIVE =
  ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json";
export const DEFAULT_CONTENTION_RELATIVE =
  ".data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json";
export const DEFAULT_REGISTRY_RELATIVE =
  "src/organization-resolution-2026/fixtures/organization-resolution-registry.json";
export const DEFAULT_OUTPUT_DIR_RELATIVE = ".data/reveal-2026/organization-resolution";

export async function loadPublicationV2(path: string): Promise<Registry2026PublicationV2> {
  return JSON.parse(await readFile(path, "utf8")) as Registry2026PublicationV2;
}

export async function loadContentionSnapshot(path: string): Promise<ContentionMembershipSnapshotV1> {
  return JSON.parse(await readFile(path, "utf8")) as ContentionMembershipSnapshotV1;
}

export async function loadResolutionRegistry(path: string): Promise<OrganizationResolutionRegistry> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as OrganizationResolutionRegistry;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyOrganizationResolutionRegistry();
    }
    throw err;
  }
}

export async function runFirstPassOrganizationResolution(input: {
  workspaceRoot: string;
  publicationPath?: string;
  contentionPath?: string;
  registryPath?: string;
  outputDir?: string;
  writeArtifacts?: boolean;
  researchPackage?: ResearchPackage;
  applyResearch?: boolean;
  /** ORG-RES-2026-2A: apply operator steward approvals (requires research first). Default true. */
  applyStewardApprovals?: boolean;
  /** ORG-RES-WEB-1: apply Applicant Website identity evidence + steward batch after ALL14. Default true when steward applies. */
  applyWeb1Identity?: boolean;
}): Promise<{
  snapshot: OrganizationResolutionSnapshot;
  inventory: ReturnType<typeof inventoryFromSnapshot>;
  artifacts?: { snapshotPath: string; reviewTsvPath: string; reviewMdPath: string; stewardQueueTsvPath: string };
}> {
  const publicationPath = input.publicationPath ?? join(input.workspaceRoot, DEFAULT_PUBLICATION_RELATIVE);
  const contentionPath = input.contentionPath ?? join(input.workspaceRoot, DEFAULT_CONTENTION_RELATIVE);
  const registryPath = input.registryPath ?? join(input.workspaceRoot, DEFAULT_REGISTRY_RELATIVE);
  const outputDir = input.outputDir ?? join(input.workspaceRoot, DEFAULT_OUTPUT_DIR_RELATIVE);

  const publication = await loadPublicationV2(publicationPath);
  const contention = await loadContentionSnapshot(contentionPath);
  const registry = await loadResolutionRegistry(registryPath);
  const confirmed2012Aliases = await loadConfirmed2012ApplicantAliases(input.workspaceRoot);

  let snapshot = buildOrganizationResolutionSnapshot({
    publication,
    registry,
    confirmed2012Aliases,
  });

  const applyResearch = input.applyResearch !== false;
  if (applyResearch) {
    const queue = buildResearchQueue({
      publication,
      contention,
      existingCandidateLegalNames: existingCandidateLegalNamesFromSnapshot(snapshot.applicantIdentityMappings),
    });
    snapshot = applyResearchPackageToSnapshot({
      snapshot,
      queue,
      research: input.researchPackage ?? RESEARCH_PACKAGE_2026_2,
    });
  }

  // Default: apply steward after research. Skip when research is off (ORG-RES-2026-1 inventory).
  const applySteward =
    input.applyStewardApprovals === true ||
    (input.applyStewardApprovals !== false && applyResearch);
  if (applySteward) {
    if (!applyResearch) {
      throw new Error("applyStewardApprovals requires applyResearch (evidence package must be present)");
    }
    snapshot = applyStewardApprovalsToSnapshot({
      snapshot,
      publication,
      contention,
    });
  }

  // WEB-1 is opt-in at the call site (product/CLI) so ALL14 + cross-round tests stay stable.
  if (input.applyWeb1Identity) {
    if (!applySteward) {
      throw new Error("applyWeb1Identity requires applyStewardApprovals (ALL14 base)");
    }
    snapshot = applyWeb1StewardToSnapshot({
      snapshot,
      publication,
      contention,
    });
  }

  const inventory = inventoryFromSnapshot(snapshot);
  if (!input.writeArtifacts) {
    return { snapshot, inventory };
  }

  await mkdir(outputDir, { recursive: true });
  const snapshotPath = join(outputDir, "organization-resolution-1.0.0.snapshot.json");
  const reviewTsvPath = join(outputDir, "organization-resolution-steward-review.tsv");
  const reviewMdPath = join(outputDir, "organization-resolution-steward-review.md");
  const stewardQueueTsvPath = join(outputDir, "organization-resolution-steward-queue.tsv");
  await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  await writeFile(reviewTsvPath, operatorReviewTsv(snapshot), "utf8");
  await writeFile(reviewMdPath, operatorReviewMarkdownSummary(snapshot), "utf8");
  await writeFile(stewardQueueTsvPath, stewardReviewQueueTsv(snapshot), "utf8");
  return {
    snapshot,
    inventory,
    artifacts: { snapshotPath, reviewTsvPath, reviewMdPath, stewardQueueTsvPath },
  };
}

export function inventoryFromSnapshot(snapshot: OrganizationResolutionSnapshot) {
  const topExact = [...snapshot.applicantIdentityMappings]
    .sort(
      (a, b) =>
        b.applicationIds.length - a.applicationIds.length ||
        a.applicantLegalName.localeCompare(b.applicantLegalName),
    )
    .slice(0, 15)
    .map((m) => ({
      applicantLegalName: m.applicantLegalName,
      applicationCount: m.applicationIds.length,
      resolutionState: m.resolutionState,
    }));

  const coverage = confirmedResolutionCoverageDisclosure(snapshot);
  const dossiers = snapshot.stewardReviewDossiers ?? [];
  return {
    applications: snapshot.quality.observedApplications,
    applicantLegalNames: snapshot.quality.observedApplicantLegalNames,
    repeatedExactLegalNames: snapshot.quality.repeatedExactLegalNameCount,
    multiApplicationLegalNames: snapshot.quality.applicantLegalNamesWithMultipleApplications,
    candidateClusters: snapshot.quality.candidateClusterCount,
    confirmedOrganizations: snapshot.quality.confirmedOrganizationCount,
    confirmedApplicantLegalNames: snapshot.quality.confirmedOrganizationMappings,
    confirmedApplications: snapshot.quality.applicationsCoveredByConfirmedOrganizations,
    confirmedCoverage: coverage,
    candidateMappings: snapshot.quality.candidateOrganizationMappings,
    ambiguousMappings: snapshot.quality.ambiguousMappings,
    unresolvedLegalNames: snapshot.quality.unresolvedApplicantLegalNames,
    unresolvedApplications: snapshot.applicantIdentityMappings
      .filter((m) => m.resolutionState === "UNRESOLVED")
      .reduce((sum, m) => sum + m.applicationIds.length, 0),
    topExactNameApplicationCounts: topExact,
    candidateHistoricalMatches: snapshot.organizations
      .filter((o) => o.status === "CANDIDATE" && o.possible2012OrganizationKey)
      .map((o) => ({
        applicantLegalNames: o.applicantLegalNames,
        possible2012OrganizationKey: o.possible2012OrganizationKey!,
        applicationCount: o.memberApplicationIds.length,
      })),
    researchQueueMethod: RESEARCH_QUEUE_METHOD,
    dossiersResearched: snapshot.quality.dossiersResearched ?? dossiers.length,
    recommendConfirm: snapshot.quality.recommendConfirm ?? 0,
    recommendKeepCandidate: snapshot.quality.recommendKeepCandidate ?? 0,
    recommendAmbiguous: snapshot.quality.recommendAmbiguous ?? 0,
    recommendReject: snapshot.quality.recommendReject ?? 0,
    recommendNoEvidence: snapshot.quality.recommendNoEvidence ?? 0,
    confirmedContentionMemberships: snapshot.quality.confirmedContentionMemberships ?? 0,
    officialContentionMemberships: snapshot.quality.officialContentionMemberships ?? 0,
    confirmedContentionMembershipCoverageRatio:
      snapshot.quality.confirmedContentionMembershipCoverageRatio ?? 0,
    stewardDecisionId: snapshot.stewardDecisionProvenance?.decisionId ?? null,
    productEligible: organizationMetricsProductEligible(snapshot),
    confirmedSubsetReadyWithLimitation: snapshot.quality.confirmedOrganizationCount > 0,
    semanticHash: snapshot.semanticContentSha256,
    applicationPin: snapshot.applicationPublicationPin.applicationGraphContentSha256,
  };
}
