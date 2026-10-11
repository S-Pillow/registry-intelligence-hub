import type {
  ChangeRecord,
  ContentionChangeType,
  ContentionMembershipKey,
  TrackedApplicationFields,
} from "@/change-intel/types";
import { makeChangeId } from "@/change-intel/hash";
import { sortMemberships } from "@/change-intel/hash";

function membershipKey(m: ContentionMembershipKey): string {
  return `${m.contentionSetId}\u0000${m.applicationId}`;
}

function baseRecord(input: {
  observationId: string;
  observedAt: string;
  changeType: ContentionChangeType;
  membership: ContentionMembershipKey;
  ordinal: number;
  appliedForString: string | null;
  applicantLegalName: string | null;
  before: ContentionMembershipKey | null;
  after: ContentionMembershipKey | null;
}): ChangeRecord {
  return {
    changeId: makeChangeId(
      input.observationId,
      input.changeType,
      `${input.membership.contentionSetId}-${input.membership.applicationId}`,
      input.ordinal,
    ),
    observedAt: input.observedAt,
    sourceType: "contention",
    changeType: input.changeType,
    applicationId: input.membership.applicationId,
    appliedForString: input.appliedForString,
    applicantLegalName: input.applicantLegalName,
    fieldChanges: [],
    contentionSetId: input.membership.contentionSetId,
    before: input.before,
    after: input.after,
    primaryImpact: "MARKET_CHANGE",
    impactReasons: [],
    applicantApplicationCount: null,
    applicantContentionCount: null,
    rspPublicPosture: null,
    exploreHref: `/explore?q=${encodeURIComponent(input.membership.applicationId)}`,
    competitiveLandscapeHref: "/competitive-landscape",
  };
}

/** Diff official (set, applicationId) memberships. Order-insensitive. */
export function diffContentionMemberships(input: {
  observationId: string;
  observedAt: string;
  previous: ContentionMembershipKey[];
  current: ContentionMembershipKey[];
  applicationsById: Map<string, TrackedApplicationFields>;
}): ChangeRecord[] {
  const prev = new Map(sortMemberships(input.previous).map((m) => [membershipKey(m), m]));
  const curr = new Map(sortMemberships(input.current).map((m) => [membershipKey(m), m]));
  const keys = [...new Set([...prev.keys(), ...curr.keys()])].sort((a, b) => a.localeCompare(b));
  const out: ChangeRecord[] = [];
  let ordinal = 0;

  for (const key of keys) {
    const before = prev.get(key);
    const after = curr.get(key);
    if (!before && after) {
      ordinal += 1;
      const app = input.applicationsById.get(after.applicationId);
      out.push(
        baseRecord({
          observationId: input.observationId,
          observedAt: input.observedAt,
          changeType: "CONTENTION_MEMBERSHIP_ADDED",
          membership: after,
          ordinal,
          appliedForString: app?.appliedForString ?? null,
          applicantLegalName: app?.applicantLegalName ?? null,
          before: null,
          after,
        }),
      );
    } else if (before && !after) {
      ordinal += 1;
      const app = input.applicationsById.get(before.applicationId);
      out.push(
        baseRecord({
          observationId: input.observationId,
          observedAt: input.observedAt,
          changeType: "CONTENTION_MEMBERSHIP_REMOVED",
          membership: before,
          ordinal,
          appliedForString: app?.appliedForString ?? null,
          applicantLegalName: app?.applicantLegalName ?? null,
          before,
          after: null,
        }),
      );
    }
  }
  return out;
}
