import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { sha256Hex } from "@/normalization/hashes";
import type { MappingLiveCheckpoint } from "./types";

export function mappingLiveCheckpointPath(stagingRoot: string): string {
  return `${stagingRoot.replace(/\/$/, "")}/mapping-live-checkpoint.json`;
}

export async function readMappingLiveCheckpoint(
  path: string,
): Promise<MappingLiveCheckpoint | null> {
  try {
    const text = await readFile(path, "utf8");
    return JSON.parse(text) as MappingLiveCheckpoint;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw err;
  }
}

export async function writeMappingLiveCheckpoint(
  path: string,
  checkpoint: MappingLiveCheckpoint,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
}

export function createEmptyMappingLiveCheckpoint(
  runId: string,
  corpusContentHash: string,
): MappingLiveCheckpoint {
  return {
    checkpointVersion: "icann2012-rsp-mapping-live-checkpoint/1.0.0",
    runId,
    corpusContentHash,
    state: "running",
    lastCompletedPageOrdinal: 0,
    pages: [],
    mappings: {},
    applicationPageOrdinal: {},
  };
}

export async function assertResumePageIntegrity(
  htmlPath: string,
  expectedSha256: string,
): Promise<void> {
  const bytes = await readFile(htmlPath);
  const actual = sha256Hex(bytes);
  if (actual !== expectedSha256) {
    throw new Error(
      `Resume hash mismatch for ${htmlPath}: expected ${expectedSha256}, got ${actual}`,
    );
  }
}
