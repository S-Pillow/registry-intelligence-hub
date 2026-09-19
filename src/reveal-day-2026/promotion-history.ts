import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PROMOTION_HISTORY_ENTRY_VERSION } from "./types";

export const DEFAULT_PROMOTION_HISTORY_PATH = "./.data/reveal-2026/promotion-history.jsonl";

export type PromotionHistoryEntry = {
  entryVersion: typeof PROMOTION_HISTORY_ENTRY_VERSION;
  event: "promoted" | "superseded";
  recordedAt: string;
  snapshotId: string;
  snapshotContentHash: string;
  rawSha256: string;
  stewardApprovalId: string;
  productApprovalId: string;
  /** Snapshot that was active before this promotion (supersession). */
  supersedesSnapshotId: string | null;
  /** Set on superseded events — the newer snapshot that replaced this one. */
  supersededBySnapshotId: string | null;
};

export async function readPromotionHistory(historyPath: string): Promise<PromotionHistoryEntry[]> {
  try {
    const text = await readFile(historyPath, "utf8");
    return text
      .split(/\n/)
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as PromotionHistoryEntry);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function appendPromotionHistoryEntry(
  historyPath: string,
  entry: PromotionHistoryEntry,
): Promise<void> {
  await mkdir(dirname(historyPath), { recursive: true });
  await appendFile(historyPath, `${JSON.stringify(entry)}\n`, "utf8");
}

export type RecordPromotionParams = {
  historyPath: string;
  snapshotId: string;
  snapshotContentHash: string;
  rawSha256: string;
  stewardApprovalId: string;
  productApprovalId: string;
  previousSnapshotId: string | null;
};

/**
 * Append-only promotion record. When replacing an active snapshot, writes a
 * superseded entry for the prior snapshot before the new promoted entry.
 */
export async function recordActualityPromotion(params: RecordPromotionParams): Promise<PromotionHistoryEntry[]> {
  const written: PromotionHistoryEntry[] = [];
  const now = new Date().toISOString();

  if (params.previousSnapshotId && params.previousSnapshotId !== params.snapshotId) {
    const superseded: PromotionHistoryEntry = {
      entryVersion: PROMOTION_HISTORY_ENTRY_VERSION,
      event: "superseded",
      recordedAt: now,
      snapshotId: params.previousSnapshotId,
      snapshotContentHash: "",
      rawSha256: "",
      stewardApprovalId: params.stewardApprovalId,
      productApprovalId: params.productApprovalId,
      supersedesSnapshotId: null,
      supersededBySnapshotId: params.snapshotId,
    };
    await appendPromotionHistoryEntry(params.historyPath, superseded);
    written.push(superseded);
  }

  const promoted: PromotionHistoryEntry = {
    entryVersion: PROMOTION_HISTORY_ENTRY_VERSION,
    event: "promoted",
    recordedAt: now,
    snapshotId: params.snapshotId,
    snapshotContentHash: params.snapshotContentHash,
    rawSha256: params.rawSha256,
    stewardApprovalId: params.stewardApprovalId,
    productApprovalId: params.productApprovalId,
    supersedesSnapshotId: params.previousSnapshotId,
    supersededBySnapshotId: null,
  };
  await appendPromotionHistoryEntry(params.historyPath, promoted);
  written.push(promoted);
  return written;
}

export function activePromotionAt(
  history: PromotionHistoryEntry[],
  asOfIso: string,
): PromotionHistoryEntry | null {
  const asOf = Date.parse(asOfIso);
  const promoted = history
    .filter((e) => e.event === "promoted" && Date.parse(e.recordedAt) <= asOf)
    .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
  const latest = promoted[0];
  if (!latest) return null;
  const superseded = history.some(
    (e) =>
      e.event === "superseded"
      && e.snapshotId === latest.snapshotId
      && Date.parse(e.recordedAt) > Date.parse(latest.recordedAt)
      && Date.parse(e.recordedAt) <= asOf,
  );
  return superseded ? null : latest;
}
