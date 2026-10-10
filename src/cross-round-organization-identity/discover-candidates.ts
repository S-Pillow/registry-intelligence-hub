import { normalizeApplicantNameForCandidateDiscovery } from "@/organization-resolution-2026/normalize-applicant-name";
import type { ResolvedOrganization2026 } from "@/organization-resolution-2026/types";
import type { Confirmed2012Organization } from "./types";

export type DiscoverySignal =
  | "exact-organization-key-lineage"
  | "possible2012-organization-key-hint"
  | "exact-canonical-name-overlap"
  | "exact-alias-overlap";

export type DiscoveredCrossRoundCandidate = {
  organization2026Id: string;
  organization2026Key: string;
  organization2012Id: string;
  organization2012Key: string;
  signals: DiscoverySignal[];
};

/**
 * Bounded discovery only — never confirms. Uses confirmed aliases/keys/canonical names.
 * Name similarity alone is intentionally not a discovery method here.
 */
export function discoverCrossRoundCandidates(input: {
  confirmed2026: ResolvedOrganization2026[];
  confirmed2012: Confirmed2012Organization[];
  /** Exact 2012 Applicant legal names → confirmed org key (from loadConfirmed2012ApplicantAliases). */
  confirmed2012ApplicantAliases?: Map<string, { organizationKey: string }>;
}): DiscoveredCrossRoundCandidate[] {
  const by2012Key = new Map(input.confirmed2012.map((o) => [o.organizationKey, o]));
  const by2012CanonicalNorm = new Map<string, Confirmed2012Organization[]>();
  for (const org of input.confirmed2012) {
    const key = normalizeApplicantNameForCandidateDiscovery(org.canonicalOrganizationName);
    const list = by2012CanonicalNorm.get(key) ?? [];
    list.push(org);
    by2012CanonicalNorm.set(key, list);
  }

  const pairSignals = new Map<string, Set<DiscoverySignal>>();

  function add(
    org2026: ResolvedOrganization2026,
    org2012: Confirmed2012Organization,
    signal: DiscoverySignal,
  ) {
    const pair = `${org2026.organizationId}↔${org2012.organizationId}`;
    const signals = pairSignals.get(pair) ?? new Set();
    signals.add(signal);
    pairSignals.set(pair, signals);
  }

  for (const org2026 of input.confirmed2026) {
    if (org2026.status !== "CONFIRMED") continue;

    // Key lineage: hist-2012-{key} or exact key match against confirmed 2012 keys
    const lineageKey = org2026.organizationKey.startsWith("hist-2012-")
      ? org2026.organizationKey.slice("hist-2012-".length)
      : org2026.organizationKey;
    const lineage = by2012Key.get(lineageKey);
    if (lineage) add(org2026, lineage, "exact-organization-key-lineage");

    if (org2026.possible2012OrganizationKey) {
      const hinted = by2012Key.get(org2026.possible2012OrganizationKey);
      if (hinted) add(org2026, hinted, "possible2012-organization-key-hint");
    }

    const canonHits =
      by2012CanonicalNorm.get(normalizeApplicantNameForCandidateDiscovery(org2026.canonicalName)) ?? [];
    for (const hit of canonHits) add(org2026, hit, "exact-canonical-name-overlap");

    if (input.confirmed2012ApplicantAliases) {
      for (const legalName of org2026.applicantLegalNames) {
        const alias = input.confirmed2012ApplicantAliases.get(legalName);
        if (!alias) continue;
        const org2012 = by2012Key.get(alias.organizationKey);
        if (org2012) add(org2026, org2012, "exact-alias-overlap");
      }
    }
  }

  const out: DiscoveredCrossRoundCandidate[] = [];
  for (const [pair, signals] of pairSignals) {
    const [organization2026Id, organization2012Id] = pair.split("↔");
    const org2026 = input.confirmed2026.find((o) => o.organizationId === organization2026Id)!;
    const org2012 = input.confirmed2012.find((o) => o.organizationId === organization2012Id)!;
    out.push({
      organization2026Id: org2026.organizationId,
      organization2026Key: org2026.organizationKey,
      organization2012Id: org2012.organizationId,
      organization2012Key: org2012.organizationKey,
      signals: [...signals].sort(),
    });
  }

  return out.sort(
    (a, b) =>
      a.organization2026Key.localeCompare(b.organization2026Key) ||
      a.organization2012Key.localeCompare(b.organization2012Key),
  );
}
