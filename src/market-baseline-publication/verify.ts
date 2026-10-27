import { hashPublicationContent, hashShardContent, shardSemanticFromParts } from "./hash";
import type {
  MarketBaselinePublicationIndex,
  MarketBaselineTldShard,
  TldShardDigestEntry,
} from "./types";

export type ShardVerificationResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Verify a loaded shard against its own digest and the containing publication.
 * Fail closed on mismatch.
 */
export function verifyTldShard(args: {
  shard: MarketBaselineTldShard;
  publicationContentSha256: string;
  indexDigestEntry?: TldShardDigestEntry;
}): ShardVerificationResult {
  const { shard, publicationContentSha256, indexDigestEntry } = args;

  if (shard.publicationContentSha256 !== publicationContentSha256) {
    return {
      ok: false,
      reason: `shard publicationContentSha256 mismatch: shard=${shard.publicationContentSha256} expected=${publicationContentSha256}`,
    };
  }

  const semantic = shardSemanticFromParts({
    tldAsciiLabel: shard.tldAsciiLabel,
    periods: shard.periods,
    registrarsByPeriod: shard.registrarsByPeriod,
  });
  const recomputed = hashShardContent(semantic);
  if (recomputed !== shard.shardContentSha256) {
    return {
      ok: false,
      reason: `shardContentSha256 mismatch for ${shard.tldAsciiLabel}: recomputed=${recomputed} stored=${shard.shardContentSha256}`,
    };
  }

  if (indexDigestEntry) {
    if (indexDigestEntry.tldAsciiLabel !== shard.tldAsciiLabel) {
      return {
        ok: false,
        reason: `index digest label mismatch: ${indexDigestEntry.tldAsciiLabel} != ${shard.tldAsciiLabel}`,
      };
    }
    if (indexDigestEntry.shardContentSha256 !== shard.shardContentSha256) {
      return {
        ok: false,
        reason: `index digest shardContentSha256 mismatch for ${shard.tldAsciiLabel}`,
      };
    }
  }

  return { ok: true };
}

/**
 * Recompute publicationContentSha256 from index.semantic alone
 * (compact shard digests — does not load shard bodies).
 */
export function verifyPublicationIndexContentSha(
  index: MarketBaselinePublicationIndex,
): ShardVerificationResult {
  const recomputed = hashPublicationContent(index.semantic);
  if (recomputed !== index.publicationContentSha256) {
    return {
      ok: false,
      reason: `publicationContentSha256 mismatch: recomputed=${recomputed} stored=${index.publicationContentSha256}`,
    };
  }
  return { ok: true };
}

export function assertShardVerified(args: {
  shard: MarketBaselineTldShard;
  publicationContentSha256: string;
  indexDigestEntry?: TldShardDigestEntry;
}): void {
  const result = verifyTldShard(args);
  if (!result.ok) {
    throw new Error(result.reason);
  }
}

export function assertPublicationIndexVerified(
  index: MarketBaselinePublicationIndex,
): void {
  const result = verifyPublicationIndexContentSha(index);
  if (!result.ok) {
    throw new Error(result.reason);
  }
}
