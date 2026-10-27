import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";
import type { BuiltPublication } from "./build";
import {
  publicationCurrentPointerPath,
  publicationDir,
  publicationIndexPath,
  publicationTldShardPath,
} from "./paths";
import type { MarketBaselinePublicationCurrentPointer } from "./types";

async function ensureParent(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

export async function writePublicationArtifacts(
  built: BuiltPublication,
  cwd = process.cwd(),
): Promise<{
  contentSha256: string;
  indexPath: string;
  shardPaths: string[];
  currentPointerPath: string;
}> {
  const sha = built.index.publicationContentSha256;
  await mkdir(publicationDir(sha, cwd), { recursive: true });
  await mkdir(publicationDir(sha, cwd) + "/tlds", { recursive: true });

  const indexPath = publicationIndexPath(sha, cwd);
  await ensureParent(indexPath);
  await writeFile(indexPath, `${JSON.stringify(built.index, null, 2)}\n`, "utf8");

  const shardPaths: string[] = [];
  for (const shard of built.shards) {
    const path = publicationTldShardPath(sha, shard.tldAsciiLabel, cwd);
    await ensureParent(path);
    await writeFile(path, `${JSON.stringify(shard, null, 2)}\n`, "utf8");
    shardPaths.push(path);
  }

  const pointer: MarketBaselinePublicationCurrentPointer = {
    publicationContentSha256: sha,
    indexRelativePath: relative(cwd, indexPath),
    generatedAt: built.index.generatedAt,
    asOfDate: built.index.semantic.asOfDate,
    sourceReportingPeriod: built.index.semantic.sourceReportingPeriod,
  };
  const currentPointerPath = publicationCurrentPointerPath(cwd);
  await ensureParent(currentPointerPath);
  await writeFile(currentPointerPath, `${JSON.stringify(pointer, null, 2)}\n`, "utf8");

  return { contentSha256: sha, indexPath, shardPaths, currentPointerPath };
}
