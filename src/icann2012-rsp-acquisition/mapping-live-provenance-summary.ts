import { readFile } from "node:fs/promises";
import { sha256Hex } from "@/normalization/hashes";
import type { MappingReviewReport } from "./mapping-review";
import type { MappingLiveResult } from "./types";
import type { EvidenceBundleManifest } from "./evidence-bundle-manifest";

export interface MappingLiveProvenanceSummary {
  commitSha?: string;
  runId: string;
  corpusContentHash: string;
  corpusApplicationCount: number;
  stagingEvidencePath: string;
  pagesCaptured: number;
  mappingsDiscovered: number;
  roundWideExact: boolean;
  pilotResolvedCount?: number;
  pilotOnlyExactCandidate?: boolean;
  stopReason?: string;
  failureClassification?: string;
  mappingArtifactSha256?: string;
  mappingReviewReportSha256?: string;
  evidenceBundleManifestSha256?: string;
}

export async function sha256File(path: string): Promise<string> {
  return sha256Hex(await readFile(path));
}

export function buildMappingLiveProvenanceSummary(input: {
  commitSha?: string;
  liveResult: MappingLiveResult;
  reviewReport?: MappingReviewReport;
  mappingArtifactSha256?: string;
  mappingReviewReportSha256?: string;
  evidenceBundle?: EvidenceBundleManifest;
}): MappingLiveProvenanceSummary {
  return {
    commitSha: input.commitSha,
    runId: input.liveResult.runId,
    corpusContentHash: input.reviewReport?.corpusContentHash ?? "",
    corpusApplicationCount: input.liveResult.reconciliation.expectedCount,
    stagingEvidencePath: input.liveResult.stagingRoot,
    pagesCaptured: input.liveResult.pagesFetched,
    mappingsDiscovered: input.liveResult.reconciliation.mappedCount,
    roundWideExact: input.liveResult.exact,
    pilotResolvedCount: input.reviewReport?.pilotResolvedCount,
    pilotOnlyExactCandidate: input.reviewReport?.pilotOnlyExactCandidate,
    stopReason: input.liveResult.stopReason,
    failureClassification: input.reviewReport?.failureClassification,
    mappingArtifactSha256: input.mappingArtifactSha256,
    mappingReviewReportSha256: input.mappingReviewReportSha256,
    evidenceBundleManifestSha256: input.evidenceBundle?.manifestSha256,
  };
}

export function formatMappingLiveProvenanceSummary(summary: MappingLiveProvenanceSummary): string {
  const lines = [
    "icann2012-rsp mapping-live provenance (safe summary — no HTML/cookies/tokens)",
    `commitSha: ${summary.commitSha ?? "(unknown)"}`,
    `runId: ${summary.runId}`,
    `corpusContentHash: ${summary.corpusContentHash}`,
    `corpusApplicationCount: ${summary.corpusApplicationCount}`,
    `stagingEvidencePath: ${summary.stagingEvidencePath}`,
    `pagesCaptured: ${summary.pagesCaptured}`,
    `mappingsDiscovered: ${summary.mappingsDiscovered}`,
    `roundWideExact: ${summary.roundWideExact}`,
  ];
  if (summary.pilotResolvedCount != null) {
    lines.push(`pilotResolvedCount: ${summary.pilotResolvedCount}`);
  }
  if (summary.pilotOnlyExactCandidate != null) {
    lines.push(`pilotOnlyExactCandidate: ${summary.pilotOnlyExactCandidate}`);
  }
  if (summary.stopReason) lines.push(`stopReason: ${summary.stopReason}`);
  if (summary.failureClassification) {
    lines.push(`failureClassification: ${summary.failureClassification}`);
  }
  if (summary.mappingArtifactSha256) {
    lines.push(`mappingArtifactSha256: ${summary.mappingArtifactSha256}`);
  }
  if (summary.mappingReviewReportSha256) {
    lines.push(`mappingReviewReportSha256: ${summary.mappingReviewReportSha256}`);
  }
  if (summary.evidenceBundleManifestSha256) {
    lines.push(`evidenceBundleManifestSha256: ${summary.evidenceBundleManifestSha256}`);
  }
  return lines.join("\n");
}
