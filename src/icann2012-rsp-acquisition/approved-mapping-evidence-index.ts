import { readFile, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { sha256Hex } from "@/normalization/hashes";
import {
  stagingIndexPageFetchMetadataPath,
  stagingIndexPageHtmlPath,
} from "./bundle-paths";
import { readMappingLiveCheckpoint } from "./mapping-checkpoint";
import type { EvidenceSnapshotIndex } from "./artifact-eligibility";
import type { RawSnapshotRecord } from "./types";

export class ApprovedMappingEvidenceIndexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovedMappingEvidenceIndexError";
  }
}

/**
 * Build the evidence index from a mapping-live run directory.
 * Each checkpoint page must have HTML and fetch metadata whose SHA-256 matches
 * the checkpoint. Snapshot ids are not copied from raw-snapshots.json.
 */
export async function loadApprovedMappingRunEvidenceIndex(
  runPath: string,
): Promise<EvidenceSnapshotIndex> {
  const resolvedPath = resolve(runPath);
  const name = basename(resolvedPath);
  if (name === "raw-snapshots.json") {
    throw new ApprovedMappingEvidenceIndexError(
      "raw-snapshots.json is not an approved mapping evidence index. Pass the mapping-live run directory.",
    );
  }

  let info;
  try {
    info = await stat(resolvedPath);
  } catch {
    throw new ApprovedMappingEvidenceIndexError(
      `Approved mapping evidence index path is missing: ${resolvedPath}`,
    );
  }
  if (!info.isDirectory()) {
    throw new ApprovedMappingEvidenceIndexError(
      `Approved mapping evidence index must be a mapping-live run directory: ${resolvedPath}`,
    );
  }

  const checkpoint = await readMappingLiveCheckpoint(`${resolvedPath}/mapping-live-checkpoint.json`);
  if (!checkpoint) {
    throw new ApprovedMappingEvidenceIndexError(
      `mapping-live-checkpoint.json not found under ${resolvedPath}. Fixture raw-snapshots.json is not used.`,
    );
  }
  if (!checkpoint.runId?.trim() || checkpoint.pages.length === 0) {
    throw new ApprovedMappingEvidenceIndexError(
      "mapping run checkpoint has no page evidence to verify",
    );
  }

  const byId = new Map<string, RawSnapshotRecord>();
  for (const page of checkpoint.pages) {
    if (!page.snapshotId?.trim() || !page.contentSha256?.trim()) {
      throw new ApprovedMappingEvidenceIndexError(
        `mapping run page ${page.pageOrdinal} is missing snapshot id or content hash`,
      );
    }
    const htmlPath = stagingIndexPageHtmlPath(resolvedPath, checkpoint.runId, page.pageOrdinal);
    let html: Buffer;
    try {
      html = await readFile(htmlPath);
    } catch {
      throw new ApprovedMappingEvidenceIndexError(
        `Cannot verify evidence snapshot ${page.snapshotId}: missing page HTML ${htmlPath}`,
      );
    }
    const htmlSha = sha256Hex(html);
    if (htmlSha !== page.contentSha256) {
      throw new ApprovedMappingEvidenceIndexError(
        `Cannot verify evidence snapshot ${page.snapshotId}: HTML SHA-256 mismatch`,
      );
    }

    const metaPath = stagingIndexPageFetchMetadataPath(
      resolvedPath,
      checkpoint.runId,
      page.pageOrdinal,
    );
    let metaText: string;
    try {
      metaText = await readFile(metaPath, "utf8");
    } catch {
      throw new ApprovedMappingEvidenceIndexError(
        `Cannot verify evidence snapshot ${page.snapshotId}: missing fetch metadata ${metaPath}`,
      );
    }
    let meta: { contentSha256?: string };
    try {
      meta = JSON.parse(metaText) as { contentSha256?: string };
    } catch {
      throw new ApprovedMappingEvidenceIndexError(
        `Cannot verify evidence snapshot ${page.snapshotId}: fetch metadata is not JSON`,
      );
    }
    if (meta.contentSha256 !== page.contentSha256) {
      throw new ApprovedMappingEvidenceIndexError(
        `Cannot verify evidence snapshot ${page.snapshotId}: fetch metadata SHA-256 mismatch`,
      );
    }
    if (byId.has(page.snapshotId)) {
      throw new ApprovedMappingEvidenceIndexError(
        `Duplicate evidence snapshot id ${page.snapshotId} in mapping run ${checkpoint.runId}`,
      );
    }

    const requestedUrl = page.resolvedUrl?.trim() ?? "";
    if (!requestedUrl) {
      throw new ApprovedMappingEvidenceIndexError(
        `Cannot verify evidence snapshot ${page.snapshotId}: checkpoint page has no resolvedUrl`,
      );
    }

    byId.set(page.snapshotId, {
      snapshotId: page.snapshotId,
      sourceId: `mapping-live:${checkpoint.runId}:page-${page.pageOrdinal}`,
      requestedUrl,
      resolvedUrl: page.resolvedUrl,
      provenance: { contentSha256: page.contentSha256 },
    });
  }

  return { byId };
}
