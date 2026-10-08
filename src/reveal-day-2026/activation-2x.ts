/**
 * RIH-ACTIVATION-2X-1 — authorize explicit Application 2.0 / contention actuality writes.
 * Does not change metric eligibility. Does not auto-promote from file presence.
 */

import type { HumanApprovalResult } from "./human-approval";
import {
  DEFAULT_CLAIM_ACTUALITY_STATE,
  DEFAULT_CONTENTION_ACTUALITY_STATE,
  type ClaimActualityState,
  type ContentionActualityState,
  type PromotionGateResult,
} from "./claim-actuality";
import {
  evaluateApplicationPublicationV2PromotionCandidate,
  evaluateContentionMembershipPromotionCandidate,
  type ApplicationV2PromotionExpectedPins,
  type ContentionPromotionExpectedPins,
} from "./promotion-contract-2x";
import type { Registry2026PublicationV2 } from "./publication-v2-types";
import type { ContentionMembershipSnapshotV1 } from "./contention-membership-types";
import { CLAIM_ACTUALITY_STATE_VERSION } from "./types";

export type ContentionPromotionGateResult = {
  ok: boolean;
  errors: string[];
  nextState: ContentionActualityState;
};

/**
 * Explicit Application 2.0 promote-actuality evaluation.
 * Requires promotion-contract-2x PROMOTABLE + human steward/product approvals.
 */
export function evaluateApplicationPublicationV2ActualityPromotion(
  publication: Registry2026PublicationV2,
  current: ClaimActualityState,
  humanApproval?: HumanApprovalResult,
  expected?: Partial<ApplicationV2PromotionExpectedPins>,
): PromotionGateResult {
  const candidate = evaluateApplicationPublicationV2PromotionCandidate(
    publication,
    expected,
    current,
  );
  const errors = [...candidate.errors];

  if (humanApproval && !humanApproval.ok) {
    errors.push(...humanApproval.errors);
  } else if (!humanApproval) {
    errors.push("Human steward and product approvals are required before promote-actuality");
  }

  if (candidate.status !== "PROMOTABLE" || !candidate.nextStateIfApplied) {
    return {
      ok: false,
      errors: errors.length ? errors : ["Publication 2.0.0 candidate is not PROMOTABLE"],
      nextState: current,
    };
  }

  if (errors.length > 0) {
    return { ok: false, errors, nextState: current };
  }

  const nextState: ClaimActualityState = {
    ...candidate.nextStateIfApplied,
    version: CLAIM_ACTUALITY_STATE_VERSION,
    round2026ApplicationActuality: "REAL_SOURCE_READY",
    promotedAt: new Date().toISOString(),
    stewardApprovalId: humanApproval?.stewardApprovalId ?? null,
    productApprovalId: humanApproval?.productApprovalId ?? null,
  };

  return { ok: true, errors: [], nextState };
}

/**
 * Explicit contention actuality promotion — independent of Application write timing,
 * but requires Application publication pin hash match.
 */
export function evaluateContentionActualityPromotion(
  sidecar: ContentionMembershipSnapshotV1,
  applicationGraphContentSha256: string,
  current: ContentionActualityState = DEFAULT_CONTENTION_ACTUALITY_STATE,
  humanApproval?: HumanApprovalResult,
  expected?: Partial<ContentionPromotionExpectedPins>,
): ContentionPromotionGateResult {
  const candidate = evaluateContentionMembershipPromotionCandidate(
    sidecar,
    applicationGraphContentSha256,
    expected,
  );
  const errors = [...candidate.errors];

  if (humanApproval && !humanApproval.ok) {
    errors.push(...humanApproval.errors);
  } else if (!humanApproval) {
    errors.push("Human steward and product approvals are required before promote-contention-actuality");
  }

  if (candidate.status !== "PROMOTABLE" || !candidate.nextStateIfApplied) {
    return {
      ok: false,
      errors: errors.length ? errors : ["Contention candidate is not PROMOTABLE"],
      nextState: current,
    };
  }

  if (errors.length > 0) {
    return { ok: false, errors, nextState: current };
  }

  return {
    ok: true,
    errors: [],
    nextState: candidate.nextStateIfApplied,
  };
}

/** Roll Application actuality back to NOT_PUBLISHED (evidence retained separately). */
export function rollbackApplicationActualityState(): ClaimActualityState {
  return { ...DEFAULT_CLAIM_ACTUALITY_STATE };
}

/** Roll contention actuality back independently. */
export function rollbackContentionActualityState(): ContentionActualityState {
  return { ...DEFAULT_CONTENTION_ACTUALITY_STATE };
}
