import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  DEFAULT_CLAIM_ACTUALITY_STATE,
  type ClaimActualityState,
} from "./claim-actuality";
import { CLAIM_ACTUALITY_STATE_VERSION } from "./types";

export async function readClaimActualityState(
  statePath: string,
  options?: { allowMissing?: boolean },
): Promise<ClaimActualityState> {
  try {
    const text = await readFile(statePath, "utf8");
    const parsed = JSON.parse(text) as ClaimActualityState;
    if (parsed.version !== CLAIM_ACTUALITY_STATE_VERSION) {
      throw new Error(`Unsupported claim actuality state version: ${parsed.version}`);
    }
    return parsed;
  } catch (error) {
    if (options?.allowMissing !== false && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return { ...DEFAULT_CLAIM_ACTUALITY_STATE };
    }
    throw error;
  }
}

export async function writeClaimActualityState(statePath: string, state: ClaimActualityState): Promise<void> {
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
