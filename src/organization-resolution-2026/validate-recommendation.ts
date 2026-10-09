import type { EvidenceStrength } from "./types";
import type { ResearchEvidenceItem, ReviewRecommendation } from "./review-types";

const CONFIRMING = new Set<EvidenceStrength>(["A", "B"]);

/**
 * Research recommendations only. CONFIRM requires A or explicit B.
 * C/D cannot produce CONFIRM. Research never yields mapping state CONFIRMED.
 */
export function validateReviewRecommendation(input: {
  recommendation: ReviewRecommendation;
  evidence: ResearchEvidenceItem[];
  claimsParentSubsidiaryCollapse: boolean;
  selfResolution: boolean;
}): void {
  const strengths = input.evidence.map((e) => e.strength);
  const strongest = strongestStrength(strengths);

  if (input.recommendation === "CONFIRM") {
    if (!input.evidence.some((e) => CONFIRMING.has(e.strength))) {
      throw new Error("CONFIRM recommendation requires at least one A or B evidence item");
    }
    if (strengths.every((s) => s === "C" || s === "D")) {
      throw new Error("C/D evidence cannot produce CONFIRM recommendation");
    }
    if (input.selfResolution && input.evidence.length === 0) {
      throw new Error("Self-resolution CONFIRM recommendation requires evidence");
    }
    if (input.claimsParentSubsidiaryCollapse) {
      const explicit = input.evidence.some(
        (e) =>
          CONFIRMING.has(e.strength) &&
          /wholly|100%\s*owner|subsidiary|parent|owned by|direct parent|ultimate parent/i.test(
            `${e.summary} ${e.supportsClaim}`,
          ),
      );
      if (!explicit) {
        throw new Error(
          "Parent/subsidiary CONFIRM recommendation requires explicit A/B ownership/control evidence",
        );
      }
    }
  }

  if (
    (input.recommendation === "CONFIRM" || input.recommendation === "KEEP_CANDIDATE") &&
    strongest === "D" &&
    !input.evidence.some((e) => e.strength !== "D")
  ) {
    if (input.recommendation === "CONFIRM") {
      throw new Error("D-only evidence cannot produce CONFIRM recommendation");
    }
  }
}

export function strongestStrength(strengths: EvidenceStrength[]): EvidenceStrength | null {
  const order: EvidenceStrength[] = ["A", "B", "C", "D"];
  for (const s of order) {
    if (strengths.includes(s)) return s;
  }
  return null;
}

export function normalizeEvidenceIds(ids: string[]): string[] {
  return [...new Set(ids)].sort();
}
