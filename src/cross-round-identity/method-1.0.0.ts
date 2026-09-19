import registryFixture from "@/data/fixtures/registry-applications.json";
import {
  CROSS_ROUND_IDENTITY_METHOD_VERSION,
  CROSS_ROUND_IDENTITY_REGISTRY_VERSION,
  type CrossRoundIdentityLink,
  type CrossRoundIdentityLinkRegistry,
  type ResolvedCrossRoundIdentityLink,
} from "./types";

/** Maps synthetic rehearsal 2026 org keys to fixture organization labels — method proof only. */
const REHEARSAL_2026_ORG_KEY_TO_FIXTURE_LABEL: Record<string, string> = {
  "rehearsal-org:atlas-digital": "Atlas Digital",
  "rehearsal-org:kizuna-registry": "Kizuna Registry",
};

export function validateCrossRoundIdentityRegistry(registry: CrossRoundIdentityLinkRegistry): void {
  if (registry.registryVersion !== CROSS_ROUND_IDENTITY_REGISTRY_VERSION) {
    throw new Error(
      `cross-round identity registry version mismatch: expected ${CROSS_ROUND_IDENTITY_REGISTRY_VERSION}, got ${registry.registryVersion}`,
    );
  }
  if (registry.methodVersion !== CROSS_ROUND_IDENTITY_METHOD_VERSION) {
    throw new Error(
      `cross-round identity method mismatch: expected ${CROSS_ROUND_IDENTITY_METHOD_VERSION}, got ${registry.methodVersion}`,
    );
  }

  const seenLinkIds = new Set<string>();
  const seenPairs = new Set<string>();

  for (const link of registry.links) {
    if (link.methodVersion !== CROSS_ROUND_IDENTITY_METHOD_VERSION) {
      throw new Error(`Link ${link.linkId} methodVersion must be ${CROSS_ROUND_IDENTITY_METHOD_VERSION}`);
    }
    if (link.evidence.length === 0) {
      throw new Error(`Link ${link.linkId} requires non-empty evidence`);
    }
    if (seenLinkIds.has(link.linkId)) {
      throw new Error(`Duplicate linkId ${link.linkId}`);
    }
    seenLinkIds.add(link.linkId);

    const pairKey = `${link.round2012OrganizationKey}↔${link.round2026OrganizationKey}`;
    if (seenPairs.has(pairKey)) {
      throw new Error(`Silent merge blocked: duplicate identity pair ${pairKey}`);
    }
    seenPairs.add(pairKey);
  }
}

export function resolveCrossRoundIdentityLinks(
  registry: CrossRoundIdentityLinkRegistry,
): ResolvedCrossRoundIdentityLink[] {
  validateCrossRoundIdentityRegistry(registry);

  const fixtureOrgs = new Set(registryFixture.applications.map((a) => a.organization));

  return registry.links.map((link) => {
    const label = REHEARSAL_2026_ORG_KEY_TO_FIXTURE_LABEL[link.round2026OrganizationKey];
    if (link.purpose === "method-rehearsal-only" && label && !fixtureOrgs.has(label)) {
      throw new Error(
        `Rehearsal link ${link.linkId} references missing fixture organization label ${label}`,
      );
    }
    return {
      ...link,
      rehearsalFixtureOrganizationLabel: label,
    };
  });
}

export function linksEligibleForIdentityComparison(links: CrossRoundIdentityLink[]): CrossRoundIdentityLink[] {
  return links.filter(
    (link) =>
      link.reviewState === "steward-approved" ||
      (link.purpose === "method-rehearsal-only" && link.reviewState === "pending-steward"),
  );
}

export function buildCrossRoundIdentityReport(registry: CrossRoundIdentityLinkRegistry) {
  const resolved = resolveCrossRoundIdentityLinks(registry);
  return {
    reportVersion: "cross-round-identity-report/1.0.0",
    methodVersion: CROSS_ROUND_IDENTITY_METHOD_VERSION,
    registryVersion: CROSS_ROUND_IDENTITY_REGISTRY_VERSION,
    linkCount: resolved.length,
    rehearsalOnlyCount: resolved.filter((l) => l.purpose === "method-rehearsal-only").length,
    stewardApprovedCount: resolved.filter((l) => l.reviewState === "steward-approved").length,
    links: resolved.map((l) => ({
      linkId: l.linkId,
      round2012OrganizationKey: l.round2012OrganizationKey,
      round2026OrganizationKey: l.round2026OrganizationKey,
      purpose: l.purpose,
      confidence: l.confidence,
      reviewState: l.reviewState,
      rehearsalFixtureOrganizationLabel: l.rehearsalFixtureOrganizationLabel ?? null,
      claimsReal2026Identity: false,
    })),
    disclaimer:
      "Rehearsal links prove cross-round-identity/1.0.0 only. They do not assert real 2026 publication identity.",
  };
}
