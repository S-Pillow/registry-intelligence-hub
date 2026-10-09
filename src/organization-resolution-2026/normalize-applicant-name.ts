/**
 * Applicant-name normalization for candidate discovery ONLY.
 * Never auto-confirms Organization identity (Applicant ≠ Organization).
 */

const CORPORATE_SUFFIX_RE =
  /\b(incorporated|inc\.?|l\.?l\.?c\.?|ltd\.?|limited|corp\.?|corporation|gmbh|s\.?p\.?a\.?|s\.?\s*à\s*r\.?\s*l\.?|sarl|sezc|plc|co\.?|company)\b/gi;

export function normalizeApplicantNameForCandidateDiscovery(legalName: string): string {
  let s = legalName.normalize("NFKC").trim().toLowerCase();
  s = s.replace(/[\u2018\u2019\u201a\u201b'`]/g, "'");
  s = s.replace(/[\u201c\u201d\u201e"]/g, '"');
  s = s.replace(CORPORATE_SUFFIX_RE, " ");
  s = s.replace(/[^a-z0-9]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** Stable cluster id from a normalized key (not an Organization id). */
export function candidateClusterIdFromNormalizedKey(normalizedKey: string): string {
  return `candidate-cluster:${normalizedKey.replace(/\s+/g, "-")}`;
}
