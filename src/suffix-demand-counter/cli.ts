#!/usr/bin/env node
/**
 * RIH-FCAST-03 — Offline ActiveDNS suffix-demand counter CLI.
 *
 * Reads locally supplied gzip lists + a panel manifest. Never downloads.
 * Writes aggregate evidence JSON under .data/ only.
 */
import path from "node:path";
import { FORECAST_V1_EXAMPLE_STRINGS } from "@/lib/registration-forecast";
import { runSuffixDemandCounter } from "./counter";
import { MID_PANEL_TLDS } from "./types";

const DEFAULT_OUT = ".data/suffix-demand/aggregate.json";

function usage(): never {
  console.error(`RIH-FCAST-03 offline suffix-demand counter

Usage:
  npm run suffix-demand -- --input-dir <dir> --manifest <path> [--out <path>]

Required:
  --input-dir <dir>   Directory containing the gzip panel files named in the manifest
  --manifest <path>   Panel manifest JSON (TLDs, filenames, SHA-256, snapshot date, counts)

Optional:
  --applications-document <path>  Authoritative, complete promoted-2026 RegistryApplicationsDocumentV2 JSON
                                 (required for full-round candidate coverage)
  --out <path>        Aggregate JSON output (default ${DEFAULT_OUT}; must be under .data/)
  --cwd <path>        Working directory (default process.cwd())

Notes:
  - Without --applications-document, uses prototype FORECAST_V1_EXAMPLE_STRINGS (${FORECAST_V1_EXAMPLE_STRINGS.length} strings) ONLY.
  - Full-round mode fails closed for absent, partial, rehearsal, or invalid application documents.
  - Approved mid-panel TLDs: ${MID_PANEL_TLDS.map((t) => `.${t}`).join(", ")}.
  - No network access. Do not commit raw domain lists.
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
  const applicationsDocumentPath = argValue(argv, "--applications-document");
  if (argv.includes("--applications-document") && !applicationsDocumentPath) usage();
  const allowed = new Set(["--input-dir", "--manifest", "--out", "--cwd", "--applications-document"]);
  for (let i = 0; i < argv.length; i += 2) {
    if (!allowed.has(argv[i]!) || !argv[i + 1] || argv[i + 1]!.startsWith("--")) usage();
  }

  if (!inputDir || !manifest) usage();

  console.log("RIH-FCAST-03 suffix-demand counter (offline)");
  console.log(`cwd=${cwd}`);
  console.log(`inputDir=${path.resolve(cwd, inputDir)}`);
  console.log(`manifest=${path.resolve(cwd, manifest)}`);
  console.log(`out=${path.resolve(cwd, out)}`);

  const result = await runSuffixDemandCounter({
    inputDir,
    manifestPath: manifest,
    outputPath: out,
    applicationsDocumentPath,
    cwd,
  });

  if (!result.ok) {
    console.error(JSON.stringify(result.failure, null, 2));
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        status: result.aggregate.status,
        outputPath: result.outputPath,
        manifestId: result.aggregate.manifestId,
        snapshotDate: result.aggregate.snapshotDate,
        referencePanelTlds: result.aggregate.referencePanelTlds,
        processing: result.aggregate.processing,
        stringCount: result.aggregate.strings.length,
        candidateProvenance: result.aggregate.candidateProvenance,
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
