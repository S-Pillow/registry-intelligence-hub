import { join } from "node:path";
import {
  DEFAULT_CONTENTION_ACTUALITY_STATE,
  type ContentionActualityState,
} from "@/reveal-day-2026/claim-actuality";
import {
  parseContentionActualityState,
  readContentionActualityState,
} from "@/reveal-day-2026/contention-actuality-persistence";

export const DEFAULT_CONTENTION_ACTUALITY_STATE_PATH =
  ".data/reveal-2026/contention-actuality-state.json";

export const CONTENTION_ACTUALITY_STATE_JSON_ENV = "REGISTRY_HUB_CONTENTION_ACTUALITY_STATE_JSON";
export const CONTENTION_ACTUALITY_STATE_PATH_ENV = "REGISTRY_HUB_CONTENTION_ACTUALITY_STATE_PATH";

/** Optional path to official contention membership sidecar for active overlay. */
export const CONTENTION_MEMBERSHIP_PATH_ENV = "REGISTRY_HUB_CONTENTION_MEMBERSHIP_PATH";

export function parseContentionActualityStateJson(text: string): ContentionActualityState {
  return parseContentionActualityState(JSON.parse(text) as unknown);
}

export function loadContentionActualityStateFromEnv(): ContentionActualityState | null {
  const raw = process.env[CONTENTION_ACTUALITY_STATE_JSON_ENV];
  if (!raw?.trim()) return null;
  return parseContentionActualityStateJson(raw);
}

/** Server-only: load contention actuality (env JSON wins over file). Absent → NOT_PUBLISHED. */
export async function loadPromotedContentionActualityState(): Promise<ContentionActualityState> {
  const fromEnv = loadContentionActualityStateFromEnv();
  if (fromEnv) return fromEnv;

  const configuredPath = process.env[CONTENTION_ACTUALITY_STATE_PATH_ENV]?.trim();
  if (configuredPath) {
    const statePath = configuredPath.startsWith("/")
      ? configuredPath
      : join(process.cwd(), configuredPath);
    try {
      return await readContentionActualityState(statePath, { allowMissing: false });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(
          `${CONTENTION_ACTUALITY_STATE_PATH_ENV} is set but the contention actuality state file could not be read`,
        );
      }
      throw error;
    }
  }

  return readContentionActualityState(
    join(process.cwd(), DEFAULT_CONTENTION_ACTUALITY_STATE_PATH),
  );
}

export { DEFAULT_CONTENTION_ACTUALITY_STATE };
