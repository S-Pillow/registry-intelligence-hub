/**
 * Conservative legal-name ↔ website-domain matching for ORG-RES-BRAND-1 discovery.
 * Queue-building signal only — never auto-confirms Organization.
 */

const LEGAL_SUFFIX_TOKENS = [
  "incorporated",
  "inc",
  "llc",
  "l.l.c",
  "ltd",
  "limited",
  "gmbh",
  "corp",
  "corporation",
  "company",
  "co",
  "plc",
  "pbc",
  "sa",
  "sas",
  "bv",
  "ag",
  "nv",
  "n.v",
  "pty",
  "kk",
  "ab",
  "oy",
  "as",
  "spa",
  "srl",
  "lp",
  "llp",
  "sezc",
  "aktiengesellschaft",
] as const;

const SUFFIX_RE = new RegExp(
  `\\b(${LEGAL_SUFFIX_TOKENS.map((t) => t.replace(/\./g, "\\.")).join("|")})\\b\\.?`,
  "gi",
);

/** Normalize Applicant legal name to a comparable alphanumeric stem (discovery only). */
export function normalizeLegalNameStemForIdentityMatch(legalName: string): string {
  let s = legalName.normalize("NFKC").trim().toLowerCase();
  s = s.replace(/&/g, " ");
  s = s.replace(SUFFIX_RE, " ");
  s = s.replace(/[^a-z0-9]+/g, "");
  return s;
}

/** Registrable domain left-most label (salesforce.com → salesforce). */
export function normalizeWebsiteDomainStemForIdentityMatch(
  registrableWebsiteDomain: string | null | undefined,
): string {
  if (!registrableWebsiteDomain) return "";
  const host = registrableWebsiteDomain.trim().toLowerCase().replace(/^www\./, "");
  const parts = host.split(".").filter(Boolean);
  return parts[0] ?? "";
}

/**
 * Strong self-identity discovery signal: legal-name stem equals registrable domain stem.
 * Foo Holdings LLC + bar.com → false. Salesforce, Inc. + salesforce.com → true.
 */
export function isStrictSelfIdentityMatch(
  applicantLegalName: string,
  registrableWebsiteDomain: string | null | undefined,
): boolean {
  const nameStem = normalizeLegalNameStemForIdentityMatch(applicantLegalName);
  const domainStem = normalizeWebsiteDomainStemForIdentityMatch(registrableWebsiteDomain);
  if (!nameStem || !domainStem) return false;
  return nameStem === domainStem;
}

/**
 * Public Organization display name from Applicant legal name (suffix stripped).
 * Does not invent a different corporate family.
 */
export function canonicalOrganizationNameFromLegalName(legalName: string): string {
  let s = legalName.normalize("NFKC").trim();
  const trailing =
    /,?\s*\b(Incorporated|Inc\.?|L\.?L\.?C\.?|Ltd\.?|Limited|Corp\.?|Corporation|GmbH|PBC|PLC|S\.?A\.?S\.?|S\.?A\.?|N\.?V\.?|BV|AG|AB|SEZC|Pty\.?\s*Ltd\.?|Co\.,?\s*Ltd\.?|CO\.,\s*LTD\.?|Company)\s*$/i;
  for (let i = 0; i < 3; i += 1) {
    const next = s.replace(trailing, "").replace(/,\s*$/, "").trim();
    if (next === s) break;
    s = next;
  }
  s = s.replace(/,?\s*&\s*Co\.?\s*$/i, "").trim();
  return s || legalName.trim();
}

/** Stable organization key from canonical display name. */
export function organizationKeyFromCanonicalName(canonicalName: string): string {
  return canonicalName
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}
