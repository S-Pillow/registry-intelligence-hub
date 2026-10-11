import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { EvaluatedMainRspArtifact } from "@/lib/icann-evaluated-rsp";
import { loadEvaluatedMainRspArtifact } from "@/lib/icann-evaluated-rsp";
import { buildBrowserApplicationPayloadFromPublicationV2 } from "@/lib/registry-application-payload-v2";
import {
  GODADDY_FOCAL_APPLICANT_LEGAL_NAME,
  buildParticipantIntelligence,
  type ParticipantIntelligence,
  type ParticipantOverlays,
  type ParticipantRow,
} from "@/lib/participant-intelligence";
import { loadParticipantOverlays } from "@/lib/participant-intelligence-server";
import type { ContentionMembershipSnapshotV1 } from "@/reveal-day-2026/contention-membership-types";
import type { Registry2026PublicationV2 } from "@/reveal-day-2026/publication-v2-types";
import {
  FORBIDDEN_RSP_CLAIM_PHRASES,
  assertNoForbiddenRspClaims,
  buildRspOpportunityIntelligence,
  filterProspects,
  organizationMappingLabel,
  prospectingPostureLabel,
  sortProspectsDefault,
} from "@/lib/rsp-opportunity-intelligence";

function cleared() {
  return { status: "SUCCESSFULLY_CLEARED" as const, rawText: "Successfully cleared RSP evaluation" };
}
function blank() {
  return { status: "BLANK" as const, rawText: "" };
}

function row(
  name: string,
  apps: number,
  opts?: Partial<ParticipantRow>,
): ParticipantRow {
  return {
    applicantLegalName: name,
    applicationCount: apps,
    shareOfObservedApplications: 0,
    contestedApplicationCount: opts?.contestedApplicationCount ?? 0,
    officialContentionMemberships: opts?.officialContentionMemberships ?? 0,
    officialContentionSetsTouched: opts?.officialContentionSetsTouched ?? 0,
    contentionRate: apps === 0 ? 0 : (opts?.contestedApplicationCount ?? 0) / apps,
    regions: opts?.regions ?? ["NA"],
    countries: ["US"],
    designationCounts: { idn: 0, brand: 0, community: 0, geographic: 0 },
    applicationIds: Array.from({ length: apps }, (_, i) => `${name}-${i}`),
    organizationResolutionStatus: opts?.organizationResolutionStatus ?? "UNRESOLVED",
    confirmedOrganizationId: opts?.confirmedOrganizationId ?? null,
    confirmedOrganizationName: opts?.confirmedOrganizationName ?? null,
    identityEvidence: opts?.identityEvidence ?? null,
    confirmedReturning: null,
    rankByApplications: 1,
    rankByContentionExposure: 1,
  };
}

function intel(participants: ParticipantRow[]): ParticipantIntelligence {
  const focal = participants.find((p) => p.applicantLegalName === GODADDY_FOCAL_APPLICANT_LEGAL_NAME) ?? null;
  return {
    coverage: {
      officialApplications: 1615,
      officialApplicants: 481,
      observedApplications: participants.reduce((n, p) => n + p.applicationCount, 0),
      observedApplicantLegalNames: participants.length,
      officialContentionSets: 0,
      officialContentionMemberships: 0,
      knownExcludedRecordIds: [],
      confirmedOrganizationMappings: participants.filter((p) => p.organizationResolutionStatus === "CONFIRMED")
        .length,
    },
    participants,
    focalApplicantLegalName: GODADDY_FOCAL_APPLICANT_LEGAL_NAME,
    focal: focal
      ? {
          applicantLegalName: GODADDY_FOCAL_APPLICANT_LEGAL_NAME,
          row: focal,
          rankByApplications: focal.rankByApplications,
          rankByContentionExposure: focal.rankByContentionExposure,
        }
      : null,
    contentionCounterparts: [],
  };
}

const artifact: EvaluatedMainRspArtifact = {
  schemaVersion: "icann-evaluated-main-rsp/1.0.0",
  source: {
    publisher: "ICANN",
    title: "List of Evaluated MAIN, DNS, DNSSEC, PROXY, and IDN Support Level Applications",
    url: "https://example.test/rsp-applications.html",
    sourceLastUpdated: "2026-10-06",
    retrievedAt: "2026-10-10T12:00:00Z",
    contentSha256: "b".repeat(64),
    contentBytes: 1,
  },
  records: [
    {
      rspLegalName: "Registry Services, LLC",
      doingBusinessAs: "GoDaddy Registry",
      countryCode: "US",
      businessUrl: "https://registry.godaddy/",
      recordLastUpdated: "2026-04-06",
      main: cleared(),
      dnssec: cleared(),
      dns: cleared(),
      proxy: blank(),
      idnSupportLevel: 2,
    },
    {
      rspLegalName: "Charleston Road Registry Inc.",
      doingBusinessAs: "Google Registry",
      countryCode: "US",
      businessUrl: "https://registry.google",
      recordLastUpdated: "2026-01-28",
      main: cleared(),
      dnssec: cleared(),
      dns: cleared(),
      proxy: blank(),
      idnSupportLevel: 1,
    },
    {
      rspLegalName: "Pending Only RSP LLC",
      doingBusinessAs: "PendingOnly",
      countryCode: "US",
      businessUrl: null,
      recordLastUpdated: "2026-01-01",
      main: { status: "NOT_CLEARED", rawText: "Technical screening: cleared/Technical testing: in-progress" },
      dnssec: blank(),
      dns: blank(),
      proxy: blank(),
      idnSupportLevel: null,
    },
  ],
  counts: {
    records: 3,
    mainSuccessfullyCleared: 2,
    dnsSuccessfullyCleared: 2,
    dnssecSuccessfullyCleared: 2,
    proxySuccessfullyCleared: 0,
  },
};

describe("RSP opportunity intelligence", () => {
  const participants = [
    row(GODADDY_FOCAL_APPLICANT_LEGAL_NAME, 77, {
      contestedApplicationCount: 66,
      organizationResolutionStatus: "CONFIRMED",
      confirmedOrganizationId: "org-godaddy",
      confirmedOrganizationName: "GoDaddy (Registry Services, LLC)",
      rankByApplications: 3,
    }),
    row("Charleston Road Registry Inc.", 39, {
      contestedApplicationCount: 13,
      organizationResolutionStatus: "CONFIRMED",
      confirmedOrganizationId: "org-google",
      confirmedOrganizationName: "Google (Charleston Road Registry Inc.)",
    }),
    row("Affiliate Under Google LLC", 5, {
      contestedApplicationCount: 1,
      organizationResolutionStatus: "CONFIRMED",
      confirmedOrganizationId: "org-google",
      confirmedOrganizationName: "Google (Charleston Road Registry Inc.)",
    }),
    row("Large Prospect Inc", 100, {
      contestedApplicationCount: 40,
      organizationResolutionStatus: "UNRESOLVED",
    }),
    row("Candidate Only Ltd", 20, {
      organizationResolutionStatus: "CANDIDATE",
    }),
    row("Ambiguous Corp", 10, {
      organizationResolutionStatus: "AMBIGUOUS",
    }),
    row("Pending Only RSP LLC", 3, {
      organizationResolutionStatus: "UNRESOLVED",
    }),
  ];

  const built = buildRspOpportunityIntelligence(intel(participants), artifact);

  it("excludes Registry Services from external-prospect universe and keeps others", () => {
    expect(built.coverage.observedApplicants).toBe(7);
    expect(built.coverage.godaddyExcluded).toBe(1);
    expect(built.coverage.externalApplicants).toBe(6);
    expect(built.prospects.every((p) => p.applicantLegalName !== GODADDY_FOCAL_APPLICANT_LEGAL_NAME)).toBe(
      true,
    );
  });

  it("matches GoDaddy exact RSP + Applicant role facts", () => {
    expect(built.godaddyRsp).not.toBeNull();
    expect(built.godaddyRsp!.rspLegalName).toBe("Registry Services, LLC");
    expect(built.godaddyRsp!.doingBusinessAs).toBe("GoDaddy Registry");
    expect(built.godaddyRsp!.mainCleared).toBe(true);
    expect(built.godaddyRsp!.dnsCleared).toBe(true);
    expect(built.godaddyRsp!.dnssecCleared).toBe(true);
    expect(built.godaddyRsp!.proxyCleared).toBe(false);
    expect(built.godaddyRsp!.idnSupportLevel).toBe(2);
    expect(built.godaddyRsp!.applicationCount).toBe(77);
    expect(built.godaddyRsp!.matchBasis).toBe("EXACT_LEGAL_NAME");
    const own = built.postures.find((p) => p.godaddyOwnApplicant)!;
    expect(own.rspProspectingPosture).toBe("GODADDY_OWN_APPLICANT_PORTFOLIO");
  });

  it("matches Charleston Road exact public RSP and keeps self-RSP visible", () => {
    const google = built.prospects.find((p) => p.applicantLegalName === "Charleston Road Registry Inc.")!;
    expect(google.rspProspectingPosture).toBe("PUBLIC_MAIN_RSP_CAPABILITY_FOUND");
    expect(google.evaluatedMainRspMatchBasis).toBe("EXACT_LEGAL_NAME");
    expect(google.evaluatedRspDba).toBe("Google Registry");
    expect(google.evaluatedRspCapabilities?.idnSupportLevel).toBe(1);
  });

  it("uses confirmed Organization for Main-RSP only with deterministic evidence; Candidate/Ambiguous cannot", () => {
    const affiliate = built.prospects.find((p) => p.applicantLegalName === "Affiliate Under Google LLC")!;
    expect(affiliate.rspProspectingPosture).toBe("MAIN_RSP_CAPABILITY_VIA_CONFIRMED_ORGANIZATION");
    expect(affiliate.evaluatedMainRspMatchBasis).toBe("CONFIRMED_ORGANIZATION");

    const candidate = built.prospects.find((p) => p.applicantLegalName === "Candidate Only Ltd")!;
    expect(candidate.rspProspectingPosture).toBe("NO_PUBLIC_MAIN_RSP_CAPABILITY_FOUND");
    expect(candidate.evaluatedMainRspStatus).toBe("NOT_MATCHED");

    const ambiguous = built.prospects.find((p) => p.applicantLegalName === "Ambiguous Corp")!;
    expect(ambiguous.rspProspectingPosture).toBe("NO_PUBLIC_MAIN_RSP_CAPABILITY_FOUND");
    expect(ambiguous.evaluatedMainRspStatus).toBe("NOT_MATCHED");
  });

  it("treats in-progress Main as no public Main-RSP capability found", () => {
    const pending = built.prospects.find((p) => p.applicantLegalName === "Pending Only RSP LLC")!;
    expect(pending.rspProspectingPosture).toBe("NO_PUBLIC_MAIN_RSP_CAPABILITY_FOUND");
    expect(pending.evaluatedMainRspStatus).toBe("NOT_MATCHED");
  });

  it("ranks no-public-Main-RSP rows first by application portfolio size", () => {
    const sorted = [...built.prospects].sort(sortProspectsDefault);
    expect(sorted[0].applicantLegalName).toBe("Large Prospect Inc");
    expect(sorted[0].rspProspectingPosture).toBe("NO_PUBLIC_MAIN_RSP_CAPABILITY_FOUND");
    expect(built.coverage.noPublicMainRspCapability).toBeGreaterThan(0);
  });

  it("never classifies a row as Potential RSP prospect", () => {
    for (const p of built.postures) {
      expect(String(p.rspProspectingPosture)).not.toBe("POTENTIAL_RSP_PROSPECT");
      expect(prospectingPostureLabel(p.rspProspectingPosture)).not.toMatch(/Potential RSP prospect/i);
      expect(prospectingPostureLabel(p.rspProspectingPosture)).not.toMatch(/available customer|unassigned/i);
    }
  });

  it("filters by Main-RSP signal and organization mapping", () => {
    const none = filterProspects(built.prospects, { mainRspSignal: "none" });
    expect(none.every((p) => p.evaluatedMainRspStatus === "NOT_MATCHED")).toBe(true);
    const evaluated = filterProspects(built.prospects, { mainRspSignal: "evaluated" });
    expect(evaluated.some((p) => p.applicantLegalName === "Charleston Road Registry Inc.")).toBe(true);
    const unresolved = filterProspects(built.prospects, { organizationMapping: "UNRESOLVED" });
    expect(unresolved.every((p) => p.organizationMappingStatus === "UNRESOLVED")).toBe(true);
  });

  it("exposes no availability / unassigned / selected-provider claims in reasons", () => {
    for (const p of built.postures) {
      assertNoForbiddenRspClaims(p.rspProspectingReason);
      assertNoForbiddenRspClaims(prospectingPostureLabel(p.rspProspectingPosture));
    }
    for (const phrase of FORBIDDEN_RSP_CLAIM_PHRASES) {
      expect(phrase.length).toBeGreaterThan(3);
    }
  });
});

describe("Organization mapping labels", () => {
  it("uses explicit business-facing labels", () => {
    expect(organizationMappingLabel("CONFIRMED", "GoDaddy")).toBe("Confirmed · GoDaddy");
    expect(organizationMappingLabel("CANDIDATE", null)).toBe("Candidate match");
    expect(organizationMappingLabel("AMBIGUOUS", null)).toBe("Identity ambiguous");
    expect(organizationMappingLabel("UNRESOLVED", null)).toBe("Not yet resolved");
  });

  it("does not present candidate/ambiguous as confirmed or unresolved as nonexistence", () => {
    expect(organizationMappingLabel("CANDIDATE", "Acme")).not.toMatch(/Confirmed/);
    expect(organizationMappingLabel("AMBIGUOUS", "Acme")).not.toMatch(/Confirmed/);
    expect(organizationMappingLabel("UNRESOLVED", null)).not.toMatch(/no organization exists/i);
    expect(organizationMappingLabel("UNRESOLVED", null)).not.toBe("No organization mapping");
  });
});

describe("RSP opportunity intelligence (live APS + tracked RSP source)", () => {
  it("preserves participant pins and derives GoDaddy/Google RSP postures", async () => {
    const workspace = process.cwd();
    const publication = JSON.parse(
      await readFile(join(workspace, ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json"), "utf8"),
    ) as Registry2026PublicationV2;
    const contention = JSON.parse(
      await readFile(join(workspace, ".data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json"), "utf8"),
    ) as ContentionMembershipSnapshotV1;
    const document = buildBrowserApplicationPayloadFromPublicationV2(publication, { contention });
    const overlays: ParticipantOverlays = await loadParticipantOverlays(workspace);
    const participants = buildParticipantIntelligence(document, overlays);
    const rsp = buildRspOpportunityIntelligence(participants, loadEvaluatedMainRspArtifact());

    expect(participants.coverage.observedApplicantLegalNames).toBe(480);
    expect(participants.coverage.observedApplications).toBe(1614);
    expect(participants.coverage.officialApplicants).toBe(481);
    expect(participants.coverage.officialApplications).toBe(1615);
    expect(rsp.coverage.observedApplicants).toBe(480);
    expect(rsp.coverage.godaddyExcluded).toBe(1);
    expect(rsp.coverage.externalApplicants).toBe(479);
    expect(
      rsp.coverage.noPublicMainRspCapability +
        rsp.coverage.publicMainRspCapable +
        rsp.coverage.viaConfirmedOrganization +
        rsp.coverage.identityReview,
    ).toBe(479);
    expect(rsp.coverage.noPublicMainRspCapability).toBe(476);

    expect(rsp.godaddyRsp?.applicationCount).toBe(77);
    expect(rsp.godaddyRsp?.contestedApplications).toBe(66);
    expect(rsp.godaddyRsp?.mainCleared).toBe(true);
    expect(rsp.godaddyRsp?.idnSupportLevel).toBe(2);
    expect(rsp.godaddyRsp?.doingBusinessAs).toBe("GoDaddy Registry");

    const charleston = rsp.prospects.find((p) => p.applicantLegalName === "Charleston Road Registry Inc.");
    expect(charleston?.rspProspectingPosture).toBe("PUBLIC_MAIN_RSP_CAPABILITY_FOUND");
    expect(charleston?.evaluatedRspDba).toBe("Google Registry");

    expect(rsp.prospects[0]?.rspProspectingPosture).toBe("NO_PUBLIC_MAIN_RSP_CAPABILITY_FOUND");
    expect(rsp.prospects[0]?.applicantLegalName).toBe("Link Freedom Group Ltd");
    expect(rsp.prospects.some((p) => p.applicantLegalName === GODADDY_FOCAL_APPLICANT_LEGAL_NAME)).toBe(false);
    expect(rsp.postures.every((p) => String(p.rspProspectingPosture) !== "POTENTIAL_RSP_PROSPECT")).toBe(
      true,
    );
    for (const p of rsp.postures) {
      assertNoForbiddenRspClaims(p.rspProspectingReason);
      assertNoForbiddenRspClaims(prospectingPostureLabel(p.rspProspectingPosture));
    }
  });
});
