import type { PortfolioChangeClassification } from "./types";

/** Absolute Application-count change is the classification rule (not percentage). */
export function classifyPortfolioChange(
  applications2012: number,
  applications2026: number,
): PortfolioChangeClassification {
  if (applications2026 > applications2012) return "EXPANDED";
  if (applications2026 < applications2012) return "CONTRACTED";
  return "UNCHANGED";
}

export function applicationDelta(applications2012: number, applications2026: number): number {
  return applications2026 - applications2012;
}

/** Secondary context only — never the classification rule. */
export function applicationPercentDelta(applications2012: number, applications2026: number): number {
  if (applications2012 === 0) return applications2026 === 0 ? 0 : Number.POSITIVE_INFINITY;
  return ((applications2026 - applications2012) / applications2012) * 100;
}

export function portfolioChangeDisclosureSentence(
  canonicalDisplayName: string,
  applications2012: number,
  applications2026: number,
): string {
  const change = classifyPortfolioChange(applications2012, applications2026);
  if (change === "UNCHANGED") {
    return `Application portfolio unchanged at ${applications2026} applications in both 2012 and 2026 for ${canonicalDisplayName}.`;
  }
  if (change === "CONTRACTED") {
    return `Application portfolio contracted from ${applications2012} applications in 2012 to ${applications2026} in 2026 for ${canonicalDisplayName}.`;
  }
  return `Application portfolio expanded from ${applications2012} applications in 2012 to ${applications2026} in 2026 for ${canonicalDisplayName}.`;
}
