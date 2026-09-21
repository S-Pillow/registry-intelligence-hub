import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  CONFIRMED_2012_MAPPED_APPLICATION_COUNT,
  CONFIRMED_2012_PORTFOLIO_COUNT,
  REGISTRY_BROWSER_2012_CONFIRMED_PORTFOLIOS_VERSION,
} from "@/historical-2012/confirmed-portfolios-constants";
import type {
  ConfirmedPortfolioSidecarEntry,
  Registry2012ConfirmedPortfoliosDocument,
} from "@/historical-2012/confirmed-portfolios-sidecar-types";
import { REGISTRY_2012_BROWSER_SNAPSHOT_ID } from "@/historical-2012/browser-payload-types";
import { APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH } from "@/historical-2012/approved-corpus-hash";
import { contentHash } from "@/normalization/hashes";
import { loadFixtureBundle } from "@/normalization/load-bundle";
import type { OrganizationPromotionOperation, OrganizationPromotionRegistry } from "@/normalization/types";
import {
  ORGANIZATION_PROMOTION_METHOD_VERSION,
  ORGANIZATION_PROMOTION_REGISTRY_VERSION,
} from "@/normalization/types";
import { validatePromotionOperation } from "@/normalization/organization-promotion";

const FULL_ROUND_BUNDLE_ID = "icann2012-reveal-day-v1";

function mergeConfirmedOps(
  operations: OrganizationPromotionOperation[],
): ConfirmedPortfolioSidecarEntry[] {
  const confirmed = operations.filter((op) => op.promotionState === "CONFIRMED");
  const byKey = new Map<string, ConfirmedPortfolioSidecarEntry>();

  for (const op of confirmed) {
    validatePromotionOperation(op);
    const existing = byKey.get(op.organizationKey);
    if (!existing) {
      byKey.set(op.organizationKey, {
        organizationKey: op.organizationKey,
        canonicalOrganizationName: op.canonicalOrganizationName,
        promotionState: "CONFIRMED",
        confidence: op.confidence === "low" ? "medium" : op.confidence,
        reviewState: "steward-approved",
        methodVersion: ORGANIZATION_PROMOTION_METHOD_VERSION,
        evidence: [...op.evidence],
        promotionOpIds: [op.opId],
        memberApplicationIds: [...op.applicationIds],
      });
      continue;
    }
    if (existing.canonicalOrganizationName !== op.canonicalOrganizationName) {
      throw new Error(`Organization key ${op.organizationKey} has conflicting canonical names`);
    }
    existing.promotionOpIds.push(op.opId);
    existing.memberApplicationIds.push(...op.applicationIds);
    existing.evidence.push(...op.evidence);
  }

  for (const entry of byKey.values()) {
    entry.memberApplicationIds = [...new Set(entry.memberApplicationIds)].sort();
    entry.promotionOpIds = [...new Set(entry.promotionOpIds)].sort();
    entry.evidence = [...new Set(entry.evidence)];
  }

  return [...byKey.values()].sort((a, b) => a.organizationKey.localeCompare(b.organizationKey));
}

function assertPortfolioCounts(portfolios: ConfirmedPortfolioSidecarEntry[]): void {
  const portfolioCount = portfolios.length;
  const mappedApps = portfolios.reduce((sum, row) => sum + row.memberApplicationIds.length, 0);
  if (portfolioCount !== CONFIRMED_2012_PORTFOLIO_COUNT) {
    throw new Error(`Expected ${CONFIRMED_2012_PORTFOLIO_COUNT} confirmed portfolios, got ${portfolioCount}`);
  }
  if (mappedApps !== CONFIRMED_2012_MAPPED_APPLICATION_COUNT) {
    throw new Error(
      `Expected ${CONFIRMED_2012_MAPPED_APPLICATION_COUNT} confirmed mapped applications, got ${mappedApps}`,
    );
  }
}

export async function buildRegistry2012ConfirmedPortfoliosDocument(
  workspaceRoot: string,
): Promise<Registry2012ConfirmedPortfoliosDocument> {
  const loaded = await loadFixtureBundle(FULL_ROUND_BUNDLE_ID, workspaceRoot);
  const registry: OrganizationPromotionRegistry = loaded.organizationPromotions;
  if (registry.registryVersion !== ORGANIZATION_PROMOTION_REGISTRY_VERSION) {
    throw new Error("Unexpected organization promotion registry version");
  }
  if (registry.methodVersion !== ORGANIZATION_PROMOTION_METHOD_VERSION) {
    throw new Error("Unexpected organization promotion method version");
  }

  const registryPath = join(
    workspaceRoot,
    "src/normalization/fixtures/icann2012-reveal-day-v1/organization-promotions.json",
  );
  const registryText = await readFile(registryPath, "utf8");
  const sourcePromotionRegistryContentHash = contentHash(JSON.parse(registryText));

  const portfolios = mergeConfirmedOps(registry.operations);
  assertPortfolioCounts(portfolios);

  return {
    payloadVersion: REGISTRY_BROWSER_2012_CONFIRMED_PORTFOLIOS_VERSION,
    payloadMode: "historical-2012-confirmed-portfolios",
    roundProgramYear: 2012,
    baseApplicationPayloadCorpusContentHash: APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH,
    baseApplicationPayloadSnapshotId: REGISTRY_2012_BROWSER_SNAPSHOT_ID,
    organizationPromotionRegistryVersion: ORGANIZATION_PROMOTION_REGISTRY_VERSION,
    organizationPromotionMethodVersion: ORGANIZATION_PROMOTION_METHOD_VERSION,
    sourcePromotionRegistryContentHash,
    confirmedPortfolioCount: CONFIRMED_2012_PORTFOLIO_COUNT,
    confirmedMappedApplicationCount: CONFIRMED_2012_MAPPED_APPLICATION_COUNT,
    generatedAt: new Date().toISOString(),
    portfolios,
  };
}
