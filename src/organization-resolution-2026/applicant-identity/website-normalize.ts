/**
 * Deterministic Applicant Website normalization for ORG-RES-WEB-1.
 * Website is a discovery signal — never alone confirmation of Organization.
 */

const MULTI_PART_PUBLIC_SUFFIXES = new Set([
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.jp",
  "co.kr",
  "com.br",
  "com.mx",
  "co.nz",
  "co.za",
  "com.sg",
  "com.hk",
  "com.tw",
  "com.cn",
  "com.tr",
]);

/** Domains that are placeholders / not usable as corporate identity signals. */
export const UNUSABLE_WEBSITE_DOMAINS = new Set(["example.com", "example.org", "example.net"]);

export type NormalizedWebsite = {
  normalizedWebsiteUrl: string;
  normalizedWebsiteHost: string;
  registrableWebsiteDomain: string;
};

export type WebsiteNormalizeResult =
  | { status: "OK"; rawWebsite: string; normalized: NormalizedWebsite }
  | { status: "MISSING_WEBSITE"; rawWebsite: null; normalized: null }
  | { status: "INVALID_OR_UNUSABLE_WEBSITE"; rawWebsite: string; normalized: null };

function stripWww(host: string): string {
  return host.startsWith("www.") ? host.slice(4) : host;
}

export function extractRegistrableWebsiteDomain(hostname: string): string {
  const host = stripWww(hostname.toLowerCase().replace(/\.$/, ""));
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2) return host;
  const last2 = parts.slice(-2).join(".");
  if (MULTI_PART_PUBLIC_SUFFIXES.has(last2) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return last2;
}

/**
 * Normalize Applicant Website URL for clustering.
 * - http/https only
 * - lowercase host, strip www
 * - drop query/fragment; treat bare "/" path as absent
 * - registrable domain via compact public-suffix table (not full PSL)
 */
export function normalizeApplicantWebsite(raw: string | null | undefined): WebsiteNormalizeResult {
  if (raw == null) {
    return { status: "MISSING_WEBSITE", rawWebsite: null, normalized: null };
  }
  const trimmed = String(raw).trim();
  if (!trimmed) {
    return { status: "MISSING_WEBSITE", rawWebsite: null, normalized: null };
  }

  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { status: "INVALID_OR_UNUSABLE_WEBSITE", rawWebsite: trimmed, normalized: null };
  }

  if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !parsed.hostname) {
    return { status: "INVALID_OR_UNUSABLE_WEBSITE", rawWebsite: trimmed, normalized: null };
  }

  const hostNoWww = stripWww(parsed.hostname.toLowerCase());
  const registrable = extractRegistrableWebsiteDomain(parsed.hostname);
  if (!registrable || UNUSABLE_WEBSITE_DOMAINS.has(registrable)) {
    return { status: "INVALID_OR_UNUSABLE_WEBSITE", rawWebsite: trimmed, normalized: null };
  }

  let path = parsed.pathname || "";
  if (path === "/") path = "";
  const normalizedWebsiteUrl = path
    ? `https://${hostNoWww}${path.replace(/\/+$/, "")}`
    : `https://${hostNoWww}`;

  return {
    status: "OK",
    rawWebsite: trimmed,
    normalized: {
      normalizedWebsiteUrl,
      normalizedWebsiteHost: hostNoWww,
      registrableWebsiteDomain: registrable,
    },
  };
}
