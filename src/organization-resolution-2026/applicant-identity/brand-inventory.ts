/**
 * Deterministic Brand Applicant inventory for ORG-RES-BRAND-1.
 * Brand designation is a discovery/corroboration signal — never confirmation alone.
 */

import type { OrganizationResolutionState } from "../types";
import { buildRepresentativeApplicationsByLegalName } from "./representative-application";
import { isStrictSelfIdentityMatch } from "./identity-match";

export type BrandApplicantInventoryRow = {
  applicantLegalName: string;
  representativeApplicationId: string;
  applicationCount: number;
  brandApplicationCount: number;
  nonBrandApplicationCount: number;
  brandApplicationRatio: number;
  appliedForStrings: string[];
  applicationIds: string[];
  brandApplicationIds: string[];
  registrableWebsiteDomain: string | null;
  normalizedWebsiteHost: string | null;
  websiteStatus: "OK" | "MISSING_WEBSITE" | "INVALID_OR_UNUSABLE_WEBSITE" | "UNKNOWN";
  priorResolutionState: OrganizationResolutionState;
  priorOrganizationId: string | null;
};

export type BrandApplicantInventory = {
  schemaVersion: "brand-applicant-inventory/1.0.0";
  representedApplicants: number;
  applicantsWithBrandApplications: number;
  brandApplicationsRepresented: number;
  nonConfirmedBrandApplicants: number;
  rows: BrandApplicantInventoryRow[];
};

export type BrandInventoryApplication = {
  applicationId: string;
  applicant: string;
  appliedString?: { label?: string } | null;
  designations?: { brand?: boolean } | null;
};

export type BrandInventoryWebsiteRow = {
  applicantLegalName: string;
  registrableWebsiteDomain: string | null;
  normalizedWebsiteHost: string | null;
  websiteStatus?: string | null;
};

export type BrandInventoryMapping = {
  applicantLegalName: string;
  resolutionState: OrganizationResolutionState;
  organizationId: string | null;
};

export function buildBrandApplicantInventory(input: {
  applications: readonly BrandInventoryApplication[];
  websiteRows: readonly BrandInventoryWebsiteRow[];
  mappings: readonly BrandInventoryMapping[];
}): BrandApplicantInventory {
  const reps = buildRepresentativeApplicationsByLegalName(
    input.applications.map((a) => ({ applicationId: a.applicationId, applicant: a.applicant })),
  );
  const websiteByName = new Map(input.websiteRows.map((r) => [r.applicantLegalName, r]));
  const mappingByName = new Map(input.mappings.map((m) => [m.applicantLegalName, m]));

  const appsByName = new Map<string, BrandInventoryApplication[]>();
  for (const app of input.applications) {
    const list = appsByName.get(app.applicant) ?? [];
    list.push(app);
    appsByName.set(app.applicant, list);
  }

  const rows: BrandApplicantInventoryRow[] = [];
  for (const [name, rep] of [...reps.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const apps = appsByName.get(name) ?? [];
    const brandApps = apps.filter((a) => Boolean(a.designations?.brand));
    const strings = [
      ...new Set(
        apps
          .map((a) => a.appliedString?.label?.trim())
          .filter((s): s is string => Boolean(s)),
      ),
    ].sort((a, b) => a.localeCompare(b));
    const website = websiteByName.get(name);
    const mapping = mappingByName.get(name);
    const websiteStatusRaw = website?.websiteStatus;
    const websiteStatus =
      websiteStatusRaw === "OK" ||
      websiteStatusRaw === "MISSING_WEBSITE" ||
      websiteStatusRaw === "INVALID_OR_UNUSABLE_WEBSITE"
        ? websiteStatusRaw
        : website?.registrableWebsiteDomain
          ? "OK"
          : website
            ? "UNKNOWN"
            : "UNKNOWN";

    rows.push({
      applicantLegalName: name,
      representativeApplicationId: rep.representativeApplicationId,
      applicationCount: apps.length,
      brandApplicationCount: brandApps.length,
      nonBrandApplicationCount: apps.length - brandApps.length,
      brandApplicationRatio: apps.length === 0 ? 0 : brandApps.length / apps.length,
      appliedForStrings: strings,
      applicationIds: [...rep.applicationIds],
      brandApplicationIds: brandApps
        .map((a) => a.applicationId)
        .sort((a, b) => a.localeCompare(b)),
      registrableWebsiteDomain: website?.registrableWebsiteDomain ?? null,
      normalizedWebsiteHost: website?.normalizedWebsiteHost ?? null,
      websiteStatus,
      priorResolutionState: mapping?.resolutionState ?? "UNRESOLVED",
      priorOrganizationId: mapping?.organizationId ?? null,
    });
  }

  const withBrand = rows.filter((r) => r.brandApplicationCount > 0);
  return {
    schemaVersion: "brand-applicant-inventory/1.0.0",
    representedApplicants: rows.length,
    applicantsWithBrandApplications: withBrand.length,
    brandApplicationsRepresented: withBrand.reduce((sum, r) => sum + r.brandApplicationCount, 0),
    nonConfirmedBrandApplicants: withBrand.filter((r) => r.priorResolutionState !== "CONFIRMED")
      .length,
    rows,
  };
}

export function rankBrandDiscoveryCandidates(
  rows: readonly BrandApplicantInventoryRow[],
): BrandApplicantInventoryRow[] {
  return [...rows]
    .filter((r) => r.brandApplicationCount > 0 && r.priorResolutionState !== "CONFIRMED")
    .sort(
      (a, b) =>
        b.brandApplicationCount - a.brandApplicationCount ||
        b.applicationCount - a.applicationCount ||
        a.applicantLegalName.localeCompare(b.applicantLegalName),
    );
}

export function brandRowsWithSelfIdentitySignal(
  rows: readonly BrandApplicantInventoryRow[],
): BrandApplicantInventoryRow[] {
  return rows.filter(
    (r) =>
      r.brandApplicationCount > 0 &&
      r.websiteStatus === "OK" &&
      isStrictSelfIdentityMatch(r.applicantLegalName, r.registrableWebsiteDomain),
  );
}
