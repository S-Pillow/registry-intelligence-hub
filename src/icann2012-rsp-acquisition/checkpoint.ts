import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { AcquisitionCheckpoint, AcquisitionCheckpointEntry } from "./types";

export function createEmptyCheckpoint(batchId: string): AcquisitionCheckpoint {
  return {
    checkpointVersion: "icann2012-rsp-acquisition-checkpoint/1.0.0",
    batchId,
    lastCompletedApplicationId: null,
    completed: [],
  };
}

export async function readCheckpoint(path: string): Promise<AcquisitionCheckpoint | null> {
  try {
    const text = await readFile(path, "utf8");
    return JSON.parse(text) as AcquisitionCheckpoint;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw err;
  }
}

export async function writeCheckpoint(path: string, checkpoint: AcquisitionCheckpoint): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
}

export function isIdempotentSkip(
  checkpoint: AcquisitionCheckpoint | null,
  applicationId: string,
  contentSha256: string,
): boolean {
  if (!checkpoint) return false;
  const entry = checkpoint.completed.find((e) => e.applicationId === applicationId);
  return entry?.contentSha256 === contentSha256;
}

export function appendCheckpointEntry(
  checkpoint: AcquisitionCheckpoint,
  entry: AcquisitionCheckpointEntry,
): AcquisitionCheckpoint {
  const without = checkpoint.completed.filter((e) => e.applicationId !== entry.applicationId);
  return {
    ...checkpoint,
    lastCompletedApplicationId: entry.applicationId,
    completed: [...without, entry],
  };
}
