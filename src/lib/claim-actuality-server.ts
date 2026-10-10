import { join } from "node:path";
import type { ClaimActualityState } from "@/reveal-day-2026/claim-actuality";
import { readClaimActualityState } from "@/reveal-day-2026/claim-actuality-persistence";
import { CLAIM_ACTUALITY_STATE_VERSION } from "@/reveal-day-2026/types";

export const DEFAULT_CLAIM_ACTUALITY_STATE_PATH = ".data/reveal-2026/claim-actuality-state.json";

/**
 * Production may inject promoted state without a host file (e.g. platform secret → env at deploy).
 * Must be a full `claim-actuality-state/1.0.0` JSON document matching promote-actuality output.
 */
export const CLAIM_ACTUALITY_STATE_JSON_ENV = "REGISTRY_HUB_CLAIM_ACTUALITY_STATE_JSON";

/** Override path to on-disk state (default: repo-relative `.data/reveal-2026/claim-actuality-state.json`). */
export const CLAIM_ACTUALITY_STATE_PATH_ENV = "REGISTRY_HUB_CLAIM_ACTUALITY_STATE_PATH";

export function parseClaimActualityStateJson(text: string): ClaimActualityState {
  const parsed = JSON.parse(text) as ClaimActualityState;
  if (parsed.version !== CLAIM_ACTUALITY_STATE_VERSION) {
    throw new Error(`Unsupported claim actuality state version: ${parsed.version}`);
  }
  return parsed;
}

export function loadClaimActualityStateFromEnv(): ClaimActualityState | null {
  const raw = process.env[CLAIM_ACTUALITY_STATE_JSON_ENV];
  if (!raw?.trim()) return null;
  return parseClaimActualityStateJson(raw);
}

/** Server-only: load promoted claim actuality for this deployment (env JSON wins over file). */
export async function loadPromotedClaimActualityState(): Promise<ClaimActualityState> {
  const fromEnv = loadClaimActualityStateFromEnv();
  if (fromEnv) return fromEnv;

  const configuredPath = process.env[CLAIM_ACTUALITY_STATE_PATH_ENV]?.trim();
  if (configuredPath) {
    const statePath = configuredPath.startsWith("/")
      ? configuredPath
      : join(process.cwd(), configuredPath);
    try {
      return await readClaimActualityState(statePath, { allowMissing: false });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(
          `${CLAIM_ACTUALITY_STATE_PATH_ENV} is set but the claim actuality state file could not be read`,
        );
      }
      throw error;
    }
  }

  return readClaimActualityState(join(process.cwd(), DEFAULT_CLAIM_ACTUALITY_STATE_PATH));
}
