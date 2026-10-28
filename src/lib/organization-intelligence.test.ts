import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildOrganizationIntelligenceProfile,
  decodeOrganizationProfileKey,
  organizationProfileHref,
} from "@/lib/organization-intelligence";
import { loadEvaluatedMainRspArtifact } from "@/lib/icann-evaluated-rsp";
import {
  loadOrganizationResolutionSnapshot,
  loadParticipantOverlays,
} from "@/lib/participant-intelligence-server";
import { buildBrowserApplicationPayloadFromPublicationV2 } from "@/lib/registry-application-payload-v2";
import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import type { ContentionMembershipSnapshotV1 } from "@/reveal-day-2026/contention-membership-types";
import type { Registry2026PublicationV2 } from "@/reveal-day-2026/publication-v2-types";

const WORKSPACE = process.cwd();
const PUBLICATION_PATH = join(WORKSPACE, ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json");
const CONTENTION_PATH = join(WORKSPACE, ".data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json");

async function loadLiveDocument(): Promise<RegistryApplicationsDocumentV2> {
  const publication = JSON.parse(await readFile(PUBLICATION_PATH, "utf8")) as Registry2026PublicationV2;
  const contention = JSON.parse(await readFile(CONTENTION_PATH, "utf8")) as ContentionMembershipSnapshotV1;
  return buildBrowserApplicationPayloadFromPublicationV2(publication, { contention });
}

describe("organization profile routing", () => {
  it("uses canonical Organization key for shareable URLs", () => {
    expect(organizationProfileHref("identity-digital")).toBe("/organization?key=identity-digital");
    expect(decodeOrganizationProfileKey("identity-digital")).toBe("identity-digital");
    expect(decodeOrganizationProfileKey(encodeURIComponent("hist-2012-microsoft"))).toBe(
      "hist-2012-microsoft",
    );
  });

  it("rejects unknown and non-Confirmed keys", async () => {
    const [document, overlays, snapshot] = await Promise.all([
      loadLiveDocument(),
      loadParticipantOverlays(WORKSPACE),
      loadOrganizationResolutionSnapshot(WORKSPACE),
    ]);
    const rsp = loadEvaluatedMainRspArtifact();
    const unknown = buildOrganizationIntelligenceProfile(document, overlays, rsp, snapshot, "no-such-org");
    expect(unknown.found).toBe(false);
    if (!unknown.found) expect(unknown.reason).toBe("unknown");

    const candidate = snapshot.organizations.find((o) => o.status === "CANDIDATE");
    expect(candidate).toBeTruthy();
    const notConfirmed = buildOrganizationIntelligenceProfile(
      document,
      overlays,
      rsp,
      snapshot,
      candidate!.organizationKey,
    );
    expect(notConfirmed.found).toBe(false);
    if (!notConfirmed.found) expect(notConfirmed.reason).toBe("not-confirmed");
  });
});

describe("organization profile derivation (live)", () => {
  it("Identity Digital — 28 Applicants / 216 Applications / 157 contention memberships", async () => {
    const [document, overlays, snapshot] = await Promise.all([
      loadLiveDocument(),
      loadParticipantOverlays(WORKSPACE),
      loadOrganizationResolutionSnapshot(WORKSPACE),
    ]);
    const profile = buildOrganizationIntelligenceProfile(
      document,
      overlays,
      loadEvaluatedMainRspArtifact(),
      snapshot,
      "identity-digital",
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;
    expect(profile.canonicalName).toBe("Identity Digital");
    expect(profile.applicantEntityCount).toBe(28);
    expect(profile.applicationCount).toBe(216);
    expect(profile.contentionMemberships).toBe(157);
    expect(profile.applicants.map((a) => a.applicantLegalName)).toContain("Hair Apparent, LLC");
    expect(profile.applicants.map((a) => a.applicantLegalName)).toContain("Paws Button, LLC");
    expect(profile.applicants).toHaveLength(28);
    expect(profile.portfolio.every((p) => p.applicantLegalName.length > 0)).toBe(true);
    expect(profile.portfolio.some((p) => p.applicantLegalName === "Hair Apparent, LLC")).toBe(true);
    expect(profile.applicants.find((a) => a.applicantLegalName === "Hair Apparent, LLC")?.profileHref).toContain(
      "/applicant?name=",
    );
  });

  it("Namecheap — 20 Applicant entities with portfolio aggregation", async () => {
    const [document, overlays, snapshot] = await Promise.all([
      loadLiveDocument(),
      loadParticipantOverlays(WORKSPACE),
      loadOrganizationResolutionSnapshot(WORKSPACE),
    ]);
    const profile = buildOrganizationIntelligenceProfile(
      document,
      overlays,
      loadEvaluatedMainRspArtifact(),
      snapshot,
      "namecheap",
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;
    expect(profile.canonicalName).toBe("Namecheap");
    expect(profile.applicantEntityCount).toBe(20);
    expect(profile.applicationCount).toBe(40);
    expect(profile.applicants).toHaveLength(20);
    expect(profile.portfolio.every((p) => p.applicantLegalName.includes("Exploration"))).toBe(true);
  });

  it("Salesforce — single-Applicant Organization with Brand portfolio", async () => {
    const [document, overlays, snapshot] = await Promise.all([
      loadLiveDocument(),
      loadParticipantOverlays(WORKSPACE),
      loadOrganizationResolutionSnapshot(WORKSPACE),
    ]);
    const profile = buildOrganizationIntelligenceProfile(
      document,
      overlays,
      loadEvaluatedMainRspArtifact(),
      snapshot,
      "salesforce",
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;
    expect(profile.applicantEntityCount).toBe(1);
    expect(profile.applicants[0]?.applicantLegalName).toBe("Salesforce, Inc.");
    expect(profile.applicationCount).toBe(4);
    expect(profile.brandApplicationCount).toBe(4);
    expect(profile.portfolio.map((p) => p.appliedForString).sort()).toEqual([
      "force",
      "salesforce",
      "slack",
      "tableau",
    ]);
  });

  it("Anthropic — Brand Applicant Organization", async () => {
    const [document, overlays, snapshot] = await Promise.all([
      loadLiveDocument(),
      loadParticipantOverlays(WORKSPACE),
      loadOrganizationResolutionSnapshot(WORKSPACE),
    ]);
    const profile = buildOrganizationIntelligenceProfile(
      document,
      overlays,
      loadEvaluatedMainRspArtifact(),
      snapshot,
      "anthropic",
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;
    expect(profile.canonicalName).toBe("Anthropic");
    expect(profile.applicationCount).toBe(2);
    expect(profile.brandApplicationCount).toBe(2);
  });

  it("Microsoft returning — 11 → 2 (−9)", async () => {
    const [document, overlays, snapshot] = await Promise.all([
      loadLiveDocument(),
      loadParticipantOverlays(WORKSPACE),
      loadOrganizationResolutionSnapshot(WORKSPACE),
    ]);
    const profile = buildOrganizationIntelligenceProfile(
      document,
      overlays,
      loadEvaluatedMainRspArtifact(),
      snapshot,
      "hist-2012-microsoft",
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;
    expect(profile.confirmedReturning).toEqual({
      applications2012: 11,
      applications2026: 2,
      applicationDelta: -9,
      portfolioChange: "CONTRACTED",
    });
    expect(profile.applicationCount).toBe(2);
  });

  it("Google returning — 101 → 39 (−62)", async () => {
    const [document, overlays, snapshot] = await Promise.all([
      loadLiveDocument(),
      loadParticipantOverlays(WORKSPACE),
      loadOrganizationResolutionSnapshot(WORKSPACE),
    ]);
    const profile = buildOrganizationIntelligenceProfile(
      document,
      overlays,
      loadEvaluatedMainRspArtifact(),
      snapshot,
      "hist-2012-google-charleston-road",
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;
    expect(profile.confirmedReturning).toEqual({
      applications2012: 101,
      applications2026: 39,
      applicationDelta: -62,
      portfolioChange: "CONTRACTED",
    });
    expect(profile.applicationCount).toBe(39);
    expect(profile.applicants[0]?.applicantLegalName).toBe("Charleston Road Registry Inc.");
  });

  it("is source-order independent for Identity Digital", async () => {
    const [document, overlays, snapshot] = await Promise.all([
      loadLiveDocument(),
      loadParticipantOverlays(WORKSPACE),
      loadOrganizationResolutionSnapshot(WORKSPACE),
    ]);
    const reversed = {
      ...document,
      applications: [...document.applications].reverse(),
    };
    const a = buildOrganizationIntelligenceProfile(
      document,
      overlays,
      loadEvaluatedMainRspArtifact(),
      snapshot,
      "identity-digital",
    );
    const b = buildOrganizationIntelligenceProfile(
      reversed,
      overlays,
      loadEvaluatedMainRspArtifact(),
      snapshot,
      "identity-digital",
    );
    expect(a.found && b.found).toBe(true);
    if (!a.found || !b.found) return;
    expect(a.applicants.map((x) => x.applicantLegalName)).toEqual(
      b.applicants.map((x) => x.applicantLegalName),
    );
    expect(a.portfolio.map((x) => x.applicationId)).toEqual(b.portfolio.map((x) => x.applicationId));
  });

  it("does not invent Organization-level RSP inference beyond mapped Applicant postures", async () => {
    const [document, overlays, snapshot] = await Promise.all([
      loadLiveDocument(),
      loadParticipantOverlays(WORKSPACE),
      loadOrganizationResolutionSnapshot(WORKSPACE),
    ]);
    const profile = buildOrganizationIntelligenceProfile(
      document,
      overlays,
      loadEvaluatedMainRspArtifact(),
      snapshot,
      "identity-digital",
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;
    expect(profile.rspAmongMappedApplicants.viaConfirmedOrganizationCount).toBe(0);
    expect(
      profile.rspAmongMappedApplicants.publicMainRspCapableCount +
        profile.rspAmongMappedApplicants.noPublicMainRspCount +
        profile.rspAmongMappedApplicants.viaConfirmedOrganizationCount +
        profile.rspAmongMappedApplicants.identityReviewCount,
    ).toBe(profile.applicantEntityCount);
  });

  it("GoDaddy Registry keeps 77 apps and surfaces NeuStar BUSINESS_LINE_SUCCESSION lineage", async () => {
    const [document, overlays, snapshot] = await Promise.all([
      loadLiveDocument(),
      loadParticipantOverlays(WORKSPACE),
      loadOrganizationResolutionSnapshot(WORKSPACE),
    ]);
    const profile = buildOrganizationIntelligenceProfile(
      document,
      overlays,
      loadEvaluatedMainRspArtifact(),
      snapshot,
      "godaddy-registry-services",
    );
    expect(profile.found).toBe(true);
    if (!profile.found) return;
    expect(profile.canonicalName).toBe("GoDaddy (Registry Services, LLC)");
    expect(profile.applicationCount).toBe(77);
    expect(profile.historicalLineages).toHaveLength(1);
    expect(profile.historicalLineages[0]?.historicalCanonicalName).toBe("NeuStar, Inc.");
    expect(profile.historicalLineages[0]?.relationshipType).toBe("BUSINESS_LINE_SUCCESSION");
    expect(profile.historicalLineages[0]?.relationshipType).not.toBe("SAME_ENTITY_RENAME");
  });
});
