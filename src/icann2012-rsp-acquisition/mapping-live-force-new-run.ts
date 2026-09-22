import { rename } from "node:fs/promises";
import { mappingLiveCheckpointPath } from "./mapping-checkpoint";
import type { ForceNewRunDisposition, MappingLiveCheckpoint } from "./types";

export type { ForceNewRunDisposition };

export const FORCE_NEW_RUN_PLAN_SEMANTICS =
  "With --force-new-run (and without --resume): archives mapping-live-checkpoint.json to a timestamped .archived file, starts a fresh checkpoint for --run-id, leaves prior sources/index/<runId>/ and mapping artifacts on disk for steward review. Does not bypass the one-run rule — each authorized HTTP crawl still requires explicit steward review before a subsequent live attempt. Mutually exclusive with --resume. Performs no HTTP." as const;

export function validateForceNewRunFlags(input: {
  resume: boolean;
  forceNewRun: boolean;
}): void {
  if (input.resume && input.forceNewRun) {
    throw new Error(
      "Refusing mapping-live: --resume and --force-new-run are mutually exclusive (resume continues prior checkpoint; force-new-run archives it and starts fresh)",
    );
  }
}

export function buildForceNewRunOperatorWarnings(input: {
  priorCheckpoint: MappingLiveCheckpoint | null;
  forceNewRun: boolean;
}): string[] {
  if (!input.forceNewRun || !input.priorCheckpoint) return [];
  const warnings = [
    `--force-new-run will archive checkpoint for prior runId=${input.priorCheckpoint.runId} and start a new live attempt`,
    "Prior index HTML, mapping.json, and review artifacts remain on disk under the staging root — steward must reconcile evidence before approval",
  ];
  if (input.priorCheckpoint.state === "running") {
    warnings.push(
      "Prior checkpoint state was running — treat as abandoned mid-crawl; do not resume the archived checkpoint without steward review",
    );
  }
  warnings.push(
    "One-run rule still applies: a second live HTTP attempt after any completed or partial run requires steward review of first-run evidence",
  );
  return warnings;
}

export async function archiveCheckpointForForceNewRun(input: {
  stagingRoot: string;
  priorCheckpoint: MappingLiveCheckpoint;
  archivedAtIso: string;
}): Promise<ForceNewRunDisposition> {
  const ckPath = mappingLiveCheckpointPath(input.stagingRoot);
  const safeRun = input.priorCheckpoint.runId.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const stamp = input.archivedAtIso.replace(/[:.]/g, "-");
  const archivedPath = `${ckPath}.archived-${stamp}-${safeRun}.json`;
  await rename(ckPath, archivedPath);

  return {
    archivedCheckpointPath: archivedPath,
    priorRunId: input.priorCheckpoint.runId,
    priorCheckpointState: input.priorCheckpoint.state,
    preservedRunDirectories: [
      `sources/index/${input.priorCheckpoint.runId}/`,
      `registry-2012-rsp-mapping/${input.priorCheckpoint.runId}/`,
      `registry-hub-rsp-mapping-review-report/${input.priorCheckpoint.runId}/`,
      `registry-hub-rsp-mapping-evidence-bundle/${input.priorCheckpoint.runId}/`,
    ],
    operatorWarnings: buildForceNewRunOperatorWarnings({
      priorCheckpoint: input.priorCheckpoint,
      forceNewRun: true,
    }),
  };
}
