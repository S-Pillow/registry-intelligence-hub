import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  DEFAULT_CONTENTION_ACTUALITY_STATE,
  type ContentionActualityState,
} from "./claim-actuality";

export function parseContentionActualityState(value: unknown): ContentionActualityState {
  if (!value || typeof value !== "object") {
    throw new Error("Unsupported contention actuality state (expected object)");
  }
  const record = value as Record<string, unknown>;
  const actuality = record.round2026ContentionActuality;
  if (actuality !== "NOT_PUBLISHED" && actuality !== "REAL_SOURCE_READY") {
    throw new Error(`Unsupported contention actuality: ${String(actuality)}`);
  }
  return {
    round2026ContentionActuality: actuality,
    snapshotId: typeof record.snapshotId === "string" ? record.snapshotId : null,
    sidecarContentHash: typeof record.sidecarContentHash === "string" ? record.sidecarContentHash : null,
    rawSha256: typeof record.rawSha256 === "string" ? record.rawSha256 : null,
    applicationPublicationPinHash:
      typeof record.applicationPublicationPinHash === "string"
        ? record.applicationPublicationPinHash
        : null,
  };
}

export async function readContentionActualityState(
  statePath: string,
  options?: { allowMissing?: boolean },
): Promise<ContentionActualityState> {
  try {
    const text = await readFile(statePath, "utf8");
    return parseContentionActualityState(JSON.parse(text) as unknown);
  } catch (error) {
    if (options?.allowMissing !== false && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return { ...DEFAULT_CONTENTION_ACTUALITY_STATE };
    }
    throw error;
  }
}

export async function writeContentionActualityState(
  statePath: string,
  state: ContentionActualityState,
): Promise<void> {
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
