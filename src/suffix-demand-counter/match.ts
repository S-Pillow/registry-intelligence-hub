/**
 * Explicit matching policy for offline suffix-demand counting.
 *
 * This is a literal string heuristic on the registrable second-level label:
 * ASCII-normalized, case-insensitive equals OR endsWith. It is not semantic
 * keyword / morphological analysis.
 */

const LDH_LABEL = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** Lowercase ASCII trim; returns null when the value is empty after trim. */
export function normalizeAsciiLabel(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  // Reject non-ASCII so IDN / mojibake never silently match ASCII candidates.
  if (!/^[\x00-\x7f]*$/.test(normalized)) return null;
  return normalized;
}

export function isValidLdhLabel(label: string): boolean {
  if (label.length < 1 || label.length > 63) return false;
  if (label.startsWith("-") || label.endsWith("-")) return false;
  return LDH_LABEL.test(label);
}

/**
 * True when the second-level label equals the candidate or literally ends with it.
 * Both sides must already be ASCII-lowercased.
 */
export function sldMatchesCandidate(sld: string, candidate: string): boolean {
  if (!candidate) return false;
  if (sld === candidate) return true;
  // Literal suffix only; require the SLD to be longer so equals is the sole
  // path for exact matches (endsWith alone would also be true for equals).
  if (sld.length > candidate.length && sld.endsWith(candidate)) return true;
  return false;
}

export const MATCHING_POLICY = {
  normalization: "ascii-lowercase-ldh",
  comparison: "case-insensitive",
  rule: "second-level-label equals candidate OR literal endsWith candidate",
  implementation: "reversed-suffix-trie",
  duplicateDetection: "sorted-adjacent-previous-domain",
  semanticKeywordAnalysis: false as const,
  note:
    "Counts use a simple ASCII equals/endsWith heuristic on the registrable second-level label (via a reversed suffix trie). This is not semantic keyword analysis. Duplicate suppression assumes each ActiveDNS list is sorted.",
} as const;
