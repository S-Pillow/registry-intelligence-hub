import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Registry2026PublicationV2 } from "@/reveal-day-2026/publication-v2-types";
import {
  buildOrganizationResolutionSnapshot,
  emptyOrganizationResolutionRegistry,
} from "./build-resolution";
import { loadConfirmed2012ApplicantAliases } from "./load-2012-confirmed-aliases";
import { operatorReviewMarkdownSummary, operatorReviewTsv } from "./operator-review";
import type { OrganizationResolutionRegistry, OrganizationResolutionSnapshot } from "./types";
import {
  confirmedResolutionCoverageDisclosure,
  organizationMetricsProductEligible,
} from "./eligibility";

export const DEFAULT_PUBLICATION_RELATIVE =
  ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json";
export const DEFAULT_REGISTRY_RELATIVE =
  "src/organization-resolution-2026/fixtures/organization-resolution-registry.json";
export const DEFAULT_OUTPUT_DIR_RELATIVE = ".data/reveal-2026/organization-resolution";

export async function loadPublicationV2(path: string): Promise<Registry2026PublicationV2> {
  return JSON.parse(await readFile(path, "utf8")) as Registry2026PublicationV2;
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
  registryPath?: string;
  outputDir?: string;
  writeArtifacts?: boolean;
}): Promise<{
  snapshot: OrganizationResolutionSnapshot;
  inventory: ReturnType<typeof inventoryFromSnapshot>;
  artifacts?: { snapshotPath: string; reviewTsvPath: string; reviewMdPath: string };
}> {
  const publicationPath = input.publicationPath ?? join(input.workspaceRoot, DEFAULT_PUBLICATION_RELATIVE);
  const registryPath = input.registryPath ?? join(input.workspaceRoot, DEFAULT_REGISTRY_RELATIVE);
  const outputDir = input.outputDir ?? join(input.workspaceRoot, DEFAULT_OUTPUT_DIR_RELATIVE);

  const publication = await loadPublicationV2(publicationPath);
  const registry = await loadResolutionRegistry(registryPath);
  const confirmed2012Aliases = await loadConfirmed2012ApplicantAliases(input.workspaceRoot);

  const snapshot = buildOrganizationResolutionSnapshot({
    publication,
    registry,
    confirmed2012Aliases,
  });

  const inventory = inventoryFromSnapshot(snapshot);
  if (!input.writeArtifacts) {
    return { snapshot, inventory };
  }

  await mkdir(outputDir, { recursive: true });
  const snapshotPath = join(outputDir, "organization-resolution-1.0.0.snapshot.json");
  const reviewTsvPath = join(outputDir, "organization-resolution-steward-review.tsv");
  const reviewMdPath = join(outputDir, "organization-resolution-steward-review.md");
  await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  await writeFile(reviewTsvPath, operatorReviewTsv(snapshot), "utf8");
  await writeFile(reviewMdPath, operatorReviewMarkdownSummary(snapshot), "utf8");
  return { snapshot, inventory, artifacts: { snapshotPath, reviewTsvPath, reviewMdPath } };
}

export function inventoryFromSnapshot(snapshot: OrganizationResolutionSnapshot) {
  const topExact = [...snapshot.applicantIdentityMappings]
    .sort((a, b) => b.applicationIds.length - a.applicationIds.length || a.applicantLegalName.localeCompare(b.applicantLegalName))
    .slice(0, 15)
    .map((m) => ({
      applicantLegalName: m.applicantLegalName,
      applicationCount: m.applicationIds.length,
      resolutionState: m.resolutionState,
    }));

  const coverage = confirmedResolutionCoverageDisclosure(snapshot);
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
    productEligible: organizationMetricsProductEligible(snapshot),
    semanticHash: snapshot.semanticContentSha256,
    applicationPin: snapshot.applicationPublicationPin.applicationGraphContentSha256,
  };
}
