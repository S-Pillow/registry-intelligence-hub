import { describe, expect, it } from "vitest";
import {
  buildBrandApplicantInventory,
  rankBrandDiscoveryCandidates,
} from "./brand-inventory";
import {
  canonicalOrganizationNameFromLegalName,
  isStrictSelfIdentityMatch,
  normalizeLegalNameStemForIdentityMatch,
  normalizeWebsiteDomainStemForIdentityMatch,
  organizationKeyFromCanonicalName,
} from "./identity-match";
import { classifyBrandDiscovery, summarizeBrandDiscovery } from "./brand-discovery";

describe("ORG-RES-BRAND-1 brand inventory", () => {
  const applications = [
    {
      applicationId: "B-2",
      applicant: "Salesforce, Inc.",
      appliedString: { label: "slack" },
      designations: { brand: true },
    },
    {
      applicationId: "B-1",
      applicant: "Salesforce, Inc.",
      appliedString: { label: "salesforce" },
      designations: { brand: true },
    },
    {
      applicationId: "B-3",
      applicant: "Salesforce, Inc.",
      appliedString: { label: "tableau" },
      designations: { brand: true },
    },
    {
      applicationId: "B-4",
      applicant: "Salesforce, Inc.",
      appliedString: { label: "force" },
      designations: { brand: true },
    },
    {
      applicationId: "M-1",
      applicant: "Mixed Brand LLC",
      appliedString: { label: "mixed" },
      designations: { brand: true },
    },
    {
      applicationId: "M-2",
      applicant: "Mixed Brand LLC",
      appliedString: { label: "other" },
      designations: { brand: false },
    },
    {
      applicationId: "N-1",
      applicant: "No Brand Corp",
      appliedString: { label: "nobrand" },
      designations: { brand: false },
    },
  ];

  const websiteRows = [
    {
      applicantLegalName: "Salesforce, Inc.",
      registrableWebsiteDomain: "salesforce.com",
      normalizedWebsiteHost: "salesforce.com",
      websiteStatus: "OK",
    },
    {
      applicantLegalName: "Mixed Brand LLC",
      registrableWebsiteDomain: "mixedbrand.com",
      normalizedWebsiteHost: "mixedbrand.com",
      websiteStatus: "OK",
    },
    {
      applicantLegalName: "No Brand Corp",
      registrableWebsiteDomain: null,
      normalizedWebsiteHost: null,
      websiteStatus: "MISSING_WEBSITE",
    },
  ];

  const mappings = [
    {
      applicantLegalName: "Salesforce, Inc.",
      resolutionState: "UNRESOLVED" as const,
      organizationId: null,
    },
    {
      applicantLegalName: "Mixed Brand LLC",
      resolutionState: "UNRESOLVED" as const,
      organizationId: null,
    },
    {
      applicantLegalName: "No Brand Corp",
      resolutionState: "UNRESOLVED" as const,
      organizationId: null,
    },
  ];

  it("builds Brand / non-Brand counts and multi-Brand under same Applicant", () => {
    const inv = buildBrandApplicantInventory({ applications, websiteRows, mappings });
    expect(inv.representedApplicants).toBe(3);
    expect(inv.applicantsWithBrandApplications).toBe(2);
    expect(inv.brandApplicationsRepresented).toBe(5);
    const sf = inv.rows.find((r) => r.applicantLegalName === "Salesforce, Inc.")!;
    expect(sf.applicationCount).toBe(4);
    expect(sf.brandApplicationCount).toBe(4);
    expect(sf.nonBrandApplicationCount).toBe(0);
    expect(sf.brandApplicationRatio).toBe(1);
    expect(sf.appliedForStrings).toEqual(["force", "salesforce", "slack", "tableau"]);
    expect(sf.representativeApplicationId).toBe("B-1");
    const mixed = inv.rows.find((r) => r.applicantLegalName === "Mixed Brand LLC")!;
    expect(mixed.brandApplicationCount).toBe(1);
    expect(mixed.nonBrandApplicationCount).toBe(1);
    expect(mixed.brandApplicationRatio).toBe(0.5);
  });

  it("is independent of source application ordering", () => {
    const reversed = [...applications].reverse();
    const a = buildBrandApplicantInventory({ applications, websiteRows, mappings });
    const b = buildBrandApplicantInventory({
      applications: reversed,
      websiteRows,
      mappings,
    });
    expect(a.rows.map((r) => r.applicantLegalName)).toEqual(b.rows.map((r) => r.applicantLegalName));
    expect(a.rows.find((r) => r.applicantLegalName === "Salesforce, Inc.")?.representativeApplicationId).toBe(
      b.rows.find((r) => r.applicantLegalName === "Salesforce, Inc.")?.representativeApplicationId,
    );
  });

  it("joins website inventory and ranks Brand candidates", () => {
    const inv = buildBrandApplicantInventory({ applications, websiteRows, mappings });
    const ranked = rankBrandDiscoveryCandidates(inv.rows);
    expect(ranked[0]?.applicantLegalName).toBe("Salesforce, Inc.");
    expect(ranked[1]?.applicantLegalName).toBe("Mixed Brand LLC");
    expect(ranked.every((r) => r.priorResolutionState !== "CONFIRMED")).toBe(true);
  });
});

describe("ORG-RES-BRAND-1 identity matching", () => {
  it("normalizes legal names and domains conservatively", () => {
    expect(normalizeLegalNameStemForIdentityMatch("Salesforce, Inc.")).toBe("salesforce");
    expect(normalizeWebsiteDomainStemForIdentityMatch("salesforce.com")).toBe("salesforce");
    expect(normalizeWebsiteDomainStemForIdentityMatch("www.salesforce.com")).toBe("salesforce");
  });

  it("detects self-identity and prevents false matches", () => {
    expect(isStrictSelfIdentityMatch("Salesforce, Inc.", "salesforce.com")).toBe(true);
    expect(isStrictSelfIdentityMatch("Foo Holdings LLC", "bar.com")).toBe(false);
    expect(isStrictSelfIdentityMatch("Amazon Registry Services, LLC", "registry.amazon")).toBe(false);
  });

  it("derives clean Organization names without legal suffix duplication", () => {
    expect(canonicalOrganizationNameFromLegalName("Salesforce, Inc.")).toBe("Salesforce");
    expect(organizationKeyFromCanonicalName("Salesforce")).toBe("salesforce");
    expect(canonicalOrganizationNameFromLegalName("Roblox Corporation")).toBe("Roblox");
    expect(canonicalOrganizationNameFromLegalName("Goldman Sachs & Co. LLC")).toBe("Goldman Sachs");
  });
});

describe("ORG-RES-BRAND-1 discovery classifications", () => {
  it("classifies self-identity vs insufficient Brand-only cases", () => {
    const rows = [
      {
        applicantLegalName: "Salesforce, Inc.",
        representativeApplicationId: "B-1",
        applicationCount: 4,
        brandApplicationCount: 4,
        nonBrandApplicationCount: 0,
        brandApplicationRatio: 1,
        appliedForStrings: ["salesforce"],
        applicationIds: ["B-1"],
        brandApplicationIds: ["B-1"],
        registrableWebsiteDomain: "salesforce.com",
        normalizedWebsiteHost: "salesforce.com",
        websiteStatus: "OK" as const,
        priorResolutionState: "UNRESOLVED" as const,
        priorOrganizationId: null,
      },
      {
        applicantLegalName: "Brand Only LLC",
        representativeApplicationId: "X-1",
        applicationCount: 1,
        brandApplicationCount: 1,
        nonBrandApplicationCount: 0,
        brandApplicationRatio: 1,
        appliedForStrings: ["brandonly"],
        applicationIds: ["X-1"],
        brandApplicationIds: ["X-1"],
        registrableWebsiteDomain: null,
        normalizedWebsiteHost: null,
        websiteStatus: "MISSING_WEBSITE" as const,
        priorResolutionState: "UNRESOLVED" as const,
        priorOrganizationId: null,
      },
    ];
    const classified = classifyBrandDiscovery({
      rows,
      canonicalNameFor: canonicalOrganizationNameFromLegalName,
    });
    const summary = summarizeBrandDiscovery(classified);
    expect(summary.selfIdentity).toBe(1);
    expect(summary.insufficient).toBe(1);
    expect(classified[0]?.proposedOrganizationCanonicalName).toBe("Salesforce");
  });
});
