import type { ReportingPeriod } from "@/market-baseline-mrr/types";

export type SnapshotKey = `${string}@${ReportingPeriod}`;

export function snapshotKey(tld: string, period: ReportingPeriod): SnapshotKey {
  return `${tld}@${period}`;
}
