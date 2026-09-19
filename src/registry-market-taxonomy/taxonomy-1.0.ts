/**
 * registry-market-taxonomy/1.0 — shared category vocabulary for 2012↔2026 comparisons.
 * Category comparisons require the same taxonomy version on both rounds.
 */

export const REGISTRY_MARKET_TAXONOMY_VERSION = "registry-market-taxonomy/1.0";

export type TaxonomyCategoryId =
  | "community"
  | "geographic"
  | "technology"
  | "consumer"
  | "identity"
  | "media"
  | "brand";

export interface TaxonomyCategoryDefinition {
  id: TaxonomyCategoryId;
  label: string;
  description: string;
}

export const TAXONOMY_CATEGORIES: TaxonomyCategoryDefinition[] = [
  { id: "community", label: "Community", description: "Community-based applications (ICANN community designation)." },
  { id: "geographic", label: "Geographic", description: "Geographic / geoTLD applications (ICANN geographic designation)." },
  { id: "technology", label: "Technology", description: "Technology-oriented generic strings (2026 rehearsal taxonomy)." },
  { id: "consumer", label: "Consumer", description: "Consumer / retail-oriented generics (2026 rehearsal taxonomy)." },
  { id: "identity", label: "Identity", description: "Identity / trust-oriented strings (2026 rehearsal taxonomy)." },
  { id: "media", label: "Media", description: "Media / content-oriented strings (2026 rehearsal taxonomy)." },
  { id: "brand", label: "Brand", description: "Brand / closed generic applications (2026 rehearsal taxonomy)." },
];

export type TaxonomyReviewState = "auto-accepted" | "unclassified" | "requires-review";

export type TaxonomyAssignmentMethod =
  | "reveal-day-community-flag/1.0"
  | "reveal-day-geographic-flag/1.0"
  | "unclassified/1.0";

export interface TaxonomyCategoryAssignment {
  categoryId: TaxonomyCategoryId;
  confidence: number;
  method: TaxonomyAssignmentMethod;
  evidenceRefs: string[];
}

export interface ApplicationTaxonomyRecord {
  applicationId: string;
  taxonomyVersion: typeof REGISTRY_MARKET_TAXONOMY_VERSION;
  categories: TaxonomyCategoryAssignment[];
  reviewState: TaxonomyReviewState;
  modelVersion: null;
}

export interface TaxonomyCoverageReport {
  reportVersion: "taxonomy-coverage/1.0.0";
  taxonomyVersion: typeof REGISTRY_MARKET_TAXONOMY_VERSION;
  applicationCount: number;
  classifiedCount: number;
  unclassifiedCount: number;
  multiLabelCount: number;
  byCategory: Record<TaxonomyCategoryId, number>;
  byMethod: Record<TaxonomyAssignmentMethod, number>;
}
