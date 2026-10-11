import { readFile } from "node:fs/promises";
import { parseAndNormalizeApsApplicationCsv } from "@/reveal-day-2026/aps-application-csv";
import { parseAndNormalizeApsContentionCsv } from "@/reveal-day-2026/aps-contention-csv";
import { sha256Hex } from "@/change-intel/hash";
import type { SourceArtifactMeta } from "@/change-intel/types";
import type { ContentionSetV1 } from "@/reveal-day-2026/contention-membership-types";
import type { Registry2026ApplicationV2 } from "@/reveal-day-2026/publication-v2-types";

export const APS_APPLICATION_CSV_URL =
  "https://newgtldprogram-aps.icann.org/aps/applications/export/csv";
export const APS_CONTENTION_CSV_URL =
  "https://newgtldprogram.icann.org/en/application-rounds/round2/reveal-day-contention-sets.csv";

export type AcquiredNormalizedSources = {
  applications: Registry2026ApplicationV2[];
  contentionSets: ContentionSetV1[];
  applicationSource: SourceArtifactMeta;
  contentionSource: SourceArtifactMeta;
  observedDistinctApplicantNames: number;
  officialContentionSets: number;
  officialContentionMemberships: number;
};

async function readBytes(pathOrUrl: string, mode: "file" | "fetch"): Promise<{
  bytes: Uint8Array;
  sourceUrl: string;
  retrievedAt: string;
}> {
  const retrievedAt = new Date().toISOString();
  if (mode === "file") {
    const bytes = new Uint8Array(await readFile(pathOrUrl));
    return { bytes, sourceUrl: pathOrUrl, retrievedAt };
  }
  const response = await fetch(pathOrUrl, {
    headers: { Accept: "text/csv,*/*" },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`SOURCE_FETCH_FAILED ${pathOrUrl} HTTP ${response.status}`);
  }
  const buf = new Uint8Array(await response.arrayBuffer());
  return { bytes: buf, sourceUrl: response.url || pathOrUrl, retrievedAt };
}

export async function acquireNormalizedSources(input: {
  applicationPathOrUrl: string;
  contentionPathOrUrl: string;
  mode: "file" | "fetch";
}): Promise<AcquiredNormalizedSources> {
  let appAcq;
  let contAcq;
  try {
    appAcq = await readBytes(input.applicationPathOrUrl, input.mode);
  } catch (error) {
    throw new Error(
      `APPLICATION_ACQUISITION_FAILED: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    contAcq = await readBytes(input.contentionPathOrUrl, input.mode);
  } catch (error) {
    throw new Error(
      `CONTENTION_ACQUISITION_FAILED: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  let appParsed;
  let contParsed;
  try {
    appParsed = parseAndNormalizeApsApplicationCsv(appAcq.bytes);
  } catch (error) {
    throw new Error(
      `APPLICATION_VALIDATION_FAILED: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    contParsed = parseAndNormalizeApsContentionCsv(contAcq.bytes);
  } catch (error) {
    throw new Error(
      `CONTENTION_VALIDATION_FAILED: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const appHash = sha256Hex(appAcq.bytes);
  const contHash = sha256Hex(contAcq.bytes);
  const membershipCount = contParsed.contentionSets.reduce((n, s) => n + s.members.length, 0);

  return {
    applications: appParsed.applications,
    contentionSets: contParsed.contentionSets,
    observedDistinctApplicantNames: appParsed.observedDistinctApplicantNames,
    officialContentionSets: contParsed.contentionSets.length,
    officialContentionMemberships: membershipCount,
    applicationSource: {
      sourceUrl: appAcq.sourceUrl,
      contentSha256: appHash,
      retrievedAt: appAcq.retrievedAt,
      recordCount: appParsed.applications.length,
      semanticHash: appHash,
    },
    contentionSource: {
      sourceUrl: contAcq.sourceUrl,
      contentSha256: contHash,
      retrievedAt: contAcq.retrievedAt,
      recordCount: membershipCount,
      semanticHash: contHash,
    },
  };
}
