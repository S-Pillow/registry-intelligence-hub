import { discoverAllTldPages } from "./discover";
import { fetchBounded, mapPool, type FetchImpl } from "./http";
import { sha256Hex } from "./hash";
import { loadDelegatedTldLabels } from "./iana-delegation";
import {
  extractAsciiAppliedLabels,
  loadAppliedAsciiLabelsFromFile,
  selectDelegatedApplicationOverlaps,
} from "./applied-overlap";
import { normalizeTransactions } from "./normalize";
import { historyWindowEndingAt, probeReportingPeriodFromAsOf } from "./period";
import {
  buildHistoryUniverse,
  controlSetPresentInDiscovery,
  probeSuccessForRanking,
  selectTop100ByTotalDomains,
} from "./selection";
import {
  discoveryCachePath,
  readNormalizedForPeriod,
  readPeriodCurrent,
  readRawBytes,
  writeCurrentIndex,
  writeManifest,
  writeNormalizedEnvelope,
  writeOutcomesArtifact,
  writePeriodCurrent,
  writeRawImmutable,
} from "./storage";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, relative } from "node:path";
import { buildAcquisitionRunScope } from "./run-scope";
import type {
  AcquisitionDiscoverySource,
  AcquisitionOutcome,
  AcquisitionPhase,
  AcquisitionRequestOutcome,
  AcquisitionRunManifest,
  DiscoveredTldPage,
  DiscoveryCacheProvenance,
  NormalizedTransactionsEnvelope,
  OutcomeCountBucket,
  ProbeTldResult,
  ReportingPeriod,
} from "./types";
import {
  MRR_DISCOVERY_CACHE_SCHEMA_VERSION,
  MRR_OUTCOMES_SCHEMA_VERSION,
  MRR_RUN_MANIFEST_SCHEMA_VERSION,
  STAGE_D_HISTORY_PERIOD_COUNT,
} from "./types";

export type AcquireStageDOptions = {
  asOfDate: string;
  cwd?: string;
  concurrency?: number;
  appliedLabelsPath?: string;
  appliedLabels?: string[];
  pages?: DiscoveredTldPage[];
  delegatedLabels?: Set<string>;
  probeLimit?: number;
  skipHistory?: boolean;
  /** Explicit offline mode — skips remote revalidation (NOT default). */
  cacheOnly?: boolean;
  fetchImpl?: FetchImpl;
  onLog?: (msg: string) => void;
};

export type AcquireStageDResult = {
  manifest: AcquisitionRunManifest;
  probeResults: ProbeTldResult[];
  requestOutcomes: AcquisitionRequestOutcome[];
};

export type AcquireOneResult = {
  outcome: AcquisitionOutcome;
  error?: string;
  sourceUrl?: string;
  rawSha256?: string;
  normalizedContentSha256?: string;
  totalDomains?: number;
  bytesDownloaded: number;
  reusedFromCache: boolean;
  revalidated: boolean;
  revisionDetected: boolean;
  throttled?: boolean;
};

function emptyCounts(): OutcomeCountBucket {
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

export function bumpOutcomeCounts(counts: OutcomeCountBucket, outcome: AcquisitionOutcome): void {
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

export function reconcileOutcomeCounts(
  requests: AcquisitionRequestOutcome[],
  phase: AcquisitionPhase,
): OutcomeCountBucket {
  const counts = emptyCounts();
  for (const r of requests) {
    if (r.phase === phase) bumpOutcomeCounts(counts, r.outcome);
  }
  return counts;
}

export async function acquireOneTransactions(args: {
  page: DiscoveredTldPage;
  period: ReportingPeriod;
  cwd: string;
  asOfDate: string;
  probeReportingPeriod: ReportingPeriod;
  cacheOnly?: boolean;
  fetchImpl?: FetchImpl;
}): Promise<AcquireOneResult> {
  const fetchFn = args.fetchImpl ?? fetchBounded;
  const sourceUrl = args.page.transactionsByPeriod[args.period];
  if (!sourceUrl) {
    return {
      outcome: "MISSING_REPORT",
      error: `No Transactions link for ${args.period}`,
      bytesDownloaded: 0,
      reusedFromCache: false,
      revalidated: false,
      revisionDetected: false,
    };
  }

  const current = await readPeriodCurrent(args.page.tldAsciiLabel, args.period, args.cwd);

  if (args.cacheOnly) {
    const cached = await readNormalizedForPeriod(args.page.tldAsciiLabel, args.period, args.cwd);
    if (cached && cached.sourceUrl === sourceUrl) {
      return {
        outcome: "SUCCESS",
        sourceUrl,
        rawSha256: cached.rawSha256,
        normalizedContentSha256: cached.normalizedContentSha256,
        totalDomains: cached.metrics.totalDomains,
        bytesDownloaded: 0,
        reusedFromCache: true,
        revalidated: false,
        revisionDetected: false,
      };
    }
  }

  const validators =
    current && current.sourceUrl === sourceUrl
      ? { etag: current.etag, lastModified: current.lastModified }
      : undefined;

  const download = await fetchFn(sourceUrl, { validators });
  if (!download.ok) {
    return {
      outcome: "DOWNLOAD_FAILED",
      error: download.error,
      sourceUrl,
      bytesDownloaded: 0,
      reusedFromCache: false,
      revalidated: true,
      revisionDetected: false,
      throttled: download.throttled,
    };
  }

  // Unchanged remote (304) — reuse current revision exactly.
  if (download.status === 304) {
    if (!current) {
      return {
        outcome: "DOWNLOAD_FAILED",
        error: "HTTP 304 without local current revision",
        sourceUrl,
        bytesDownloaded: 0,
        reusedFromCache: false,
        revalidated: true,
        revisionDetected: false,
      };
    }
    const snap = await readNormalizedForPeriod(args.page.tldAsciiLabel, args.period, args.cwd);
    if (!snap) {
      return {
        outcome: "DOWNLOAD_FAILED",
        error: "HTTP 304 but normalized current missing",
        sourceUrl,
        bytesDownloaded: 0,
        reusedFromCache: false,
        revalidated: true,
        revisionDetected: false,
      };
    }
    await writePeriodCurrent(
      {
        ...current,
        retrievedAt: new Date().toISOString(),
        etag: download.etag ?? current.etag,
        lastModified: download.lastModified ?? current.lastModified,
      },
      args.cwd,
    );
    return {
      outcome: "SUCCESS",
      sourceUrl,
      rawSha256: current.currentRawSha256,
      normalizedContentSha256: current.currentNormalizedSha256,
      totalDomains: snap.metrics.totalDomains,
      bytesDownloaded: 0,
      reusedFromCache: true,
      revalidated: true,
      revisionDetected: false,
    };
  }

  const rawSha256 = sha256Hex(download.bytes);
  const sameAsCurrent = current?.currentRawSha256 === rawSha256 && current.sourceUrl === sourceUrl;
  if (sameAsCurrent && current) {
    const snap = await readNormalizedForPeriod(args.page.tldAsciiLabel, args.period, args.cwd);
    await writePeriodCurrent(
      {
        ...current,
        retrievedAt: new Date().toISOString(),
        etag: download.etag ?? current.etag,
        lastModified: download.lastModified ?? current.lastModified,
      },
      args.cwd,
    );
    return {
      outcome: "SUCCESS",
      sourceUrl,
      rawSha256,
      normalizedContentSha256: current.currentNormalizedSha256,
      totalDomains: snap?.metrics.totalDomains,
      bytesDownloaded: 0,
      reusedFromCache: true,
      revalidated: true,
      revisionDetected: false,
    };
  }

  const revisionDetected = Boolean(current && current.currentRawSha256 !== rawSha256);
  const revisionOf = revisionDetected && current ? current.currentRawSha256 : null;

  const rawWrite = await writeRawImmutable(
    args.page.tldAsciiLabel,
    args.period,
    rawSha256,
    download.bytes,
    args.cwd,
  );

  const norm = normalizeTransactions({
    rawText: download.text,
    rawBytes: download.bytes,
    tldAsciiLabel: args.page.tldAsciiLabel,
    reportingPeriod: args.period,
    sourceUrl,
    resourcePageUrl: args.page.resourcePageUrl,
    revisionOfRawSha256: revisionOf,
  });

  if (norm.outcome !== "SUCCESS") {
    return {
      outcome: norm.outcome,
      error: norm.error,
      sourceUrl,
      rawSha256,
      bytesDownloaded: rawWrite.wrote ? download.bytes.byteLength : 0,
      reusedFromCache: !rawWrite.wrote,
      revalidated: true,
      revisionDetected,
    };
  }

  const retrievedAt = new Date().toISOString();
  const envelope: NormalizedTransactionsEnvelope = {
    snapshot: norm.snapshot,
    retrievedAt,
    asOfDate: args.asOfDate,
    probeReportingPeriod: args.probeReportingPeriod,
  };
  await writeNormalizedEnvelope(envelope, args.cwd);
  await writePeriodCurrent(
    {
      tldAsciiLabel: args.page.tldAsciiLabel,
      reportingPeriod: args.period,
      sourceUrl,
      currentRawSha256: rawSha256,
      currentNormalizedSha256: norm.snapshot.normalizedContentSha256,
      previousRawSha256: revisionOf,
      retrievedAt,
      etag: download.etag,
      lastModified: download.lastModified,
    },
    args.cwd,
  );

  return {
    outcome: "SUCCESS",
    sourceUrl,
    rawSha256,
    normalizedContentSha256: norm.snapshot.normalizedContentSha256,
    totalDomains: norm.snapshot.metrics.totalDomains,
    bytesDownloaded: rawWrite.wrote ? download.bytes.byteLength : 0,
    reusedFromCache: !rawWrite.wrote,
    revalidated: true,
    revisionDetected,
  };
}

function toRequestOutcome(
  page: DiscoveredTldPage,
  period: ReportingPeriod,
  phase: AcquisitionPhase,
  r: AcquireOneResult,
): AcquisitionRequestOutcome {
  return {
    tldAsciiLabel: page.tldAsciiLabel,
    reportingPeriod: period,
    phase,
    outcome: r.outcome,
    resourcePageUrl: page.resourcePageUrl,
    sourceUrl: r.sourceUrl,
    rawSha256: r.rawSha256,
    normalizedContentSha256: r.normalizedContentSha256,
    totalDomains: r.totalDomains,
    reusedFromCache: r.reusedFromCache,
    revalidated: r.revalidated,
    revisionDetected: r.revisionDetected,
    bytesDownloaded: r.bytesDownloaded,
    error: r.error,
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
  const fetchImpl = options.fetchImpl;

  let throttlingObserved = false;
  let stopBulk = false;
  const shouldStop = () => stopBulk;

  log(`asOfDate=${asOfDate} probeReportingPeriod=${probeReportingPeriod}`);

  const callerSuppliedPages = options.pages != null;
  let discoverySource: AcquisitionDiscoverySource = callerSuppliedPages
    ? "CALLER_SUPPLIED"
    : "ICANN_FULL_DISCOVERY";

  let pages: DiscoveredTldPage[] = options.pages ?? [];
  if (!options.pages) {
    const cachePath = discoveryCachePath(cwd);
    let loaded: DiscoveredTldPage[] | null = null;
    let cacheQualified = false;
    try {
      const cached = JSON.parse(await readFile(cachePath, "utf8")) as {
        asOfDate?: string;
        pages: DiscoveredTldPage[];
        discoveryProvenance?: DiscoveryCacheProvenance;
      };
      if (cached.pages?.length && cached.asOfDate === asOfDate) {
        loaded = cached.pages;
        cacheQualified =
          cached.discoveryProvenance?.schemaVersion === MRR_DISCOVERY_CACHE_SCHEMA_VERSION
          && cached.discoveryProvenance.source === "ICANN_FULL_DISCOVERY"
          && cached.discoveryProvenance.qualifiedForFullStageD === true;
        log(
          `Reusing discovery cache (${loaded.length} TLD pages; ${cacheQualified ? "qualified full" : "legacy/unqualified"})`,
        );
      }
    } catch {
      // no cache
    }
    if (loaded) {
      pages = loaded;
      discoverySource = cacheQualified
        ? "QUALIFIED_DISCOVERY_CACHE"
        : "LEGACY_UNQUALIFIED_CACHE";
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
      discoverySource = "ICANN_FULL_DISCOVERY";
      const discoveryProvenance: DiscoveryCacheProvenance = {
        schemaVersion: MRR_DISCOVERY_CACHE_SCHEMA_VERSION,
        source: "ICANN_FULL_DISCOVERY",
        qualifiedForFullStageD: true,
      };
      await mkdir(dirname(cachePath), { recursive: true });
      await writeFile(
        cachePath,
        `${JSON.stringify({
          asOfDate,
          probeReportingPeriod,
          pages,
          cachedAt: new Date().toISOString(),
          discoveryProvenance,
        })}\n`,
        "utf8",
      );
    }
  }
  log(`Discovered ${pages.length} TLD pages (discoverySource=${discoverySource})`);

  const pageByTld = new Map(pages.map((p) => [p.tldAsciiLabel, p]));
  const discoveredLabels = new Set(pages.map((p) => p.tldAsciiLabel));

  let probePages = pages;
  if (options.probeLimit != null) {
    probePages = pages.slice(0, options.probeLimit);
  }

  const requestOutcomes: AcquisitionRequestOutcome[] = [];
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

  const accumulate = (r: AcquireOneResult) => {
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
  };

  const runOne = async (
    page: DiscoveredTldPage,
    period: ReportingPeriod,
  ): Promise<AcquireOneResult> => {
    let r = await acquireOneTransactions({
      page,
      period,
      cwd,
      asOfDate,
      probeReportingPeriod,
      cacheOnly: options.cacheOnly,
      fetchImpl,
    });
    if (r.throttled) {
      throttlingObserved = true;
      log(`Throttling observed (${r.error}); cooling down 90s before stop decision`);
      await new Promise((res) => setTimeout(res, 90_000));
      const retry = await acquireOneTransactions({
        page,
        period,
        cwd,
        asOfDate,
        probeReportingPeriod,
        cacheOnly: options.cacheOnly,
        fetchImpl,
      });
      if (retry.throttled || retry.outcome === "DOWNLOAD_FAILED") {
        stopBulk = true;
        log(`Throttling persisted; stopping bulk acquisition`);
      }
      r = retry;
    }
    return r;
  };

  log(`Probe period ${probeReportingPeriod} for ${probePages.length} TLDs…`);
  await mapPool(
    probePages,
    concurrency,
    async (page) => {
      if (shouldStop()) return;
      filesRequested += 1;
      const r = await runOne(page, probeReportingPeriod);
      accumulate(r);
      requestOutcomes.push(toRequestOutcome(page, probeReportingPeriod, "PROBE", r));
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
    try {
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
  const historyPeriods = historyWindowEndingAt(
    probeReportingPeriod,
    STAGE_D_HISTORY_PERIOD_COUNT,
  );

  if (!options.skipHistory && !stopBulk) {
    const jobs: Array<{ tld: string; period: ReportingPeriod }> = [];
    for (const member of historyUniverse) {
      for (const period of historyPeriods) {
        if (period === probeReportingPeriod) continue;
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
        const r = await runOne(page, job.period);
        accumulate(r);
        requestOutcomes.push(toRequestOutcome(page, job.period, "HISTORY", r));
      },
      shouldStop,
    );
  }

  requestOutcomes.sort(
    (a, b) =>
      a.phase.localeCompare(b.phase)
      || a.tldAsciiLabel.localeCompare(b.tldAsciiLabel)
      || a.reportingPeriod.localeCompare(b.reportingPeriod),
  );

  const probeCounts = reconcileOutcomeCounts(requestOutcomes, "PROBE");
  const historyCounts = reconcileOutcomeCounts(requestOutcomes, "HISTORY");

  const outcomesArtifact: import("./types").AcquisitionOutcomesArtifact = {
    schemaVersion: MRR_OUTCOMES_SCHEMA_VERSION,
    runId,
    asOfDate,
    probeReportingPeriod,
    requests: requestOutcomes,
  };
  const writtenOutcomes = await writeOutcomesArtifact(outcomesArtifact, cwd);

  const completedAt = new Date().toISOString();
  const durationMs = Date.parse(completedAt) - Date.parse(startedAt);
  let resultStatus: AcquisitionRunManifest["resultStatus"] = "SUCCESS";
  if (stopBulk && throttlingObserved) resultStatus = "STOPPED_THROTTLED";
  else if (probeCounts.success === 0) resultStatus = "FAILED";
  else if (
    probeCounts.missing + probeCounts.downloadFailed + probeCounts.unsupportedSchema > 0
    || historyCounts.missing + historyCounts.downloadFailed > 0
    || schemaFailures > 0
    || validationFailures > 0
  ) {
    resultStatus = "PARTIAL";
  }

  const runScope = buildAcquisitionRunScope({
    callerSuppliedPages,
    probeLimit: options.probeLimit,
    skipHistory: options.skipHistory === true,
    discoverySource,
    discoveredTldCount: pages.length,
    probedTldCount: probePages.length,
    historyPeriodCount: historyPeriods.length,
  });

  const manifest: AcquisitionRunManifest = {
    schemaVersion: MRR_RUN_MANIFEST_SCHEMA_VERSION,
    runId,
    startedAt,
    completedAt,
    asOfDate,
    probeReportingPeriod,
    discoveredTldCount: pages.length,
    probe: probeCounts,
    history: historyCounts,
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
    outcomesArtifactPath: relative(cwd, writtenOutcomes.path),
    outcomesArtifactSha256: writtenOutcomes.sha256,
    resultStatus,
    throttlingObserved,
    durationMs,
    notes: [
      "Transactions-only Stage D acquisition",
      "Activity links observed during discovery are not downloaded",
      "renewalRate is intentionally unsupported",
      "normalized snapshots are intrinsic-only; temporal metrics are series derivations",
      "authoritative acquisition revalidates remote source URLs by default",
      `runScope.mode=${runScope.mode}; discoverySource=${runScope.discoverySource}`,
    ],
    runScope,
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
      outcomesArtifactPath: manifest.outcomesArtifactPath,
      outcomesArtifactSha256: manifest.outcomesArtifactSha256,
    },
    cwd,
  );

  return { manifest, probeResults, requestOutcomes };
}

/** Test helper: seed a period from known bytes without remote fetch. */
export async function seedNormalizedFromBytes(args: {
  cwd: string;
  tldAsciiLabel: string;
  reportingPeriod: ReportingPeriod;
  sourceUrl: string;
  resourcePageUrl: string;
  rawBytes: Uint8Array;
  rawText: string;
  asOfDate?: string;
  revisionOfRawSha256?: string | null;
}): Promise<{ snapshotSha: string; rawSha: string }> {
  const current = await readPeriodCurrent(args.tldAsciiLabel, args.reportingPeriod, args.cwd);
  const rawSha = sha256Hex(args.rawBytes);
  const revisionOf =
    args.revisionOfRawSha256 !== undefined
      ? args.revisionOfRawSha256
      : current && current.currentRawSha256 !== rawSha
        ? current.currentRawSha256
        : null;
  await writeRawImmutable(args.tldAsciiLabel, args.reportingPeriod, rawSha, args.rawBytes, args.cwd);
  const norm = normalizeTransactions({
    rawText: args.rawText,
    rawBytes: args.rawBytes,
    tldAsciiLabel: args.tldAsciiLabel,
    reportingPeriod: args.reportingPeriod,
    sourceUrl: args.sourceUrl,
    resourcePageUrl: args.resourcePageUrl,
    revisionOfRawSha256: revisionOf,
  });
  if (norm.outcome !== "SUCCESS") throw new Error(norm.error);
  const retrievedAt = new Date().toISOString();
  await writeNormalizedEnvelope(
    { snapshot: norm.snapshot, retrievedAt, asOfDate: args.asOfDate },
    args.cwd,
  );
  await writePeriodCurrent(
    {
      tldAsciiLabel: args.tldAsciiLabel,
      reportingPeriod: args.reportingPeriod,
      sourceUrl: args.sourceUrl,
      currentRawSha256: rawSha,
      currentNormalizedSha256: norm.snapshot.normalizedContentSha256,
      previousRawSha256: revisionOf,
      retrievedAt,
    },
    args.cwd,
  );
  return { snapshotSha: norm.snapshot.normalizedContentSha256, rawSha };
}

export { readRawBytes };
