#!/usr/bin/env node
import { parseArgs } from "node:util";
import { fetchAll, fetchOne, inspect, listHandoff, listSnapshots, verifyAll } from "./pipeline";
import type { PipelineMode } from "./pipeline";
import { SOURCE_REGISTRY } from "./registry";

const DEFAULT_ROOT = "./.data/source-pipeline";

function usage(): string {
  return `Registry Intelligence Hub — source snapshot pipeline

Usage:
  npm run pipeline -- list
  npm run pipeline -- fetch <sourceId> [--mode fixture|live] [--root <dir>]
  npm run pipeline -- fetch --all [--mode fixture|live] [--root <dir>]
  npm run pipeline -- snapshots [sourceId] [--root <dir>]
  npm run pipeline -- inspect <sourceId> <attemptId|sha256> [--root <dir>]
  npm run pipeline -- verify [sourceId] [--root <dir>]
  npm run pipeline -- handoff [sourceId] [--root <dir>]

Options:
  --mode fixture|live   Default "fixture" (offline, representative fixtures — see src/pipeline/fixtures/README.md).
                         "live" performs real bounded network requests against the sources in docs/source-inventory.md.
  --root <dir>          Storage root for blobs + manifests. Default "${DEFAULT_ROOT}" (gitignored).
                         Pass a path outside the repo for a "live" run, per the pipeline's own boundary.
`;
}

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      mode: { type: "string" },
      root: { type: "string" },
      all: { type: "boolean" },
    },
  });

  const [command, ...rest] = positionals;
  const root = values.root ?? DEFAULT_ROOT;
  const mode = (values.mode as PipelineMode | undefined) ?? "fixture";
  if (mode !== "fixture" && mode !== "live") {
    throw new Error(`--mode must be "fixture" or "live", got "${mode}"`);
  }

  switch (command) {
    case "list": {
      for (const source of SOURCE_REGISTRY) {
        console.log(`${source.id} (v${source.version}) — ${source.name}`);
        console.log(`  owner: ${source.owner} · format: ${source.format} · adapter: ${source.adapterId}/${source.schemaVersion}`);
        console.log(`  url: ${source.url}`);
        console.log(`  effective-time: ${source.effectiveTimeSemantics} · rights: ${source.rights}`);
      }
      return;
    }

    case "fetch": {
      if (values.all) {
        const results = await fetchAll({ root, mode });
        for (const { entry, retryCount } of results) {
          console.log(formatEntry(entry, retryCount));
        }
        const failures = results.filter((r) => r.entry.outcome === "network-error" || r.entry.outcome === "validation-failed");
        if (failures.length > 0) process.exitCode = 1;
        return;
      }
      const sourceId = rest[0];
      if (!sourceId) throw new Error("fetch requires a sourceId, or pass --all");
      const { entry, retryCount } = await fetchOne(sourceId, { root, mode });
      console.log(formatEntry(entry, retryCount));
      if (entry.outcome === "network-error" || entry.outcome === "validation-failed") process.exitCode = 1;
      return;
    }

    case "snapshots": {
      const sourceId = rest[0];
      const bySource = await listSnapshots(root, sourceId);
      console.log(JSON.stringify(bySource, null, 2));
      return;
    }

    case "inspect": {
      const [sourceId, attemptIdOrHash] = rest;
      if (!sourceId || !attemptIdOrHash) throw new Error("inspect requires <sourceId> <attemptId|sha256>");
      const entry = await inspect(root, sourceId, attemptIdOrHash);
      if (!entry) {
        console.error(`No manifest entry found for ${sourceId} / ${attemptIdOrHash}`);
        process.exitCode = 1;
        return;
      }
      console.log(JSON.stringify(entry, null, 2));
      return;
    }

    case "verify": {
      const sourceId = rest[0];
      const results = await verifyAll(root, sourceId);
      for (const result of results) {
        console.log(`${result.ok ? "OK  " : "FAIL"} ${result.sourceId} ${result.attemptId} ${result.sha256}${result.error ? ` — ${result.error}` : ""}`);
      }
      const anyFailed = results.some((r) => !r.ok);
      console.log(`${results.length} stored blob(s) checked, ${results.filter((r) => r.ok).length} ok.`);
      if (anyFailed) process.exitCode = 1;
      return;
    }

    case "handoff": {
      const sourceId = rest[0];
      const records = await listHandoff(root, sourceId);
      console.log(JSON.stringify(records, null, 2));
      return;
    }

    default: {
      console.log(usage());
      if (command && command !== "help") process.exitCode = 1;
      return;
    }
  }
}

function formatEntry(entry: Awaited<ReturnType<typeof fetchOne>>["entry"], retryCount: number): string {
  const retrySuffix = retryCount > 0 ? ` (${retryCount} retr${retryCount === 1 ? "y" : "ies"})` : "";
  return `[${entry.outcome}]${retrySuffix} ${entry.sourceId} attempt #${entry.attempt} — ${
    entry.outcome === "success" || entry.outcome === "duplicate-skip"
      ? `${entry.byteCount} bytes, sha256 ${entry.sha256}`
      : entry.errorMessage
  }`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
