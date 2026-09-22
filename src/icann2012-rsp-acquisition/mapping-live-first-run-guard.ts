import { access, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import {
  stagingIndexRunDir,
  stagingMappingArtifactPath,
} from "./bundle-paths";
import { mappingLiveCheckpointPath, readMappingLiveCheckpoint } from "./mapping-checkpoint";

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function runIdHasAcceptedPageSnapshots(stagingRoot: string, runId: string): Promise<boolean> {
  const runDir = stagingIndexRunDir(stagingRoot, runId);
  if (!(await pathExists(runDir))) {
    return false;
  }
  const entries = await readdir(runDir);
  return entries.some((name) => /^page-\d{4}\.(html|fetch\.json)$/.test(name));
}

export async function assertNormalFirstRunNoCollision(input: {
  stagingRoot: string;
  runId: string;
  resume: boolean;
  forceNewRun: boolean;
}): Promise<void> {
  if (input.resume || input.forceNewRun) {
    return;
  }

  const collisions: string[] = [];

  const checkpoint = await readMappingLiveCheckpoint(mappingLiveCheckpointPath(input.stagingRoot));
  if (checkpoint) {
    collisions.push(
      `active checkpoint (runId=${checkpoint.runId}, state=${checkpoint.state}) at staging root`,
    );
  }

  const runDir = stagingIndexRunDir(input.stagingRoot, input.runId);
  if (await pathExists(runDir)) {
    collisions.push(`evidence directory for run-id ${input.runId}`);
  }

  const mappingPath = stagingMappingArtifactPath(input.stagingRoot, input.runId);
  if (await pathExists(mappingPath)) {
    collisions.push(`mapping artifact for run-id ${input.runId}`);
  }

  if (await runIdHasAcceptedPageSnapshots(input.stagingRoot, input.runId)) {
    collisions.push(`accepted page snapshots for run-id ${input.runId}`);
  }

  if (collisions.length === 0) {
    return;
  }

  throw new Error(
    `Refusing first-run mapping-live: ${collisions.join("; ")}. ` +
      "Use a fresh run-id and staging root, or an explicit --resume / steward --force-new-run recovery path — never silent overwrite.",
  );
}
