#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { runStageDAcquisition } from "./acquire";
import { mrrRoot } from "./storage";
import { probeReportingPeriodFromAsOf } from "./period";

function usage(): never {
  console.error(`Usage:
  npm run market-mrr -- stage-d --as-of YYYY-MM-DD [options]

Options:
  --as-of YYYY-MM-DD          Required. Derives probeReportingPeriod (withhold rule).
  --concurrency N             Max concurrent HTTP requests (default 4, max 4 recommended).
  --applied-labels PATH       JSON publication / label list for delegated overlap selection.
  --probe-limit N             Debug: only probe first N discovered TLDs.
  --skip-history              Debug: probe + select only; skip 24-month history.
  --cwd PATH                  Working directory (default process.cwd()).
`);
  process.exit(2);
}

function argValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  return argv[i + 1];
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (cmd !== "stage-d") usage();

  const asOf = argValue(argv, "--as-of");
  if (!asOf || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    console.error("Missing or invalid --as-of YYYY-MM-DD");
    usage();
  }

  const concurrencyRaw = argValue(argv, "--concurrency");
  const concurrency = concurrencyRaw ? Math.min(4, Math.max(1, Number(concurrencyRaw))) : 4;
  const appliedLabelsPath = argValue(argv, "--applied-labels");
  const probeLimitRaw = argValue(argv, "--probe-limit");
  const probeLimit = probeLimitRaw ? Number(probeLimitRaw) : undefined;
  const skipHistory = hasFlag(argv, "--skip-history");
  const cwd = argValue(argv, "--cwd") ?? process.cwd();

  const probe = probeReportingPeriodFromAsOf(asOf);
  console.log(`RIH market-baseline-mrr stage-d`);
  console.log(`asOfDate=${asOf} probeReportingPeriod=${probe} concurrency=${concurrency}`);
  console.log(`data root=${mrrRoot(cwd)}`);

  await mkdir(mrrRoot(cwd), { recursive: true });

  const { manifest } = await runStageDAcquisition({
    asOfDate: asOf,
    cwd,
    concurrency,
    appliedLabelsPath,
    probeLimit,
    skipHistory,
    onLog: (msg) => console.log(msg),
  });

  console.log(JSON.stringify({
    runId: manifest.runId,
    resultStatus: manifest.resultStatus,
    discoveredTldCount: manifest.discoveredTldCount,
    probe: manifest.probe,
    top100: manifest.top100.length,
    controlSet: manifest.controlSet,
    delegatedOverlaps: manifest.delegatedOverlaps.length,
    historyUniverse: manifest.historyUniverse.length,
    filesRequested: manifest.filesRequested,
    filesDownloaded: manifest.filesDownloaded,
    filesReusedFromCache: manifest.filesReusedFromCache,
    missingReports: manifest.missingReports,
    schemaFailures: manifest.schemaFailures,
    validationFailures: manifest.validationFailures,
    bytesDownloaded: manifest.bytesDownloaded,
    durationMs: manifest.durationMs,
    throttlingObserved: manifest.throttlingObserved,
  }, null, 2));

  if (manifest.resultStatus === "FAILED") process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
