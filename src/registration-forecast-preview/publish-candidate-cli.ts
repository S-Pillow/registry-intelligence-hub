#!/usr/bin/env node
/**
 * Build an unpublished, ignored publication candidate from the accepted FCAST-05A preview.
 *
 * Usage:
 *   npm run forecast-publish-candidate -- --out .data/registration-forecast
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildAndOptionallyWritePublicationCandidate } from "@/lib/forecast-catalog-server";
import { FORECAST_PUBLICATION_CANDIDATE_RELATIVE_PATH } from "@/lib/forecast-publication-candidate";

function usage(): never {
  console.error(`Usage: npm run forecast-publish-candidate -- [--cwd <dir>] [--out-dir <dir>]

Writes ${FORECAST_PUBLICATION_CANDIDATE_RELATIVE_PATH} (or <out-dir>/experimental-forecast-publication-candidate.json).
Does not commit or publish. Requires the accepted local preview JSON.`);
  process.exit(2);
}

async function main() {
  const args = process.argv.slice(2);
  let cwd = process.cwd();
  let outDir: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--cwd") cwd = args[++i] ?? usage();
    else if (a === "--out-dir") outDir = args[++i] ?? usage();
    else if (a === "--help" || a === "-h") usage();
    else usage();
  }

  const built = await buildAndOptionallyWritePublicationCandidate({ cwd, write: !outDir });
  if (outDir) {
    const { stableStringifyForecastCandidate } = await import(
      "@/lib/forecast-publication-candidate"
    );
    const target = path.resolve(cwd, outDir, "experimental-forecast-publication-candidate.json");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, stableStringifyForecastCandidate(built.candidate), "utf8");
    console.log(`Wrote ${target}`);
  } else {
    console.log(`Wrote ${path.resolve(cwd, FORECAST_PUBLICATION_CANDIDATE_RELATIVE_PATH)}`);
  }
  console.log(`candidateSha256=${built.sha256}`);
  console.log(`sourcePreviewSha256=${built.candidate.sourcePreviewSha256}`);
  console.log(`sourceAggregateSha256=${built.candidate.sourceAggregateSha256}`);
  console.log(`strings=${built.candidate.strings.length}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
