import { describe, expect, it } from "vitest";
import {
  buildApplicantWebsiteInventory,
  buildSharedApplicantWebsiteClusters,
} from "./website-clusters";

describe("shared applicant website clusters", () => {
  const base = [
    {
      applicantLegalName: "Hair Apparent, LLC",
      representativeApplicationId: "SS2654T-T11896",
      rawWebsite: "https://www.identity.digital",
      applicationIds: ["SS2654T-T11896", "SS2654T-T19815"],
      officialContentionMemberships: 3,
      sourceUrl: "https://example.test/summary/1",
    },
    {
      applicantLegalName: "Paws Button, LLC",
      representativeApplicationId: "PB1",
      rawWebsite: "https://identity.digital/",
      applicationIds: ["PB1"],
      officialContentionMemberships: 1,
      sourceUrl: "https://example.test/summary/2",
    },
    {
      applicantLegalName: "Solo Applicant Ltd",
      representativeApplicationId: "SOLO1",
      rawWebsite: "https://www.solo-registry.io",
      applicationIds: ["SOLO1"],
      officialContentionMemberships: 0,
      sourceUrl: "https://example.test/summary/3",
    },
    {
      applicantLegalName: "Missing Site Inc",
      representativeApplicationId: "MISS1",
      rawWebsite: null,
      applicationIds: ["MISS1"],
      officialContentionMemberships: 0,
      sourceUrl: "https://example.test/summary/4",
    },
  ];

  it("classifies unique vs shared domains and excludes missing from shared claims", () => {
    const inventory = buildApplicantWebsiteInventory({ rows: base });
    const hair = inventory.find((r) => r.applicantLegalName === "Hair Apparent, LLC")!;
    const solo = inventory.find((r) => r.applicantLegalName === "Solo Applicant Ltd")!;
    const missing = inventory.find((r) => r.applicantLegalName === "Missing Site Inc")!;
    expect(hair.discoveryClass).toBe("SHARED_DOMAIN");
    expect(solo.discoveryClass).toBe("UNIQUE_DOMAIN");
    expect(missing.discoveryClass).toBe("MISSING_WEBSITE");

    const clusters = buildSharedApplicantWebsiteClusters(inventory);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.registrableWebsiteDomain).toBe("identity.digital");
    expect(clusters[0]!.applicantLegalNames).toEqual(["Hair Apparent, LLC", "Paws Button, LLC"]);
    expect(clusters[0]!.applicationCount).toBe(3);
    expect(clusters[0]!.officialContentionMemberships).toBe(4);
  });

  it("does not inflate Applicant count for duplicate Applications", () => {
    const inventory = buildApplicantWebsiteInventory({
      rows: [
        {
          applicantLegalName: "Hair Apparent, LLC",
          representativeApplicationId: "A",
          rawWebsite: "https://identity.digital",
          applicationIds: ["A", "B", "A"],
          officialContentionMemberships: 2,
          sourceUrl: "u",
        },
        {
          applicantLegalName: "Hair Apparent, LLC",
          representativeApplicationId: "A",
          rawWebsite: "https://identity.digital",
          applicationIds: ["A", "B"],
          officialContentionMemberships: 2,
          sourceUrl: "u",
        },
        {
          applicantLegalName: "Paws Button, LLC",
          representativeApplicationId: "C",
          rawWebsite: "https://identity.digital",
          applicationIds: ["C"],
          officialContentionMemberships: 1,
          sourceUrl: "u",
        },
      ],
    });
    // duplicate inventory rows for same applicant still count once in cluster
    const clusters = buildSharedApplicantWebsiteClusters(inventory);
    expect(clusters[0]!.applicantLegalNames).toEqual(["Hair Apparent, LLC", "Paws Button, LLC"]);
    expect(clusters[0]!.applicationIds).toEqual(["A", "B", "C"]);
  });

  it("is source-order independent", () => {
    const a = buildSharedApplicantWebsiteClusters(buildApplicantWebsiteInventory({ rows: base }));
    const b = buildSharedApplicantWebsiteClusters(
      buildApplicantWebsiteInventory({ rows: [...base].reverse() }),
    );
    expect(a).toEqual(b);
  });
});
