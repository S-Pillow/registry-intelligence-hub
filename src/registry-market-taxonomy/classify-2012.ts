import type { RevealDayCsvRow } from "../normalization/parse-reveal-csv";
import {
  REGISTRY_MARKET_TAXONOMY_VERSION,
  type ApplicationTaxonomyRecord,
  type TaxonomyCategoryAssignment,
  type TaxonomyCoverageReport,
  type TaxonomyCategoryId,
} from "./taxonomy-1.0";

function yesFlag(value: string | null | undefined): boolean {
  return (value ?? "").trim().toLowerCase() === "yes";
}

function assignFromRow(row: RevealDayCsvRow): ApplicationTaxonomyRecord {
  const categories: TaxonomyCategoryAssignment[] = [];
  const community = row.preservedColumns["Community?"] ?? null;
  const geographic = row.preservedColumns["Geographic?"] ?? null;

  if (yesFlag(community)) {
    categories.push({
      categoryId: "community",
      confidence: 1,
      method: "reveal-day-community-flag/1.0",
      evidenceRefs: [`csv:Community?=Yes@applicationId=${row.applicationId}`],
    });
  }
  if (yesFlag(geographic)) {
    categories.push({
      categoryId: "geographic",
      confidence: 1,
      method: "reveal-day-geographic-flag/1.0",
      evidenceRefs: [`csv:Geographic?=Yes@applicationId=${row.applicationId}`],
    });
  }

  const reviewState = categories.length === 0 ? "unclassified" : "auto-accepted";

  return {
    applicationId: row.applicationId,
    taxonomyVersion: REGISTRY_MARKET_TAXONOMY_VERSION,
    categories,
    reviewState,
    modelVersion: null,
  };
}

export function classify2012RevealDayApplications(rows: RevealDayCsvRow[]): ApplicationTaxonomyRecord[] {
  const sorted = [...rows].sort((a, b) => a.applicationId.localeCompare(b.applicationId));
  return sorted.map(assignFromRow);
}

export function buildTaxonomyCoverageReport(records: ApplicationTaxonomyRecord[]): TaxonomyCoverageReport {
  const byCategory: Record<TaxonomyCategoryId, number> = {
    community: 0,
    geographic: 0,
    technology: 0,
    consumer: 0,
    identity: 0,
    media: 0,
    brand: 0,
  };
  const byMethod: Record<string, number> = {
    "reveal-day-community-flag/1.0": 0,
    "reveal-day-geographic-flag/1.0": 0,
    "unclassified/1.0": 0,
  };

  let classifiedCount = 0;
  let unclassifiedCount = 0;
  let multiLabelCount = 0;

  for (const record of records) {
    if (record.categories.length === 0) {
      unclassifiedCount += 1;
      byMethod["unclassified/1.0"] += 1;
    } else {
      classifiedCount += 1;
      if (record.categories.length > 1) multiLabelCount += 1;
      for (const cat of record.categories) {
        byCategory[cat.categoryId] += 1;
        byMethod[cat.method] = (byMethod[cat.method] ?? 0) + 1;
      }
    }
  }

  return {
    reportVersion: "taxonomy-coverage/1.0.0",
    taxonomyVersion: REGISTRY_MARKET_TAXONOMY_VERSION,
    applicationCount: records.length,
    classifiedCount,
    unclassifiedCount,
    multiLabelCount,
    byCategory,
    byMethod: byMethod as TaxonomyCoverageReport["byMethod"],
  };
}
