import { enrichPresentationFeed } from "@/change-intel/enrich-presentation-feed";
import { readLatestFeed, readObservation } from "@/change-intel/state-io";
import type {
  ChangeIntelFeedState,
  ChangeIntelObservation,
  ChangeIntelPresentationFeedState,
} from "@/change-intel/types";
import { loadOrganizationResolutionSnapshot } from "@/lib/participant-intelligence-server";

/** Server-only local feed load — never contacts ICANN. Raw storage feed. */
export async function loadChangeIntelFeed(): Promise<ChangeIntelFeedState> {
  return readLatestFeed(process.cwd());
}

async function loadObservationsForFeed(
  feed: ChangeIntelFeedState,
  cwd: string,
): Promise<Map<string, ChangeIntelObservation>> {
  const map = new Map<string, ChangeIntelObservation>();
  if (!feed.initialized) return map;
  const ids = new Set<string>();
  if (feed.currentObservationId) ids.add(feed.currentObservationId);
  if (feed.previousObservationId) ids.add(feed.previousObservationId);
  if (feed.latestDiff?.observationId) ids.add(feed.latestDiff.observationId);
  if (feed.latestDiff?.previousObservationId) ids.add(feed.latestDiff.previousObservationId);
  for (const d of feed.recentMeaningfulDiffs) {
    ids.add(d.observationId);
    if (d.previousObservationId) ids.add(d.previousObservationId);
  }
  for (const id of ids) {
    const obs = await readObservation(id, cwd);
    if (obs) map.set(id, obs);
  }
  return map;
}

/**
 * Presentation feed: immutable storage feed + read-time Organization / materiality /
 * contention / display context. Does not write runtime state.
 */
export async function loadChangeIntelPresentationFeed(
  cwd: string = process.cwd(),
): Promise<ChangeIntelPresentationFeedState> {
  const feed = await readLatestFeed(cwd);
  if (!feed.initialized) return { initialized: false };

  let organizationSnapshot = null;
  try {
    organizationSnapshot = await loadOrganizationResolutionSnapshot(cwd);
  } catch {
    organizationSnapshot = null;
  }

  const observationsById = await loadObservationsForFeed(feed, cwd);
  return enrichPresentationFeed({
    feed,
    organizationSnapshot,
    observationsById,
  });
}
