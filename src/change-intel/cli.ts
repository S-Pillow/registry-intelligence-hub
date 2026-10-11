#!/usr/bin/env tsx
import { bootstrapChangeIntel } from "@/change-intel/bootstrap";
import { refreshChangeIntel } from "@/change-intel/refresh";
import { readIndex, readLatestFeed } from "@/change-intel/state-io";

function argFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function argValue(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx < 0) return undefined;
  return args[idx + 1];
}

async function main(): Promise<void> {
  const [, , command, ...rest] = process.argv;
  if (!command || command === "help" || command === "--help") {
    console.log(`Usage:
  npm run change-intel:bootstrap [-- --cwd <path>]
  npm run change-intel:refresh -- [--dry-run] [--mode file|fetch] [--application <path|url>] [--contention <path|url>]
  npm run change-intel -- status
`);
    process.exit(0);
  }

  const cwd = argValue(rest, "--cwd") ?? process.cwd();

  if (command === "bootstrap") {
    const result = await bootstrapChangeIntel({ cwd });
    if (result.status === "already-initialized") {
      console.log(
        JSON.stringify({
          status: "already-initialized",
          currentObservationId: result.index.currentObservationId,
          lastCheckedAt: result.index.lastCheckedAt,
        }),
      );
      process.exit(0);
    }
    console.log(
      JSON.stringify({
        status: "initialized",
        observationId: result.observation.observationId,
        observedApplicationRecords: result.observation.observedApplicationRecords,
        officialContentionMemberships: result.observation.officialContentionMemberships,
        applicationsSemanticHash: result.observation.applicationsSemanticHash,
        contentionSemanticHash: result.observation.contentionSemanticHash,
      }),
    );
    process.exit(0);
  }

  if (command === "refresh") {
    const dryRun = argFlag(rest, "--dry-run");
    const mode = (argValue(rest, "--mode") as "file" | "fetch" | undefined) ?? "fetch";
    try {
      const result = await refreshChangeIntel({
        cwd,
        dryRun,
        mode,
        applicationPathOrUrl: argValue(rest, "--application"),
        contentionPathOrUrl: argValue(rest, "--contention"),
      });
      console.log(
        JSON.stringify({
          status: result.status,
          wroteState: result.wroteState,
          observationId: result.observation.observationId,
          previousObservationId: result.observation.previousObservationId,
          observedApplicationRecords: result.observation.observedApplicationRecords,
          officialContentionMemberships: result.observation.officialContentionMemberships,
          applicationContentSha256: result.observation.applicationSource.contentSha256,
          contentionContentSha256: result.observation.contentionSource.contentSha256,
          applicationsSemanticHash: result.observation.applicationsSemanticHash,
          contentionSemanticHash: result.observation.contentionSemanticHash,
          changeCount: result.diff.changes.length,
          semanticUnchanged: result.diff.semanticUnchanged,
          summary: result.diff.summary,
        }),
      );
      process.exit(0);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  if (command === "status") {
    const index = await readIndex(cwd);
    const feed = await readLatestFeed(cwd);
    console.log(JSON.stringify({ index, feed }, null, 2));
    process.exit(0);
  }

  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
