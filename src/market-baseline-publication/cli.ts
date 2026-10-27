#!/usr/bin/env node
import { publishFromMrrArchive } from "./from-archive";
import { publicationRoot } from "./paths";
import { writePublicationArtifacts } from "./write";

function usage(): never {
  console.error(`Usage:
  npm run market-publish -- --as-of YYYY-MM-DD [options]

Options:
  --as-of YYYY-MM-DD     Required. Derives source reporting period (withhold rule).
  --tlds com,xyz         Optional allowlist of probe-universe TLDs (comma-separated).
  --history-periods N    History window length ending at probe (default 24).
  --run-id ID            Explicit MRR acquisition run when coverage is ambiguous.
  --cwd PATH             Working directory (default process.cwd()).
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
  const asOf = argValue(argv, "--as-of");
  if (!asOf || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    console.error("Missing or invalid --as-of YYYY-MM-DD");
    usage();
  }
  const cwd = argValue(argv, "--cwd") ?? process.cwd();
  const tldsRaw = argValue(argv, "--tlds");
  const tldAllowlist = tldsRaw
    ? tldsRaw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
    : undefined;
  const historyRaw = argValue(argv, "--history-periods");
  const historyPeriodCount = historyRaw ? Number(historyRaw) : 24;
  const runId = argValue(argv, "--run-id");

  console.log(`RIH market-baseline publication`);
  console.log(`asOfDate=${asOf} root=${publicationRoot(cwd)}`);

  const built = await publishFromMrrArchive({
    cwd,
    asOfDate: asOf,
    tldAllowlist,
    historyPeriodCount,
    runId,
  });
  const written = await writePublicationArtifacts(built, cwd);

  console.log(
    JSON.stringify(
      {
        publicationContentSha256: written.contentSha256,
        indexPath: written.indexPath,
        shardCount: written.shardPaths.length,
        sourceReportingPeriod: built.index.semantic.sourceReportingPeriod,
        sourceAcquisitionRunId: built.index.sourceAcquisitionRunId,
        sourceOutcomesArtifactSha256: built.index.sourceOutcomesArtifactSha256,
        operationalCurrentRunId: built.index.operationalCurrentRunId,
        operationalCurrentDiffersFromGoverning:
          built.index.operationalCurrentDiffersFromGoverning,
        coverage: built.index.semantic.coverage,
        domainBaseTop5: built.index.semantic.domainBaseRanking.slice(0, 5),
        momTop5: built.index.semantic.monthOverMonthGrowthRanking.slice(0, 5),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
