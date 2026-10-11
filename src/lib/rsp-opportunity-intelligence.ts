/**
 * RSP opportunity intelligence (RSP-INTEL-1).
 * Public-signal prospecting enrichment over Applicant participant rows.
 * Does not infer selected RSP or commercial availability.
 */

import {
  findEvaluatedRspByLegalName,
  isSuccessfullyCleared,
  loadEvaluatedMainRspArtifact,
  normalizeExactIdentityName,
  type EvaluatedMainRspArtifact,
  type EvaluatedRspRecord,
  type RspCapability,
} from "@/lib/icann-evaluated-rsp";
import {
  GODADDY_FOCAL_APPLICANT_LEGAL_NAME,
  type OrganizationResolutionOverlayStatus,
  type ParticipantIntelligence,
  type ParticipantRow,
} from "@/lib/participant-intelligence";

export type EvaluatedMainRspMatchBasis =
  | "EXACT_LEGAL_NAME"
  | "EXACT_OFFICIAL_DBA"
  | "CONFIRMED_ORGANIZATION"
  | "NONE";

export type EvaluatedMainRspStatus = "CLEARED" | "NOT_MATCHED";

export type RspProspectingPosture =
  | "GODADDY_OWN_APPLICANT_PORTFOLIO"
  | "NO_PUBLIC_MAIN_RSP_CAPABILITY_FOUND"
  | "PUBLIC_MAIN_RSP_CAPABILITY_FOUND"
  | "MAIN_RSP_CAPABILITY_VIA_CONFIRMED_ORGANIZATION"
  | "IDENTITY_REVIEW_NEEDED";

export type EvaluatedRspCapabilitiesSummary = {
  main: boolean;
  dns: boolean;
  dnssec: boolean;
  proxy: boolean;
  idnSupportLevel: number | string | null;
};

export type ApplicantRspPosture = {
  applicantLegalName: string;
  applicationCount: number;
  contestedApplications: number;
  contentionRate: number;
  contentionSetsTouched: number;
  region: string[];
  organizationMappingStatus: OrganizationResolutionOverlayStatus;
  confirmedOrganizationName: string | null;
  evaluatedMainRspStatus: EvaluatedMainRspStatus;
  evaluatedMainRspMatchBasis: EvaluatedMainRspMatchBasis;
  evaluatedRspLegalName: string | null;
  evaluatedRspDba: string | null;
  evaluatedRspCapabilities: EvaluatedRspCapabilitiesSummary | null;
  evaluatedRspRecordLastUpdated: string | null;
  godaddyOwnApplicant: boolean;
  rspProspectingPosture: RspProspectingPosture;
  rspProspectingReason: string;
};

export type RspOpportunityCoverage = {
  observedApplicants: number;
  godaddyExcluded: number;
  externalApplicants: number;
  noPublicMainRspCapability: number;
  publicMainRspCapable: number;
  viaConfirmedOrganization: number;
  identityReview: number;
  sourceLastUpdated: string;
  sourceUrl: string;
  sourcePublisher: string;
  mainSuccessfullyClearedRspCount: number;
};

export type GodaddyRspRole = {
  applicantLegalName: string;
  rspLegalName: string;
  doingBusinessAs: string | null;
  countryCode: string | null;
  mainCleared: boolean;
  dnsCleared: boolean;
  dnssecCleared: boolean;
  proxyCleared: boolean;
  idnSupportLevel: number | string | null;
  recordLastUpdated: string | null;
  matchBasis: EvaluatedMainRspMatchBasis;
  applicationCount: number;
  contestedApplications: number;
  rankByApplications: number;
};

export type RspOpportunityIntelligence = {
  coverage: RspOpportunityCoverage;
  godaddyRsp: GodaddyRspRole | null;
  postures: ApplicantRspPosture[];
  /** External prospect universe (excludes GoDaddy own Applicant), default-ranked. */
  prospects: ApplicantRspPosture[];
};

function capabilitySummary(record: EvaluatedRspRecord): EvaluatedRspCapabilitiesSummary {
  return {
    main: isSuccessfullyCleared(record.main),
    dns: isSuccessfullyCleared(record.dns),
    dnssec: isSuccessfullyCleared(record.dnssec),
    proxy: isSuccessfullyCleared(record.proxy),
    idnSupportLevel: record.idnSupportLevel,
  };
}

function buildDbaIndex(records: EvaluatedRspRecord[]): Map<string, EvaluatedRspRecord[]> {
  const map = new Map<string, EvaluatedRspRecord[]>();
  for (const r of records) {
    if (!r.doingBusinessAs) continue;
    const key = normalizeExactIdentityName(r.doingBusinessAs);
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  return map;
}

type MatchResult = {
  record: EvaluatedRspRecord;
  basis: Exclude<EvaluatedMainRspMatchBasis, "NONE">;
};

function matchApplicantToMainClearedRsp(
  applicant: ParticipantRow,
  byLegal: Map<string, EvaluatedRspRecord>,
  byDba: Map<string, EvaluatedRspRecord[]>,
  mainClearedOrgIds: Set<string>,
  mainClearedOrgNames: Set<string>,
): MatchResult | null {
  const legalKey = normalizeExactIdentityName(applicant.applicantLegalName);
  const legalHit = byLegal.get(legalKey);
  if (legalHit && isSuccessfullyCleared(legalHit.main)) {
    return { record: legalHit, basis: "EXACT_LEGAL_NAME" };
  }

  const dbaHits = byDba.get(legalKey) ?? [];
  const dbaCleared = dbaHits.filter((r) => isSuccessfullyCleared(r.main));
  if (dbaCleared.length === 1) {
    return { record: dbaCleared[0], basis: "EXACT_OFFICIAL_DBA" };
  }

  // Confirmed Organization path only — never Candidate/Ambiguous.
  if (applicant.organizationResolutionStatus === "CONFIRMED") {
    const orgId = applicant.confirmedOrganizationId;
    const orgName = applicant.confirmedOrganizationName;
    const viaId = orgId && mainClearedOrgIds.has(orgId);
    const viaName =
      orgName && mainClearedOrgNames.has(normalizeExactIdentityName(orgName));
    if (viaId || viaName) {
      // Prefer the RSP record that shares the confirmed org via an exact Applicant match
      // already indexed; fall back to name/DBA equality against the confirmed org name.
      let record: EvaluatedRspRecord | null = null;
      if (orgName) {
        const orgKey = normalizeExactIdentityName(orgName);
        record = byLegal.get(orgKey) ?? null;
        if (!record) {
          const dba = (byDba.get(orgKey) ?? []).filter((r) => isSuccessfullyCleared(r.main));
          if (dba.length === 1) record = dba[0];
        }
      }
      // If org name is a brand (e.g. "GoDaddy") rather than RSP legal name, find any
      // Main-cleared RSP already linked through another Applicant under same org id
      // by scanning byLegal values that were seeds — handled via seed map below.
      if (!record && orgId) {
        // Seed records stored under synthetic key in byLegal aren't available;
        // caller supplies seedViaOrg map separately — see build below.
      }
      if (record && isSuccessfullyCleared(record.main)) {
        return { record, basis: "CONFIRMED_ORGANIZATION" };
      }
    }
  }

  return null;
}

function postureFor(
  applicant: ParticipantRow,
  match: MatchResult | null,
  seedRspByOrgId: Map<string, EvaluatedRspRecord>,
): ApplicantRspPosture {
  const godaddyOwn = applicant.applicantLegalName === GODADDY_FOCAL_APPLICANT_LEGAL_NAME;

  let resolvedMatch = match;
  if (
    !resolvedMatch &&
    applicant.organizationResolutionStatus === "CONFIRMED" &&
    applicant.confirmedOrganizationId &&
    seedRspByOrgId.has(applicant.confirmedOrganizationId)
  ) {
    const record = seedRspByOrgId.get(applicant.confirmedOrganizationId)!;
    if (isSuccessfullyCleared(record.main)) {
      resolvedMatch = { record, basis: "CONFIRMED_ORGANIZATION" };
    }
  }

  let evaluatedMainRspStatus: EvaluatedMainRspStatus = "NOT_MATCHED";
  let basis: EvaluatedMainRspMatchBasis = "NONE";
  let rsp: EvaluatedRspRecord | null = null;

  if (resolvedMatch) {
    evaluatedMainRspStatus = "CLEARED";
    basis = resolvedMatch.basis;
    rsp = resolvedMatch.record;
  }

  let rspProspectingPosture: RspProspectingPosture;
  let rspProspectingReason: string;

  if (godaddyOwn) {
    rspProspectingPosture = "GODADDY_OWN_APPLICANT_PORTFOLIO";
    rspProspectingReason =
      "Registry Services, LLC applications are GoDaddy's own Applicant / prospective Registry Operator portfolio — excluded from the external RSP research universe.";
  } else if (evaluatedMainRspStatus === "CLEARED" && basis === "CONFIRMED_ORGANIZATION") {
    rspProspectingPosture = "MAIN_RSP_CAPABILITY_VIA_CONFIRMED_ORGANIZATION";
    rspProspectingReason = `Confirmed Organization mapping links this Applicant to evaluated Main-RSP identity ${rsp!.rspLegalName}. Public APS data still does not disclose which RSP the Applicant selected.`;
  } else if (evaluatedMainRspStatus === "CLEARED") {
    rspProspectingPosture = "PUBLIC_MAIN_RSP_CAPABILITY_FOUND";
    rspProspectingReason = `Public ICANN evaluated-RSP list matches this Applicant (${basis.replaceAll("_", " ").toLowerCase()}) with Main successfully cleared. The Applicant may self-provide, use an affiliate, or choose another provider — selected RSP is not public.`;
  } else {
    rspProspectingPosture = "NO_PUBLIC_MAIN_RSP_CAPABILITY_FOUND";
    rspProspectingReason =
      "RIH found no public evaluated Main-RSP capability for this Applicant under current evidence and matching rules. Public posture is factual only — selected RSP and contract openness are unknown.";
  }

  return {
    applicantLegalName: applicant.applicantLegalName,
    applicationCount: applicant.applicationCount,
    contestedApplications: applicant.contestedApplicationCount,
    contentionRate: applicant.contentionRate,
    contentionSetsTouched: applicant.officialContentionSetsTouched,
    region: applicant.regions,
    organizationMappingStatus: applicant.organizationResolutionStatus,
    confirmedOrganizationName: applicant.confirmedOrganizationName,
    evaluatedMainRspStatus,
    evaluatedMainRspMatchBasis: basis,
    evaluatedRspLegalName: rsp?.rspLegalName ?? null,
    evaluatedRspDba: rsp?.doingBusinessAs ?? null,
    evaluatedRspCapabilities: rsp ? capabilitySummary(rsp) : null,
    evaluatedRspRecordLastUpdated: rsp?.recordLastUpdated ?? null,
    godaddyOwnApplicant: godaddyOwn,
    rspProspectingPosture,
    rspProspectingReason,
  };
}

function postureRank(p: RspProspectingPosture): number {
  switch (p) {
    case "NO_PUBLIC_MAIN_RSP_CAPABILITY_FOUND":
      return 0;
    case "IDENTITY_REVIEW_NEEDED":
      return 1;
    case "MAIN_RSP_CAPABILITY_VIA_CONFIRMED_ORGANIZATION":
      return 2;
    case "PUBLIC_MAIN_RSP_CAPABILITY_FOUND":
      return 3;
    case "GODADDY_OWN_APPLICANT_PORTFOLIO":
      return 4;
    default:
      return 9;
  }
}

export function sortProspectsDefault(a: ApplicantRspPosture, b: ApplicantRspPosture): number {
  return (
    postureRank(a.rspProspectingPosture) - postureRank(b.rspProspectingPosture) ||
    b.applicationCount - a.applicationCount ||
    b.contestedApplications - a.contestedApplications ||
    a.applicantLegalName.localeCompare(b.applicantLegalName)
  );
}

export type RspProspectFilter = {
  q?: string;
  posture?: RspProspectingPosture | "";
  mainRspSignal?: "all" | "none" | "evaluated" | "via-org";
  region?: string;
  hasOfficialContention?: boolean;
  organizationMapping?: "CONFIRMED" | "CANDIDATE" | "AMBIGUOUS" | "UNRESOLVED" | "";
};

export function filterProspects(
  prospects: ApplicantRspPosture[],
  filter: RspProspectFilter = {},
): ApplicantRspPosture[] {
  const q = filter.q?.trim().toLowerCase() ?? "";
  return prospects.filter((p) => {
    if (q && !p.applicantLegalName.toLowerCase().includes(q)) return false;
    if (filter.posture && p.rspProspectingPosture !== filter.posture) return false;
    if (filter.region && !p.region.includes(filter.region)) return false;
    if (filter.hasOfficialContention && p.contestedApplications === 0) return false;
    if (filter.organizationMapping && p.organizationMappingStatus !== filter.organizationMapping) {
      return false;
    }
    if (filter.mainRspSignal === "none" && p.evaluatedMainRspStatus !== "NOT_MATCHED") return false;
    if (filter.mainRspSignal === "evaluated" && p.rspProspectingPosture !== "PUBLIC_MAIN_RSP_CAPABILITY_FOUND") {
      return false;
    }
    if (
      filter.mainRspSignal === "via-org" &&
      p.rspProspectingPosture !== "MAIN_RSP_CAPABILITY_VIA_CONFIRMED_ORGANIZATION"
    ) {
      return false;
    }
    return true;
  });
}

export function buildRspOpportunityIntelligence(
  participantIntel: ParticipantIntelligence,
  artifact: EvaluatedMainRspArtifact = loadEvaluatedMainRspArtifact(),
): RspOpportunityIntelligence {
  const records = artifact.records;
  const byLegal = new Map<string, EvaluatedRspRecord>();
  for (const r of records) {
    byLegal.set(normalizeExactIdentityName(r.rspLegalName), r);
  }
  const byDba = buildDbaIndex(records);

  // Seed confirmed orgs that include an Applicant with exact Main-cleared RSP match.
  const seedRspByOrgId = new Map<string, EvaluatedRspRecord>();
  const mainClearedOrgIds = new Set<string>();
  const mainClearedOrgNames = new Set<string>();

  for (const row of participantIntel.participants) {
    const legalKey = normalizeExactIdentityName(row.applicantLegalName);
    const legalHit = byLegal.get(legalKey);
    const dbaHits = (byDba.get(legalKey) ?? []).filter((r) => isSuccessfullyCleared(r.main));
    const seed =
      legalHit && isSuccessfullyCleared(legalHit.main)
        ? legalHit
        : dbaHits.length === 1
          ? dbaHits[0]
          : null;
    if (!seed) continue;
    if (row.organizationResolutionStatus === "CONFIRMED") {
      if (row.confirmedOrganizationId) {
        seedRspByOrgId.set(row.confirmedOrganizationId, seed);
        mainClearedOrgIds.add(row.confirmedOrganizationId);
      }
      if (row.confirmedOrganizationName) {
        mainClearedOrgNames.add(normalizeExactIdentityName(row.confirmedOrganizationName));
      }
    }
  }

  // Also allow confirmed org name to equal RSP legal name or unambiguous DBA.
  for (const r of records) {
    if (!isSuccessfullyCleared(r.main)) continue;
    mainClearedOrgNames.add(normalizeExactIdentityName(r.rspLegalName));
    if (r.doingBusinessAs) {
      // Only when DBA is unique among Main-cleared RSPs
      const peers = (byDba.get(normalizeExactIdentityName(r.doingBusinessAs)) ?? []).filter((x) =>
        isSuccessfullyCleared(x.main),
      );
      if (peers.length === 1) {
        mainClearedOrgNames.add(normalizeExactIdentityName(r.doingBusinessAs));
      }
    }
  }

  const postures = participantIntel.participants.map((row) => {
    const match = matchApplicantToMainClearedRsp(
      row,
      byLegal,
      byDba,
      mainClearedOrgIds,
      mainClearedOrgNames,
    );
    return postureFor(row, match, seedRspByOrgId);
  });

  const prospects = postures
    .filter((p) => !p.godaddyOwnApplicant)
    .sort(sortProspectsDefault);

  const godaddyParticipant = participantIntel.focal?.row ?? null;
  const godaddyRspRecord = findEvaluatedRspByLegalName(records, GODADDY_FOCAL_APPLICANT_LEGAL_NAME);
  const godaddyPosture = postures.find((p) => p.godaddyOwnApplicant) ?? null;

  const godaddyRsp: GodaddyRspRole | null =
    godaddyRspRecord && godaddyParticipant
      ? {
          applicantLegalName: GODADDY_FOCAL_APPLICANT_LEGAL_NAME,
          rspLegalName: godaddyRspRecord.rspLegalName,
          doingBusinessAs: godaddyRspRecord.doingBusinessAs,
          countryCode: godaddyRspRecord.countryCode,
          mainCleared: isSuccessfullyCleared(godaddyRspRecord.main),
          dnsCleared: isSuccessfullyCleared(godaddyRspRecord.dns),
          dnssecCleared: isSuccessfullyCleared(godaddyRspRecord.dnssec),
          proxyCleared: isSuccessfullyCleared(godaddyRspRecord.proxy),
          idnSupportLevel: godaddyRspRecord.idnSupportLevel,
          recordLastUpdated: godaddyRspRecord.recordLastUpdated,
          matchBasis: godaddyPosture?.evaluatedMainRspMatchBasis ?? "EXACT_LEGAL_NAME",
          applicationCount: godaddyParticipant.applicationCount,
          contestedApplications: godaddyParticipant.contestedApplicationCount,
          rankByApplications: godaddyParticipant.rankByApplications,
        }
      : null;

  return {
    coverage: {
      observedApplicants: postures.length,
      godaddyExcluded: postures.filter((p) => p.godaddyOwnApplicant).length,
      externalApplicants: prospects.length,
      noPublicMainRspCapability: prospects.filter(
        (p) => p.rspProspectingPosture === "NO_PUBLIC_MAIN_RSP_CAPABILITY_FOUND",
      ).length,
      publicMainRspCapable: prospects.filter(
        (p) => p.rspProspectingPosture === "PUBLIC_MAIN_RSP_CAPABILITY_FOUND",
      ).length,
      viaConfirmedOrganization: prospects.filter(
        (p) => p.rspProspectingPosture === "MAIN_RSP_CAPABILITY_VIA_CONFIRMED_ORGANIZATION",
      ).length,
      identityReview: prospects.filter((p) => p.rspProspectingPosture === "IDENTITY_REVIEW_NEEDED")
        .length,
      sourceLastUpdated: artifact.source.sourceLastUpdated,
      sourceUrl: artifact.source.url,
      sourcePublisher: artifact.source.publisher,
      mainSuccessfullyClearedRspCount: artifact.counts.mainSuccessfullyCleared,
    },
    godaddyRsp,
    postures,
    prospects,
  };
}

/** Business-facing Organization mapping labels (ORG UX). */
export function organizationMappingLabel(
  status: OrganizationResolutionOverlayStatus,
  confirmedName: string | null,
): string {
  switch (status) {
    case "CONFIRMED":
      return confirmedName ? `Confirmed · ${confirmedName}` : "Confirmed organization";
    case "CANDIDATE":
      return "Candidate organization";
    case "AMBIGUOUS":
      return "Ambiguous organization";
    case "UNRESOLVED":
    default:
      return "No organization mapping";
  }
}

export function prospectingPostureLabel(posture: RspProspectingPosture): string {
  switch (posture) {
    case "GODADDY_OWN_APPLICANT_PORTFOLIO":
      return "GoDaddy own Applicant portfolio";
    case "NO_PUBLIC_MAIN_RSP_CAPABILITY_FOUND":
      return "No public Main-RSP capability found";
    case "PUBLIC_MAIN_RSP_CAPABILITY_FOUND":
      return "Public Main-RSP capability found";
    case "MAIN_RSP_CAPABILITY_VIA_CONFIRMED_ORGANIZATION":
      return "Main-RSP capability via confirmed organization";
    case "IDENTITY_REVIEW_NEEDED":
      return "Identity review needed";
    default:
      return posture;
  }
}

export function mainRspSignalLabel(posture: ApplicantRspPosture): string {
  switch (posture.rspProspectingPosture) {
    case "PUBLIC_MAIN_RSP_CAPABILITY_FOUND":
      return "Evaluated Main RSP";
    case "MAIN_RSP_CAPABILITY_VIA_CONFIRMED_ORGANIZATION":
      return "Via confirmed organization";
    case "GODADDY_OWN_APPLICANT_PORTFOLIO":
      return posture.evaluatedMainRspStatus === "CLEARED" ? "Evaluated Main RSP" : "No public Main-RSP match";
    default:
      return "No public Main-RSP match";
  }
}

/** Forbidden commercial-availability / selected-RSP phrases for regression guards. */
export const FORBIDDEN_RSP_CLAIM_PHRASES = [
  "available opportunity",
  "unassigned rsp",
  "no rsp selected",
  "needs an rsp",
  "needs a rsp",
  "available customer",
  "open customer",
  "competitor customer",
  "potential rsp prospect",
] as const;

export function assertNoForbiddenRspClaims(text: string): void {
  const lower = text.toLowerCase();
  for (const phrase of FORBIDDEN_RSP_CLAIM_PHRASES) {
    if (lower.includes(phrase)) {
      throw new Error(`Forbidden RSP claim phrase present: ${phrase}`);
    }
  }
}

export function clearedCapabilityLabel(cleared: boolean): string {
  return cleared ? "Evaluated" : "Not evaluated";
}

export type { RspCapability };
