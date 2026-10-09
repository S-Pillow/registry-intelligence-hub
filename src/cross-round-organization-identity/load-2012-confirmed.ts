import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { contentHash } from "@/normalization/hashes";
import type { OrganizationPromotionRegistry } from "@/normalization/types";
import {
  DEFAULT_2012_PROMOTION_REGISTRY_RELATIVE,
  ORGANIZATION_2012_ENTITY_PREFIX,
  PINNED_2012_ORG_PROMOTION_METHOD_VERSION,
  PINNED_2012_ORG_PROMOTION_REGISTRY_CONTENT_SHA256,
  PINNED_2012_ORG_PROMOTION_REGISTRY_VERSION,
} from "./constants";
import type { Confirmed2012Organization, OrganizationLayerPin } from "./types";

export type Loaded2012ConfirmedUniverse = {
  organizations: Confirmed2012Organization[];
  pin: OrganizationLayerPin;
  registryContentSha256: string;
  /** Offline registry includes candidate/ambiguous — never used as confirmed identity. */
  excludedCandidateOrganizationKeys: string[];
  excludedAmbiguousOrganizationKeys: string[];
  offlinePromotedOrganizationCount: number;
  offlinePromotedApplicationCount: number;
};

/**
 * Load only steward-CONFIRMED 2012 Organizations from the accepted promotion registry.
 * Candidate/ambiguous records are inventoried for disclosure but excluded from matching.
 */
export async function loadConfirmed2012OrganizationUniverse(
  workspaceRoot: string,
  registryRelativePath: string = DEFAULT_2012_PROMOTION_REGISTRY_RELATIVE,
): Promise<Loaded2012ConfirmedUniverse> {
  const path = join(workspaceRoot, registryRelativePath);
  const raw = await readFile(path, "utf8");
  const registry = JSON.parse(raw) as OrganizationPromotionRegistry;
  if (registry.registryVersion !== PINNED_2012_ORG_PROMOTION_REGISTRY_VERSION) {
    throw new Error(
      `2012 promotion registry version mismatch: expected ${PINNED_2012_ORG_PROMOTION_REGISTRY_VERSION}, got ${registry.registryVersion}`,
    );
  }
  if (registry.methodVersion !== PINNED_2012_ORG_PROMOTION_METHOD_VERSION) {
    throw new Error(
      `2012 promotion method mismatch: expected ${PINNED_2012_ORG_PROMOTION_METHOD_VERSION}, got ${registry.methodVersion}`,
    );
  }

  const registryContentSha256 = contentHash(registry);
  if (registryContentSha256 !== PINNED_2012_ORG_PROMOTION_REGISTRY_CONTENT_SHA256) {
    throw new Error(
      `2012 promotion registry pin mismatch: expected ${PINNED_2012_ORG_PROMOTION_REGISTRY_CONTENT_SHA256}, got ${registryContentSha256}`,
    );
  }

  const confirmedByKey = new Map<string, Confirmed2012Organization>();
  const excludedCandidateOrganizationKeys: string[] = [];
  const excludedAmbiguousOrganizationKeys: string[] = [];
  const offlineApps = new Set<string>();
  const offlineOrgs = new Set<string>();

  for (const op of registry.operations) {
    offlineOrgs.add(op.organizationKey);
    for (const id of op.applicationIds) offlineApps.add(id);

    if (op.promotionState === "CANDIDATE") {
      excludedCandidateOrganizationKeys.push(op.organizationKey);
      continue;
    }
    if (op.promotionState === "AMBIGUOUS") {
      excludedAmbiguousOrganizationKeys.push(op.organizationKey);
      continue;
    }
    if (op.promotionState !== "CONFIRMED") continue;
    if (op.reviewState !== "steward-approved") {
      throw new Error(`CONFIRMED 2012 op ${op.opId} lacks steward-approved reviewState`);
    }
    if (op.confidence !== "high" && op.confidence !== "medium") {
      throw new Error(`CONFIRMED 2012 op ${op.opId} requires high/medium confidence`);
    }

    const existing = confirmedByKey.get(op.organizationKey);
    if (existing) {
      existing.memberApplicationIds = [...new Set([...existing.memberApplicationIds, ...op.applicationIds])].sort();
      existing.evidence = [...new Set([...existing.evidence, ...op.evidence])];
      existing.promotionOpIds = [...new Set([...existing.promotionOpIds, op.opId])].sort();
    } else {
      confirmedByKey.set(op.organizationKey, {
        organizationId: `${ORGANIZATION_2012_ENTITY_PREFIX}${op.organizationKey}`,
        organizationKey: op.organizationKey,
        canonicalOrganizationName: op.canonicalOrganizationName,
        memberApplicationIds: [...op.applicationIds].sort(),
        evidence: [...op.evidence],
        promotionOpIds: [op.opId],
        confidence: op.confidence,
        reviewState: "steward-approved",
      });
    }
  }

  const organizations = [...confirmedByKey.values()].sort((a, b) =>
    a.organizationKey.localeCompare(b.organizationKey),
  );
  const confirmedApps = new Set(organizations.flatMap((o) => o.memberApplicationIds));

  return {
    organizations,
    registryContentSha256,
    excludedCandidateOrganizationKeys: [...new Set(excludedCandidateOrganizationKeys)].sort(),
    excludedAmbiguousOrganizationKeys: [...new Set(excludedAmbiguousOrganizationKeys)].sort(),
    offlinePromotedOrganizationCount: offlineOrgs.size,
    offlinePromotedApplicationCount: offlineApps.size,
    pin: {
      round: 2012,
      schemaOrRegistryVersion: PINNED_2012_ORG_PROMOTION_REGISTRY_VERSION,
      methodVersion: PINNED_2012_ORG_PROMOTION_METHOD_VERSION,
      contentSha256: registryContentSha256,
      confirmedOrganizationCount: organizations.length,
      confirmedApplicationCount: confirmedApps.size,
    },
  };
}
