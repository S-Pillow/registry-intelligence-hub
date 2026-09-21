import {
  CONFIRMED_2012_MAPPED_APPLICATION_COUNT,
  CONFIRMED_2012_PORTFOLIO_COUNT,
  REGISTRY_BROWSER_2012_CONFIRMED_PORTFOLIOS_VERSION,
} from "@/historical-2012/confirmed-portfolios-constants";
import type { Registry2012ConfirmedPortfoliosDocument } from "@/historical-2012/confirmed-portfolios-sidecar-types";
import {
  ORGANIZATION_PROMOTION_METHOD_VERSION,
  ORGANIZATION_PROMOTION_REGISTRY_VERSION,
} from "@/normalization/types";

function isConfirmedPortfolioEntry(value: unknown): value is Registry2012ConfirmedPortfoliosDocument["portfolios"][number] {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.organizationKey === "string"
    && typeof record.canonicalOrganizationName === "string"
    && record.promotionState === "CONFIRMED"
    && (record.confidence === "high" || record.confidence === "medium")
    && record.reviewState === "steward-approved"
    && record.methodVersion === ORGANIZATION_PROMOTION_METHOD_VERSION
    && Array.isArray(record.evidence)
    && record.evidence.every((item) => typeof item === "string")
    && Array.isArray(record.promotionOpIds)
    && record.promotionOpIds.every((item) => typeof item === "string")
    && Array.isArray(record.memberApplicationIds)
    && record.memberApplicationIds.every((item) => typeof item === "string")
  );
}

export function isRegistry2012ConfirmedPortfoliosDocument(
  value: unknown,
): value is Registry2012ConfirmedPortfoliosDocument {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.payloadVersion === REGISTRY_BROWSER_2012_CONFIRMED_PORTFOLIOS_VERSION
    && record.payloadMode === "historical-2012-confirmed-portfolios"
    && record.roundProgramYear === 2012
    && typeof record.baseApplicationPayloadCorpusContentHash === "string"
    && typeof record.baseApplicationPayloadSnapshotId === "string"
    && record.organizationPromotionRegistryVersion === ORGANIZATION_PROMOTION_REGISTRY_VERSION
    && record.organizationPromotionMethodVersion === ORGANIZATION_PROMOTION_METHOD_VERSION
    && typeof record.sourcePromotionRegistryContentHash === "string"
    && record.confirmedPortfolioCount === CONFIRMED_2012_PORTFOLIO_COUNT
    && record.confirmedMappedApplicationCount === CONFIRMED_2012_MAPPED_APPLICATION_COUNT
    && typeof record.generatedAt === "string"
    && Array.isArray(record.portfolios)
    && record.portfolios.every(isConfirmedPortfolioEntry)
    && record.portfolios.length === CONFIRMED_2012_PORTFOLIO_COUNT
  );
}
