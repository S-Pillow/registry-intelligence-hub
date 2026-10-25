import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildOrganizationConcentration,
  OrganizationConcentrationError,
} from "@/lib/organization-concentration";
import { GODADDY_FOCAL_APPLICANT_LEGAL_NAME } from "@/lib/participant-intelligence";
import { buildBrowserApplicationPayloadFromPublicationV2 } from "@/lib/registry-application-payload-v2";
import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import type { OrganizationResolutionSnapshot } from "@/organization-resolution-2026/types";
import type { ContentionMembershipSnapshotV1 } from "@/reveal-day-2026/contention-membership-types";
import type { Registry2026PublicationV2 } from "@/reveal-day-2026/publication-v2-types";

const WORKSPACE = process.cwd();
const PUBLICATION_PATH = join(
  WORKSPACE,
  ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json",
);
const CONTENTION_PATH = join(
  WORKSPACE,
  ".data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json",
);
const ORG_PATH = join(
  WORKSPACE,
  ".data/reveal-2026/organization-resolution/organization-resolution-1.0.0.snapshot.json",
);

async function loadLive(): Promise<{
  document: RegistryApplicationsDocumentV2;
  orgSnapshot: OrganizationResolutionSnapshot;
}> {
  const publication = JSON.parse(await readFile(PUBLICATION_PATH, "utf8")) as Registry2026PublicationV2;
  const contention = JSON.parse(
    await readFile(CONTENTION_PATH, "utf8"),
  ) as ContentionMembershipSnapshotV1;
  const orgSnapshot = JSON.parse(
    await readFile(ORG_PATH, "utf8"),
  ) as OrganizationResolutionSnapshot;
  const document = buildBrowserApplicationPayloadFromPublicationV2(publication, { contention });
  return { document, orgSnapshot };
}

describe("ORG-CONCENTRATION-1 baseline / denominators", () => {
  it("matches accepted source-derived coverage constants", async () => {
    const { document, orgSnapshot } = await loadLive();
    expect(orgSnapshot.semanticContentSha256).toBe(
      "06ba3920f6028b1a410835332869869691252432bdb1b7c923e7baee519d346c",
    );
    const model = buildOrganizationConcentration(document, orgSnapshot);
    const c = model.coverage;
    expect(c.confirmedOrganizations).toBe(104);
    expect(c.confirmedApplicantMappings).toBe(161);
    expect(c.confirmedApplications).toBe(1129);
    expect(c.confirmedContentionMemberships).toBe(724);
    expect(c.setsWithConfirmedOrganizationMembership).toBe(256);
    expect(c.officialContentionSets).toBe(263);
    expect(c.officialContentionMemberships).toBe(891);
    expect(c.representedApplications).toBe(1614);
    expect(c.unresolvedApplications).toBe(445);
    expect(c.unresolvedContentionMemberships).toBe(149);
    expect(c.confirmedBrandApplications).toBe(160);
    expect(c.unresolvedBrandApplications).toBe(171);
  });

  it("Application and contention confirmed-subset shares sum to 1", async () => {
    const { document, orgSnapshot } = await loadLive();
    const model = buildOrganizationConcentration(document, orgSnapshot);
    const appSum = model.organizations.reduce((n, o) => n + o.applicationCount, 0);
    const contSum = model.organizations.reduce((n, o) => n + o.contentionMembershipCount, 0);
    expect(appSum).toBe(1129);
    expect(contSum).toBe(724);
    const appShare = model.organizations.reduce(
      (n, o) => n + o.applicationShareOfConfirmedSubset,
      0,
    );
    const contShare = model.organizations.reduce(
      (n, o) => n + o.contentionMembershipShareOfConfirmedSubset,
      0,
    );
    expect(Math.abs(appShare - 1)).toBeLessThan(1e-12);
    expect(Math.abs(contShare - 1)).toBeLessThan(1e-12);
  });

  it("set-touch shares are independent of membership share (not required to sum to 1)", async () => {
    const { document, orgSnapshot } = await loadLive();
    const model = buildOrganizationConcentration(document, orgSnapshot);
    const touchSum = model.organizations.reduce((n, o) => n + o.officialSetTouchShare, 0);
    expect(touchSum).toBeGreaterThan(1);
  });
});

describe("ORG-CONCENTRATION-1 confirmed-only + consolidation", () => {
  it("excludes Candidate / Ambiguous / Unresolved from Organization rankings", async () => {
    const { document, orgSnapshot } = await loadLive();
    const model = buildOrganizationConcentration(document, orgSnapshot);
    expect(model.organizations).toHaveLength(104);
    expect(model.organizations.every((o) => o.organizationId.startsWith("organization:"))).toBe(
      true,
    );
    expect(model.organizations.some((o) => /unknown|unresolved/i.test(o.organizationName))).toBe(
      false,
    );
    const nonConfirmed = orgSnapshot.applicantIdentityMappings.filter(
      (m) => m.resolutionState !== "CONFIRMED",
    );
    expect(nonConfirmed.length).toBeGreaterThan(0);
    for (const m of nonConfirmed) {
      if (!m.organizationId) continue;
      // Candidate/Ambiguous org entities must not appear as concentration rows unless also CONFIRMED status
      const org = orgSnapshot.organizations.find((o) => o.organizationId === m.organizationId);
      if (org && org.status !== "CONFIRMED") {
        expect(model.organizations.some((r) => r.organizationId === org.organizationId)).toBe(
          false,
        );
      }
    }
  });

  it("Alibaba Group consolidates Applicants without duplicate Applications/memberships", async () => {
    const { document, orgSnapshot } = await loadLive();
    const model = buildOrganizationConcentration(document, orgSnapshot);
    const ali = model.organizations.find((o) => o.organizationKey === "alibaba-group");
    expect(ali).toBeTruthy();
    expect(ali!.confirmedApplicantCount).toBe(3);
    expect(ali!.applicationCount).toBe(7);
    expect(ali!.contentionMembershipCount).toBe(4);
    const names = orgSnapshot.organizations.find((o) => o.organizationKey === "alibaba-group")!
      .applicantLegalNames;
    expect(names).toHaveLength(3);
    const apps = document.applications.filter((a) => names.includes(a.applicant));
    expect(apps).toHaveLength(7);
    const memb = apps.reduce(
      (n, a) => n + (a.officialContention?.membershipPresent ? a.officialContention.officialContentionSetIds.length : 0),
      0,
    );
    expect(memb).toBe(4);
  });
});

describe("ORG-CONCENTRATION-1 crowded sets + GoDaddy relative", () => {
  it("ranks crowded sets by membership DESC then set id ASC", async () => {
    const { document, orgSnapshot } = await loadLive();
    const model = buildOrganizationConcentration(document, orgSnapshot, { crowdedSetLimit: 10 });
    expect(model.crowdedSets).toHaveLength(10);
    for (let i = 1; i < model.crowdedSets.length; i++) {
      const prev = model.crowdedSets[i - 1]!;
      const cur = model.crowdedSets[i]!;
      expect(prev.officialMembershipCount).toBeGreaterThanOrEqual(cur.officialMembershipCount);
      if (prev.officialMembershipCount === cur.officialMembershipCount) {
        expect(
          prev.contentionSetId.localeCompare(cur.contentionSetId, undefined, { numeric: true }),
        ).toBeLessThanOrEqual(0);
      }
    }
    expect(model.crowdedSets[0]!.officialMembershipCount).toBeGreaterThanOrEqual(
      model.crowdedSets.at(-1)!.officialMembershipCount,
    );
  });

  it("does not label partially unresolved sets as SINGLE_CONFIRMED_ORG", async () => {
    const { document, orgSnapshot } = await loadLive();
    const model = buildOrganizationConcentration(document, orgSnapshot, { crowdedSetLimit: 50 });
    for (const s of model.crowdedSets) {
      if (s.unresolvedMembershipCount > 0) {
        expect(s.confirmedStructure).toBe("PARTIAL_RESOLUTION");
        expect(s.displayStructureLabel).not.toMatch(/^1 confirmed Organization \(fully resolved/);
      }
      if (s.confirmedStructure === "SINGLE_CONFIRMED_ORG") {
        expect(s.confirmedMembershipCount).toBe(s.officialMembershipCount);
        expect(s.distinctConfirmedOrganizations).toBe(1);
      }
    }
  });

  it("GoDaddy relative excludes self Organization and preserves 77/66", async () => {
    const { document, orgSnapshot } = await loadLive();
    const model = buildOrganizationConcentration(document, orgSnapshot);
    const gd = model.godaddyRelative;
    expect(gd).toBeTruthy();
    expect(gd!.godaddyApplicantLegalName).toBe(GODADDY_FOCAL_APPLICANT_LEGAL_NAME);
    expect(gd!.applicationCount).toBe(77);
    expect(gd!.contentionMembershipCount).toBe(66);
    expect(gd!.godaddyOrganizationKey).toBe("godaddy-registry-services");
    expect(
      gd!.counterparts.some((c) => c.organizationId === gd!.godaddyOrganizationId),
    ).toBe(false);
    expect(gd!.counterparts.every((c) => c.sharedSetCountWithGoDaddy >= 1)).toBe(true);
    // ranking stability
    for (let i = 1; i < gd!.counterparts.length; i++) {
      const a = gd!.counterparts[i - 1]!;
      const b = gd!.counterparts[i]!;
      const keyA = [a.sharedSetCountWithGoDaddy, a.counterpartMembershipsWithinSharedSets];
      const keyB = [b.sharedSetCountWithGoDaddy, b.counterpartMembershipsWithinSharedSets];
      expect(keyA[0]! > keyB[0]! || (keyA[0] === keyB[0] && keyA[1]! >= keyB[1]!)).toBe(true);
    }
  });

  it("fail-closed on publication pin mismatch", async () => {
    const { document, orgSnapshot } = await loadLive();
    const bad = {
      ...orgSnapshot,
      applicationPublicationPin: {
        ...orgSnapshot.applicationPublicationPin,
        applicationGraphContentSha256: "0".repeat(64),
      },
    };
    expect(() => buildOrganizationConcentration(document, bad)).toThrow(
      OrganizationConcentrationError,
    );
  });
});

describe("ORG-CONCENTRATION-1 ranking / top shares / language safety helpers", () => {
  it("assigns stable GoDaddy ranks and top-N confirmed-subset shares", async () => {
    const { document, orgSnapshot } = await loadLive();
    const model = buildOrganizationConcentration(document, orgSnapshot);
    const gd = model.organizations.find((o) => o.isGodaddyOrganization)!;
    expect(gd.rankByApplications).toBe(model.godaddyRelative!.applicationRankAmongConfirmed);
    expect(gd.rankByContentionMemberships).toBe(
      model.godaddyRelative!.contentionMembershipRankAmongConfirmed,
    );
    expect(model.topShares.top5ApplicationShareOfConfirmedSubset).toBeGreaterThan(0);
    expect(model.topShares.top5ApplicationShareOfConfirmedSubset).toBeLessThanOrEqual(1);
    expect(model.topShares.top10ApplicationShareOfConfirmedSubset).toBeGreaterThanOrEqual(
      model.topShares.top5ApplicationShareOfConfirmedSubset,
    );
    const blob = [
      model.disclosure.applicationCoverageSentence,
      model.disclosure.contentionCoverageSentence,
      model.disclosure.subsetDisclaimer,
      ...model.crowdedSets.map((s) => s.displayStructureLabel),
    ].join("\n");
    expect(blob).not.toMatch(/market share|dominance|market power|win probability|auction probability|sales opportunity|selected RSP|available customer/i);
  });
});
