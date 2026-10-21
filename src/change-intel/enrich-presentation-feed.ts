import {
  deriveChangeContext,
  organizationLookupFromSnapshot,
  type OrganizationLookupRow,
} from "@/change-intel/derive-change-context";
import type {
  ChangeIntelFeed,
  ChangeIntelFeedState,
  ChangeIntelObservation,
  ChangeIntelPresentationFeedState,
  ChangeRecord,
  DerivedChangeContext,
} from "@/change-intel/types";
import type { OrganizationResolutionSnapshot } from "@/organization-resolution-2026/types";

export type EnrichPresentationInput = {
  feed: ChangeIntelFeedState;
  organizationSnapshot: OrganizationResolutionSnapshot | null;
  /**
   * Observations keyed by observationId. Used for temporal contention set
   * resolution. Missing observations yield no fabricated contention links.
   */
  observationsById?: Map<string, ChangeIntelObservation>;
  /**
   * Optional override lookup for tests (Confirmed-only gate still applies).
   */
  organizationLookupOverride?: {
    hash: string;
    generatedAt: string | null;
    byApplicant: Map<string, OrganizationLookupRow>;
  };
};

function collectChanges(feed: ChangeIntelFeed): ChangeRecord[] {
  const out: ChangeRecord[] = [];
  const seen = new Set<string>();
  const push = (list: ChangeRecord[] | undefined) => {
    for (const c of list ?? []) {
      if (seen.has(c.changeId)) continue;
      seen.add(c.changeId);
      out.push(c);
    }
  };
  push(feed.latestDiff?.changes);
  for (const d of feed.recentMeaningfulDiffs) {
    push(d.changes);
  }
  return out;
}

function observationForDiffSide(
  feed: ChangeIntelFeed,
  side: "source" | "target",
  change: ChangeRecord,
  observationsById: Map<string, ChangeIntelObservation>,
): ChangeIntelObservation | null {
  // Prefer the diff that owns this changeId.
  const diffs = [
    feed.latestDiff,
    ...feed.recentMeaningfulDiffs,
  ].filter(Boolean) as NonNullable<ChangeIntelFeed["latestDiff"]>[];
  const owning = diffs.find((d) => d.changes.some((c) => c.changeId === change.changeId));
  if (!owning) return null;
  const id = side === "target" ? owning.observationId : owning.previousObservationId;
  if (!id) return null;
  return observationsById.get(id) ?? null;
}

/**
 * Build presentation feed with read-time derived context.
 * Does not mutate the input feed object or any ChangeRecord.
 */
export function enrichPresentationFeed(input: EnrichPresentationInput): ChangeIntelPresentationFeedState {
  if (!input.feed.initialized) {
    return { initialized: false };
  }

  const feed = input.feed;
  const lookup = input.organizationLookupOverride
    ?? (input.organizationSnapshot
      ? organizationLookupFromSnapshot(input.organizationSnapshot)
      : {
          hash: "organization-snapshot-unavailable",
          generatedAt: null as string | null,
          byApplicant: new Map<string, OrganizationLookupRow>(),
        });

  const observationsById = input.observationsById ?? new Map();
  const derivedByChangeId: Record<string, DerivedChangeContext> = {};

  for (const change of collectChanges(feed)) {
    // Deep-freeze intent: operate on the record as read-only input.
    const sourceObs = observationForDiffSide(feed, "source", change, observationsById);
    const targetObs = observationForDiffSide(feed, "target", change, observationsById);
    derivedByChangeId[change.changeId] = deriveChangeContext({
      change,
      snapshotHash: lookup.hash,
      snapshotGeneratedAt: lookup.generatedAt,
      organizationLookup: lookup.byApplicant,
      sourceObservation: sourceObs,
      targetObservation: targetObs,
    });
  }

  return {
    ...feed,
    organizationSnapshotHash: lookup.hash,
    organizationSnapshotGeneratedAt: lookup.generatedAt,
    derivedByChangeId,
  };
}

/** Assert enrichment did not mutate ChangeRecord fields. */
export function changeRecordFingerprint(change: ChangeRecord): string {
  return JSON.stringify(change);
}
