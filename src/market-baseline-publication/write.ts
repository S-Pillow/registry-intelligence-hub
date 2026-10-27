import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { randomBytes } from "node:crypto";
import type { BuiltPublication } from "./build";
import type { ShardSemantic } from "./hash";
import {
  publicationCurrentPointerPath,
  publicationDir,
  publicationIndexPath,
  publicationStagingDir,
  publicationTldShardPath,
} from "./paths";
import type {
  MarketBaselinePublicationCurrentPointer,
  MarketBaselinePublicationIndex,
  MarketBaselineTldShard,
} from "./types";
import { MARKET_BASELINE_PUBLICATION_SCHEMA_VERSION } from "./types";

async function ensureParent(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

export type StagedShardRecord = {
  shardContentSha256: string;
  semantic: ShardSemantic;
};

export async function createPublicationStagingDir(
  cwd = process.cwd(),
): Promise<{ stagingId: string; stagingDir: string }> {
  const stagingId = `pub-${Date.now()}-${randomBytes(6).toString("hex")}`;
  const stagingDir = publicationStagingDir(stagingId, cwd);
  await mkdir(join(stagingDir, "tlds"), { recursive: true });
  return { stagingId, stagingDir };
}

export async function writeStagedShardSemantic(args: {
  stagingDir: string;
  tldAsciiLabel: string;
  shardContentSha256: string;
  semantic: ShardSemantic;
}): Promise<string> {
  const path = join(args.stagingDir, "tlds", `${args.tldAsciiLabel}.json`);
  const record: StagedShardRecord = {
    shardContentSha256: args.shardContentSha256,
    semantic: args.semantic,
  };
  await ensureParent(path);
  await writeFile(path, `${JSON.stringify(record)}\n`, "utf8");
  return path;
}

export async function readStagedShardSemantic(
  stagingDir: string,
  tldAsciiLabel: string,
): Promise<StagedShardRecord> {
  const path = join(stagingDir, "tlds", `${tldAsciiLabel}.json`);
  const text = await readFile(path, "utf8");
  return JSON.parse(text) as StagedShardRecord;
}

export async function cleanupPublicationStaging(
  stagingDir: string,
): Promise<void> {
  await rm(stagingDir, { recursive: true, force: true });
}

function pointerFromIndex(
  index: MarketBaselinePublicationIndex,
  indexPath: string,
  cwd: string,
): MarketBaselinePublicationCurrentPointer {
  return {
    publicationContentSha256: index.publicationContentSha256,
    indexRelativePath: relative(cwd, indexPath),
    generatedAt: index.generatedAt,
    asOfDate: index.asOfDate,
    sourceReportingPeriod: index.semantic.sourceReportingPeriod,
    sourceAcquisitionRunId: index.sourceAcquisitionRunId,
    sourceOutcomesArtifactSha256: index.sourceOutcomesArtifactSha256,
    sourceAcquisitionRunScope: index.sourceAcquisitionRunScope,
    operationalCurrentRunId: index.operationalCurrentRunId,
    operationalCurrentDiffersFromGoverning:
      index.operationalCurrentDiffersFromGoverning,
  };
}

/** Persist current pointer — must run only after artifacts are complete. */
export async function commitPublicationPointer(
  index: MarketBaselinePublicationIndex,
  cwd = process.cwd(),
): Promise<string> {
  const sha = index.publicationContentSha256;
  const indexPath = publicationIndexPath(sha, cwd);
  const pointer = pointerFromIndex(index, indexPath, cwd);
  const currentPointerPath = publicationCurrentPointerPath(cwd);
  await ensureParent(currentPointerPath);
  // Atomic-ish replace via temp + rename within same directory.
  const tmp = `${currentPointerPath}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(tmp, `${JSON.stringify(pointer, null, 2)}\n`, "utf8");
  await rename(tmp, currentPointerPath);
  return currentPointerPath;
}

/**
 * Materialize final content-addressed index + shards from staging.
 * Does NOT advance the current pointer.
 */
export async function materializePublicationFromStaging(args: {
  cwd: string;
  stagingDir: string;
  index: MarketBaselinePublicationIndex;
}): Promise<{ indexPath: string; shardPaths: string[] }> {
  const { cwd, stagingDir, index } = args;
  const sha = index.publicationContentSha256;
  const destDir = publicationDir(sha, cwd);
  await mkdir(join(destDir, "tlds"), { recursive: true });

  const indexPath = publicationIndexPath(sha, cwd);
  await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

  const shardPaths: string[] = [];
  for (const entry of index.semantic.tldShards) {
    const staged = await readStagedShardSemantic(stagingDir, entry.tldAsciiLabel);
    if (staged.shardContentSha256 !== entry.shardContentSha256) {
      throw new Error(
        `Staged shard digest mismatch for ${entry.tldAsciiLabel}`,
      );
    }
    const shard: MarketBaselineTldShard = {
      schemaVersion: MARKET_BASELINE_PUBLICATION_SCHEMA_VERSION,
      tldAsciiLabel: entry.tldAsciiLabel,
      publicationContentSha256: sha,
      shardContentSha256: entry.shardContentSha256,
      periods: staged.semantic.periods,
      registrarsByPeriod: staged.semantic.registrarsByPeriod,
    };
    const path = publicationTldShardPath(sha, entry.tldAsciiLabel, cwd);
    await writeFile(path, `${JSON.stringify(shard, null, 2)}\n`, "utf8");
    shardPaths.push(path);
  }

  return { indexPath, shardPaths };
}

export type FinalizePublicationOptions = {
  /**
   * Test hook: throw after artifacts materialize but before pointer commit.
   * Proves pointer remains unchanged on failure.
   */
  failBeforePointerCommit?: boolean;
};

/**
 * Finalize staging → content-addressed publication, then commit pointer last.
 * On any failure before pointer commit, previous current pointer is unchanged.
 */
export async function finalizePublicationFromStaging(args: {
  cwd: string;
  stagingDir: string;
  index: MarketBaselinePublicationIndex;
  options?: FinalizePublicationOptions;
}): Promise<{
  contentSha256: string;
  indexPath: string;
  shardPaths: string[];
  currentPointerPath: string;
}> {
  const { cwd, stagingDir, index, options } = args;
  try {
    const { indexPath, shardPaths } = await materializePublicationFromStaging({
      cwd,
      stagingDir,
      index,
    });
    if (options?.failBeforePointerCommit) {
      throw new Error("simulated finalization failure before pointer commit");
    }
    const currentPointerPath = await commitPublicationPointer(index, cwd);
    await cleanupPublicationStaging(stagingDir);
    return {
      contentSha256: index.publicationContentSha256,
      indexPath,
      shardPaths,
      currentPointerPath,
    };
  } catch (err) {
    await cleanupPublicationStaging(stagingDir).catch(() => undefined);
    throw err;
  }
}

/**
 * In-memory BuiltPublication writer (tests / small inputs).
 * Pointer advances only after all shards are written.
 */
export async function writePublicationArtifacts(
  built: BuiltPublication,
  cwd = process.cwd(),
  options?: FinalizePublicationOptions,
): Promise<{
  contentSha256: string;
  indexPath: string;
  shardPaths: string[];
  currentPointerPath: string;
}> {
  const sha = built.index.publicationContentSha256;
  await mkdir(publicationDir(sha, cwd), { recursive: true });
  await mkdir(join(publicationDir(sha, cwd), "tlds"), { recursive: true });

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

  if (options?.failBeforePointerCommit) {
    throw new Error("simulated finalization failure before pointer commit");
  }

  const currentPointerPath = await commitPublicationPointer(built.index, cwd);
  return { contentSha256: sha, indexPath, shardPaths, currentPointerPath };
}
