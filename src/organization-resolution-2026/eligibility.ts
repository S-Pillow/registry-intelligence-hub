import type { OrganizationResolutionSnapshot } from "./types";

/**
 * Product eligibility for Organization intelligence.
 * Only CONFIRMED mappings may contribute to org counts / portfolios / contention-aware org metrics.
 * Candidate and ambiguous never count. Empty confirmed set keeps metrics blocked.
 */
export function productEligibleOrganizationCount(snapshot: OrganizationResolutionSnapshot): number {
  return snapshot.organizations.filter((o) => o.status === "CONFIRMED").length;
}

export function organizationMetricsProductEligible(snapshot: OrganizationResolutionSnapshot): boolean {
  return productEligibleOrganizationCount(snapshot) > 0;
}

export function confirmedPortfolioSizes(
  snapshot: OrganizationResolutionSnapshot,
): Array<{ organizationId: string; organizationKey: string; applicationCount: number }> {
  return snapshot.organizations
    .filter((o) => o.status === "CONFIRMED")
    .map((o) => ({
      organizationId: o.organizationId,
      organizationKey: o.organizationKey,
      applicationCount: o.memberApplicationIds.length,
    }))
    .sort((a, b) => b.applicationCount - a.applicationCount || a.organizationKey.localeCompare(b.organizationKey));
}

export function confirmedResolutionCoverageDisclosure(snapshot: OrganizationResolutionSnapshot): {
  confirmedOrganizations: number;
  confirmedApplications: number;
  observedApplications: number;
  coverageRatio: number;
  disclosure: string;
} {
  const confirmedOrganizations = productEligibleOrganizationCount(snapshot);
  const confirmedApplications = snapshot.quality.applicationsCoveredByConfirmedOrganizations;
  const observedApplications = snapshot.quality.observedApplications;
  const coverageRatio = observedApplications === 0 ? 0 : confirmedApplications / observedApplications;
  return {
    confirmedOrganizations,
    confirmedApplications,
    observedApplications,
    coverageRatio,
    disclosure:
      confirmedOrganizations === 0
        ? "No steward-confirmed 2026 Organizations — Organization metrics remain blocked; Applicant Name is not Organization."
        : `Confirmed Organization coverage ${confirmedApplications}/${observedApplications} observed Applications (${(coverageRatio * 100).toFixed(1)}%); not official Applicants ${snapshot.quality.officialApplicants}.`,
  };
}
