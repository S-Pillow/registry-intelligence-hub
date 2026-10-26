import type { ProbeTldResult, SelectionReason, UniverseMember } from "./types";

export const CONTROL_SET_TLDS = ["com", "net", "org", "xyz", "online", "shop", "top", "site"] as const;

export function selectTop100ByTotalDomains(
  probeSuccess: Array<{ tldAsciiLabel: string; totalDomains: number }>,
  n = 100,
): string[] {
  const ranked = [...probeSuccess].sort((a, b) => {
    if (b.totalDomains !== a.totalDomains) return b.totalDomains - a.totalDomains;
    return a.tldAsciiLabel.localeCompare(b.tldAsciiLabel);
  });
  return ranked.slice(0, n).map((r) => r.tldAsciiLabel);
}

export function buildHistoryUniverse(args: {
  top100: string[];
  controlSet: string[];
  delegatedOverlaps: string[];
}): UniverseMember[] {
  const reasons = new Map<string, Set<SelectionReason>>();
  const add = (tld: string, reason: SelectionReason) => {
    const label = tld.toLowerCase();
    let set = reasons.get(label);
    if (!set) {
      set = new Set();
      reasons.set(label, set);
    }
    set.add(reason);
  };
  for (const t of args.top100) add(t, "TOP_100");
  for (const t of args.controlSet) add(t, "CONTROL_SET");
  for (const t of args.delegatedOverlaps) add(t, "RIH_DELEGATED_APPLICATION_OVERLAP");

  return [...reasons.entries()]
    .map(([tldAsciiLabel, set]) => ({
      tldAsciiLabel,
      reasons: [...set].sort() as SelectionReason[],
    }))
    .sort((a, b) => a.tldAsciiLabel.localeCompare(b.tldAsciiLabel));
}

export function controlSetPresentInDiscovery(discoveredLabels: Set<string>): string[] {
  return CONTROL_SET_TLDS.filter((t) => discoveredLabels.has(t));
}

export function probeSuccessForRanking(results: ProbeTldResult[]): Array<{
  tldAsciiLabel: string;
  totalDomains: number;
}> {
  return results
    .filter((r) => r.outcome === "SUCCESS" && typeof r.totalDomains === "number")
    .map((r) => ({ tldAsciiLabel: r.tldAsciiLabel, totalDomains: r.totalDomains! }));
}
