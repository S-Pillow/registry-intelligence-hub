import { isValidLdhLabel, normalizeAsciiLabel } from "./match";

export type ParsedRegistrableDomain = {
  /** Full normalized registrable domain, e.g. "example.net". */
  domain: string;
  /** Second-level label, e.g. "example". */
  sld: string;
  tld: string;
};

/**
 * Parse a single ActiveDNS registrable-domain line for a known single-label
 * reference TLD (e.g. net, org). Rejects multi-label public suffixes and
 * anything that is not exactly `<ldh-label>.<tld>`.
 */
export function parseRegistrableDomainForTld(
  line: string,
  expectedTld: string,
): ParsedRegistrableDomain | null {
  const normalizedTld = normalizeAsciiLabel(expectedTld);
  if (!normalizedTld || !isValidLdhLabel(normalizedTld)) return null;

  const normalized = normalizeAsciiLabel(line);
  if (!normalized) return null;
  if (normalized.includes(" ") || normalized.includes("\t")) return null;
  if (normalized.startsWith(".") || normalized.endsWith(".")) return null;
  if (normalized.includes("..")) return null;

  const parts = normalized.split(".");
  // Reference panel TLDs are single-label (net, org, …). Require exactly SLD + TLD.
  if (parts.length !== 2) return null;

  const [sld, tld] = parts;
  if (tld !== normalizedTld) return null;
  if (!isValidLdhLabel(sld) || !isValidLdhLabel(tld)) return null;

  return {
    domain: `${sld}.${tld}`,
    sld,
    tld,
  };
}
