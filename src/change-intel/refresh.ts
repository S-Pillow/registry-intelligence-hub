import { join } from "node:path";
import { deriveDiff } from "@/change-intel/derive-diff";
import { buildObservationFromNormalizedSources } from "@/change-intel/observation";
import {
  browserDocumentFromNormalized,
  buildRspPostureMap,
} from "@/change-intel/rsp-context";
import {
  acquireNormalizedSources,
  APS_APPLICATION_CSV_URL,
  APS_CONTENTION_CSV_URL,
} from "@/change-intel/sources";
import {
  persistRefresh,
  readIndex,
  readObservation,
} from "@/change-intel/state-io";
import type {
  ChangeIntelDiff,
  ChangeIntelFeed,
  ChangeIntelIndex,
  ChangeIntelObservation,
} from "@/change-intel/types";

export type RefreshResult = {
  status: "refreshed" | "dry-run";
  observation: ChangeIntelObservation;
  diff: ChangeIntelDiff;
  index?: ChangeIntelIndex;
  feed?: ChangeIntelFeed;
  wroteState: boolean;
};

export async function refreshChangeIntel(input?: {
  cwd?: string;
  dryRun?: boolean;
  mode?: "fetch" | "file";
  applicationPathOrUrl?: string;
  contentionPathOrUrl?: string;
  observedAt?: string;
}): Promise<RefreshResult> {
  const cwd = input?.cwd ?? process.cwd();
  const dryRun = Boolean(input?.dryRun);
  const mode = input?.mode ?? "fetch";
  const index = await readIndex(cwd);
  if (!index?.currentObservationId) {
    throw new Error("CHANGE_INTEL_NOT_INITIALIZED");
  }
  const previous = await readObservation(index.currentObservationId, cwd);
  if (!previous) {
    throw new Error("CHANGE_INTEL_PREVIOUS_OBSERVATION_MISSING");
  }

  const applicationPathOrUrl =
    input?.applicationPathOrUrl
    ?? (mode === "file"
      ? join(cwd, ".data/reveal-2026/aps-capture/applications.csv")
      : APS_APPLICATION_CSV_URL);
  const contentionPathOrUrl =
    input?.contentionPathOrUrl
    ?? (mode === "file"
      ? join(cwd, ".data/reveal-2026/aps-capture/reveal-day-contention-sets.csv")
      : APS_CONTENTION_CSV_URL);

  // Acquisition/validation — on failure throw before any write.
  const acquired = await acquireNormalizedSources({
    applicationPathOrUrl,
    contentionPathOrUrl,
    mode,
  });

  const observedAt = input?.observedAt ?? new Date().toISOString();
  const observation = buildObservationFromNormalizedSources({
    observedAt,
    previousObservationId: previous.observationId,
    bootstrap: false,
    applications: acquired.applications,
    contentionSets: acquired.contentionSets,
    applicationSource: acquired.applicationSource,
    contentionSource: acquired.contentionSource,
    officialApplications: previous.officialApplications,
    officialApplicants: previous.officialApplicants,
  });

  let rspByApplicant;
  try {
    const ephemeral = browserDocumentFromNormalized({
      applications: acquired.applications,
      contentionSets: acquired.contentionSets,
    });
    rspByApplicant = buildRspPostureMap(ephemeral);
  } catch {
    rspByApplicant = undefined;
  }

  const diff = deriveDiff({ previous, current: observation, rspByApplicant });

  if (dryRun) {
    return {
      status: "dry-run",
      observation,
      diff,
      wroteState: false,
    };
  }

  const { index: nextIndex, feed } = await persistRefresh({ observation, diff, cwd });
  return {
    status: "refreshed",
    observation,
    diff,
    index: nextIndex,
    feed,
    wroteState: true,
  };
}
