import { hashNormalizedContent } from "@/market-baseline-mrr/hash";
import type { ReportingPeriod } from "@/market-baseline-mrr/types";
import type {
  MarketBaselinePublicationSemantic,
  PublishedRegistrarPeriodFact,
  PublishedTldPeriodFact,
} from "./types";
import { MARKET_BASELINE_PUBLICATION_SCHEMA_VERSION } from "./types";

/**
 * Shard semantic body — product facts only.
 * Excludes publicationContentSha256 and shardContentSha256 (no circular hash).
 */
export type ShardSemantic = {
  schemaVersion: typeof MARKET_BASELINE_PUBLICATION_SCHEMA_VERSION;
  tldAsciiLabel: string;
  periods: Record<ReportingPeriod, PublishedTldPeriodFact>;
  registrarsByPeriod: Record<ReportingPeriod, PublishedRegistrarPeriodFact[]>;
};

/** Per-shard content digest (publication-specific; does not alter MRR normalized hashes). */
export function hashShardContent(semantic: ShardSemantic): string {
  return hashNormalizedContent(semantic);
}

/**
 * Publication content digest from the compact semantic index.
 * The index commits to every shard via sorted tldShards[].shardContentSha256 —
 * callers must never pass full shard bodies here.
 */
export function hashPublicationContent(
  semantic: MarketBaselinePublicationSemantic,
): string {
  return hashNormalizedContent(semantic);
}

export function shardSemanticFromParts(args: {
  tldAsciiLabel: string;
  periods: Record<ReportingPeriod, PublishedTldPeriodFact>;
  registrarsByPeriod: Record<ReportingPeriod, PublishedRegistrarPeriodFact[]>;
}): ShardSemantic {
  return {
    schemaVersion: MARKET_BASELINE_PUBLICATION_SCHEMA_VERSION,
    tldAsciiLabel: args.tldAsciiLabel,
    periods: args.periods,
    registrarsByPeriod: args.registrarsByPeriod,
  };
}
