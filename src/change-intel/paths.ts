import { join } from "node:path";

export const CHANGE_INTEL_ROOT_RELATIVE = ".data/change-intel";
export const CHANGE_INTEL_INDEX_NAME = "index.json";
export const CHANGE_INTEL_LATEST_FEED_NAME = "latest-feed.json";
export const CHANGE_INTEL_OBSERVATIONS_DIR = "observations";
export const CHANGE_INTEL_DIFFS_DIR = "diffs";

export function changeIntelRoot(cwd = process.cwd()): string {
  return join(cwd, CHANGE_INTEL_ROOT_RELATIVE);
}

export function changeIntelIndexPath(cwd = process.cwd()): string {
  return join(changeIntelRoot(cwd), CHANGE_INTEL_INDEX_NAME);
}

export function changeIntelLatestFeedPath(cwd = process.cwd()): string {
  return join(changeIntelRoot(cwd), CHANGE_INTEL_LATEST_FEED_NAME);
}

export function changeIntelObservationsDir(cwd = process.cwd()): string {
  return join(changeIntelRoot(cwd), CHANGE_INTEL_OBSERVATIONS_DIR);
}

export function changeIntelDiffsDir(cwd = process.cwd()): string {
  return join(changeIntelRoot(cwd), CHANGE_INTEL_DIFFS_DIR);
}

export function changeIntelObservationPath(observationId: string, cwd = process.cwd()): string {
  return join(changeIntelObservationsDir(cwd), `${observationId}.json`);
}

export function changeIntelDiffPath(diffId: string, cwd = process.cwd()): string {
  return join(changeIntelDiffsDir(cwd), `${diffId}.json`);
}
