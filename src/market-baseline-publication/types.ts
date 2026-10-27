import type {
  OptionalMetric,
  RegistrarClassification,
  ReportingPeriod,
  SchemaProfileId,
} from "@/market-baseline-mrr/types";
import {
  MRR_PARSER_VERSION,
  MRR_TRANSACTIONS_SCHEMA_VERSION,
} from "@/market-baseline-mrr/types";

export const MARKET_BASELINE_PUBLICATION_SCHEMA_VERSION =
  "market-baseline-publication/1.0.0" as const;

export const MARKET_BASELINE_PUBLICATION_BUILDER_VERSION =
  "market-baseline-publication-builder/1.0.0" as const;

export type FactAvailability = "AVAILABLE" | "MISSING";

export type PublishedFactProvenance = {
  sourceSystem: "icann-mrr-transactions";
  sourceUrl: string;
  rawSha256: string;
  normalizedContentSha256: string;
  normalizedSchemaVersion: typeof MRR_TRANSACTIONS_SCHEMA_VERSION;
  parserVersion: typeof MRR_PARSER_VERSION;
  schemaProfileVersion: SchemaProfileId;
};

/** TLD × reporting period product fact (intrinsic + derived temporal). */
export type PublishedTldPeriodAvailable = {
  availability: "AVAILABLE";
  tldAsciiLabel: string;
  reportingPeriod: ReportingPeriod;
  totalDomains: number;
  netAddsCount: number;
  netRenewCount: number;
  deleteCount: number;
  transferGainingCount: number;
  transferLosingCount: number;
  registrarBreadth: number;
  topRegistrarShare: OptionalMetric;
  top5RegistrarShare: OptionalMetric;
  accreditedRegistrarDomains: number;
  specialOrSystemDomains: number;
  netDomainBaseChange: OptionalMetric;
  monthOverMonthGrowth: OptionalMetric;
  yearOverYearGrowth: OptionalMetric;
  provenance: PublishedFactProvenance;
};

export type PublishedTldPeriodMissing = {
  availability: "MISSING";
  tldAsciiLabel: string;
  reportingPeriod: ReportingPeriod;
  reason: string;
};

export type PublishedTldPeriodFact = PublishedTldPeriodAvailable | PublishedTldPeriodMissing;

export type PublishedRegistrarPeriodFact = {
  tldAsciiLabel: string;
  reportingPeriod: ReportingPeriod;
  ianaRegistrarId: string;
  registrarName: string;
  classification: RegistrarClassification;
  totalDomains: number;
  /** Share of Totals.totalDomains; unavailable when denominator is 0. */
  shareOfTldTotal: OptionalMetric;
  provenance: PublishedFactProvenance;
};

export type TldDomainBaseRankEntry = {
  rank: number;
  tldAsciiLabel: string;
  totalDomains: number;
  reportingPeriod: ReportingPeriod;
};

export type TldGrowthRankEntry = {
  rank: number;
  tldAsciiLabel: string;
  reportingPeriod: ReportingPeriod;
  monthOverMonthGrowth: number;
  totalDomains: number;
};

export type PublicationCoverage = {
  sourceReportingPeriod: ReportingPeriod;
  tldCountInPublication: number;
  availableAtSourcePeriod: number;
  missingAtSourcePeriod: number;
  tldHistoryPeriodCounts: Record<string, number>;
};

/**
 * Semantic publication body — product-fact identity.
 * Excludes generatedAt and asOfDate (build/provenance envelope metadata).
 */
export type MarketBaselinePublicationSemantic = {
  schemaVersion: typeof MARKET_BASELINE_PUBLICATION_SCHEMA_VERSION;
  builderVersion: typeof MARKET_BASELINE_PUBLICATION_BUILDER_VERSION;
  sourceReportingPeriod: ReportingPeriod;
  coverage: PublicationCoverage;
  /** Current-period TLD facts only (AVAILABLE + MISSING for universe). */
  currentPeriod: PublishedTldPeriodFact[];
  domainBaseRanking: TldDomainBaseRankEntry[];
  /** MoM growth ranking among TLDs with available MoM at source period. */
  monthOverMonthGrowthRanking: TldGrowthRankEntry[];
  /** Relative paths of per-TLD shards included in this publication. */
  tldShardPaths: string[];
};

export type MarketBaselinePublicationIndex = {
  semantic: MarketBaselinePublicationSemantic;
  publicationContentSha256: string;
  /** Build/provenance metadata — outside semantic content identity. */
  generatedAt: string;
  /** Calendar as-of used to derive sourceReportingPeriod — outside semantic hash. */
  asOfDate: string;
  /** Governing acquisition run — outside semantic content identity. */
  sourceAcquisitionRunId?: string;
  /** Verified outcomes artifact SHA — outside semantic content identity. */
  sourceOutcomesArtifactSha256?: string;
  /** Operational indexes/current.json run when present. */
  operationalCurrentRunId?: string | null;
  /** True when operational current differs from governing publication run. */
  operationalCurrentDiffersFromGoverning?: boolean;
};

export type MarketBaselineTldShard = {
  schemaVersion: typeof MARKET_BASELINE_PUBLICATION_SCHEMA_VERSION;
  tldAsciiLabel: string;
  publicationContentSha256: string;
  /** Period → TLD-month fact (history). */
  periods: Record<ReportingPeriod, PublishedTldPeriodFact>;
  /** Period → registrar rows (Totals excluded). */
  registrarsByPeriod: Record<ReportingPeriod, PublishedRegistrarPeriodFact[]>;
};

export type MarketBaselinePublicationCurrentPointer = {
  publicationContentSha256: string;
  indexRelativePath: string;
  generatedAt: string;
  asOfDate: string;
  sourceReportingPeriod: ReportingPeriod;
  sourceAcquisitionRunId?: string;
  sourceOutcomesArtifactSha256?: string;
  operationalCurrentRunId?: string | null;
  operationalCurrentDiffersFromGoverning?: boolean;
};
