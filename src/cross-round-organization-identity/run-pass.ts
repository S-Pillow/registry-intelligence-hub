import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfirmed2012ApplicantAliases } from "@/organization-resolution-2026/load-2012-confirmed-aliases";
import { runFirstPassOrganizationResolution } from "@/organization-resolution-2026/run-first-pass";
import { buildCrossRoundOrganizationIdentitySnapshot } from "./build-snapshot";
import { DEFAULT_OUTPUT_DIR_RELATIVE } from "./constants";
import { discoverCrossRoundCandidates } from "./discover-candidates";
import {
  crossRoundPortfolioConcentrationEligible,
  expandedContractedProductEligible,
  returningNewProductEligible,
} from "./eligibility";
import { RESEARCH_PACKAGE_CROSS_ROUND_1 } from "./fixtures/research-package-cross-round-1";
import { loadConfirmed2012OrganizationUniverse } from "./load-2012-confirmed";
import {
  crossRoundOperatorReviewMarkdown,
  crossRoundOperatorReviewTsv,
  inventoryFromCrossRoundSnapshot,
} from "./operator-review";
import type { CrossRoundOrganizationIdentitySnapshot, CrossRoundResearchPackage } from "./types";

export async function runCrossRoundOrganizationIdentityPass(input: {
  workspaceRoot: string;
  writeArtifacts?: boolean;
  outputDir?: string;
  researchPackage?: CrossRoundResearchPackage;
}): Promise<{
  snapshot: CrossRoundOrganizationIdentitySnapshot;
  inventory: ReturnType<typeof inventoryFromCrossRoundSnapshot>;
  discoveryCount: number;
  artifacts?: {
    snapshotPath: string;
    reviewTsvPath: string;
    reviewMdPath: string;
  };
}> {
  const universe2012 = await loadConfirmed2012OrganizationUniverse(input.workspaceRoot);
  const { snapshot: snapshot2026 } = await runFirstPassOrganizationResolution({
    workspaceRoot: input.workspaceRoot,
    writeArtifacts: false,
    applyResearch: true,
    applyStewardApprovals: true,
  });

  const aliases = await loadConfirmed2012ApplicantAliases(input.workspaceRoot);
  const discovery = discoverCrossRoundCandidates({
    confirmed2026: snapshot2026.organizations.filter((o) => o.status === "CONFIRMED"),
    confirmed2012: universe2012.organizations,
    confirmed2012ApplicantAliases: aliases,
  });

  const snapshot = buildCrossRoundOrganizationIdentitySnapshot({
    universe2012,
    snapshot2026,
    research: input.researchPackage ?? RESEARCH_PACKAGE_CROSS_ROUND_1,
  });

  // Sanity: product gates remain blocked
  if (returningNewProductEligible(snapshot)) {
    throw new Error("returning/new must remain ineligible before steward approval");
  }
  if (expandedContractedProductEligible(snapshot)) {
    throw new Error("expanded/contracted must remain ineligible before steward approval");
  }
  if (crossRoundPortfolioConcentrationEligible(snapshot)) {
    throw new Error("cross-round portfolio concentration must remain ineligible");
  }

  const inventory = inventoryFromCrossRoundSnapshot(snapshot);
  let artifacts: { snapshotPath: string; reviewTsvPath: string; reviewMdPath: string } | undefined;

  if (input.writeArtifacts) {
    const outputDir = input.outputDir ?? join(input.workspaceRoot, DEFAULT_OUTPUT_DIR_RELATIVE);
    await mkdir(outputDir, { recursive: true });
    const snapshotPath = join(outputDir, "cross-round-organization-identity-1.0.0.snapshot.json");
    const reviewTsvPath = join(outputDir, "cross-round-organization-identity-steward-review.tsv");
    const reviewMdPath = join(outputDir, "cross-round-organization-identity-steward-review.md");
    await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
    await writeFile(reviewTsvPath, crossRoundOperatorReviewTsv(snapshot), "utf8");
    await writeFile(reviewMdPath, crossRoundOperatorReviewMarkdown(snapshot), "utf8");
    artifacts = { snapshotPath, reviewTsvPath, reviewMdPath };
  }

  return { snapshot, inventory, discoveryCount: discovery.length, artifacts };
}
