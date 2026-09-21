"use client";

import { createContext, useContext } from "react";
import type { HistoricalMetricFact } from "@/comparison/historical-2012-ui-adapter";
import type { Application, EntityType } from "@/lib/registry-data";
import type { SavedWork } from "@/lib/use-saved-work";

export type CompareEntityType = EntityType;

export type InvestigationKind = "application" | "applicant" | "category" | "string" | "signal" | "metric" | "coverage" | "dataset";

/** Explore dataset context for drawer actions — prevents 2012 historical rows routing into 2026 rehearsal flows. */
export type InvestigationExploreDataset = "2026-rehearsal" | "2012-historical";

export type InvestigationItem = {
  id: string;
  label: string;
  kind: InvestigationKind;
  records: readonly Application[];
  entityType?: CompareEntityType;
  entityKey?: string;
  /** Approved 2012 aggregate fact — supporting records may still be rehearsal fixture browse context. */
  historicalFact?: HistoricalMetricFact;
  /** Optional override for drawer “View full” when records are aggregate-only or filtered cohorts. */
  exploreFullHref?: string;
  /** When set from Explore, drawer provenance and downstream actions stay on this dataset. */
  exploreDataset?: InvestigationExploreDataset;
};

export type InvestigationContextValue = {
  investigate: (item: InvestigationItem) => void;
  addCompare: (item: InvestigationItem) => void;
  removeCompare: (id: string) => void;
  toggleWatch: (item: InvestigationItem) => void;
  compareItems: InvestigationItem[];
  watchedIds: Set<string>;
  savedWork: SavedWork;
};

export const InvestigationContext = createContext<InvestigationContextValue | null>(null);

export function useInvestigation() {
  const value = useContext(InvestigationContext);
  if (!value) throw new Error("Investigation controls require CommandCenter context");
  return value;
}
