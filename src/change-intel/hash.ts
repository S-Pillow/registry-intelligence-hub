import { createHash } from "node:crypto";
import type { ContentionMembershipKey, TrackedApplicationFields } from "@/change-intel/types";
import { sortTrackedApplications } from "@/change-intel/tracked-fields";

export function sha256Hex(bytes: Uint8Array | string): string {
  const buf = typeof bytes === "string" ? Buffer.from(bytes, "utf8") : Buffer.from(bytes);
  return createHash("sha256").update(buf).digest("hex");
}

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

export function hashTrackedApplications(apps: TrackedApplicationFields[]): string {
  return sha256Hex(canonicalJson(sortTrackedApplications(apps)));
}

export function sortMemberships(keys: ContentionMembershipKey[]): ContentionMembershipKey[] {
  return [...keys].sort(
    (a, b) =>
      a.contentionSetId.localeCompare(b.contentionSetId)
      || a.applicationId.localeCompare(b.applicationId),
  );
}

export function hashContentionMemberships(keys: ContentionMembershipKey[]): string {
  return sha256Hex(canonicalJson(sortMemberships(keys)));
}

export function makeObservationId(observedAt: string, applicationsHash: string): string {
  const stamp = observedAt.replace(/[:.]/g, "-");
  return `obs-${stamp}-${applicationsHash.slice(0, 12)}`;
}

export function makeDiffId(observationId: string): string {
  return `diff-${observationId.replace(/^obs-/, "")}`;
}

export function makeChangeId(
  observationId: string,
  changeType: string,
  subject: string,
  ordinal: number,
): string {
  return `chg-${observationId.slice(0, 24)}-${changeType}-${subject}-${String(ordinal).padStart(4, "0")}`;
}
