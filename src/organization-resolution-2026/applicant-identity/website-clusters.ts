import { normalizeApplicantWebsite, UNUSABLE_WEBSITE_DOMAINS } from "./website-normalize";

export type WebsiteDiscoveryClass =
  | "UNIQUE_DOMAIN"
  | "SHARED_DOMAIN"
  | "KNOWN_CONFIRMED_ORG_DOMAIN"
  | "MAPPING_CONFLICT"
  | "MISSING_WEBSITE"
  | "INVALID_OR_UNUSABLE_WEBSITE";

export type ApplicantWebsiteInventoryRow = {
  applicantLegalName: string;
  representativeApplicationId: string;
  rawWebsite: string | null;
  normalizedWebsiteUrl: string | null;
  normalizedWebsiteHost: string | null;
  registrableWebsiteDomain: string | null;
  applicationIds: string[];
  officialContentionMemberships: number;
  discoveryClass: WebsiteDiscoveryClass;
  sourceUrl: string;
  publicationAsOf: string | null;
};

export type SharedApplicantWebsiteCluster = {
  registrableWebsiteDomain: string;
  applicantLegalNames: string[];
  applicationIds: string[];
  applicationCount: number;
  officialContentionMemberships: number;
  representativeApplicationIds: string[];
};

export type WebsiteInventoryBuildInput = {
  rows: Array<{
    applicantLegalName: string;
    representativeApplicationId: string;
    rawWebsite: string | null;
    applicationIds: string[];
    officialContentionMemberships: number;
    sourceUrl: string;
    publicationAsOf?: string | null;
    /** Optional: domain already mapped to a confirmed Organization (discovery class only). */
    knownConfirmedOrgDomain?: boolean;
    /** Optional: first-party conflict flag from steward review. */
    mappingConflict?: boolean;
  }>;
};

export function buildApplicantWebsiteInventory(
  input: WebsiteInventoryBuildInput,
): ApplicantWebsiteInventoryRow[] {
  const out: ApplicantWebsiteInventoryRow[] = [];
  for (const row of input.rows) {
    const norm = normalizeApplicantWebsite(row.rawWebsite);
    let discoveryClass: WebsiteDiscoveryClass;
    if (norm.status === "MISSING_WEBSITE") discoveryClass = "MISSING_WEBSITE";
    else if (norm.status === "INVALID_OR_UNUSABLE_WEBSITE") discoveryClass = "INVALID_OR_UNUSABLE_WEBSITE";
    else if (row.mappingConflict) discoveryClass = "MAPPING_CONFLICT";
    else if (row.knownConfirmedOrgDomain) discoveryClass = "KNOWN_CONFIRMED_ORG_DOMAIN";
    else discoveryClass = "UNIQUE_DOMAIN"; // reclassified after cluster pass

    out.push({
      applicantLegalName: row.applicantLegalName,
      representativeApplicationId: row.representativeApplicationId,
      rawWebsite: norm.status === "MISSING_WEBSITE" ? null : (row.rawWebsite?.trim() ?? null),
      normalizedWebsiteUrl: norm.normalized?.normalizedWebsiteUrl ?? null,
      normalizedWebsiteHost: norm.normalized?.normalizedWebsiteHost ?? null,
      registrableWebsiteDomain: norm.normalized?.registrableWebsiteDomain ?? null,
      applicationIds: [...row.applicationIds].sort((a, b) => a.localeCompare(b)),
      officialContentionMemberships: row.officialContentionMemberships,
      discoveryClass,
      sourceUrl: row.sourceUrl,
      publicationAsOf: row.publicationAsOf ?? null,
    });
  }

  const byDomain = new Map<string, string[]>();
  for (const row of out) {
    if (!row.registrableWebsiteDomain) continue;
    if (UNUSABLE_WEBSITE_DOMAINS.has(row.registrableWebsiteDomain)) continue;
    const list = byDomain.get(row.registrableWebsiteDomain) ?? [];
    list.push(row.applicantLegalName);
    byDomain.set(row.registrableWebsiteDomain, list);
  }

  return out
    .map((row): ApplicantWebsiteInventoryRow => {
      if (
        row.discoveryClass === "MISSING_WEBSITE" ||
        row.discoveryClass === "INVALID_OR_UNUSABLE_WEBSITE" ||
        row.discoveryClass === "MAPPING_CONFLICT" ||
        !row.registrableWebsiteDomain
      ) {
        return row;
      }
      const names = new Set(byDomain.get(row.registrableWebsiteDomain) ?? []);
      if (names.size >= 2) {
        const discoveryClass: WebsiteDiscoveryClass =
          row.discoveryClass === "KNOWN_CONFIRMED_ORG_DOMAIN"
            ? "KNOWN_CONFIRMED_ORG_DOMAIN"
            : "SHARED_DOMAIN";
        return { ...row, discoveryClass };
      }
      return row;
    })
    .sort((a, b) => a.applicantLegalName.localeCompare(b.applicantLegalName));
}

/**
 * Shared Applicant Website clusters — not corporate groups.
 * Sort: distinct Applicant count desc, Application count desc, domain asc.
 */
export function buildSharedApplicantWebsiteClusters(
  inventory: readonly ApplicantWebsiteInventoryRow[],
): SharedApplicantWebsiteCluster[] {
  const byDomain = new Map<string, ApplicantWebsiteInventoryRow[]>();
  for (const row of inventory) {
    if (!row.registrableWebsiteDomain) continue;
    if (
      row.discoveryClass === "MISSING_WEBSITE" ||
      row.discoveryClass === "INVALID_OR_UNUSABLE_WEBSITE"
    ) {
      continue;
    }
    const list = byDomain.get(row.registrableWebsiteDomain) ?? [];
    list.push(row);
    byDomain.set(row.registrableWebsiteDomain, list);
  }

  const clusters: SharedApplicantWebsiteCluster[] = [];
  for (const [domain, rows] of byDomain) {
    const applicantLegalNames = [...new Set(rows.map((r) => r.applicantLegalName))].sort((a, b) =>
      a.localeCompare(b),
    );
    if (applicantLegalNames.length < 2) continue;
    const applicationIds = [...new Set(rows.flatMap((r) => r.applicationIds))].sort((a, b) =>
      a.localeCompare(b),
    );
    const officialContentionMemberships = rows.reduce(
      (sum, r) => sum + r.officialContentionMemberships,
      0,
    );
    clusters.push({
      registrableWebsiteDomain: domain,
      applicantLegalNames,
      applicationIds,
      applicationCount: applicationIds.length,
      officialContentionMemberships,
      representativeApplicationIds: [...new Set(rows.map((r) => r.representativeApplicationId))].sort(
        (a, b) => a.localeCompare(b),
      ),
    });
  }

  return clusters.sort(
    (a, b) =>
      b.applicantLegalNames.length - a.applicantLegalNames.length ||
      b.applicationCount - a.applicationCount ||
      a.registrableWebsiteDomain.localeCompare(b.registrableWebsiteDomain),
  );
}
