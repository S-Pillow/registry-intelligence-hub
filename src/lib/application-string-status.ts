/**
 * Shared Application string-status / SCD contention classification.
 * Used by Applicant and Organization intelligence without circular imports.
 */

import type {
  BrowserApplicationV2,
  RegistryApplicationsDocumentV2,
} from "@/lib/registry-applications-document-v2";
import { contentionSetHref } from "@/lib/contention-intelligence";

/** How the selected/current string was resolved from Application + optional `-R` evidence. */
export type ApplicationStringSelectionMode =
  | "original-only"
  | "kept-original-unselected-replacement"
  | "selected-replacement"
  | "unresolved";

/**
 * SCD contention classification for the selected string.
 * `uncontested_in_scd_capture` is only emitted when SCD contention evidence is ready —
 * never when the overlay is missing, stale, Reveal Day–pinned, or mismatched.
 */
export type ApplicationScdContentionStatus =
  | "contested"
  | "uncontested_in_scd_capture"
  | "n/a_withdrawn"
  | "unavailable"
  | "unresolved";

/** Official award/delegation is a separate evidence class from SCD uncontested. */
export type ApplicationOfficialAwardOutcome = "not_established" | "awarded";

export type ApplicationStringCompetitor = {
  applicationId: string;
  applicantLegalName: string;
  appliedForString: string;
};

export type ApplicationStringStatusObservation = {
  applicationSnapshotId: string;
  publishedAt: string;
  retrievedAt: string;
  contentionSnapshotId: string | null;
  contentionOverlayStatus: "available" | "unavailable";
  scdContentionEvidence: "ready" | "unavailable";
  publicationBasisLabel: string;
};

export type ApplicationStringStatusSummary = {
  applicationCount: number;
  selectedReplacements: number;
  activeUncontestedInScdCapture: number;
  activeContestedInScdCapture: number;
  withdrawnSelected: number;
  unresolvedSelections: number;
  awardEstablishedCount: number;
};

export type ApplicationPortfolioFilter =
  | "all"
  | "no_scd_contention"
  | "still_in_contention"
  | "selected_replacements"
  | "withdrawn_or_unresolved";

export type ResolvedSelectedString = {
  selectionMode: ApplicationStringSelectionMode;
  originalAppliedForString: string;
  selectedCurrentString: string;
  selectedReplacementApplicationId: string | null;
  replacementStringLabel: string | null;
  currentApplicationStatus: string;
  unresolvedReason: string | null;
};

/** Common string-status fields shared by Applicant and Organization portfolio rows. */
export type ApplicationStringStatusFields = {
  originalAppliedForString: string;
  selectedCurrentString: string;
  selectedReplacementApplicationId: string | null;
  replacementStringLabel: string | null;
  selectionMode: ApplicationStringSelectionMode;
  selectionUnresolvedReason: string | null;
  currentApplicationStatus: string | null;
  inInitialContention: boolean;
  officialContentionSetIds: string[];
  scdContentionStatus: ApplicationScdContentionStatus;
  scdContentionSetId: string | null;
  competitors: ApplicationStringCompetitor[];
  officialAwardOutcome: ApplicationOfficialAwardOutcome;
  contentionSetHref: string | null;
};

const SELECTED_REPLACEMENT_TYPES = new Set(["New gTLD", "New gTLD with Variants"]);
const UNSELECTED_REPLACEMENT_TYPES = new Set(["Replacement String"]);

/** True when the snapshot ID is the String Confirmation Day publication lineage. */
export function isStringConfirmationSnapshotId(snapshotId: string | null | undefined): boolean {
  return typeof snapshotId === "string" && snapshotId.includes("string-confirmation");
}

/**
 * SCD contention classification is allowed only when both Application and contention
 * snapshots are String Confirmation Day, the overlay is available, and the overlay's
 * application-publication pin matches this browser document's application content hash.
 */
export function resolveScdContentionEvidenceStatus(
  document: RegistryApplicationsDocumentV2,
): "ready" | "unavailable" {
  const overlay = document.contentionOverlay;
  if (overlay.status !== "available") return "unavailable";
  if (!isStringConfirmationSnapshotId(document.snapshotId)) return "unavailable";
  if (!isStringConfirmationSnapshotId(overlay.snapshotId)) return "unavailable";
  if (
    !overlay.applicationPublicationPinHash ||
    overlay.applicationPublicationPinHash !== document.snapshotContentHash
  ) {
    return "unavailable";
  }
  return "ready";
}

export function buildStringStatusObservation(
  document: RegistryApplicationsDocumentV2,
): ApplicationStringStatusObservation {
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
  const expectedReplacementId = `${app.applicationId}-R`;
  const identityMatches =
    typeof repl.sourceRowId === "string" && repl.sourceRowId === expectedReplacementId;
  const selectedType = SELECTED_REPLACEMENT_TYPES.has(repl.applicationType);
  const unselectedType = UNSELECTED_REPLACEMENT_TYPES.has(repl.applicationType);

  if (!identityMatches) {
    return {
      selectionMode: "unresolved",
      originalAppliedForString,
      selectedCurrentString: originalAppliedForString,
      selectedReplacementApplicationId: null,
      replacementStringLabel,
      currentApplicationStatus: baseStatus,
      unresolvedReason:
        "Replacement row identity must equal base applicationId + \"-R\" (source-backed selected-string guard)",
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

export function resolveScdContentionStatusForRow(
  app: BrowserApplicationV2,
  selected: ResolvedSelectedString,
  scdEvidence: "ready" | "unavailable",
): {
  scdContentionStatus: ApplicationScdContentionStatus;
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

export function buildContentionSetMemberIndex(
  applications: ReadonlyArray<BrowserApplicationV2>,
): Map<string, BrowserApplicationV2[]> {
  const setMembers = new Map<string, BrowserApplicationV2[]>();
  for (const app of applications) {
    const oc = app.officialContention;
    if (!oc?.membershipPresent) continue;
    for (const setId of oc.officialContentionSetIds) {
      const list = setMembers.get(setId) ?? [];
      list.push(app);
      setMembers.set(setId, list);
    }
  }
  return setMembers;
}

export function competitorsForApplication(
  app: BrowserApplicationV2,
  setMembers: Map<string, BrowserApplicationV2[]>,
): ApplicationStringCompetitor[] {
  const oc = app.officialContention;
  if (!oc?.membershipPresent) return [];
  const seen = new Set<string>();
  const out: ApplicationStringCompetitor[] = [];
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

/** Classify one Application into shared string-status portfolio fields. */
export function classifyApplicationStringStatus(
  app: BrowserApplicationV2,
  scdEvidence: "ready" | "unavailable",
  setMembers: Map<string, BrowserApplicationV2[]>,
): ApplicationStringStatusFields {
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
    originalAppliedForString: selected.originalAppliedForString,
    selectedCurrentString: selected.selectedCurrentString,
    selectedReplacementApplicationId: selected.selectedReplacementApplicationId,
    replacementStringLabel: selected.replacementStringLabel,
    selectionMode: selected.selectionMode,
    selectionUnresolvedReason: selected.unresolvedReason,
    currentApplicationStatus: selected.currentApplicationStatus || null,
    inInitialContention: Boolean(oc?.membershipPresent),
    officialContentionSetIds: setIds,
    scdContentionStatus,
    scdContentionSetId,
    competitors,
    officialAwardOutcome: "not_established",
    contentionSetHref:
      scdContentionSetId != null
        ? contentionSetHref(scdContentionSetId)
        : setIds[0]
          ? contentionSetHref(setIds[0])
          : null,
  };
}

export function summarizeApplicationStringStatus(
  portfolio: ReadonlyArray<{
    selectionMode: ApplicationStringSelectionMode;
    currentApplicationStatus: string | null;
    scdContentionStatus: ApplicationScdContentionStatus;
    officialAwardOutcome: ApplicationOfficialAwardOutcome;
  }>,
): ApplicationStringStatusSummary {
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

export function filterApplicationPortfolio<
  T extends {
    scdContentionStatus: ApplicationScdContentionStatus;
    selectionMode: ApplicationStringSelectionMode;
    currentApplicationStatus: string | null;
  },
>(portfolio: ReadonlyArray<T>, filter: ApplicationPortfolioFilter): T[] {
  switch (filter) {
    case "no_scd_contention":
      // Match summary card Active-status rule for uncontested counts.
      return portfolio.filter(
        (r) =>
          r.currentApplicationStatus === "Active" &&
          r.scdContentionStatus === "uncontested_in_scd_capture",
      );
    case "still_in_contention":
      // Match summary card Active-status rule for contested counts.
      return portfolio.filter(
        (r) => r.currentApplicationStatus === "Active" && r.scdContentionStatus === "contested",
      );
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

export function scdContentionStatusLabel(status: ApplicationScdContentionStatus): string {
  switch (status) {
    case "contested":
      return "Applications facing competition";
    case "uncontested_in_scd_capture":
      return "Applications with no published competitors";
    case "n/a_withdrawn":
      return "Withdrawn";
    case "unavailable":
      return "Competition status unavailable";
    case "unresolved":
      return "Unresolved";
    default:
      return status;
  }
}

export function selectionModeLabel(mode: ApplicationStringSelectionMode): string {
  switch (mode) {
    case "original-only":
      return "Original string";
    case "kept-original-unselected-replacement":
      return "Kept original (replacement not selected)";
    case "selected-replacement":
      return "Replacement string selected";
    case "unresolved":
      return "Unresolved selection";
    default:
      return mode;
  }
}

export const CONTENTION_SET_PLAIN_LANGUAGE =
  "A contention set groups Applications that ICANN has identified as competing with one another. A set with 13 Applications means 13 Applications are in that competition group; those Applications may represent fewer than 13 distinct Applicants. These are official initial memberships and may change as the program progresses — not a prediction of final outcome.";

export const SCD_CONTENTION_SET_PLAIN_LANGUAGE =
  "A contention set groups Applications that ICANN has identified as competing with one another. A set with 13 Applications means 13 Applications are in that competition group; those Applications may represent fewer than 13 distinct Applicants. These are published String Confirmation Day contention memberships and may change as the program progresses — not a prediction of final outcome.";

export const SCD_UNCONTESTED_NOT_AWARDED_PLAIN_LANGUAGE =
  "“Applications with no published competitors” means none are recorded in the published contention data; it does not establish an award.";

/** True when the profile observation is on an SCD application snapshot (wording only). */
export function isScdApplicationObservation(
  observation: Pick<ApplicationStringStatusObservation, "applicationSnapshotId">,
): boolean {
  return isStringConfirmationSnapshotId(observation.applicationSnapshotId);
}

export function contestedApplicationsStatLabel(
  observation: Pick<ApplicationStringStatusObservation, "applicationSnapshotId">,
): string {
  return isScdApplicationObservation(observation)
    ? "Applications facing competition"
    : "In initial contention";
}

export function contentionSetExplanation(
  observation: Pick<ApplicationStringStatusObservation, "applicationSnapshotId">,
): string {
  return isScdApplicationObservation(observation)
    ? SCD_CONTENTION_SET_PLAIN_LANGUAGE
    : CONTENTION_SET_PLAIN_LANGUAGE;
}

export function noContentionMembershipsLabel(
  observation: Pick<ApplicationStringStatusObservation, "applicationSnapshotId">,
  subject: "Applicant" | "Organization" = "Applicant",
): string {
  return isScdApplicationObservation(observation)
    ? `No published competitors are recorded in the contention data for this ${subject}.`
    : `No official initial contention memberships for this ${subject}.`;
}

/** Visible one-line source summary for profile headers. */
export function formatProfileSourceLine(
  observation: ApplicationStringStatusObservation,
): string {
  if (observation.scdContentionEvidence === "ready") {
    const captureDate = formatCaptureDate(observation.retrievedAt);
    return captureDate
      ? `Source: ICANN String Confirmation Day · ${captureDate} capture`
      : "Source: ICANN String Confirmation Day";
  }
  if (isStringConfirmationSnapshotId(observation.applicationSnapshotId)) {
    return "Source: String Confirmation Day applications — published contention data unavailable";
  }
  return "Source: Reveal Day / historical publication basis";
}

function formatCaptureDate(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const PROFILE_PORTFOLIO_FILTERS: Array<{
  id: ApplicationPortfolioFilter;
  label: string;
}> = [
  { id: "all", label: "All applications" },
  { id: "no_scd_contention", label: "Applications with no published competitors" },
  { id: "still_in_contention", label: "Applications facing competition" },
  { id: "selected_replacements", label: "Replacement strings selected" },
  { id: "withdrawn_or_unresolved", label: "Withdrawn or unresolved" },
];
