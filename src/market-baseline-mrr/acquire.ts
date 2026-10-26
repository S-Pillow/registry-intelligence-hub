import { discoverAllTldPages } from "./discover";
import { fetchBounded, mapPool } from "./http";
import { sha256Hex } from "./hash";
import { loadDelegatedTldLabels } from "./iana-delegation";
import {
  extractAsciiAppliedLabels,
  loadAppliedAsciiLabelsFromFile,
  selectDelegatedApplicationOverlaps,
} from "./applied-overlap";
import { normalizeTransactions } from "./normalize";
import { historyWindowEndingAt, previousPeriod, probeReportingPeriodFromAsOf, yearAgoPeriod } from "./period";
import {
  buildHistoryUniverse,
  controlSetPresentInDiscovery,
  probeSuccessForRanking,
  selectTop100ByTotalDomains,
} from "./selection";
import {
  discoveryCachePath,
  listRawHashes,
  readNormalizedForPeriod,
  writeCurrentIndex,
  writeManifest,
  writeNormalizedEnvelope,
  writeRawImmutable,
} from "./storage";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  AcquisitionOutcome,
  AcquisitionRunManifest,
  DiscoveredTldPage,
  NormalizedTransactionsEnvelope,
  ProbeTldResult,
  ReportingPeriod,
} from "./types";

export type AcquireStageDOptions = {
  asOfDate: string;
  cwd?: string;
  concurrency?: number;
  appliedLabelsPath?: string;
  appliedLabels?: string[];
  /** Skip live discovery; inject pages (tests). */
  pages?: DiscoveredTldPage[];
  /** Inject IANA labels (tests). */
  delegatedLabels?: Set<string>;
  /** Limit probe TLDs (debug). */
  probeLimit?: number;
  /** Skip history phase. */
  skipHistory?: boolean;
  onLog?: (msg: string) => void;
};

export type AcquireStageDResult = {
  manifest: AcquisitionRunManifest;
  probeResults: ProbeTldResult[];
};

function emptyProbeCounts(): AcquisitionRunManifest["probe"] {
  return {
    success: 0,
    missing: 0,
    downloadFailed: 0,
    unsupportedSchema: 0,
    parseFailed: 0,
    validationFailed: 0,
    normalizationFailed: 0,
  };
}

function bumpProbe(counts: AcquisitionRunManifest["probe"], outcome: AcquisitionOutcome): void {
  switch (outcome) {
    case "SUCCESS":
      counts.success += 1;
      break;
    case "MISSING_REPORT":
      counts.missing += 1;
      break;
    case "DOWNLOAD_FAILED":
      counts.downloadFailed += 1;
      break;
    case "UNSUPPORTED_SCHEMA":
      counts.unsupportedSchema += 1;
      break;
    case "PARSE_FAILED":
      counts.parseFailed += 1;
      break;
    case "VALIDATION_FAILED":
      counts.validationFailed += 1;
      break;
    case "NORMALIZATION_FAILED":
      counts.normalizationFailed += 1;
      break;
  }
}

async function acquireOneTransactions(args: {
  page: DiscoveredTldPage;
  period: ReportingPeriod;
  cwd: string;
  asOfDate: string;
  probeReportingPeriod: ReportingPeriod;
}): Promise<{
  outcome: AcquisitionOutcome;
  error?: string;
  sourceUrl?: string;
  rawSha256?: string;
  normalizedContentSha256?: string;
  totalDomains?: number;
  bytesDownloaded: number;
  reusedFromCache: boolean;
  revisionDetected: boolean;
  throttled?: boolean;
}> {
  const sourceUrl = args.page.transactionsByPeriod[args.period];
  if (!sourceUrl) {
    return {
      outcome: "MISSING_REPORT",
      error: `No Transactions link for ${args.period}`,
      bytesDownloaded: 0,
      reusedFromCache: false,
      revisionDetected: false,
    };
  }

  const cachedNorm = await readNormalizedForPeriod(args.page.tldAsciiLabel, args.period, args.cwd);
  if (cachedNorm && cachedNorm.sourceUrl === sourceUrl) {
    return {
      outcome: "SUCCESS",
      sourceUrl,
      rawSha256: cachedNorm.rawSha256,
      normalizedContentSha256: cachedNorm.normalizedContentSha256,
      totalDomains: cachedNorm.metrics.totalDomains,
      bytesDownloaded: 0,
      reusedFromCache: true,
      revisionDetected: false,
    };
  }

  const existingHashes = await listRawHashes(args.page.tldAsciiLabel, args.period, args.cwd);
  const download = await fetchBounded(sourceUrl);
  if (!download.ok) {
    return {
      outcome: "DOWNLOAD_FAILED",
      error: download.error,
      sourceUrl,
      bytesDownloaded: 0,
      reusedFromCache: false,
      revisionDetected: false,
      throttled: download.throttled,
    };
  }

  const rawSha256 = sha256Hex(download.bytes);
  const reusedFromCache = existingHashes.includes(rawSha256);
  const revisionDetected = existingHashes.length > 0 && !existingHashes.includes(rawSha256);
  const revisionOf =
    revisionDetected && existingHashes.length > 0 ? existingHashes[existingHashes.length - 1]! : null;

  await writeRawImmutable(args.page.tldAsciiLabel, args.period, rawSha256, download.bytes, args.cwd);

  const prevSnap = await readNormalizedForPeriod(
    args.page.tldAsciiLabel,
    previousPeriod(args.period),
    args.cwd,
  );
  const yoySnap = await readNormalizedForPeriod(
    args.page.tldAsciiLabel,
    yearAgoPeriod(args.period),
    args.cwd,
  );

  const norm = normalizeTransactions({
    rawText: download.text,
    rawBytes: download.bytes,
    tldAsciiLabel: args.page.tldAsciiLabel,
    reportingPeriod: args.period,
    sourceUrl,
    resourcePageUrl: args.page.resourcePageUrl,
    previousTotalDomains: prevSnap?.metrics.totalDomains ?? null,
    yearAgoTotalDomains: yoySnap?.metrics.totalDomains ?? null,
    revisionOfRawSha256: revisionOf,
  });

  if (norm.outcome !== "SUCCESS") {
    return {
      outcome: norm.outcome,
      error: norm.error,
      sourceUrl,
      rawSha256,
      bytesDownloaded: reusedFromCache ? 0 : download.bytes.byteLength,
      reusedFromCache,
      revisionDetected,
    };
  }

  const envelope: NormalizedTransactionsEnvelope = {
    snapshot: norm.snapshot,
    retrievedAt: new Date().toISOString(),
    asOfDate: args.asOfDate,
    probeReportingPeriod: args.probeReportingPeriod,
  };
  await writeNormalizedEnvelope(envelope, args.cwd);

  return {
    outcome: "SUCCESS",
    sourceUrl,
    rawSha256,
    normalizedContentSha256: norm.snapshot.normalizedContentSha256,
    totalDomains: norm.snapshot.metrics.totalDomains,
    bytesDownloaded: reusedFromCache ? 0 : download.bytes.byteLength,
    reusedFromCache,
    revisionDetected,
  };
}

export async function runStageDAcquisition(
  options: AcquireStageDOptions,
): Promise<AcquireStageDResult> {
  const cwd = options.cwd ?? process.cwd();
  const concurrency = options.concurrency ?? 4;
  const asOfDate = options.asOfDate;
  const probeReportingPeriod = probeReportingPeriodFromAsOf(asOfDate);
  const startedAt = new Date().toISOString();
  const runId = `mrr-stage-d-${asOfDate}-${startedAt.replace(/[:.]/g, "-")}`;
  const log = options.onLog ?? (() => undefined);

  let throttlingObserved = false;
  let stopBulk = false;
  const shouldStop = () => stopBulk;

  log(`asOfDate=${asOfDate} probeReportingPeriod=${probeReportingPeriod}`);

  let pages: DiscoveredTldPage[] = options.pages ?? [];
  if (!options.pages) {
    const cachePath = discoveryCachePath(cwd);
    let loaded: DiscoveredTldPage[] | null = null;
    try {
      const cached = JSON.parse(await readFile(cachePath, "utf8")) as {
        asOfDate?: string;
        pages: DiscoveredTldPage[];
      };
      if (cached.pages?.length && cached.asOfDate === asOfDate) {
        loaded = cached.pages;
        log(`Reusing discovery cache (${loaded.length} TLD pages)`);
      }
    } catch {
      // no cache
    }
    if (loaded) {
      pages = loaded;
    } else {
      log("Discovering TLD report pages…");
      const discovered = await discoverAllTldPages({
        concurrency,
        onProgress: (done, total) => {
          if (done % 50 === 0 || done === total) log(`discovery pages ${done}/${total}`);
        },
      });
      if (discovered.indexFetchError) {
        throw new Error(`Index fetch failed: ${discovered.indexFetchError}`);
      }
      pages = discovered.pages;
      await mkdir(dirname(cachePath), { recursive: true });
      await writeFile(
        cachePath,
        `${JSON.stringify({ asOfDate, probeReportingPeriod, pages, cachedAt: new Date().toISOString() })}\n`,
        "utf8",
      );
    }
  }
  log(`Discovered ${pages.length} TLD pages`);

  const pageByTld = new Map(pages.map((p) => [p.tldAsciiLabel, p]));
  const discoveredLabels = new Set(pages.map((p) => p.tldAsciiLabel));

  let probePages = pages;
  if (options.probeLimit != null) {
    probePages = pages.slice(0, options.probeLimit);
  }

  const probeCounts = emptyProbeCounts();
  const probeResults: ProbeTldResult[] = [];
  let filesRequested = 0;
  let filesDownloaded = 0;
  let filesReusedFromCache = 0;
  let bytesDownloaded = 0;
  let missingReports = 0;
  let schemaFailures = 0;
  let validationFailures = 0;
  let normalizationFailures = 0;
  let sourceRevisionsDetected = 0;
  const rawHashes: string[] = [];
  const normalizedHashes: string[] = [];

  log(`Probe period ${probeReportingPeriod} for ${probePages.length} TLDs…`);
  await mapPool(
    probePages,
    concurrency,
    async (page) => {
      if (shouldStop()) return;
      filesRequested += 1;
      const r = await acquireOneTransactions({
        page,
        period: probeReportingPeriod,
        cwd,
        asOfDate,
        probeReportingPeriod,
      });
      if (r.throttled) {
        throttlingObserved = true;
        log(`Throttling observed (${r.error}); cooling down 90s before stop decision`);
        await new Promise((res) => setTimeout(res, 90_000));
        // one recovery attempt for this TLD
        const retry = await acquireOneTransactions({
          page,
          period: probeReportingPeriod,
          cwd,
          asOfDate,
          probeReportingPeriod,
        });
        if (retry.throttled || retry.outcome === "DOWNLOAD_FAILED") {
          stopBulk = true;
          log(`Throttling persisted; stopping bulk acquisition`);
          Object.assign(r, retry);
        } else {
          Object.assign(r, retry);
        }
      }
      bumpProbe(probeCounts, r.outcome);
      if (r.outcome === "MISSING_REPORT") missingReports += 1;
      if (r.outcome === "UNSUPPORTED_SCHEMA") schemaFailures += 1;
      if (r.outcome === "VALIDATION_FAILED") validationFailures += 1;
      if (r.outcome === "NORMALIZATION_FAILED" || r.outcome === "PARSE_FAILED") {
        normalizationFailures += 1;
      }
      if (r.reusedFromCache) filesReusedFromCache += 1;
      else if (r.outcome !== "MISSING_REPORT" && r.bytesDownloaded > 0) filesDownloaded += 1;
      bytesDownloaded += r.bytesDownloaded;
      if (r.revisionDetected) sourceRevisionsDetected += 1;
      if (r.rawSha256) rawHashes.push(r.rawSha256);
      if (r.normalizedContentSha256) normalizedHashes.push(r.normalizedContentSha256);
      probeResults.push({
        tldAsciiLabel: page.tldAsciiLabel,
        resourcePageUrl: page.resourcePageUrl,
        reportingPeriod: probeReportingPeriod,
        outcome: r.outcome,
        sourceUrl: r.sourceUrl,
        rawSha256: r.rawSha256,
        normalizedContentSha256: r.normalizedContentSha256,
        totalDomains: r.totalDomains,
        error: r.error,
      });
    },
    shouldStop,
  );

  probeResults.sort((a, b) => a.tldAsciiLabel.localeCompare(b.tldAsciiLabel));

  const top100 = selectTop100ByTotalDomains(probeSuccessForRanking(probeResults), 100);
  const controlSet = controlSetPresentInDiscovery(discoveredLabels);

  let appliedLabels = options.appliedLabels ?? [];
  if (options.appliedLabelsPath) {
    appliedLabels = await loadAppliedAsciiLabelsFromFile(options.appliedLabelsPath);
  } else if (appliedLabels.length === 0) {
    // Best-effort: local reveal publication if present
    try {
      const { readFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const snapPath = join(cwd, ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json");
      const text = await readFile(snapPath, "utf8");
      appliedLabels = extractAsciiAppliedLabels(JSON.parse(text));
      log(`Loaded ${appliedLabels.length} applied ASCII labels from reveal publication`);
    } catch {
      log("No applied-label source found; delegated overlaps will be empty unless provided");
    }
  }

  let delegatedLabels = options.delegatedLabels;
  if (!delegatedLabels) {
    const iana = await loadDelegatedTldLabels();
    delegatedLabels = iana.labels;
    log(`IANA delegated labels: ${delegatedLabels.size}`);
  }

  const delegatedOverlaps = selectDelegatedApplicationOverlaps({
    appliedAsciiLabels: appliedLabels,
    delegatedLabels,
    discoveredMrrLabels: discoveredLabels,
  });
  log(
    `Selection: top100=${top100.length} controls=${controlSet.length} overlaps=${delegatedOverlaps.length}`,
  );

  const historyUniverse = buildHistoryUniverse({ top100, controlSet, delegatedOverlaps });
  const historyPeriods = historyWindowEndingAt(probeReportingPeriod, 24);

  if (!options.skipHistory && !stopBulk) {
    const jobs: Array<{ tld: string; period: ReportingPeriod }> = [];
    for (const member of historyUniverse) {
      for (const period of historyPeriods) {
        if (period === probeReportingPeriod) continue; // already acquired in probe
        jobs.push({ tld: member.tldAsciiLabel, period });
      }
    }
    log(`History jobs: ${jobs.length}`);
    await mapPool(
      jobs,
      concurrency,
      async (job) => {
        if (shouldStop()) return;
        const page = pageByTld.get(job.tld);
        if (!page) return;
        filesRequested += 1;
        const r = await acquireOneTransactions({
          page,
          period: job.period,
          cwd,
          asOfDate,
          probeReportingPeriod,
        });
        if (r.throttled) {
          throttlingObserved = true;
          log(`Throttling during history; cooling down 90s`);
          await new Promise((res) => setTimeout(res, 90_000));
          const retry = await acquireOneTransactions({
            page,
            period: job.period,
            cwd,
            asOfDate,
            probeReportingPeriod,
          });
          if (retry.throttled || retry.outcome === "DOWNLOAD_FAILED") {
            stopBulk = true;
            log(`Throttling persisted during history; stopping`);
            Object.assign(r, retry);
          } else {
            Object.assign(r, retry);
          }
        }
        if (r.outcome === "MISSING_REPORT") missingReports += 1;
        if (r.outcome === "UNSUPPORTED_SCHEMA") schemaFailures += 1;
        if (r.outcome === "VALIDATION_FAILED") validationFailures += 1;
        if (r.outcome === "NORMALIZATION_FAILED" || r.outcome === "PARSE_FAILED") {
          normalizationFailures += 1;
        }
        if (r.reusedFromCache) filesReusedFromCache += 1;
        else if (r.outcome !== "MISSING_REPORT" && r.bytesDownloaded > 0) filesDownloaded += 1;
        bytesDownloaded += r.bytesDownloaded;
        if (r.revisionDetected) sourceRevisionsDetected += 1;
        if (r.rawSha256) rawHashes.push(r.rawSha256);
        if (r.normalizedContentSha256) normalizedHashes.push(r.normalizedContentSha256);
      },
      shouldStop,
    );
  }

  const completedAt = new Date().toISOString();
  const durationMs = Date.parse(completedAt) - Date.parse(startedAt);
  let resultStatus: AcquisitionRunManifest["resultStatus"] = "SUCCESS";
  if (stopBulk && throttlingObserved) resultStatus = "STOPPED_THROTTLED";
  else if (probeCounts.success === 0) resultStatus = "FAILED";
  else if (
    probeCounts.missing + probeCounts.downloadFailed + probeCounts.unsupportedSchema > 0
    || schemaFailures > 0
    || validationFailures > 0
  ) {
    resultStatus = "PARTIAL";
  }

  const manifest: AcquisitionRunManifest = {
    schemaVersion: "market-baseline-mrr-run-manifest/1.0.0",
    runId,
    startedAt,
    completedAt,
    asOfDate,
    probeReportingPeriod,
    discoveredTldCount: pages.length,
    probe: probeCounts,
    top100,
    controlSet,
    delegatedOverlaps,
    historyUniverse,
    historyPeriodCount: historyPeriods.length,
    filesRequested,
    filesDownloaded,
    filesReusedFromCache,
    missingReports,
    schemaFailures,
    validationFailures,
    normalizationFailures,
    bytesDownloaded,
    rawHashes: [...new Set(rawHashes)].sort(),
    normalizedHashes: [...new Set(normalizedHashes)].sort(),
    sourceRevisionsDetected,
    resultStatus,
    throttlingObserved,
    durationMs,
    notes: [
      "Transactions-only Stage D acquisition",
      "Activity links observed during discovery are not downloaded",
      "renewalRate is intentionally unsupported",
    ],
  };

  await writeManifest(manifest, cwd);
  await writeCurrentIndex(
    {
      updatedAt: completedAt,
      latestRunId: runId,
      asOfDate,
      probeReportingPeriod,
      discoveredTldCount: pages.length,
      top100Count: top100.length,
      historyUniverseCount: historyUniverse.length,
    },
    cwd,
  );

  return { manifest, probeResults };
}
