import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runCrossRoundOrganizationIdentityPass } from "@/cross-round-organization-identity/run-pass";
import { buildParticipationIntelligenceSnapshot } from "./build-snapshot";
import { DEFAULT_OUTPUT_DIR_RELATIVE } from "./constants";
import {
  completeReturningMetricEligible,
  confirmedPortfolioChangeSubsetReady,
  confirmedReturningSubsetReady,
  newOrganizationMetricEligible,
} from "./eligibility";
import {
  inventoryFromParticipationSnapshot,
  participationOperatorReviewMarkdown,
  participationOperatorReviewTsv,
} from "./operator-review";
import type { CrossRoundParticipationIntelligenceSnapshot } from "./types";

export async function runParticipationIntelligencePass(input: {
  workspaceRoot: string;
  writeArtifacts?: boolean;
  outputDir?: string;
}): Promise<{
  snapshot: CrossRoundParticipationIntelligenceSnapshot;
  inventory: ReturnType<typeof inventoryFromParticipationSnapshot>;
  artifacts?: {
    snapshotPath: string;
    reviewTsvPath: string;
    reviewMdPath: string;
  };
}> {
  const { snapshot: crossRoundSnapshot } = await runCrossRoundOrganizationIdentityPass({
    workspaceRoot: input.workspaceRoot,
    writeArtifacts: false,
    applyStewardApprovals: true,
  });

  const snapshot = buildParticipationIntelligenceSnapshot({ crossRoundSnapshot });

  if (!confirmedReturningSubsetReady(snapshot)) {
    throw new Error("expected confirmed-returning subset readiness");
  }
  if (!confirmedPortfolioChangeSubsetReady(snapshot)) {
    throw new Error("expected confirmed portfolio-change subset readiness");
  }
  if (completeReturningMetricEligible(snapshot)) {
    throw new Error("complete returning metric must remain ineligible");
  }
  if (newOrganizationMetricEligible(snapshot)) {
    throw new Error("new Organization metric must remain blocked");
  }
  if (snapshot.summary.newOrganizationMetric.numericCount !== null) {
    throw new Error("new Organization numeric count must be absent");
  }

  const inventory = inventoryFromParticipationSnapshot(snapshot);
  let artifacts: { snapshotPath: string; reviewTsvPath: string; reviewMdPath: string } | undefined;

  if (input.writeArtifacts) {
    const outputDir = input.outputDir ?? join(input.workspaceRoot, DEFAULT_OUTPUT_DIR_RELATIVE);
    await mkdir(outputDir, { recursive: true });
    const snapshotPath = join(outputDir, "cross-round-participation-intelligence-1.0.0.snapshot.json");
    const reviewTsvPath = join(outputDir, "cross-round-participation-intelligence-review.tsv");
    const reviewMdPath = join(outputDir, "cross-round-participation-intelligence-review.md");
    await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
    await writeFile(reviewTsvPath, participationOperatorReviewTsv(snapshot), "utf8");
    await writeFile(reviewMdPath, participationOperatorReviewMarkdown(snapshot), "utf8");
    artifacts = { snapshotPath, reviewTsvPath, reviewMdPath };
  }

  return { snapshot, inventory, artifacts };
}
