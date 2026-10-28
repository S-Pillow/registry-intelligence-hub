import { HISTORICAL_ORGANIZATION_LINEAGE_REGISTRY_1 } from "./fixtures/lineage-registry-1";
import { lineageAliasMatches } from "./normalize-alias";
import type {
  HistoricalOrganizationLineageRecord,
  HistoricalOrganizationLineageRegistry,
} from "./types";

export function loadHistoricalOrganizationLineageRegistry(): HistoricalOrganizationLineageRegistry {
  return HISTORICAL_ORGANIZATION_LINEAGE_REGISTRY_1;
}

export function listApprovedHistoricalLineages(
  registry: HistoricalOrganizationLineageRegistry = loadHistoricalOrganizationLineageRegistry(),
): HistoricalOrganizationLineageRecord[] {
  return registry.records.filter((r) => r.stewardState === "steward-approved");
}

export function lineagesForCurrentOrganizationKey(
  organizationKey: string,
  registry: HistoricalOrganizationLineageRegistry = loadHistoricalOrganizationLineageRegistry(),
): HistoricalOrganizationLineageRecord[] {
  return listApprovedHistoricalLineages(registry).filter(
    (r) => r.currentOrganizationKey === organizationKey,
  );
}

export function lineagesForHistoricalOrganizationKey(
  organizationKey: string,
  registry: HistoricalOrganizationLineageRegistry = loadHistoricalOrganizationLineageRegistry(),
): HistoricalOrganizationLineageRecord[] {
  return listApprovedHistoricalLineages(registry).filter(
    (r) => r.historicalOrganizationKey === organizationKey,
  );
}

export function resolveLineageByAlias(
  query: string,
  registry: HistoricalOrganizationLineageRegistry = loadHistoricalOrganizationLineageRegistry(),
): HistoricalOrganizationLineageRecord[] {
  return listApprovedHistoricalLineages(registry).filter((r) =>
    lineageAliasMatches(query, [
      ...r.aliases,
      r.historicalCanonicalName,
      r.currentCanonicalName,
      r.historicalOrganizationKey,
      r.currentOrganizationKey,
    ]),
  );
}

export function relationshipTypeLabel(type: HistoricalOrganizationLineageRecord["relationshipType"]): string {
  switch (type) {
    case "SAME_ENTITY_RENAME":
      return "Same-entity rename";
    case "BUSINESS_LINE_SUCCESSION":
      return "Business-line succession";
    case "ACQUISITION":
      return "Acquisition";
    case "MERGER":
      return "Merger";
    case "OTHER_EVIDENCE_BACKED_SUCCESSION":
      return "Evidence-backed succession";
  }
}
