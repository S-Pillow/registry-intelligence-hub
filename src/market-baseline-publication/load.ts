import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  publicationCurrentPointerPath,
  publicationDir,
  publicationIndexPath,
  publicationTldShardPath,
} from "./paths";
import type {
  MarketBaselinePublicationCurrentPointer,
  MarketBaselinePublicationIndex,
  MarketBaselineTldShard,
  PublishedTldPeriodFact,
} from "./types";

/** Load current publication pointer without scanning the MRR archive. */
export async function loadCurrentPublicationPointer(
  cwd = process.cwd(),
): Promise<MarketBaselinePublicationCurrentPointer | null> {
  try {
    const text = await readFile(publicationCurrentPointerPath(cwd), "utf8");
    return JSON.parse(text) as MarketBaselinePublicationCurrentPointer;
  } catch {
    return null;
  }
}

export async function loadPublicationIndex(
  contentSha256: string,
  cwd = process.cwd(),
): Promise<MarketBaselinePublicationIndex> {
  const text = await readFile(publicationIndexPath(contentSha256, cwd), "utf8");
  return JSON.parse(text) as MarketBaselinePublicationIndex;
}

/** Single-TLD history lookup — does not load other TLD shards or the raw archive. */
export async function loadTldShard(
  contentSha256: string,
  tldAsciiLabel: string,
  cwd = process.cwd(),
): Promise<MarketBaselineTldShard> {
  const text = await readFile(
    publicationTldShardPath(contentSha256, tldAsciiLabel, cwd),
    "utf8",
  );
  return JSON.parse(text) as MarketBaselineTldShard;
}

export async function loadCurrentTldPeriod(
  tldAsciiLabel: string,
  cwd = process.cwd(),
): Promise<PublishedTldPeriodFact | null> {
  const pointer = await loadCurrentPublicationPointer(cwd);
  if (!pointer) return null;
  const index = await loadPublicationIndex(pointer.publicationContentSha256, cwd);
  return (
    index.semantic.currentPeriod.find((f) => f.tldAsciiLabel === tldAsciiLabel) ?? null
  );
}

export function publicationDirExistsPath(contentSha256: string, cwd = process.cwd()): string {
  return publicationDir(contentSha256, cwd);
}

export function shardFilePath(
  contentSha256: string,
  tld: string,
  cwd = process.cwd(),
): string {
  return join(publicationDir(contentSha256, cwd), "tlds", `${tld}.json`);
}
