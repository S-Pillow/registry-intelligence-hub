import type { PrimaryImpact, RspPublicPostureLabel } from "@/change-intel/types";

/** User-facing impact band labels — internal enum values are unchanged. */
export const IMPACT_DISPLAY_LABEL: Record<PrimaryImpact, string> = {
  GODADDY_DIRECT: "GoDaddy direct",
  GODADDY_CONTENTION: "GoDaddy contention",
  RSP_RESEARCH_RELEVANT: "Public Main-RSP unmatched",
  MARKET_CHANGE: "Market",
};

export const FORBIDDEN_CHANGE_INTEL_UI_PHRASES = [
  "RSP research",
  "worth investigation",
  "GoDaddy Registry investigation",
  "opportunity",
  "needs RSP",
  "unassigned",
  "available customer",
  "no selected provider",
] as const;

const LEGACY_RSP_REASON =
  /Applicant currently has no public Main-RSP capability match\s*[—\-].*Selected RSP is not disclosed in public Application data\.?/i;

const SAFE_RSP_UNMATCHED_REASON =
  "No public Main-RSP capability match was found for this Applicant under the current evaluated-RSP identity matching.";

/**
 * Sanitize stored impact reasons for display without mutating ChangeRecord storage.
 * Rewrites known legacy RSP investigation phrasing; strips exact forbidden phrase hits
 * only via known template replacement (no AI prose).
 */
export function displayImpactReasons(reasons: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of reasons) {
    let text = raw;
    if (LEGACY_RSP_REASON.test(text) || /worth .*investigation|GoDaddy Registry investigation/i.test(text)) {
      text = SAFE_RSP_UNMATCHED_REASON;
    }
    if (seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

export function displayImpactLabel(impact: PrimaryImpact): string {
  return IMPACT_DISPLAY_LABEL[impact];
}

/** Factual public-RSP posture line for change cards. */
export function displayRspPostureLine(
  posture: RspPublicPostureLabel,
  primaryImpact: PrimaryImpact,
): string | null {
  if (primaryImpact === "RSP_RESEARCH_RELEVANT") {
    return "Public Main-RSP posture: no public capability match";
  }
  if (!posture) return null;
  return `Public Main-RSP posture: ${posture}`;
}

/** Safe reason text written into *new* ChangeRecords going forward. */
export function rspUnmatchedImpactReason(): string {
  return SAFE_RSP_UNMATCHED_REASON;
}

export function assertNoForbiddenChangeIntelPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  return FORBIDDEN_CHANGE_INTEL_UI_PHRASES.filter((p) => lower.includes(p.toLowerCase()));
}
