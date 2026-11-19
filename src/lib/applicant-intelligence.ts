/**
 * Applicant Intelligence Profiles (APPLICANT-INTEL-1).
 * Derives a research profile from existing participant / org / contention / RSP overlays.
 * Applicant = exact ICANN legal name. Organization = optional evidence-backed enrichment.
 */

import type { BrowserApplicationV2, RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import {
  buildParticipantIntelligence,
  exploreApplicantApplicationsHref,
  exploreApplicantHref,
  type OrganizationResolutionOverlayStatus,
  type ParticipantIdentityEvidenceOverlay,
  type ParticipantOverlays,
  type ParticipantReturningOverlay,
  type ParticipantRow,
} from "@/lib/participant-intelligence";
import { organizationKeyFromOverlays, organizationProfileHref } from "@/lib/organization-intelligence";
import {
  buildRspOpportunityIntelligence,
  prospectingPostureLabel,
  type ApplicantRspPosture,
  type RspProspectingPosture,
} from "@/lib/rsp-opportunity-intelligence";
import type { EvaluatedMainRspArtifact } from "@/lib/icann-evaluated-rsp";
import { contentionSetHref } from "@/lib/contention-intelligence";

/** How the selected/current string was resolved from Application + optional `-R` evidence. */
export type ApplicantStringSelectionMode =
  | "original-only"
  | "kept-original-unselected-replacement"
  | "selected-replacement"
  | "unresolved";

/**
 * SCD contention classification for the selected string.
 * `uncontested_in_scd_capture` is only emitted when SCD contention evidence is ready —
 * never when the overlay is missing, stale, Reveal Day–pinned, or mismatched.
 */
export type ApplicantScdContentionStatus =
  | "contested"
  | "uncontested_in_scd_capture"
  | "n/a_withdrawn"
  | "unavailable"
  | "unresolved";

/** Official award/delegation is a separate evidence class from SCD uncontested. */
export type ApplicantOfficialAwardOutcome = "not_established" | "awarded";

export type ApplicantStringCompetitor = {
  applicationId: string;
  applicantLegalName: string;
  appliedForString: string;
};

export type ApplicantPortfolioRow = {
  applicationId: string;
  /** Original applied-for string (base Application label). */
  appliedForString: string;
  originalAppliedForString: string;
  selectedCurrentString: string;
  selectedReplacementApplicationId: string | null;
  replacementStringLabel: string | null;
  selectionMode: ApplicantStringSelectionMode;
  selectionUnresolvedReason: string | null;
  /** Status of the selected/current string (Active `-R` when selected replacement). */
  currentApplicationStatus: string | null;
  brand: boolean;
  community: boolean;
  idn: boolean;
  geographic: boolean;
  /** Base Application status as published (may be Deactivated when `-R` is selected). */
  applicationStatus: string | null;
  processingStage: string | null;
  region: string | null;
  country: string | null;
  /** Official contention membership on the base Application ID (Reveal Day or SCD overlay). */
  inInitialContention: boolean;
  officialContentionSetIds: string[];
  scdContentionStatus: ApplicantScdContentionStatus;
  scdContentionSetId: string | null;
  competitors: ApplicantStringCompetitor[];
  officialAwardOutcome: ApplicantOfficialAwardOutcome;
  exploreHref: string;
};

export type ApplicantStringStatusObservation = {
  applicationSnapshotId: string;
  publishedAt: string;
  retrievedAt: string;
  contentionSnapshotId: string | null;
  contentionOverlayStatus: "available" | "unavailable";
  scdContentionEvidence: "ready" | "unavailable";
  publicationBasisLabel: string;
};

export type ApplicantStringStatusSummary = {
  applicationCount: number;
  selectedReplacements: number;
  activeUncontestedInScdCapture: number;
  activeContestedInScdCapture: number;
  withdrawnSelected: number;
  unresolvedSelections: number;
  awardEstablishedCount: number;
};

export type ApplicantContentionSetMember = {
  applicationId: string;
  appliedForString: string;
  applicantLegalName: string;
  isFocalApplicant: boolean;
  exploreHref: string;
  profileHref: string;
};

export type ApplicantContentionSetSummary = {
  setId: string;
  appliedForStrings: string[];
  applicationCount: number;
  distinctApplicantCount: number;
  applicantApplicationIds: string[];
  includesGodaddy: boolean;
  contentionSetHref: string;
  /** Applications in the set — Applications may outnumber distinct Applicants. */
  members: ApplicantContentionSetMember[];
};

export type ApplicantOrganizationSibling = {
  applicantLegalName: string;
  applicationCount: number;
  profileHref: string;
};

export type ApplicantChangeSummary = {
  hasMaterialChanges: boolean;
  summaryLine: string;
  changesHref: string;
};

export type ApplicantIntelligenceProfile = {
  found: true;
  applicantLegalName: string;
  profileHref: string;
  countries: string[];
  regions: string[];
  organizationResolutionStatus: OrganizationResolutionOverlayStatus;
  confirmedOrganizationId: string | null;
  confirmedOrganizationName: string | null;
  /** Present only when Confirmed and canonical key is known. */
  organizationProfileHref: string | null;
  identityEvidence: ParticipantIdentityEvidenceOverlay | null;
  brandApplicationCount: number;
  applicationCount: number;
  contestedApplicationCount: number;
  uniqueContentionSets: number;
  distinctCounterpartApplicants: number;
  rspPosture: RspProspectingPosture;
  rspPostureLabel: string;
  rspProspectingReason: string;
  portfolio: ApplicantPortfolioRow[];
  stringStatusObservation: ApplicantStringStatusObservation;
  stringStatusSummary: ApplicantStringStatusSummary;
  contentionSets: ApplicantContentionSetSummary[];
  counterparts: Array<{
    applicantLegalName: string;
    sharedContentionSets: number;
    organizationResolutionStatus: OrganizationResolutionOverlayStatus;
    confirmedOrganizationName: string | null;
    profileHref: string;
  }>;
  organizationContext: {
    organizationName: string;
    organizationId: string;
    siblingApplicants: ApplicantOrganizationSibling[];
    siblingApplicantCount: number;
    organizationApplicationCount: number;
    organizationContentionMemberships: number;
  } | null;
  confirmedReturning: ParticipantReturningOverlay | null;
  changeSummary: ApplicantChangeSummary;
  exploreApplicationsHref: string;
  exploreApplicantHref: string;
  competitiveLandscapeHref: string;
  contentionHref: string;
  participantRow: ParticipantRow;
  rspRow: ApplicantRspPosture;
};

export type ApplicantIntelligenceLookup =
  | ApplicantIntelligenceProfile
  | { found: false; applicantLegalName: string; profileHref: string };

/** Shareable, deterministic Applicant profile route (legal name is the stable key). */
export function applicantProfileHref(applicantLegalName: string): string {
  return `/applicant?name=${encodeURIComponent(applicantLegalName)}`;
}

export function decodeApplicantProfileName(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return decodeURIComponent(trimmed).trim() || null;
  } catch {
    return trimmed;
  }
}

const SELECTED_REPLACEMENT_TYPES = new Set(["New gTLD", "New gTLD with Variants"]);
const UNSELECTED_REPLACEMENT_TYPES = new Set(["Replacement String"]);

/** True when the snapshot ID is the String Confirmation Day publication lineage. */
export function isStringConfirmationSnapshotId(snapshotId: string | null | undefined): boolean {
  return typeof snapshotId === "string" && snapshotId.includes("string-confirmation");
}

/**
 * SCD contention classification is allowed only when both Application and contention
 * snapshots are String Confirmation Day and the overlay is available (pin-matched).
 * Never combine SCD applications with Reveal Day contention as “current.”
 */
export function resolveScdContentionEvidenceStatus(
  document: RegistryApplicationsDocumentV2,
): "ready" | "unavailable" {
  const overlay = document.contentionOverlay;
  if (overlay.status !== "available") return "unavailable";
  if (!isStringConfirmationSnapshotId(document.snapshotId)) return "unavailable";
  if (!isStringConfirmationSnapshotId(overlay.snapshotId)) return "unavailable";
  return "ready";
}

export function buildStringStatusObservation(
  document: RegistryApplicationsDocumentV2,
): ApplicantStringStatusObservation {
  const scdContentionEvidence = resolveScdContentionEvidenceStatus(document);
  const publicationBasisLabel =
    scdContentionEvidence === "ready"
      ? "String Confirmation Day application + contention capture"
      : isStringConfirmationSnapshotId(document.snapshotId)
        ? "String Confirmation Day application capture — SCD contention evidence unavailable or mismatched"
        : "Reveal Day / historical publication basis — SCD contention status not activated on this observation";
  return {
    applicationSnapshotId: document.snapshotId,
    publishedAt: document.publishedAt,
    retrievedAt: document.retrievedAt,
    contentionSnapshotId: document.contentionOverlay.snapshotId,
    contentionOverlayStatus: document.contentionOverlay.status,
    scdContentionEvidence,
    publicationBasisLabel,
  };
}

export type ResolvedSelectedString = {
  selectionMode: ApplicantStringSelectionMode;
  originalAppliedForString: string;
  selectedCurrentString: string;
  selectedReplacementApplicationId: string | null;
  replacementStringLabel: string | null;
  currentApplicationStatus: string;
  unresolvedReason: string | null;
};

/**
 * Resolve selected/current string from source-backed `-R` identity, Application Type, and status.
 * Conflicting evidence fails closed to `unresolved`.
 */
export function resolveSelectedStringStatus(app: BrowserApplicationV2): ResolvedSelectedString {
  const originalAppliedForString = app.appliedString?.label ?? "";
  const baseStatus = app.applicationStatus ?? "";
  const repl = app.replacementString;

  if (!repl) {
    return {
      selectionMode: "original-only",
      originalAppliedForString,
      selectedCurrentString: originalAppliedForString,
      selectedReplacementApplicationId: null,
      replacementStringLabel: null,
      currentApplicationStatus: baseStatus,
      unresolvedReason: null,
    };
  }

  const replacementStringLabel = repl.label ?? "";
  const isR = typeof repl.sourceRowId === "string" && repl.sourceRowId.endsWith("-R");
  const selectedType = SELECTED_REPLACEMENT_TYPES.has(repl.applicationType);
  const unselectedType = UNSELECTED_REPLACEMENT_TYPES.has(repl.applicationType);

  if (!isR) {
    return {
      selectionMode: "unresolved",
      originalAppliedForString,
      selectedCurrentString: originalAppliedForString,
      selectedReplacementApplicationId: null,
      replacementStringLabel,
      currentApplicationStatus: baseStatus,
      unresolvedReason: "Replacement row identity is not a source-backed -R application ID",
    };
  }

  if (selectedType) {
    const consistentSelected =
      baseStatus === "Deactivated" && repl.applicationStatus === "Active";
    if (consistentSelected) {
      return {
        selectionMode: "selected-replacement",
        originalAppliedForString,
        selectedCurrentString: replacementStringLabel,
        selectedReplacementApplicationId: repl.sourceRowId,
        replacementStringLabel,
        currentApplicationStatus: repl.applicationStatus,
        unresolvedReason: null,
      };
    }
    return {
      selectionMode: "unresolved",
      originalAppliedForString,
      selectedCurrentString: originalAppliedForString,
      selectedReplacementApplicationId: null,
      replacementStringLabel,
      currentApplicationStatus: baseStatus,
      unresolvedReason:
        "Selected-replacement Application Type is inconsistent with base/replacement status evidence",
    };
  }

  if (unselectedType) {
    if (repl.applicationStatus === "Active") {
      return {
        selectionMode: "unresolved",
        originalAppliedForString,
        selectedCurrentString: originalAppliedForString,
        selectedReplacementApplicationId: null,
        replacementStringLabel,
        currentApplicationStatus: baseStatus,
        unresolvedReason:
          "Unselected Replacement String type is inconsistent with an Active replacement status",
      };
    }
    return {
      selectionMode: "kept-original-unselected-replacement",
      originalAppliedForString,
      selectedCurrentString: originalAppliedForString,
      selectedReplacementApplicationId: null,
      replacementStringLabel,
      currentApplicationStatus: baseStatus,
      unresolvedReason: null,
    };
  }

  return {
    selectionMode: "unresolved",
    originalAppliedForString,
    selectedCurrentString: originalAppliedForString,
    selectedReplacementApplicationId: null,
    replacementStringLabel,
    currentApplicationStatus: baseStatus,
    unresolvedReason: `Unrecognized replacement Application Type: ${repl.applicationType || "(empty)"}`,
  };
}

function resolveScdContentionStatusForRow(
  app: BrowserApplicationV2,
  selected: ResolvedSelectedString,
  scdEvidence: "ready" | "unavailable",
): {
  scdContentionStatus: ApplicantScdContentionStatus;
  scdContentionSetId: string | null;
} {
  if (selected.selectionMode === "unresolved") {
    return { scdContentionStatus: "unresolved", scdContentionSetId: null };
  }
  if (selected.currentApplicationStatus === "Withdrawn") {
    return { scdContentionStatus: "n/a_withdrawn", scdContentionSetId: null };
  }
  if (scdEvidence !== "ready") {
    return { scdContentionStatus: "unavailable", scdContentionSetId: null };
  }
  const oc = app.officialContention;
  const setIds = oc?.membershipPresent ? [...oc.officialContentionSetIds].sort() : [];
  if (setIds.length > 0) {
    return { scdContentionStatus: "contested", scdContentionSetId: setIds[0]! };
  }
  return { scdContentionStatus: "uncontested_in_scd_capture", scdContentionSetId: null };
}

function competitorsForApplication(
  app: BrowserApplicationV2,
  setMembers: Map<string, BrowserApplicationV2[]>,
): ApplicantStringCompetitor[] {
  const oc = app.officialContention;
  if (!oc?.membershipPresent) return [];
  const seen = new Set<string>();
  const out: ApplicantStringCompetitor[] = [];
  for (const setId of oc.officialContentionSetIds) {
    for (const peer of setMembers.get(setId) ?? []) {
      if (peer.applicationId === app.applicationId) continue;
      if (seen.has(peer.applicationId)) continue;
      seen.add(peer.applicationId);
      out.push({
        applicationId: peer.applicationId,
        applicantLegalName: peer.applicant,
        appliedForString: peer.appliedString?.label ?? "",
      });
    }
  }
  out.sort(
    (a, b) =>
      a.applicantLegalName.localeCompare(b.applicantLegalName) ||
      a.appliedForString.localeCompare(b.appliedForString) ||
      a.applicationId.localeCompare(b.applicationId),
  );
  return out;
}

export function summarizeApplicantStringStatus(
  portfolio: ReadonlyArray<ApplicantPortfolioRow>,
): ApplicantStringStatusSummary {
  return {
    applicationCount: portfolio.length,
    selectedReplacements: portfolio.filter((r) => r.selectionMode === "selected-replacement").length,
    activeUncontestedInScdCapture: portfolio.filter(
      (r) =>
        r.currentApplicationStatus === "Active" &&
        r.scdContentionStatus === "uncontested_in_scd_capture",
    ).length,
    activeContestedInScdCapture: portfolio.filter(
      (r) => r.currentApplicationStatus === "Active" && r.scdContentionStatus === "contested",
    ).length,
    withdrawnSelected: portfolio.filter(
      (r) =>
        r.currentApplicationStatus === "Withdrawn" || r.scdContentionStatus === "n/a_withdrawn",
    ).length,
    unresolvedSelections: portfolio.filter((r) => r.selectionMode === "unresolved").length,
    awardEstablishedCount: portfolio.filter((r) => r.officialAwardOutcome === "awarded").length,
  };
}

function portfolioRowsForApplicant(
  document: RegistryApplicationsDocumentV2,
  applicantLegalName: string,
): ApplicantPortfolioRow[] {
  const scdEvidence = resolveScdContentionEvidenceStatus(document);
  const setMembers = new Map<string, BrowserApplicationV2[]>();
  for (const app of document.applications) {
    const oc = app.officialContention;
    if (!oc?.membershipPresent) continue;
    for (const setId of oc.officialContentionSetIds) {
      const list = setMembers.get(setId) ?? [];
      list.push(app);
      setMembers.set(setId, list);
    }
  }

  const rows = document.applications
    .filter((a) => a.applicant === applicantLegalName)
    .map((app: BrowserApplicationV2) => {
      const oc = app.officialContention;
      const setIds = oc?.membershipPresent ? [...oc.officialContentionSetIds].sort() : [];
      const selected = resolveSelectedStringStatus(app);
      const { scdContentionStatus, scdContentionSetId } = resolveScdContentionStatusForRow(
        app,
        selected,
        scdEvidence,
      );
      const competitors =
        scdEvidence === "ready" && scdContentionStatus === "contested"
          ? competitorsForApplication(app, setMembers)
          : [];
      return {
        applicationId: app.applicationId,
        appliedForString: selected.originalAppliedForString,
        originalAppliedForString: selected.originalAppliedForString,
        selectedCurrentString: selected.selectedCurrentString,
        selectedReplacementApplicationId: selected.selectedReplacementApplicationId,
        replacementStringLabel: selected.replacementStringLabel,
        selectionMode: selected.selectionMode,
        selectionUnresolvedReason: selected.unresolvedReason,
        currentApplicationStatus: selected.currentApplicationStatus || null,
        brand: Boolean(app.designations.brand),
        community: Boolean(app.designations.community),
        idn: Boolean(app.designations.idn),
        geographic: Boolean(app.designations.geoSelfDesignated),
        applicationStatus: app.applicationStatus ?? null,
        processingStage: app.processingStage ?? null,
        region: app.region ?? null,
        country: app.country ?? null,
        inInitialContention: Boolean(oc?.membershipPresent),
        officialContentionSetIds: setIds,
        scdContentionStatus,
        scdContentionSetId,
        competitors,
        officialAwardOutcome: "not_established" as const,
        exploreHref: `/explore?q=${encodeURIComponent(app.applicationId)}`,
      };
    });
  rows.sort(
    (a, b) =>
      a.appliedForString.localeCompare(b.appliedForString) ||
      a.applicationId.localeCompare(b.applicationId),
  );
  return rows;
}

function buildContentionSummaries(
  document: RegistryApplicationsDocumentV2,
  applicantLegalName: string,
): ApplicantContentionSetSummary[] {
  const setMembers = new Map<string, BrowserApplicationV2[]>();
  for (const app of document.applications) {
    const oc = app.officialContention;
    if (!oc?.membershipPresent) continue;
    for (const setId of oc.officialContentionSetIds) {
      const list = setMembers.get(setId) ?? [];
      list.push(app);
      setMembers.set(setId, list);
    }
  }

  const out: ApplicantContentionSetSummary[] = [];
  for (const [setId, apps] of setMembers) {
    const applicantApps = apps.filter((a) => a.applicant === applicantLegalName);
    if (applicantApps.length === 0) continue;
    const applicants = new Set(apps.map((a) => a.applicant));
    const strings = [
      ...new Set(apps.map((a) => a.appliedString?.label ?? "").filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));
    const members = [...apps]
      .sort(
        (a, b) =>
          (a.appliedString?.label ?? "").localeCompare(b.appliedString?.label ?? "") ||
          a.applicant.localeCompare(b.applicant) ||
          a.applicationId.localeCompare(b.applicationId),
      )
      .map((a) => ({
        applicationId: a.applicationId,
        appliedForString: a.appliedString?.label ?? "",
        applicantLegalName: a.applicant,
        isFocalApplicant: a.applicant === applicantLegalName,
        exploreHref: `/explore?q=${encodeURIComponent(a.applicationId)}`,
        profileHref: applicantProfileHref(a.applicant),
      }));
    out.push({
      setId,
      appliedForStrings: strings,
      applicationCount: apps.length,
      distinctApplicantCount: applicants.size,
      applicantApplicationIds: applicantApps.map((a) => a.applicationId).sort(),
      includesGodaddy: apps.some((a) => a.applicant === "Registry Services, LLC"),
      contentionSetHref: contentionSetHref(setId),
      members,
    });
  }
  out.sort(
    (a, b) =>
      b.applicationCount - a.applicationCount ||
      a.setId.localeCompare(b.setId),
  );
  return out;
}

/**
 * Build Applicant Intelligence Profile for an exact legal name.
 * Lookup is exact match against represented Applicant names (not fuzzy).
 */
export function buildApplicantIntelligenceProfile(
  document: RegistryApplicationsDocumentV2,
  overlays: ParticipantOverlays | undefined,
  evaluatedRsp: EvaluatedMainRspArtifact,
  applicantLegalName: string,
  options?: { changesHrefBase?: string },
): ApplicantIntelligenceLookup {
  const name = applicantLegalName.trim();
  const href = applicantProfileHref(name);
  if (!name) return { found: false, applicantLegalName: name, profileHref: href };

  const participantIntel = buildParticipantIntelligence(document, overlays, {
    focalApplicantLegalName: name,
  });
  const row = participantIntel.participants.find((p) => p.applicantLegalName === name);
  if (!row) {
    return { found: false, applicantLegalName: name, profileHref: href };
  }

  const rspIntel = buildRspOpportunityIntelligence(participantIntel, evaluatedRsp);
  const rspRow = rspIntel.postures.find((p) => p.applicantLegalName === name)!;

  const portfolio = portfolioRowsForApplicant(document, name);
  const stringStatusObservation = buildStringStatusObservation(document);
  const stringStatusSummary = summarizeApplicantStringStatus(portfolio);
  const contentionSets = buildContentionSummaries(document, name);

  let organizationContext: ApplicantIntelligenceProfile["organizationContext"] = null;
  if (row.organizationResolutionStatus === "CONFIRMED" && row.confirmedOrganizationId && row.confirmedOrganizationName) {
    const siblings = participantIntel.participants
      .filter(
        (p) =>
          p.applicantLegalName !== name &&
          p.organizationResolutionStatus === "CONFIRMED" &&
          p.confirmedOrganizationId === row.confirmedOrganizationId,
      )
      .map((p) => ({
        applicantLegalName: p.applicantLegalName,
        applicationCount: p.applicationCount,
        profileHref: applicantProfileHref(p.applicantLegalName),
      }))
      .sort(
        (a, b) =>
          b.applicationCount - a.applicationCount ||
          a.applicantLegalName.localeCompare(b.applicantLegalName),
      );
    const family = participantIntel.participants.filter(
      (p) =>
        p.organizationResolutionStatus === "CONFIRMED" &&
        p.confirmedOrganizationId === row.confirmedOrganizationId,
    );
    organizationContext = {
      organizationName: row.confirmedOrganizationName,
      organizationId: row.confirmedOrganizationId,
      siblingApplicants: siblings,
      siblingApplicantCount: siblings.length,
      organizationApplicationCount: family.reduce((n, p) => n + p.applicationCount, 0),
      organizationContentionMemberships: family.reduce((n, p) => n + p.officialContentionMemberships, 0),
    };
  }

  const changesHref = `${options?.changesHrefBase ?? "/changes"}?q=${encodeURIComponent(name)}`;
  const orgKey =
    row.organizationResolutionStatus === "CONFIRMED"
      ? organizationKeyFromOverlays(overlays, row.confirmedOrganizationId)
      : null;

  return {
    found: true,
    applicantLegalName: name,
    profileHref: href,
    countries: row.countries,
    regions: row.regions,
    organizationResolutionStatus: row.organizationResolutionStatus,
    confirmedOrganizationId: row.confirmedOrganizationId,
    confirmedOrganizationName: row.confirmedOrganizationName,
    organizationProfileHref: orgKey ? organizationProfileHref(orgKey) : null,
    identityEvidence: row.identityEvidence,
    brandApplicationCount: row.designationCounts.brand,
    applicationCount: row.applicationCount,
    contestedApplicationCount: row.contestedApplicationCount,
    uniqueContentionSets: row.officialContentionSetsTouched,
    distinctCounterpartApplicants: participantIntel.contentionCounterparts.length,
    rspPosture: rspRow.rspProspectingPosture,
    rspPostureLabel: prospectingPostureLabel(rspRow.rspProspectingPosture),
    rspProspectingReason: rspRow.rspProspectingReason,
    portfolio,
    stringStatusObservation,
    stringStatusSummary,
    contentionSets,
    counterparts: participantIntel.contentionCounterparts.map((c) => ({
      applicantLegalName: c.applicantLegalName,
      sharedContentionSets: c.sharedContentionSets,
      organizationResolutionStatus: c.organizationResolutionStatus,
      confirmedOrganizationName: c.confirmedOrganizationName,
      profileHref: applicantProfileHref(c.applicantLegalName),
    })),
    organizationContext,
    confirmedReturning: row.confirmedReturning,
    changeSummary: {
      hasMaterialChanges: false,
      summaryLine:
        "No material public Application or contention changes recorded since monitoring began.",
      changesHref,
    },
    exploreApplicationsHref: exploreApplicantApplicationsHref(row.applicationIds),
    exploreApplicantHref: exploreApplicantHref(name),
    competitiveLandscapeHref: `/competitive-landscape?q=${encodeURIComponent(name)}`,
    contentionHref: `/contention?view=all&q=${encodeURIComponent(name)}`,
    participantRow: row,
    rspRow,
  };
}

/** Sets grouped by Application count for interactive distribution UX. */
export function buildContentionApplicationCountDistribution(
  sets: ReadonlyArray<{ setId: string; totalApplications: number; distinctApplicants: number; appliedForStrings: string[]; includesGodaddy: boolean }>,
): Array<{
  applicationCount: number;
  setCount: number;
  sets: Array<{
    setId: string;
    appliedForStrings: string[];
    applicationCount: number;
    distinctApplicantCount: number;
    includesGodaddy: boolean;
    contentionSetHref: string;
  }>;
}> {
  type DistSet = (typeof sets)[number];
  const bySize = new Map<number, DistSet[]>();
  for (const set of sets) {
    const list = bySize.get(set.totalApplications) ?? [];
    list.push(set);
    bySize.set(set.totalApplications, list);
  }
  return [...bySize.entries()]
    .sort((a, b) => b[0] - a[0] || a[1].length - b[1].length)
    .map(([applicationCount, group]) => ({
      applicationCount,
      setCount: group.length,
      sets: [...group]
        .sort((a, b) => a.setId.localeCompare(b.setId))
        .map((s) => ({
          setId: s.setId,
          appliedForStrings: [...s.appliedForStrings],
          applicationCount: s.totalApplications,
          distinctApplicantCount: s.distinctApplicants,
          includesGodaddy: s.includesGodaddy,
          contentionSetHref: contentionSetHref(s.setId),
        })),
    }));
}

export const CONTENTION_SET_PLAIN_LANGUAGE =
  "A contention set groups Applications that ICANN has identified as competing with one another. A set with 13 Applications means 13 Applications are in that competition group; those Applications may represent fewer than 13 distinct Applicants. These are official initial memberships and may change as the program progresses — not a prediction of final outcome.";

export const SCD_UNCONTESTED_NOT_AWARDED_PLAIN_LANGUAGE =
  "No published SCD contention membership is not an official award. Award/delegation requires separate authoritative evidence.";

export type ApplicantPortfolioFilter =
  | "all"
  | "no_scd_contention"
  | "still_in_contention"
  | "selected_replacements"
  | "withdrawn_or_unresolved";

export function filterApplicantPortfolio(
  portfolio: ReadonlyArray<ApplicantPortfolioRow>,
  filter: ApplicantPortfolioFilter,
): ApplicantPortfolioRow[] {
  switch (filter) {
    case "no_scd_contention":
      return portfolio.filter((r) => r.scdContentionStatus === "uncontested_in_scd_capture");
    case "still_in_contention":
      return portfolio.filter((r) => r.scdContentionStatus === "contested");
    case "selected_replacements":
      return portfolio.filter((r) => r.selectionMode === "selected-replacement");
    case "withdrawn_or_unresolved":
      return portfolio.filter(
        (r) =>
          r.selectionMode === "unresolved" ||
          r.currentApplicationStatus === "Withdrawn" ||
          r.scdContentionStatus === "n/a_withdrawn",
      );
    case "all":
    default:
      return [...portfolio];
  }
}

export function scdContentionStatusLabel(status: ApplicantScdContentionStatus): string {
  switch (status) {
    case "contested":
      return "Still in SCD contention";
    case "uncontested_in_scd_capture":
      return "No published SCD contention";
    case "n/a_withdrawn":
      return "Withdrawn (SCD N/A)";
    case "unavailable":
      return "SCD contention unavailable";
    case "unresolved":
      return "Unresolved";
    default:
      return status;
  }
}

export function selectionModeLabel(mode: ApplicantStringSelectionMode): string {
  switch (mode) {
    case "original-only":
      return "Original string";
    case "kept-original-unselected-replacement":
      return "Kept original (unselected replacement)";
    case "selected-replacement":
      return "Selected replacement";
    case "unresolved":
      return "Unresolved selection";
    default:
      return mode;
  }
}
