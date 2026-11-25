#!/usr/bin/env node
/**
 * RIH-FCAST-03 / 03A / 04B — Offline ActiveDNS suffix-demand counter CLI.
 *
 * Reads locally supplied gzip lists + a panel manifest. Never downloads.
 * Writes aggregate evidence JSON under .data/ only.
 */
import path from "node:path";
import { FORECAST_V1_EXAMPLE_STRINGS } from "@/lib/registration-forecast";
import type { CandidateMode } from "./candidates";
import { runSuffixDemandCounter } from "./counter";
import { MID_PANEL_TLDS } from "./types";

const DEFAULT_OUT = ".data/suffix-demand/aggregate.json";

function usage(): never {
  console.error(`RIH-FCAST-04B offline suffix-demand counter

Usage:
  npm run suffix-demand -- --input-dir <dir> --manifest <path> [options]

Required:
  --input-dir <dir>   Directory containing the gzip panel files named in the manifest
  --manifest <path>   Panel manifest JSON (TLDs, filenames, SHA-256, snapshot date, counts)

Candidate modes:
  --candidate-mode example-list
      Default. Uses FORECAST_V1_EXAMPLE_STRINGS (${FORECAST_V1_EXAMPLE_STRINGS.length} prototype examples).
  --candidate-mode applications-document-v2 --applications-document <path>
      Forecast-eligible selected/current strings (Brand proxy exclusion; omits knownExcluded-only).
  --candidate-mode observed-proposed-strings --applications-document <path>
      All distinct source-backed proposed labels from applied/replacement strings plus
      knownExcludedRecords.primaryString (includes WDO). Does not assert a complete census.

Optional:
  --out <path>        Aggregate JSON output (default ${DEFAULT_OUT}; must be under .data/; must not already exist)
  --cwd <path>        Working directory (default process.cwd())

Notes:
  - Approved mid-panel TLDs: ${MID_PANEL_TLDS.map((t) => `.${t}`).join(", ")}.
  - Input lists must be sorted (ActiveDNS contract); unsorted input fails closed.
  - Do not commit raw domain lists.
  - Panel-limited counts are not converted into registration forecasts.
`);
  process.exit(2);
}

function argValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  return argv[i + 1];
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h") || argv.length === 0) usage();

  const inputDir = argValue(argv, "--input-dir");
  const manifest = argValue(argv, "--manifest");
  const out = argValue(argv, "--out") ?? DEFAULT_OUT;
  const cwd = argValue(argv, "--cwd") ?? process.cwd();
  const modeRaw = argValue(argv, "--candidate-mode") ?? "example-list";
  const applicationsDocument = argValue(argv, "--applications-document");

  if (!inputDir || !manifest) usage();
  const allowed: CandidateMode[] = [
    "example-list",
    "applications-document-v2",
    "observed-proposed-strings",
  ];
  if (!allowed.includes(modeRaw as CandidateMode)) {
    console.error(`Invalid --candidate-mode: ${modeRaw}`);
    usage();
  }
  const candidateMode = modeRaw as CandidateMode;
  if (
    (candidateMode === "applications-document-v2" ||
      candidateMode === "observed-proposed-strings") &&
    !applicationsDocument
  ) {
    console.error(`${candidateMode} mode requires --applications-document <path>`);
    usage();
  }

  console.log("RIH-FCAST-04B suffix-demand counter (offline)");
  console.log(`cwd=${cwd}`);
  console.log(`inputDir=${path.resolve(cwd, inputDir)}`);
  console.log(`manifest=${path.resolve(cwd, manifest)}`);
  console.log(`candidateMode=${candidateMode}`);
  if (applicationsDocument) {
    console.log(`applicationsDocument=${path.resolve(cwd, applicationsDocument)}`);
  }
  console.log(`out=${path.resolve(cwd, out)}`);

  const result = await runSuffixDemandCounter({
    inputDir,
    manifestPath: manifest,
    outputPath: out,
    cwd,
    candidateMode,
    applicationsDocumentPath: applicationsDocument,
  });

  if (!result.ok) {
    console.error(JSON.stringify(result.failure, null, 2));
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        status: result.aggregate.status,
        schemaVersion: result.aggregate.schemaVersion,
        domainScan: result.aggregate.domainScan,
        applicationCensus: result.aggregate.applicationCensus,
        outputPath: result.outputPath,
        manifestId: result.aggregate.manifestId,
        snapshotDate: result.aggregate.snapshotDate,
        candidateProvenance: {
          mode: result.aggregate.candidateProvenance.mode,
          snapshotId: result.aggregate.candidateProvenance.snapshotId,
          eligibleCandidateCount: result.aggregate.candidateProvenance.eligibleCandidateCount,
          brandExcludedCount: result.aggregate.candidateProvenance.brandExcludedCount,
          observedInventory: result.aggregate.candidateProvenance.observedInventory ?? null,
          applicationCensusCoverage:
            result.aggregate.candidateProvenance.applicationCensusCoverage ?? null,
        },
        referencePanelTlds: result.aggregate.referencePanelTlds,
        processing: result.aggregate.processing,
        stringCount: result.aggregate.strings.length,
        unmeasuredCount: result.aggregate.unmeasuredStrings.length,
        forecastConversionApplied: result.aggregate.forecastConversion.applied,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
