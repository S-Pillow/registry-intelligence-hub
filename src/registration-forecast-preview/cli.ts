#!/usr/bin/env node
/**
 * RIH-FCAST-05A — Offline experimental registration-forecast preview CLI.
 *
 * Reads an existing FCAST-04B suffix-demand aggregate (no network, no recount).
 * Writes analysis JSON + CSV under .data/registration-forecast/ only.
 */
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildForecastPreviewDocument, forecastPreviewToCsv, stableStringify } from "./derive";
import { ForecastPreviewError } from "./types";
import { validateSuffixDemandAggregateForPreview } from "./validate-aggregate";

const DEFAULT_AGGREGATE =
  ".data/suffix-demand/rih-fcast-04b-2026-11-07-observed-aggregate.json";
const DEFAULT_EXPECTED_SHA =
  "287be9f443f45c740e3a0ff3e743e82c46d8bb98e2a55b748511bace9b1d5158";
const DEFAULT_OUT_DIR = ".data/registration-forecast";

function usage(): never {
  console.error(`RIH-FCAST-05A offline experimental forecast preview

Usage:
  npm run forecast-preview -- [options]

Options:
  --aggregate <path>       FCAST-04B aggregate JSON (default ${DEFAULT_AGGREGATE})
  --expected-sha256 <hex>  Require exact aggregate SHA-256 (default ${DEFAULT_EXPECTED_SHA})
  --skip-sha-check         Skip SHA-256 gate (tests only; not for production runs)
  --out-dir <path>         Output directory under .data/ (default ${DEFAULT_OUT_DIR})
  --cwd <path>             Working directory (default process.cwd())

Writes:
  <out-dir>/experimental-forecast-preview.json
  <out-dir>/experimental-forecast-preview.csv

Notes:
  - Does not re-download ActiveDNS or re-run the suffix-demand counter.
  - Does not apply Brand exclusion; retains WDO and all measured strings.
  - Offline analysis artifacts only — not website integration.
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
  if (argv.includes("--help") || argv.includes("-h")) usage();

  const cwd = argValue(argv, "--cwd") ?? process.cwd();
  const aggregateRel = argValue(argv, "--aggregate") ?? DEFAULT_AGGREGATE;
  const outDirRel = argValue(argv, "--out-dir") ?? DEFAULT_OUT_DIR;
  const skipSha = hasFlag(argv, "--skip-sha-check");
  const expectedSha = skipSha
    ? undefined
    : (argValue(argv, "--expected-sha256") ?? DEFAULT_EXPECTED_SHA);

  const aggregatePath = path.resolve(cwd, aggregateRel);
  const outDir = path.resolve(cwd, outDirRel);
  assertUnderData(outDir, cwd);

  const jsonOut = path.join(outDir, "experimental-forecast-preview.json");
  const csvOut = path.join(outDir, "experimental-forecast-preview.csv");
  await assertFresh(jsonOut);
  await assertFresh(csvOut);

  const raw = await readFile(aggregatePath);
  const sha256 = createHash("sha256").update(raw).digest("hex");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch (err) {
    throw new ForecastPreviewError("Aggregate is invalid JSON", [
      err instanceof Error ? err.message : String(err),
    ]);
  }

  const aggregate = validateSuffixDemandAggregateForPreview(parsed, {
    expectedSha256: expectedSha,
    rawBytes: expectedSha ? raw : undefined,
  });

  const document = buildForecastPreviewDocument({
    aggregate,
    sourcePath: aggregatePath,
    sourceSha256: sha256,
  });

  await mkdir(outDir, { recursive: true });
  const jsonText = `${stableStringify(document)}\n`;
  await writeFile(jsonOut, jsonText, "utf8");
  await writeFile(csvOut, forecastPreviewToCsv(document), "utf8");

  const topExpected = [...document.strings]
    .filter((r) => r.range != null)
    .sort(
      (a, b) =>
        (b.range?.expected ?? 0) - (a.range?.expected ?? 0) ||
        a.stringLabel.localeCompare(b.stringLabel),
    )
    .slice(0, 20);

  const wdo = document.strings.find((r) => r.stringLabel === "wdo");

  console.log(
    JSON.stringify(
      {
        status: document.status,
        kind: document.kind,
        aggregatePath,
        aggregateSha256: sha256,
        jsonOut,
        jsonSha256: createHash("sha256").update(jsonText).digest("hex"),
        csvOut,
        csvSha256: createHash("sha256").update(forecastPreviewToCsv(document)).digest("hex"),
        summary: document.summary,
        wdo: wdo
          ? {
              measuredDomainCount: wdo.measuredDomainCount,
              status: wdo.status,
              range: wdo.range,
              brandDesignationObserved: wdo.brandDesignationObserved,
              contested: wdo.contested,
            }
          : null,
        top20Expected: topExpected.map((r) => ({
          stringLabel: r.stringLabel,
          measuredDomainCount: r.measuredDomainCount,
          expected: r.range?.expected ?? null,
          conservative: r.range?.conservative ?? null,
          optimistic: r.range?.optimistic ?? null,
        })),
      },
      null,
      2,
    ),
  );
}

function assertUnderData(target: string, cwd: string): void {
  const dataRoot = path.resolve(cwd, ".data");
  const resolved = path.resolve(target);
  if (resolved !== dataRoot && !resolved.startsWith(`${dataRoot}${path.sep}`)) {
    throw new ForecastPreviewError("Output must be under ignored .data/", [
      `outDir=${resolved}`,
      `requiredPrefix=${dataRoot}`,
    ]);
  }
}

async function assertFresh(filePath: string): Promise<void> {
  try {
    await access(filePath);
    throw new ForecastPreviewError(
      "Output path already exists — refusing to overwrite; choose a fresh path or remove the prior artifact",
      [filePath],
    );
  } catch (err) {
    if (err instanceof ForecastPreviewError) throw err;
  }
}

main().catch((err) => {
  if (err instanceof ForecastPreviewError) {
    console.error(JSON.stringify({ status: "failed", reason: err.message, details: err.details }, null, 2));
    process.exit(1);
  }
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
