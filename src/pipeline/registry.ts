import type { SourceDefinition } from "./types";

/**
 * The typed, versioned source registry. Every entry here corresponds to a
 * subsection of docs/source-inventory.md (Project Agent Store) marked
 * "Adapter state: Implemented" — sources documented as "documented only" or
 * "not implemented" there are deliberately absent from this fetchable set;
 * see that doc for why (dynamic HTML scraping targets deferred to the
 * normalization phase, and sources whose live reachability from a
 * production host is unconfirmed).
 *
 * Registry entries are immutable in spirit: once published, edit only to
 * fix a genuine mistake. A materially different fetch target (new URL,
 * format, or bound) should bump `version` and, if the old target is being
 * retired, keep the old `id` documented in source-inventory.md rather than
 * silently reassigning it.
 */
export const REGISTRY_VERSION = "1.0.0";

export const SOURCE_REGISTRY: readonly SourceDefinition[] = [
  {
    id: "icann-2012-reveal-day-overview-pdf",
    version: 1,
    name: "Overview of New gTLD Applications (13 Jun 2012)",
    owner: "ICANN",
    url: "https://newgtlds.icann.org/sites/default/files/applications-overview-13jun12-en.pdf",
    format: "pdf",
    mediaTypeHint: "application/pdf",
    cadence: "Published once (13 Jun 2012); static archival file since.",
    coverage:
      "Authoritative aggregate 2012-round statistics: total applications, standard vs. community-based, geographic-name, IDN, Applicant Support Program, and per-region counts.",
    effectiveTimeSemantics: "point-in-time-publication",
    rights: "public-reference-unapproved",
    rightsNote: "Public ICANN reference page — bulk/automated use not yet approved by a data steward.",
    adapterId: "http",
    schemaVersion: "http-adapter/1.0.0",
    maxBytes: 1_000_000,
    notes: "docs/source-inventory.md §1.1",
  },
  {
    id: "iana-root-zone-tld-list-text",
    version: 1,
    name: "IANA Root Zone — plain-text delegated TLD list",
    owner: "IANA",
    url: "https://data.iana.org/TLD/tlds-alpha-by-domain.txt",
    format: "text",
    mediaTypeHint: "text/plain",
    cadence: "Updated as delegations change; observed same-day updates.",
    coverage: "Flat, current list of every delegated top-level domain label (ASCII / Punycode A-labels).",
    effectiveTimeSemantics: "live-current-status",
    rights: "public-reference-unapproved",
    rightsNote: "Public IANA reference file — bulk/automated use not yet approved by a data steward.",
    adapterId: "http",
    schemaVersion: "http-adapter/1.0.0",
    maxBytes: 200_000,
    notes: "docs/source-inventory.md §4.2",
  },
  {
    id: "iana-root-zone-tld-list-json",
    version: 1,
    name: "IANA Root Zone — structured JSON export (v1 data)",
    owner: "IANA",
    url: "https://data.iana.org/TLD/v1/tlds.json",
    format: "json",
    mediaTypeHint: "application/json",
    cadence: "Updated as delegations change; observed same-day updates.",
    coverage:
      "Per-domain status, type, IDN u-label/script code, ISO 3166 code, manager/contacts, DS records, nameservers, RDAP/WHOIS endpoints, and delegation/revocation events with an explicit confidence_level.",
    effectiveTimeSemantics: "live-current-status",
    rights: "public-reference-unapproved",
    rightsNote: "Public IANA reference file — bulk/automated use not yet approved by a data steward.",
    adapterId: "http",
    schemaVersion: "http-adapter/1.0.0",
    maxBytes: 6_000_000,
    notes: "docs/source-inventory.md §4.3",
  },
  {
    id: "iana-root-zone-tld-schema-json",
    version: 1,
    name: "IANA Root Zone — structured JSON export (v1 schema)",
    owner: "IANA",
    url: "https://data.iana.org/TLD/v1/tlds-schema.json",
    format: "json",
    mediaTypeHint: "application/json",
    cadence: "Updated only when IANA revises the export's shape.",
    coverage: "The published JSON Schema describing iana-root-zone-tld-list-json's shape — lets a future normalizer validate structurally instead of guessing at drift.",
    effectiveTimeSemantics: "point-in-time-publication",
    rights: "public-reference-unapproved",
    rightsNote: "Public IANA reference file — bulk/automated use not yet approved by a data steward.",
    adapterId: "http",
    schemaVersion: "http-adapter/1.0.0",
    maxBytes: 200_000,
    notes: "docs/source-inventory.md §4.3",
  },
] as const;

export function getSourceDefinition(sourceId: string): SourceDefinition | undefined {
  return SOURCE_REGISTRY.find((source) => source.id === sourceId);
}

export function requireSourceDefinition(sourceId: string): SourceDefinition {
  const source = getSourceDefinition(sourceId);
  if (!source) {
    throw new Error(`Unknown source id "${sourceId}". Run \`list\` to see registered sources.`);
  }
  return source;
}
