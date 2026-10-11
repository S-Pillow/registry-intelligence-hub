import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  changeIntelDiffPath,
  changeIntelDiffsDir,
  changeIntelIndexPath,
  changeIntelLatestFeedPath,
  changeIntelObservationPath,
  changeIntelObservationsDir,
  changeIntelRoot,
} from "@/change-intel/paths";
import {
  CHANGE_INTEL_FEED_VERSION,
  CHANGE_INTEL_STATE_VERSION,
  type ChangeIntelDiff,
  type ChangeIntelFeed,
  type ChangeIntelFeedState,
  type ChangeIntelIndex,
  type ChangeIntelObservation,
} from "@/change-intel/types";

const RECENT_MEANINGFUL_LIMIT = 20;

async function writeAtomicJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = join(dirname(path), `.${path.split("/").pop()}.tmp-${process.pid}-${Date.now()}`);
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, path);
}

export async function ensureChangeIntelDirs(cwd = process.cwd()): Promise<void> {
  await mkdir(changeIntelObservationsDir(cwd), { recursive: true });
  await mkdir(changeIntelDiffsDir(cwd), { recursive: true });
}

export async function readIndex(cwd = process.cwd()): Promise<ChangeIntelIndex | null> {
  try {
    const raw = JSON.parse(await readFile(changeIntelIndexPath(cwd), "utf8")) as ChangeIntelIndex;
    if (raw.version !== CHANGE_INTEL_STATE_VERSION) return null;
    return raw;
  } catch {
    return null;
  }
}

export async function readObservation(
  observationId: string,
  cwd = process.cwd(),
): Promise<ChangeIntelObservation | null> {
  try {
    return JSON.parse(await readFile(changeIntelObservationPath(observationId, cwd), "utf8")) as ChangeIntelObservation;
  } catch {
    return null;
  }
}

export async function readDiff(diffId: string, cwd = process.cwd()): Promise<ChangeIntelDiff | null> {
  try {
    return JSON.parse(await readFile(changeIntelDiffPath(diffId, cwd), "utf8")) as ChangeIntelDiff;
  } catch {
    return null;
  }
}

export async function readLatestFeed(cwd = process.cwd()): Promise<ChangeIntelFeedState> {
  try {
    const feed = JSON.parse(await readFile(changeIntelLatestFeedPath(cwd), "utf8")) as ChangeIntelFeed;
    if (feed.version !== CHANGE_INTEL_FEED_VERSION || !feed.initialized) {
      return { initialized: false };
    }
    return feed;
  } catch {
    return { initialized: false };
  }
}

export function buildFeedFromState(input: {
  index: ChangeIntelIndex;
  current: ChangeIntelObservation | null;
  latestDiff: ChangeIntelDiff | null;
  recentMeaningfulDiffs: ChangeIntelDiff[];
}): ChangeIntelFeed {
  return {
    version: CHANGE_INTEL_FEED_VERSION,
    initialized: true,
    lastCheckedAt: input.index.lastCheckedAt,
    lastMeaningfulChangeAt: input.index.lastMeaningfulChangeAt,
    currentObservationId: input.index.currentObservationId,
    previousObservationId: input.index.previousObservationId,
    comparedWithObservedAt: input.latestDiff?.previousObservedAt ?? null,
    latestDiff: input.latestDiff,
    recentMeaningfulDiffs: input.recentMeaningfulDiffs,
    applicationSource: input.current?.applicationSource ?? null,
    contentionSource: input.current?.contentionSource ?? null,
  };
}

export async function persistBootstrap(input: {
  observation: ChangeIntelObservation;
  cwd?: string;
}): Promise<{ index: ChangeIntelIndex; feed: ChangeIntelFeed }> {
  const cwd = input.cwd ?? process.cwd();
  await ensureChangeIntelDirs(cwd);
  const existing = await readIndex(cwd);
  if (existing?.currentObservationId) {
    throw new Error("CHANGE_INTEL_ALREADY_INITIALIZED");
  }
  await writeAtomicJson(changeIntelObservationPath(input.observation.observationId, cwd), input.observation);
  const index: ChangeIntelIndex = {
    version: CHANGE_INTEL_STATE_VERSION,
    initializedAt: input.observation.observedAt,
    lastCheckedAt: input.observation.observedAt,
    lastMeaningfulChangeAt: null,
    currentObservationId: input.observation.observationId,
    previousObservationId: null,
    latestDiffId: null,
    latestMeaningfulDiffId: null,
    observationIds: [input.observation.observationId],
    diffIds: [],
  };
  const feed = buildFeedFromState({
    index,
    current: input.observation,
    latestDiff: null,
    recentMeaningfulDiffs: [],
  });
  await writeAtomicJson(changeIntelIndexPath(cwd), index);
  await writeAtomicJson(changeIntelLatestFeedPath(cwd), feed);
  return { index, feed };
}

export async function persistRefresh(input: {
  observation: ChangeIntelObservation;
  diff: ChangeIntelDiff;
  cwd?: string;
}): Promise<{ index: ChangeIntelIndex; feed: ChangeIntelFeed }> {
  const cwd = input.cwd ?? process.cwd();
  await ensureChangeIntelDirs(cwd);
  const existing = await readIndex(cwd);
  if (!existing?.currentObservationId) {
    throw new Error("CHANGE_INTEL_NOT_INITIALIZED");
  }

  await writeAtomicJson(changeIntelObservationPath(input.observation.observationId, cwd), input.observation);
  await writeAtomicJson(changeIntelDiffPath(input.diff.diffId, cwd), input.diff);

  const meaningful = !input.diff.semanticUnchanged && input.diff.changes.length > 0;
  const observationIds = [...existing.observationIds, input.observation.observationId];
  const diffIds = [...existing.diffIds, input.diff.diffId];
  const index: ChangeIntelIndex = {
    ...existing,
    lastCheckedAt: input.observation.observedAt,
    lastMeaningfulChangeAt: meaningful
      ? input.observation.observedAt
      : existing.lastMeaningfulChangeAt,
    previousObservationId: existing.currentObservationId,
    currentObservationId: input.observation.observationId,
    latestDiffId: input.diff.diffId,
    latestMeaningfulDiffId: meaningful ? input.diff.diffId : existing.latestMeaningfulDiffId,
    observationIds,
    diffIds,
  };

  const recentMeaningful: ChangeIntelDiff[] = [];
  for (const id of [...diffIds].reverse()) {
    if (recentMeaningful.length >= RECENT_MEANINGFUL_LIMIT) break;
    const d = await readDiff(id, cwd);
    if (d && !d.semanticUnchanged && d.changes.length > 0) recentMeaningful.push(d);
  }

  const feed = buildFeedFromState({
    index,
    current: input.observation,
    latestDiff: input.diff,
    recentMeaningfulDiffs: recentMeaningful,
  });
  await writeAtomicJson(changeIntelIndexPath(cwd), index);
  await writeAtomicJson(changeIntelLatestFeedPath(cwd), feed);
  return { index, feed };
}

/** Test helper — remove entire change-intel root. */
export async function resetChangeIntelRoot(cwd = process.cwd()): Promise<void> {
  await rm(changeIntelRoot(cwd), { recursive: true, force: true });
}
