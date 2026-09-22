import { mkdir, writeFile } from "node:fs/promises";
import { sha256Hex } from "@/normalization/hashes";
import { APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH } from "@/historical-2012/approved-corpus-hash";
import { stagingMappingReviewReportPath } from "./bundle-paths";
import {
  buildEvidenceBundleManifest,
  writeEvidenceBundleManifest,
} from "./evidence-bundle-manifest";
import type { MappingLiveResult } from "./types";
import { formatMappingReviewReport, runMappingReview } from "./mapping-review";
import {
  buildMappingLiveProvenanceSummary,
  formatMappingLiveProvenanceSummary,
  sha256File,
} from "./mapping-live-provenance-summary";
import { resolveOperatorCommitSha } from "./operator-git-provenance";

export interface MappingLiveOperatorFlowResult {
  reviewReportPath: string;
  mappingReviewReportSha256: string;
  mappingArtifactSha256: string;
  evidenceBundleManifestPath: string;
  provenanceSummaryText: string;
}

/** Offline post-run steps shared by operator rehearsal tests (zero HTTP after mapping-live). */
export async function completeMappingLiveOperatorFlow(input: {
  workspaceRoot: string;
  liveResult: MappingLiveResult;
}): Promise<MappingLiveOperatorFlowResult> {
  const reviewReport = await runMappingReview({
    workspaceRoot: input.workspaceRoot,
    runDir: input.liveResult.stagingRoot,
  });

  const reviewReportPath = stagingMappingReviewReportPath(
    input.liveResult.stagingRoot,
    input.liveResult.runId,
  );
  await mkdir(reviewReportPath.replace(/mapping-review-report\.json$/, ""), { recursive: true });
  const reviewJson = formatMappingReviewReport(reviewReport);
  await writeFile(reviewReportPath, `${reviewJson}\n`);
  const mappingReviewReportSha256 = sha256Hex(Buffer.from(reviewJson, "utf8"));

  const mappingArtifactSha256 = await sha256File(input.liveResult.mappingArtifactPath);
  const commitSha = await resolveOperatorCommitSha(input.workspaceRoot);

  const evidenceBundle = await buildEvidenceBundleManifest({
    stagingRoot: input.liveResult.stagingRoot,
    runId: input.liveResult.runId,
    corpusContentHash: APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH,
    commitSha,
  });
  const evidenceBundleManifestPath = await writeEvidenceBundleManifest(evidenceBundle);

  const provenanceSummaryText = formatMappingLiveProvenanceSummary(
    buildMappingLiveProvenanceSummary({
      commitSha,
      liveResult: input.liveResult,
      reviewReport,
      mappingArtifactSha256,
      mappingReviewReportSha256,
      evidenceBundle,
    }),
  );

  return {
    reviewReportPath,
    mappingReviewReportSha256,
    mappingArtifactSha256,
    evidenceBundleManifestPath,
    provenanceSummaryText,
  };
}
