import { REGISTRY_BROWSER_2012_CONFIRMED_PORTFOLIOS_VERSION } from "@/historical-2012/confirmed-portfolios-constants";
import type { OrganizationPromotionState } from "@/normalization/types";

export type ConfirmedPortfolioSidecarEntry = {
  organizationKey: string;
  canonicalOrganizationName: string;
  promotionState: Extract<OrganizationPromotionState, "CONFIRMED">;
  confidence: "high" | "medium";
  reviewState: "steward-approved";
  methodVersion: "organization-promotion/1.0.0";
  evidence: string[];
  promotionOpIds: string[];
  memberApplicationIds: string[];
};

export type Registry2012ConfirmedPortfoliosDocument = {
  payloadVersion: typeof REGISTRY_BROWSER_2012_CONFIRMED_PORTFOLIOS_VERSION;
  payloadMode: "historical-2012-confirmed-portfolios";
  roundProgramYear: 2012;
  baseApplicationPayloadCorpusContentHash: string;
  baseApplicationPayloadSnapshotId: string;
  organizationPromotionRegistryVersion: "organization-promotion-registry/1.0.0";
  organizationPromotionMethodVersion: "organization-promotion/1.0.0";
  sourcePromotionRegistryContentHash: string;
  confirmedPortfolioCount: number;
  confirmedMappedApplicationCount: number;
  generatedAt: string;
  portfolios: ConfirmedPortfolioSidecarEntry[];
};
