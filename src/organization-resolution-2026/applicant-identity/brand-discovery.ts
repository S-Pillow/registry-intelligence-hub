/**
 * Research-only Brand discovery classifications for ORG-RES-BRAND-1.
 * Do not replace Organization-resolution states (CONFIRMED / CANDIDATE / …).
 */

import {
  brandRowsWithSelfIdentitySignal,
  type BrandApplicantInventoryRow,
} from "./brand-inventory";
import { isStrictSelfIdentityMatch } from "./identity-match";

export type BrandDiscoveryClass =
  | "SELF_IDENTITY_SIGNAL"
  | "PARENT_BRAND_SIGNAL"
  | "AFFILIATE_IDENTITY_SIGNAL"
  | "BRAND_IDENTITY_CONFLICT"
  | "INSUFFICIENT_IDENTITY_EVIDENCE";

export type BrandDiscoveryRow = BrandApplicantInventoryRow & {
  discoveryClass: BrandDiscoveryClass;
  proposedOrganizationCanonicalName: string | null;
  evidenceBasis: string;
};

export type BrandParentAffiliateHints = {
  applicantLegalName: string;
  directParentLegalName: string | null;
  ultimateParentLegalName: string | null;
  ultimateControlLegalName: string | null;
  affiliateExplanation: string | null;
  identityConflictNote: string | null;
};

function classifyRow(
  row: BrandApplicantInventoryRow,
  hints: BrandParentAffiliateHints | undefined,
): Pick<BrandDiscoveryRow, "discoveryClass" | "proposedOrganizationCanonicalName" | "evidenceBasis"> {
  if (row.brandApplicationCount === 0) {
    return {
      discoveryClass: "INSUFFICIENT_IDENTITY_EVIDENCE",
      proposedOrganizationCanonicalName: null,
      evidenceBasis: "No Brand-designated Applications",
    };
  }

  if (hints?.identityConflictNote) {
    return {
      discoveryClass: "BRAND_IDENTITY_CONFLICT",
      proposedOrganizationCanonicalName: null,
      evidenceBasis: hints.identityConflictNote,
    };
  }

  const self = isStrictSelfIdentityMatch(row.applicantLegalName, row.registrableWebsiteDomain);
  if (self && row.websiteStatus === "OK") {
    return {
      discoveryClass: "SELF_IDENTITY_SIGNAL",
      proposedOrganizationCanonicalName: null, // filled by caller with canonical helper
      evidenceBasis: `Legal name stem matches website domain ${row.registrableWebsiteDomain}; Brand applications ${row.brandApplicationCount}/${row.applicationCount}`,
    };
  }

  const affiliate = (hints?.affiliateExplanation ?? "").trim();
  const parent =
    hints?.directParentLegalName || hints?.ultimateParentLegalName || hints?.ultimateControlLegalName;
  if (parent && row.websiteStatus === "OK") {
    return {
      discoveryClass: "PARENT_BRAND_SIGNAL",
      proposedOrganizationCanonicalName: null,
      evidenceBasis: `Parent/control disclosed with Brand Applications; website ${row.registrableWebsiteDomain ?? "n/a"}`,
    };
  }
  if (affiliate && !parent) {
    return {
      discoveryClass: "AFFILIATE_IDENTITY_SIGNAL",
      proposedOrganizationCanonicalName: null,
      evidenceBasis: "Affiliate disclosure without sufficient ownership language",
    };
  }

  if (row.websiteStatus === "OK" && row.registrableWebsiteDomain && !self) {
    // Unusual domain vs legal name with Brand apps — parent-brand discovery queue, not confirmable alone
    return {
      discoveryClass: "PARENT_BRAND_SIGNAL",
      proposedOrganizationCanonicalName: null,
      evidenceBasis: `Brand Applications with website ${row.registrableWebsiteDomain} that does not strictly self-identify the Applicant legal name`,
    };
  }

  return {
    discoveryClass: "INSUFFICIENT_IDENTITY_EVIDENCE",
    proposedOrganizationCanonicalName: null,
    evidenceBasis: "Brand designation without sufficient first-party identity evidence",
  };
}

export function classifyBrandDiscovery(input: {
  rows: readonly BrandApplicantInventoryRow[];
  hintsByApplicant?: ReadonlyMap<string, BrandParentAffiliateHints>;
  canonicalNameFor?: (legalName: string) => string;
}): BrandDiscoveryRow[] {
  const out: BrandDiscoveryRow[] = [];
  for (const row of input.rows) {
    if (row.brandApplicationCount === 0) continue;
    const hints = input.hintsByApplicant?.get(row.applicantLegalName);
    const classified = classifyRow(row, hints);
    const proposed =
      classified.discoveryClass === "SELF_IDENTITY_SIGNAL" && input.canonicalNameFor
        ? input.canonicalNameFor(row.applicantLegalName)
        : classified.proposedOrganizationCanonicalName;
    out.push({
      ...row,
      discoveryClass: classified.discoveryClass,
      proposedOrganizationCanonicalName: proposed,
      evidenceBasis: classified.evidenceBasis,
    });
  }
  return out.sort(
    (a, b) =>
      b.brandApplicationCount - a.brandApplicationCount ||
      b.applicationCount - a.applicationCount ||
      a.applicantLegalName.localeCompare(b.applicantLegalName),
  );
}

export function summarizeBrandDiscovery(rows: readonly BrandDiscoveryRow[]): {
  selfIdentity: number;
  parentBrand: number;
  affiliate: number;
  conflicts: number;
  insufficient: number;
} {
  return {
    selfIdentity: rows.filter((r) => r.discoveryClass === "SELF_IDENTITY_SIGNAL").length,
    parentBrand: rows.filter((r) => r.discoveryClass === "PARENT_BRAND_SIGNAL").length,
    affiliate: rows.filter((r) => r.discoveryClass === "AFFILIATE_IDENTITY_SIGNAL").length,
    conflicts: rows.filter((r) => r.discoveryClass === "BRAND_IDENTITY_CONFLICT").length,
    insufficient: rows.filter((r) => r.discoveryClass === "INSUFFICIENT_IDENTITY_EVIDENCE").length,
  };
}

export function nonConfirmedSelfIdentityBrandApplicants(
  rows: readonly BrandApplicantInventoryRow[],
): BrandApplicantInventoryRow[] {
  return brandRowsWithSelfIdentitySignal(rows).filter((r) => r.priorResolutionState !== "CONFIRMED");
}
