import { APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH } from "@/historical-2012/approved-corpus-hash";
import {
  CONFIRMED_2012_MAPPED_APPLICATION_COUNT,
  CONFIRMED_2012_PORTFOLIO_COUNT,
} from "@/historical-2012/confirmed-portfolios-constants";
import { isRegistry2012ConfirmedPortfoliosDocument } from "@/historical-2012/confirmed-portfolios-sidecar-document";
import type { Registry2012ConfirmedPortfoliosDocument } from "@/historical-2012/confirmed-portfolios-sidecar-types";
import type { Registry2012ApplicationsDocument } from "@/historical-2012/browser-payload-document";

export type ConfirmedPortfoliosSidecarSelectionReason =
  | "not-configured"
  | "invalid-document"
  | "base-corpus-hash-mismatch"
  | "portfolio-count-mismatch"
  | "mapped-application-count-mismatch"
  | "member-id-missing-in-base"
  | "loaded-active";

export type ConfirmedPortfoliosSidecarResolution =
  | {
      status: "not-loaded";
      reason: ConfirmedPortfoliosSidecarSelectionReason;
      errorMessage: string;
    }
  | {
      status: "loaded";
      reason: "loaded-active";
      document: Registry2012ConfirmedPortfoliosDocument;
    };

export function resolveConfirmedPortfoliosSidecar(
  configured: Registry2012ConfirmedPortfoliosDocument | null,
  baseApplicationPayload: Registry2012ApplicationsDocument | null,
): ConfirmedPortfoliosSidecarResolution {
  if (!configured) {
    return {
      status: "not-loaded",
      reason: "not-configured",
      errorMessage:
        "No 2012 confirmed portfolio sidecar was supplied. An explicit override that fails is not replaced with the committed sidecar.",
    };
  }

  if (!isRegistry2012ConfirmedPortfoliosDocument(configured)) {
    return {
      status: "not-loaded",
      reason: "invalid-document",
      errorMessage: "Unsupported or unpinned 2012 confirmed portfolio sidecar document.",
    };
  }

  if (!baseApplicationPayload) {
    return {
      status: "not-loaded",
      reason: "base-corpus-hash-mismatch",
      errorMessage:
        "2012 application payload must be loaded before the confirmed portfolio sidecar — refusing orphan sidecar.",
    };
  }

  if (baseApplicationPayload.corpusContentHash !== APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH) {
    return {
      status: "not-loaded",
      reason: "base-corpus-hash-mismatch",
      errorMessage: "Configured 2012 application payload corpus hash does not match the approved baseline.",
    };
  }

  if (configured.baseApplicationPayloadCorpusContentHash !== baseApplicationPayload.corpusContentHash) {
    return {
      status: "not-loaded",
      reason: "base-corpus-hash-mismatch",
      errorMessage: "Confirmed portfolio sidecar base corpus hash disagrees with the loaded application payload.",
    };
  }

  if (configured.confirmedPortfolioCount !== CONFIRMED_2012_PORTFOLIO_COUNT) {
    return {
      status: "not-loaded",
      reason: "portfolio-count-mismatch",
      errorMessage: `Sidecar confirmed portfolio count ${configured.confirmedPortfolioCount} ≠ pinned ${CONFIRMED_2012_PORTFOLIO_COUNT}.`,
    };
  }

  if (configured.confirmedMappedApplicationCount !== CONFIRMED_2012_MAPPED_APPLICATION_COUNT) {
    return {
      status: "not-loaded",
      reason: "mapped-application-count-mismatch",
      errorMessage: `Sidecar mapped application count ${configured.confirmedMappedApplicationCount} ≠ pinned ${CONFIRMED_2012_MAPPED_APPLICATION_COUNT}.`,
    };
  }

  const appIds = new Set(baseApplicationPayload.applications.map((app) => app.id));
  for (const portfolio of configured.portfolios) {
    for (const memberId of portfolio.memberApplicationIds) {
      if (!appIds.has(memberId)) {
        return {
          status: "not-loaded",
          reason: "member-id-missing-in-base",
          errorMessage: `Portfolio ${portfolio.organizationKey} references application ${memberId} missing from base payload.`,
        };
      }
    }
  }

  return {
    status: "loaded",
    reason: "loaded-active",
    document: configured,
  };
}
