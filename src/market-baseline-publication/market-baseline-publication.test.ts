import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CORE_TRANSACTION_HEADERS } from "@/market-baseline-mrr/schema-profiles";
import { normalizeTransactions } from "@/market-baseline-mrr/normalize";
import { seedNormalizedFromBytes } from "@/market-baseline-mrr/acquire";
import { sha256Hex } from "@/market-baseline-mrr/hash";
import {
  MRR_OUTCOMES_SCHEMA_VERSION,
  MRR_RUN_MANIFEST_SCHEMA_VERSION,
  MRR_RUN_MANIFEST_SCHEMA_VERSION_V1_0,
  STAGE_D_HISTORY_PERIOD_COUNT,
} from "@/market-baseline-mrr/types";
import type {
  AcquisitionOutcomesArtifact,
  AcquisitionRequestOutcome,
  AcquisitionRunManifest,
  AcquisitionRunScope,
  NormalizedTransactionsSnapshot,
  OutcomeCountBucket,
  ReportingPeriod,
} from "@/market-baseline-mrr/types";
import {
  buildMarketBaselinePublication,
  composePublicationIdentity,
  projectTldPublicationGrain,
  snapshotKey,
} from "./build";
import { hashPublicationContent, hashShardContent, shardSemanticFromParts } from "./hash";
import { loadCurrentPublicationPointer, loadPublicationIndex, loadTldShard } from "./load";
import {
  assertPublicationIndexVerified,
  assertShardVerified,
  verifyPublicationIndexContentSha,
  verifyTldShard,
} from "./verify";
import { writePublicationArtifacts } from "./write";
import { publishFromMrrArchive } from "./from-archive";
import { MARKET_BASELINE_PUBLICATION_SCHEMA_VERSION } from "./types";

function syntheticCsv(totalDomains: number): string {
  const headers = [...CORE_TRANSACTION_HEADERS];
  const zeros = headers.map(() => "0");
  const set = (row: string[], field: (typeof headers)[number], value: string | number) => {
    row[headers.indexOf(field)] = String(value);
  };
  const reg = [...zeros];
  set(reg, "registrar-name", "Alpha Registrar");
  set(reg, "iana-id", "100");
  set(reg, "total-domains", totalDomains);
  const special = [...zeros];
  set(special, "registrar-name", "Registry Special");
  set(special, "iana-id", "9998");
  set(special, "total-domains", 0);
  const totals = [...zeros];
  set(totals, "registrar-name", "Totals");
  set(totals, "iana-id", "");
  set(totals, "total-domains", totalDomains);
  return [headers.join(","), reg.join(","), special.join(","), totals.join(",")].join("\n") + "\n";
}

function normalizePeriod(
  tld: string,
  period: string,
  domains: number,
): NormalizedTransactionsSnapshot {
  const compact = period.replace("-", "");
  const text = syntheticCsv(domains);
  const bytes = new TextEncoder().encode(text);
  const r = normalizeTransactions({
    rawText: text,
    rawBytes: bytes,
    tldAsciiLabel: tld,
    reportingPeriod: period,
    sourceUrl: `https://www.icann.org/sites/default/files/mrr/${tld}/${tld}-transactions-${compact}-en.csv`,
    resourcePageUrl: `https://example.test/${tld}`,
  });
  if (r.outcome !== "SUCCESS") throw new Error(r.error);
  return r.snapshot;
}

function req(partial: {
  tldAsciiLabel: string;
  reportingPeriod: ReportingPeriod;
  phase: AcquisitionRequestOutcome["phase"];
  outcome: AcquisitionRequestOutcome["outcome"];
  rawSha256?: string;
  error?: string;
}): AcquisitionRequestOutcome {
  return {
    tldAsciiLabel: partial.tldAsciiLabel,
    reportingPeriod: partial.reportingPeriod,
    phase: partial.phase,
    outcome: partial.outcome,
    resourcePageUrl: `https://example.test/${partial.tldAsciiLabel}`,
    rawSha256: partial.rawSha256,
    error: partial.error,
    reusedFromCache: false,
    revalidated: false,
    revisionDetected: false,
    bytesDownloaded: partial.outcome === "SUCCESS" ? 100 : 0,
  };
}

function emptyBucket(): OutcomeCountBucket {
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

function bucketFromRequests(
  requests: AcquisitionRequestOutcome[],
  phase: "PROBE" | "HISTORY",
): OutcomeCountBucket {
  const bucket = emptyBucket();
  for (const r of requests) {
    if (r.phase !== phase) continue;
    switch (r.outcome) {
      case "SUCCESS":
        bucket.success += 1;
        break;
      case "MISSING_REPORT":
        bucket.missing += 1;
        break;
      case "DOWNLOAD_FAILED":
        bucket.downloadFailed += 1;
        break;
      case "UNSUPPORTED_SCHEMA":
        bucket.unsupportedSchema += 1;
        break;
      case "PARSE_FAILED":
        bucket.parseFailed += 1;
        break;
      case "VALIDATION_FAILED":
        bucket.validationFailed += 1;
        break;
      case "NORMALIZATION_FAILED":
        bucket.normalizationFailed += 1;
        break;
    }
  }
  return bucket;
}

function makeRunScope(args: {
  mode: AcquisitionRunScope["mode"];
  discoveredTldCount: number;
  probedTldCount: number;
  historyPeriodCount: number;
  probeLimit?: number | null;
}): AcquisitionRunScope {
  const probeLimit = args.probeLimit ?? null;
  return {
    mode: args.mode,
    discoverySource:
      args.mode === "FULL_STAGE_D" ? "ICANN_FULL_DISCOVERY" : "CALLER_SUPPLIED",
    probeLimit,
    historyMode:
      args.historyPeriodCount === STAGE_D_HISTORY_PERIOD_COUNT
        ? "FULL_24_MONTH"
        : "SKIPPED_OR_BOUNDED",
    intendedProbeUniverse:
      args.mode === "FULL_STAGE_D" ? "ALL_DISCOVERED_TLDS" : "BOUNDED",
    discoveredTldCount: args.discoveredTldCount,
    probedTldCount: args.probedTldCount,
  };
}

async function writeAcquisitionEvidence(args: {
  cwd: string;
  runId: string;
  asOfDate: string;
  probeReportingPeriod: ReportingPeriod;
  requests: AcquisitionRequestOutcome[];
  setCurrentIndex?: boolean;
  /** Override discoveredTldCount (probeLimit-style mismatch). */
  discoveredTldCount?: number;
  historyUniverseTlds?: string[];
  historyPeriodCount?: number;
  resultStatus?: AcquisitionRunManifest["resultStatus"];
  /** Corrupt outcomes bytes after writing without updating SHA. */
  tamperOutcomes?: (outcomes: AcquisitionOutcomesArtifact) => AcquisitionOutcomesArtifact;
  /** Override current-index recorded SHA while keeping manifest SHA correct. */
  currentIndexShaOverride?: string;
  /** Authoritative scope mode. Defaults to BOUNDED. */
  runScopeMode?: AcquisitionRunScope["mode"];
  /** Emit legacy 1.0.0 manifest without runScope. */
  legacyManifest?: boolean;
}): Promise<{ outcomesSha256: string; outcomesRel: string }> {
  const outcomes: AcquisitionOutcomesArtifact = {
    schemaVersion: MRR_OUTCOMES_SCHEMA_VERSION,
    runId: args.runId,
    asOfDate: args.asOfDate,
    probeReportingPeriod: args.probeReportingPeriod,
    requests: args.requests,
  };
  const manifestsDir = join(args.cwd, ".data/market-baseline/mrr/manifests");
  mkdirSync(manifestsDir, { recursive: true });
  const outcomesRel = `.data/market-baseline/mrr/manifests/${args.runId}.outcomes.json`;
  const outcomesBody = `${JSON.stringify(outcomes, null, 2)}\n`;
  const outcomesSha256 = sha256Hex(outcomesBody);
  writeFileSync(join(args.cwd, outcomesRel), outcomesBody, "utf8");

  if (args.tamperOutcomes) {
    const tampered = args.tamperOutcomes(structuredClone(outcomes));
    writeFileSync(
      join(args.cwd, outcomesRel),
      `${JSON.stringify(tampered, null, 2)}\n`,
      "utf8",
    );
  }

  const probeTlds = [
    ...new Set(
      args.requests.filter((r) => r.phase === "PROBE").map((r) => r.tldAsciiLabel),
    ),
  ];
  const historyUniverseTlds = args.historyUniverseTlds ?? [];
  const historyPeriodCount = args.historyPeriodCount ?? 24;
  const discoveredTldCount = args.discoveredTldCount ?? probeTlds.length;
  const runScopeMode = args.runScopeMode ?? "BOUNDED";
  const manifest: AcquisitionRunManifest = {
    schemaVersion: args.legacyManifest
      ? MRR_RUN_MANIFEST_SCHEMA_VERSION_V1_0
      : MRR_RUN_MANIFEST_SCHEMA_VERSION,
    runId: args.runId,
    startedAt: "2026-10-26T00:00:00.000Z",
    completedAt: "2026-10-26T00:01:00.000Z",
    asOfDate: args.asOfDate,
    probeReportingPeriod: args.probeReportingPeriod,
    discoveredTldCount,
    probe: bucketFromRequests(args.requests, "PROBE"),
    history: bucketFromRequests(args.requests, "HISTORY"),
    top100: [],
    controlSet: [],
    delegatedOverlaps: [],
    historyUniverse: historyUniverseTlds.map((tldAsciiLabel) => ({
      tldAsciiLabel,
      reasons: ["CONTROL_SET"],
    })),
    historyPeriodCount,
    filesRequested: args.requests.length,
    filesDownloaded: 0,
    filesReusedFromCache: 0,
    missingReports: 0,
    schemaFailures: 0,
    validationFailures: 0,
    normalizationFailures: 0,
    bytesDownloaded: 0,
    rawHashes: [],
    normalizedHashes: [],
    sourceRevisionsDetected: 0,
    outcomesArtifactPath: outcomesRel,
    outcomesArtifactSha256: outcomesSha256,
    resultStatus: args.resultStatus ?? "PARTIAL",
    throttlingObserved: args.resultStatus === "STOPPED_THROTTLED",
    durationMs: 1,
    notes: [],
    ...(args.legacyManifest
      ? {}
      : {
          runScope: makeRunScope({
            mode: runScopeMode,
            discoveredTldCount,
            probedTldCount: probeTlds.length,
            historyPeriodCount,
            probeLimit:
              discoveredTldCount !== probeTlds.length ? probeTlds.length : null,
          }),
        }),
  };
  writeFileSync(
    join(manifestsDir, `${args.runId}.json`),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  if (args.setCurrentIndex !== false) {
    const indexesDir = join(args.cwd, ".data/market-baseline/mrr/indexes");
    mkdirSync(indexesDir, { recursive: true });
    writeFileSync(
      join(indexesDir, "current.json"),
      `${JSON.stringify(
        {
          updatedAt: "2026-10-26T00:01:00.000Z",
          latestRunId: args.runId,
          asOfDate: args.asOfDate,
          probeReportingPeriod: args.probeReportingPeriod,
          outcomesArtifactPath: outcomesRel,
          outcomesArtifactSha256: args.currentIndexShaOverride ?? outcomesSha256,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }
  return { outcomesSha256, outcomesRel };
}

function historyPeriodsForCount(
  probe: ReportingPeriod,
  historyPeriodCount: number,
): ReportingPeriod[] {
  // newest-first excluding probe itself for HISTORY phase
  const [ys, ms] = probe.split("-").map(Number) as [number, number];
  const out: ReportingPeriod[] = [];
  let y = ys;
  let m = ms;
  for (let i = 0; i < historyPeriodCount - 1; i++) {
    m -= 1;
    if (m <= 0) {
      m = 12;
      y -= 1;
    }
    out.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return out;
}

function fullStageDRequests(args: {
  tlds: string[];
  probe: ReportingPeriod;
  historyPeriodCount: number;
  missingHistory?: Array<{ tld: string; period: ReportingPeriod }>;
}): AcquisitionRequestOutcome[] {
  const missing = new Set(
    (args.missingHistory ?? []).map((x) => `${x.tld}@${x.period}`),
  );
  const requests: AcquisitionRequestOutcome[] = [];
  for (const tld of args.tlds) {
    requests.push(
      req({
        tldAsciiLabel: tld,
        reportingPeriod: args.probe,
        phase: "PROBE",
        outcome: "SUCCESS",
      }),
    );
  }
  const histPeriods = historyPeriodsForCount(args.probe, args.historyPeriodCount);
  for (const tld of args.tlds) {
    for (const period of histPeriods) {
      const key = `${tld}@${period}`;
      requests.push(
        req({
          tldAsciiLabel: tld,
          reportingPeriod: period,
          phase: "HISTORY",
          outcome: missing.has(key) ? "MISSING_REPORT" : "SUCCESS",
          error: missing.has(key) ? `No Transactions link for ${period}` : undefined,
        }),
      );
    }
  }
  return requests;
}

describe("market-baseline publication", () => {
  it("is deterministic for identical accepted inputs (generatedAt excluded from content hash)", () => {
    const snaps = new Map([
      [snapshotKey("demo", "2026-06"), normalizePeriod("demo", "2026-06", 157)],
      [snapshotKey("demo", "2026-05"), normalizePeriod("demo", "2026-05", 150)],
      [snapshotKey("demo", "2025-06"), normalizePeriod("demo", "2025-06", 100)],
    ]);
    const a = buildMarketBaselinePublication({
      asOfDate: "2026-10-26",
      snapshots: snaps,
      universeTlds: ["demo"],
      historyPeriodsByTld: new Map([["demo", ["2026-06", "2026-05", "2025-06"]]]),
      generatedAt: "2026-10-26T00:00:00.000Z",
    });
    const b = buildMarketBaselinePublication({
      asOfDate: "2026-10-26",
      snapshots: snaps,
      universeTlds: ["demo"],
      historyPeriodsByTld: new Map([["demo", ["2026-06", "2026-05", "2025-06"]]]),
      generatedAt: "2026-11-01T12:00:00.000Z",
    });
    expect(a.index.publicationContentSha256).toBe(b.index.publicationContentSha256);
    expect(a.index.generatedAt).not.toBe(b.index.generatedAt);
  });

  it("keeps semantic SHA stable across asOfDate within the same source reporting period", () => {
    const snaps = new Map([
      [snapshotKey("demo", "2026-06"), normalizePeriod("demo", "2026-06", 157)],
      [snapshotKey("demo", "2026-05"), normalizePeriod("demo", "2026-05", 150)],
      [snapshotKey("demo", "2025-06"), normalizePeriod("demo", "2025-06", 100)],
    ]);
    const a = buildMarketBaselinePublication({
      asOfDate: "2026-10-26",
      snapshots: snaps,
      universeTlds: ["demo"],
      historyPeriodsByTld: new Map([["demo", ["2026-06", "2026-05", "2025-06"]]]),
      generatedAt: "2026-10-26T00:00:00.000Z",
    });
    const b = buildMarketBaselinePublication({
      asOfDate: "2026-10-27",
      snapshots: snaps,
      universeTlds: ["demo"],
      historyPeriodsByTld: new Map([["demo", ["2026-06", "2026-05", "2025-06"]]]),
      generatedAt: "2026-10-26T00:00:00.000Z",
    });
    expect(a.index.semantic.sourceReportingPeriod).toBe("2026-06");
    expect(b.index.semantic.sourceReportingPeriod).toBe("2026-06");
    expect(a.index.publicationContentSha256).toBe(b.index.publicationContentSha256);
    expect(a.index.asOfDate).toBe("2026-10-26");
    expect(b.index.asOfDate).toBe("2026-10-27");
    expect(a.index.semantic).not.toHaveProperty("asOfDate");
  });

  it("changes semantic SHA when source reporting period advances", () => {
    const snaps = new Map([
      [snapshotKey("demo", "2026-06"), normalizePeriod("demo", "2026-06", 157)],
      [snapshotKey("demo", "2026-07"), normalizePeriod("demo", "2026-07", 160)],
    ]);
    const june = buildMarketBaselinePublication({
      asOfDate: "2026-10-26",
      snapshots: snaps,
      universeTlds: ["demo"],
      historyPeriodsByTld: new Map([["demo", ["2026-06", "2026-07"]]]),
    });
    const july = buildMarketBaselinePublication({
      asOfDate: "2026-11-26",
      snapshots: snaps,
      universeTlds: ["demo"],
      historyPeriodsByTld: new Map([["demo", ["2026-06", "2026-07"]]]),
    });
    expect(june.index.semantic.sourceReportingPeriod).toBe("2026-06");
    expect(july.index.semantic.sourceReportingPeriod).toBe("2026-07");
    expect(june.index.publicationContentSha256).not.toBe(
      july.index.publicationContentSha256,
    );
  });

  it("changes semantic SHA when an accepted fact changes", () => {
    const a = buildMarketBaselinePublication({
      asOfDate: "2026-10-26",
      snapshots: new Map([
        [snapshotKey("demo", "2026-06"), normalizePeriod("demo", "2026-06", 100)],
      ]),
      universeTlds: ["demo"],
    });
    const b = buildMarketBaselinePublication({
      asOfDate: "2026-10-26",
      snapshots: new Map([
        [snapshotKey("demo", "2026-06"), normalizePeriod("demo", "2026-06", 101)],
      ]),
      universeTlds: ["demo"],
    });
    expect(a.index.publicationContentSha256).not.toBe(b.index.publicationContentSha256);
  });

  it("derives temporal metrics with exact-period semantics and no gap bridging", () => {
    const snaps = new Map([
      [snapshotKey("demo", "2026-06"), normalizePeriod("demo", "2026-06", 157)],
      [snapshotKey("demo", "2026-05"), normalizePeriod("demo", "2026-05", 150)],
      [snapshotKey("demo", "2025-06"), normalizePeriod("demo", "2025-06", 100)],
    ]);
    const full = buildMarketBaselinePublication({
      asOfDate: "2026-10-26",
      snapshots: snaps,
      universeTlds: ["demo"],
      historyPeriodsByTld: new Map([["demo", ["2026-06", "2026-05", "2025-06"]]]),
    });
    const june = full.index.semantic.currentPeriod[0]!;
    expect(june.availability).toBe("AVAILABLE");
    if (june.availability !== "AVAILABLE") return;
    expect(june.netDomainBaseChange).toEqual({ available: true, value: 7 });
    expect(june.monthOverMonthGrowth).toEqual({ available: true, value: 7 / 150 });
    expect(june.yearOverYearGrowth).toEqual({ available: true, value: 57 / 100 });

    const withoutMay = new Map(snaps);
    withoutMay.delete(snapshotKey("demo", "2026-05"));
    const gap = buildMarketBaselinePublication({
      asOfDate: "2026-10-26",
      snapshots: withoutMay,
      universeTlds: ["demo"],
      historyPeriodsByTld: new Map([["demo", ["2026-06", "2026-05", "2025-06"]]]),
    });
    const juneGap = gap.index.semantic.currentPeriod[0]!;
    expect(juneGap.availability).toBe("AVAILABLE");
    if (juneGap.availability !== "AVAILABLE") return;
    expect(juneGap.monthOverMonthGrowth).toEqual({
      available: false,
      reason: "prior_period_unavailable",
    });
    expect(juneGap.netDomainBaseChange).toEqual({
      available: false,
      reason: "prior_period_unavailable",
    });
    expect(juneGap.yearOverYearGrowth).toEqual({ available: true, value: 57 / 100 });
    const mayFact = gap.shards[0]!.periods["2026-05"]!;
    expect(mayFact.availability).toBe("MISSING");
  });

  it("does not represent missing TLD-period as zero", () => {
    const snaps = new Map([
      [snapshotKey("alpha", "2026-06"), normalizePeriod("alpha", "2026-06", 10)],
    ]);
    const built = buildMarketBaselinePublication({
      asOfDate: "2026-10-26",
      snapshots: snaps,
      universeTlds: ["alpha", "beta"],
    });
    const beta = built.index.semantic.currentPeriod.find((f) => f.tldAsciiLabel === "beta")!;
    expect(beta.availability).toBe("MISSING");
    if (beta.availability === "MISSING") {
      expect(beta).not.toHaveProperty("totalDomains");
    }
    expect(built.index.semantic.coverage.missingAtSourcePeriod).toBe(1);
    expect(built.index.semantic.coverage.availableAtSourcePeriod).toBe(1);
  });

  it("excludes Totals from registrar grain and preserves special classification", () => {
    const snap = normalizePeriod("demo", "2026-06", 42);
    const snaps = new Map([[snapshotKey("demo", "2026-06"), snap]]);
    const built = buildMarketBaselinePublication({
      asOfDate: "2026-10-26",
      snapshots: snaps,
      universeTlds: ["demo"],
    });
    const regs = built.shards[0]!.registrarsByPeriod["2026-06"]!;
    expect(regs.every((r) => r.classification !== "TOTALS")).toBe(true);
    expect(regs.some((r) => r.classification === "SPECIAL_REGISTRY_OR_SYSTEM")).toBe(true);
    expect(regs.some((r) => r.ianaRegistrarId === "100")).toBe(true);
    const accredited = regs.find((r) => r.ianaRegistrarId === "100")!;
    expect(accredited.shareOfTldTotal).toEqual({ available: true, value: 1 });
  });

  it("uses explicit current revision C after A→B→C (not lexical hash order)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-pub-rev-"));
    try {
      const tld = "demo";
      const period = "2026-06";
      const url = `https://www.icann.org/sites/default/files/mrr/${tld}/${tld}-transactions-202606-en.csv`;
      const pageUrl = `https://example.test/${tld}`;

      const bodies = [syntheticCsv(10), syntheticCsv(20), syntheticCsv(30)];
      const hashes: string[] = [];
      for (let i = 0; i < bodies.length; i++) {
        const text = bodies[i]!;
        const bytes = new TextEncoder().encode(text);
        const seeded = await seedNormalizedFromBytes({
          cwd: dir,
          tldAsciiLabel: tld,
          reportingPeriod: period,
          sourceUrl: url,
          resourcePageUrl: pageUrl,
          rawBytes: bytes,
          rawText: text,
          asOfDate: "2026-10-26",
        });
        hashes.push(seeded.rawSha);
      }

      const current = JSON.parse(
        readFileSync(
          join(dir, `.data/market-baseline/mrr/indexes/periods/${tld}/${period}.json`),
          "utf8",
        ),
      );
      expect(current.currentRawSha256).toBe(hashes[2]);
      expect(current.previousRawSha256).toBe(hashes[1]);

      const poisonSha = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      const poisonDir = join(dir, `.data/market-baseline/mrr/normalized/${tld}/${period}`);
      mkdirSync(poisonDir, { recursive: true });
      writeFileSync(
        join(poisonDir, `${poisonSha}.json`),
        JSON.stringify({
          snapshot: {
            ...normalizePeriod(tld, period, 999),
            normalizedContentSha256: poisonSha,
            rawSha256: poisonSha,
          },
          retrievedAt: "2099-01-01T00:00:00.000Z",
        }),
      );

      await writeAcquisitionEvidence({
        cwd: dir,
        runId: "mrr-test-rev-1",
        runScopeMode: "FULL_STAGE_D",
        asOfDate: "2026-10-26",
        probeReportingPeriod: "2026-06",
        requests: [
          req({
            tldAsciiLabel: tld,
            reportingPeriod: period,
            phase: "PROBE",
            outcome: "SUCCESS",
            rawSha256: hashes[2],
          }),
        ],
      });

      const built = await publishFromMrrArchive({
        cwd: dir,
        asOfDate: "2026-10-26",
        tldAllowlist: [tld],
        historyPeriodCount: 1,
      });
      const fact = built.index.semantic.currentPeriod[0]!;
      expect(fact.availability).toBe("AVAILABLE");
      if (fact.availability !== "AVAILABLE") return;
      expect(fact.totalDomains).toBe(30);
      expect(fact.provenance.rawSha256).toBe(hashes[2]);
      expect(fact.provenance.rawSha256).not.toBe(poisonSha);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes sharded artifacts and supports single-TLD load without archive scan", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-pub-write-"));
    try {
      const snaps = new Map([
        [snapshotKey("alpha", "2026-06"), normalizePeriod("alpha", "2026-06", 100)],
        [snapshotKey("beta", "2026-06"), normalizePeriod("beta", "2026-06", 50)],
      ]);
      const built = buildMarketBaselinePublication({
        asOfDate: "2026-10-26",
        snapshots: snaps,
        universeTlds: ["alpha", "beta"],
        generatedAt: "2026-10-26T00:00:00.000Z",
      });
      const written = await writePublicationArtifacts(built, dir);
      const pointer = await loadCurrentPublicationPointer(dir);
      expect(pointer?.publicationContentSha256).toBe(written.contentSha256);
      expect(pointer?.asOfDate).toBe("2026-10-26");
      const index = await loadPublicationIndex(written.contentSha256, dir);
      expect(index.asOfDate).toBe("2026-10-26");
      expect(index.semantic.coverage.tldCountInPublication).toBe(2);
      const shard = await loadTldShard(written.contentSha256, "alpha", dir);
      expect(shard.tldAsciiLabel).toBe("alpha");
      expect(shard.periods["2026-06"]?.availability).toBe("AVAILABLE");
      const fact = shard.periods["2026-06"]!;
      if (fact.availability === "AVAILABLE") {
        expect(fact.provenance.sourceSystem).toBe("icann-mrr-transactions");
        expect(fact.provenance.normalizedContentSha256).toMatch(/^[a-f0-9]{64}$/);
      }
      await expect(
        loadTldShard(written.contentSha256, "../etc/passwd", dir),
      ).rejects.toThrow(/Invalid TLD/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("preserves provenance on published facts", () => {
    const snap = normalizePeriod("demo", "2026-06", 12);
    const built = buildMarketBaselinePublication({
      asOfDate: "2026-10-26",
      snapshots: new Map([[snapshotKey("demo", "2026-06"), snap]]),
      universeTlds: ["demo"],
    });
    const fact = built.index.semantic.currentPeriod[0]!;
    expect(fact.availability).toBe("AVAILABLE");
    if (fact.availability !== "AVAILABLE") return;
    expect(fact.provenance.rawSha256).toBe(snap.rawSha256);
    expect(fact.provenance.normalizedContentSha256).toBe(snap.normalizedContentSha256);
    expect(fact.provenance.sourceUrl).toContain("demo-transactions-202606");
  });

  it("A: missing probe identity survives archive publication", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-pub-cov-a-"));
    try {
      await seedNormalizedFromBytes({
        cwd: dir,
        tldAsciiLabel: "alpha",
        reportingPeriod: "2026-06",
        sourceUrl:
          "https://www.icann.org/sites/default/files/mrr/alpha/alpha-transactions-202606-en.csv",
        resourcePageUrl: "https://example.test/alpha",
        rawBytes: new TextEncoder().encode(syntheticCsv(100)),
        rawText: syntheticCsv(100),
        asOfDate: "2026-10-26",
      });
      await writeAcquisitionEvidence({
        cwd: dir,
        runId: "mrr-cov-a",
        runScopeMode: "FULL_STAGE_D",
        asOfDate: "2026-10-26",
        probeReportingPeriod: "2026-06",
        requests: [
          req({
            tldAsciiLabel: "alpha",
            reportingPeriod: "2026-06",
            phase: "PROBE",
            outcome: "SUCCESS",
          }),
          req({
            tldAsciiLabel: "beta",
            reportingPeriod: "2026-06",
            phase: "PROBE",
            outcome: "MISSING_REPORT",
            error: "No Transactions link for 2026-06",
          }),
        ],
      });

      const built = await publishFromMrrArchive({
        cwd: dir,
        asOfDate: "2026-10-26",
        historyPeriodCount: 3,
      });
      const labels = built.index.semantic.currentPeriod.map((f) => f.tldAsciiLabel).sort();
      expect(labels).toEqual(["alpha", "beta"]);
      const alpha = built.index.semantic.currentPeriod.find((f) => f.tldAsciiLabel === "alpha")!;
      const beta = built.index.semantic.currentPeriod.find((f) => f.tldAsciiLabel === "beta")!;
      expect(alpha.availability).toBe("AVAILABLE");
      expect(beta.availability).toBe("MISSING");
      if (beta.availability === "MISSING") {
        expect(beta.reason).toBe("acquisition_outcome:MISSING_REPORT");
      }
      expect(built.index.semantic.coverage.availableAtSourcePeriod).toBe(1);
      expect(built.index.semantic.coverage.missingAtSourcePeriod).toBe(1);
      expect(built.index.semantic.coverage.tldCountInPublication).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("B: non-history TLD does not receive fabricated historical MISSING facts", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-pub-cov-b-"));
    try {
      for (const period of ["2026-06", "2026-05", "2026-04"] as const) {
        await seedNormalizedFromBytes({
          cwd: dir,
          tldAsciiLabel: "alpha",
          reportingPeriod: period,
          sourceUrl: `https://www.icann.org/sites/default/files/mrr/alpha/alpha-transactions-${period.replace("-", "")}-en.csv`,
          resourcePageUrl: "https://example.test/alpha",
          rawBytes: new TextEncoder().encode(syntheticCsv(10)),
          rawText: syntheticCsv(10),
          asOfDate: "2026-10-26",
        });
      }
      await seedNormalizedFromBytes({
        cwd: dir,
        tldAsciiLabel: "beta",
        reportingPeriod: "2026-06",
        sourceUrl:
          "https://www.icann.org/sites/default/files/mrr/beta/beta-transactions-202606-en.csv",
        resourcePageUrl: "https://example.test/beta",
        rawBytes: new TextEncoder().encode(syntheticCsv(5)),
        rawText: syntheticCsv(5),
        asOfDate: "2026-10-26",
      });
      await writeAcquisitionEvidence({
        cwd: dir,
        runId: "mrr-cov-b",
        runScopeMode: "FULL_STAGE_D",
        asOfDate: "2026-10-26",
        probeReportingPeriod: "2026-06",
        historyUniverseTlds: ["alpha"],
        historyPeriodCount: 3,
        requests: [
          req({
            tldAsciiLabel: "alpha",
            reportingPeriod: "2026-06",
            phase: "PROBE",
            outcome: "SUCCESS",
          }),
          req({
            tldAsciiLabel: "beta",
            reportingPeriod: "2026-06",
            phase: "PROBE",
            outcome: "SUCCESS",
          }),
          req({
            tldAsciiLabel: "alpha",
            reportingPeriod: "2026-05",
            phase: "HISTORY",
            outcome: "SUCCESS",
          }),
          req({
            tldAsciiLabel: "alpha",
            reportingPeriod: "2026-04",
            phase: "HISTORY",
            outcome: "SUCCESS",
          }),
        ],
      });

      const built = await publishFromMrrArchive({
        cwd: dir,
        asOfDate: "2026-10-26",
        historyPeriodCount: 3,
      });
      const alphaShard = await loadTldShard(built.contentSha256, "alpha", dir);
      const betaShard = await loadTldShard(built.contentSha256, "beta", dir);
      expect(Object.keys(alphaShard.periods).sort()).toEqual([
        "2026-04",
        "2026-05",
        "2026-06",
      ]);
      expect(Object.keys(betaShard.periods)).toEqual(["2026-06"]);
      expect(betaShard.periods["2026-05"]).toBeUndefined();
      expect(betaShard.periods["2026-04"]).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("C: requested historical MISSING remains explicit", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-pub-cov-c-"));
    try {
      await seedNormalizedFromBytes({
        cwd: dir,
        tldAsciiLabel: "alpha",
        reportingPeriod: "2026-06",
        sourceUrl:
          "https://www.icann.org/sites/default/files/mrr/alpha/alpha-transactions-202606-en.csv",
        resourcePageUrl: "https://example.test/alpha",
        rawBytes: new TextEncoder().encode(syntheticCsv(10)),
        rawText: syntheticCsv(10),
        asOfDate: "2026-10-26",
      });
      await writeAcquisitionEvidence({
        cwd: dir,
        runId: "mrr-cov-c",
        runScopeMode: "FULL_STAGE_D",
        asOfDate: "2026-10-26",
        probeReportingPeriod: "2026-06",
        historyUniverseTlds: ["alpha"],
        historyPeriodCount: 3,
        requests: [
          req({
            tldAsciiLabel: "alpha",
            reportingPeriod: "2026-06",
            phase: "PROBE",
            outcome: "SUCCESS",
          }),
          req({
            tldAsciiLabel: "alpha",
            reportingPeriod: "2026-05",
            phase: "HISTORY",
            outcome: "MISSING_REPORT",
            error: "No Transactions link for 2026-05",
          }),
          req({
            tldAsciiLabel: "alpha",
            reportingPeriod: "2026-04",
            phase: "HISTORY",
            outcome: "SUCCESS",
          }),
        ],
      });
      // Seed only 2026-04 history success (2026-05 intentionally absent).
      await seedNormalizedFromBytes({
        cwd: dir,
        tldAsciiLabel: "alpha",
        reportingPeriod: "2026-04",
        sourceUrl:
          "https://www.icann.org/sites/default/files/mrr/alpha/alpha-transactions-202604-en.csv",
        resourcePageUrl: "https://example.test/alpha",
        rawBytes: new TextEncoder().encode(syntheticCsv(8)),
        rawText: syntheticCsv(8),
        asOfDate: "2026-10-26",
      });

      const built = await publishFromMrrArchive({
        cwd: dir,
        asOfDate: "2026-10-26",
        historyPeriodCount: 3,
      });
      const shard = await loadTldShard(built.contentSha256, "alpha", dir);
      expect(shard.periods["2026-05"]?.availability).toBe("MISSING");
      if (shard.periods["2026-05"]?.availability === "MISSING") {
        expect(shard.periods["2026-05"].reason).toBe(
          "acquisition_outcome:MISSING_REPORT",
        );
      }
      expect(shard.periods["2026-04"]?.availability).toBe("AVAILABLE");
      expect(shard.periods["2026-06"]?.availability).toBe("AVAILABLE");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("D: allowlist retains missing probe identity without period-current", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-pub-cov-d-"));
    try {
      await seedNormalizedFromBytes({
        cwd: dir,
        tldAsciiLabel: "alpha",
        reportingPeriod: "2026-06",
        sourceUrl:
          "https://www.icann.org/sites/default/files/mrr/alpha/alpha-transactions-202606-en.csv",
        resourcePageUrl: "https://example.test/alpha",
        rawBytes: new TextEncoder().encode(syntheticCsv(100)),
        rawText: syntheticCsv(100),
        asOfDate: "2026-10-26",
      });
      await writeAcquisitionEvidence({
        cwd: dir,
        runId: "mrr-cov-d",
        runScopeMode: "FULL_STAGE_D",
        asOfDate: "2026-10-26",
        probeReportingPeriod: "2026-06",
        requests: [
          req({
            tldAsciiLabel: "alpha",
            reportingPeriod: "2026-06",
            phase: "PROBE",
            outcome: "SUCCESS",
          }),
          req({
            tldAsciiLabel: "beta",
            reportingPeriod: "2026-06",
            phase: "PROBE",
            outcome: "MISSING_REPORT",
          }),
          req({
            tldAsciiLabel: "gamma",
            reportingPeriod: "2026-06",
            phase: "PROBE",
            outcome: "SUCCESS",
          }),
        ],
      });

      const built = await publishFromMrrArchive({
        cwd: dir,
        asOfDate: "2026-10-26",
        tldAllowlist: ["alpha", "beta"],
        historyPeriodCount: 1,
      });
      const labels = built.index.semantic.currentPeriod.map((f) => f.tldAsciiLabel).sort();
      expect(labels).toEqual(["alpha", "beta"]);
      expect(
        built.index.semantic.currentPeriod.find((f) => f.tldAsciiLabel === "beta")
          ?.availability,
      ).toBe("MISSING");
      expect(
        built.index.semantic.currentPeriod.find((f) => f.tldAsciiLabel === "gamma"),
      ).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("1B: full run wins over later bounded current smoke", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-pub-1b-full-"));
    try {
      const tlds = ["alpha", "beta", "gamma", "delta"];
      for (const tld of tlds) {
        await seedNormalizedFromBytes({
          cwd: dir,
          tldAsciiLabel: tld,
          reportingPeriod: "2026-06",
          sourceUrl: `https://www.icann.org/sites/default/files/mrr/${tld}/${tld}-transactions-202606-en.csv`,
          resourcePageUrl: `https://example.test/${tld}`,
          rawBytes: new TextEncoder().encode(syntheticCsv(10)),
          rawText: syntheticCsv(10),
          asOfDate: "2026-10-26",
        });
      }
      await writeAcquisitionEvidence({
        cwd: dir,
        runId: "mrr-full-4",
        runScopeMode: "FULL_STAGE_D",
        asOfDate: "2026-10-26",
        probeReportingPeriod: "2026-06",
        historyUniverseTlds: tlds,
        historyPeriodCount: 3,
        setCurrentIndex: false,
        requests: fullStageDRequests({
          tlds,
          probe: "2026-06",
          historyPeriodCount: 3,
        }),
      });
      await writeAcquisitionEvidence({
        cwd: dir,
        runId: "mrr-bounded-2",
        asOfDate: "2026-10-26",
        probeReportingPeriod: "2026-06",
        discoveredTldCount: 4,
        historyUniverseTlds: [],
        historyPeriodCount: 3,
        setCurrentIndex: true,
        requests: [
          req({
            tldAsciiLabel: "alpha",
            reportingPeriod: "2026-06",
            phase: "PROBE",
            outcome: "SUCCESS",
          }),
          req({
            tldAsciiLabel: "beta",
            reportingPeriod: "2026-06",
            phase: "PROBE",
            outcome: "SUCCESS",
          }),
        ],
      });

      const built = await publishFromMrrArchive({
        cwd: dir,
        asOfDate: "2026-10-26",
        historyPeriodCount: 3,
      });
      expect(built.index.sourceAcquisitionRunId).toBe("mrr-full-4");
      expect(built.index.operationalCurrentDiffersFromGoverning).toBe(true);
      expect(built.index.operationalCurrentRunId).toBe("mrr-bounded-2");
      expect(
        built.index.semantic.currentPeriod.map((f) => f.tldAsciiLabel).sort(),
      ).toEqual(["alpha", "beta", "delta", "gamma"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("1B: explicit --run-id may select bounded run with integrity", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-pub-1b-explicit-"));
    try {
      const tlds = ["alpha", "beta", "gamma", "delta"];
      for (const tld of ["alpha", "beta"] as const) {
        await seedNormalizedFromBytes({
          cwd: dir,
          tldAsciiLabel: tld,
          reportingPeriod: "2026-06",
          sourceUrl: `https://www.icann.org/sites/default/files/mrr/${tld}/${tld}-transactions-202606-en.csv`,
          resourcePageUrl: `https://example.test/${tld}`,
          rawBytes: new TextEncoder().encode(syntheticCsv(10)),
          rawText: syntheticCsv(10),
          asOfDate: "2026-10-26",
        });
      }
      await writeAcquisitionEvidence({
        cwd: dir,
        runId: "mrr-full-4",
        runScopeMode: "FULL_STAGE_D",
        asOfDate: "2026-10-26",
        probeReportingPeriod: "2026-06",
        historyUniverseTlds: tlds,
        historyPeriodCount: 3,
        setCurrentIndex: false,
        requests: fullStageDRequests({
          tlds,
          probe: "2026-06",
          historyPeriodCount: 3,
        }),
      });
      await writeAcquisitionEvidence({
        cwd: dir,
        runId: "mrr-bounded-2",
        asOfDate: "2026-10-26",
        probeReportingPeriod: "2026-06",
        discoveredTldCount: 4,
        historyUniverseTlds: [],
        historyPeriodCount: 3,
        setCurrentIndex: true,
        requests: [
          req({
            tldAsciiLabel: "alpha",
            reportingPeriod: "2026-06",
            phase: "PROBE",
            outcome: "SUCCESS",
          }),
          req({
            tldAsciiLabel: "beta",
            reportingPeriod: "2026-06",
            phase: "PROBE",
            outcome: "SUCCESS",
          }),
        ],
      });

      const built = await publishFromMrrArchive({
        cwd: dir,
        asOfDate: "2026-10-26",
        runId: "mrr-bounded-2",
        historyPeriodCount: 3,
      });
      expect(built.index.sourceAcquisitionRunId).toBe("mrr-bounded-2");
      expect(
        built.index.semantic.currentPeriod.map((f) => f.tldAsciiLabel).sort(),
      ).toEqual(["alpha", "beta"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("1B: multiple full-qualified runs fail closed without --run-id", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-pub-1b-multi-"));
    try {
      const tlds = ["alpha", "beta"];
      for (const runId of ["mrr-full-a", "mrr-full-b"] as const) {
        await writeAcquisitionEvidence({
          cwd: dir,
          runId,
          runScopeMode: "FULL_STAGE_D",
          asOfDate: "2026-10-26",
          probeReportingPeriod: "2026-06",
          historyUniverseTlds: tlds,
          historyPeriodCount: 3,
          setCurrentIndex: runId === "mrr-full-b",
          requests: fullStageDRequests({
            tlds,
            probe: "2026-06",
            historyPeriodCount: 3,
          }),
        });
      }
      await expect(
        publishFromMrrArchive({
          cwd: dir,
          asOfDate: "2026-10-26",
          historyPeriodCount: 3,
        }),
      ).rejects.toThrow(/multiple full-qualified/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("1B: zero full-qualified runs fail closed without --run-id", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-pub-1b-zero-"));
    try {
      await writeAcquisitionEvidence({
        cwd: dir,
        runId: "mrr-only-bounded",
        asOfDate: "2026-10-26",
        probeReportingPeriod: "2026-06",
        discoveredTldCount: 4,
        historyUniverseTlds: [],
        historyPeriodCount: 3,
        requests: [
          req({
            tldAsciiLabel: "alpha",
            reportingPeriod: "2026-06",
            phase: "PROBE",
            outcome: "SUCCESS",
          }),
          req({
            tldAsciiLabel: "beta",
            reportingPeriod: "2026-06",
            phase: "PROBE",
            outcome: "SUCCESS",
          }),
        ],
      });
      await expect(
        publishFromMrrArchive({
          cwd: dir,
          asOfDate: "2026-10-26",
          historyPeriodCount: 3,
        }),
      ).rejects.toThrow(/no full-qualified/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("1B: probeLimit-style and skipHistory-style runs do not auto-qualify", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-pub-1b-qual-"));
    try {
      await writeAcquisitionEvidence({
        cwd: dir,
        runId: "mrr-probe-limit",
        asOfDate: "2026-10-26",
        probeReportingPeriod: "2026-06",
        discoveredTldCount: 4,
        historyUniverseTlds: [],
        historyPeriodCount: 3,
        setCurrentIndex: false,
        requests: [
          req({
            tldAsciiLabel: "alpha",
            reportingPeriod: "2026-06",
            phase: "PROBE",
            outcome: "SUCCESS",
          }),
          req({
            tldAsciiLabel: "beta",
            reportingPeriod: "2026-06",
            phase: "PROBE",
            outcome: "SUCCESS",
          }),
        ],
      });
      await writeAcquisitionEvidence({
        cwd: dir,
        runId: "mrr-skip-history",
        asOfDate: "2026-10-26",
        probeReportingPeriod: "2026-06",
        historyUniverseTlds: ["alpha", "beta"],
        historyPeriodCount: 3,
        setCurrentIndex: true,
        requests: [
          req({
            tldAsciiLabel: "alpha",
            reportingPeriod: "2026-06",
            phase: "PROBE",
            outcome: "SUCCESS",
          }),
          req({
            tldAsciiLabel: "beta",
            reportingPeriod: "2026-06",
            phase: "PROBE",
            outcome: "SUCCESS",
          }),
        ],
      });
      await expect(
        publishFromMrrArchive({ cwd: dir, asOfDate: "2026-10-26" }),
      ).rejects.toThrow(/no full-qualified/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("1B: STOPPED_THROTTLED does not auto-qualify", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-pub-1b-throttle-"));
    try {
      await writeAcquisitionEvidence({
        cwd: dir,
        runId: "mrr-throttled",
        runScopeMode: "FULL_STAGE_D",
        asOfDate: "2026-10-26",
        probeReportingPeriod: "2026-06",
        historyUniverseTlds: ["alpha"],
        historyPeriodCount: 3,
        resultStatus: "STOPPED_THROTTLED",
        requests: fullStageDRequests({
          tlds: ["alpha"],
          probe: "2026-06",
          historyPeriodCount: 3,
        }),
      });
      await expect(
        publishFromMrrArchive({ cwd: dir, asOfDate: "2026-10-26" }),
      ).rejects.toThrow(/no full-qualified/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("1B: PARTIAL with complete coverage and MISSING_REPORT may qualify", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-pub-1b-partial-"));
    try {
      await seedNormalizedFromBytes({
        cwd: dir,
        tldAsciiLabel: "alpha",
        reportingPeriod: "2026-06",
        sourceUrl:
          "https://www.icann.org/sites/default/files/mrr/alpha/alpha-transactions-202606-en.csv",
        resourcePageUrl: "https://example.test/alpha",
        rawBytes: new TextEncoder().encode(syntheticCsv(10)),
        rawText: syntheticCsv(10),
        asOfDate: "2026-10-26",
      });
      await writeAcquisitionEvidence({
        cwd: dir,
        runId: "mrr-partial-ok",
        runScopeMode: "FULL_STAGE_D",
        asOfDate: "2026-10-26",
        probeReportingPeriod: "2026-06",
        historyUniverseTlds: ["alpha"],
        historyPeriodCount: 3,
        resultStatus: "PARTIAL",
        requests: fullStageDRequests({
          tlds: ["alpha"],
          probe: "2026-06",
          historyPeriodCount: 3,
          missingHistory: [{ tld: "alpha", period: "2026-05" }],
        }),
      });
      const built = await publishFromMrrArchive({
        cwd: dir,
        asOfDate: "2026-10-26",
        historyPeriodCount: 3,
      });
      expect(built.index.sourceAcquisitionRunId).toBe("mrr-partial-ok");
      const partialShard = await loadTldShard(built.contentSha256, "alpha", dir);
      expect(partialShard.periods["2026-05"]?.availability).toBe("MISSING");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("1B: tampered outcomes artifact fails closed before projection", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-pub-1b-tamper-"));
    try {
      await writeAcquisitionEvidence({
        cwd: dir,
        runId: "mrr-tamper",
        runScopeMode: "FULL_STAGE_D",
        asOfDate: "2026-10-26",
        probeReportingPeriod: "2026-06",
        historyUniverseTlds: ["alpha"],
        historyPeriodCount: 3,
        requests: fullStageDRequests({
          tlds: ["alpha"],
          probe: "2026-06",
          historyPeriodCount: 3,
        }),
        tamperOutcomes: (o) => {
          o.requests = o.requests.map((r) =>
            r.phase === "PROBE"
              ? { ...r, tldAsciiLabel: "evil" }
              : r,
          );
          return o;
        },
      });
      await expect(
        publishFromMrrArchive({ cwd: dir, asOfDate: "2026-10-26" }),
      ).rejects.toThrow(/outcomes artifact integrity mismatch/);
      await expect(
        publishFromMrrArchive({
          cwd: dir,
          asOfDate: "2026-10-26",
          runId: "mrr-tamper",
        }),
      ).rejects.toThrow(/outcomes artifact integrity mismatch/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("1B: same-run current-index SHA mismatch fails closed", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-pub-1b-cursha-"));
    try {
      await writeAcquisitionEvidence({
        cwd: dir,
        runId: "mrr-cur-mismatch",
        runScopeMode: "FULL_STAGE_D",
        asOfDate: "2026-10-26",
        probeReportingPeriod: "2026-06",
        historyUniverseTlds: ["alpha"],
        historyPeriodCount: 3,
        currentIndexShaOverride: "a".repeat(64),
        requests: fullStageDRequests({
          tlds: ["alpha"],
          probe: "2026-06",
          historyPeriodCount: 3,
        }),
      });
      await expect(
        publishFromMrrArchive({ cwd: dir, asOfDate: "2026-10-26" }),
      ).rejects.toThrow(/current-index outcomes SHA mismatches/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("1B: different current run does not compare its SHA against governing run", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-pub-1b-diffcur-"));
    try {
      const tlds = ["alpha", "beta"];
      await seedNormalizedFromBytes({
        cwd: dir,
        tldAsciiLabel: "alpha",
        reportingPeriod: "2026-06",
        sourceUrl:
          "https://www.icann.org/sites/default/files/mrr/alpha/alpha-transactions-202606-en.csv",
        resourcePageUrl: "https://example.test/alpha",
        rawBytes: new TextEncoder().encode(syntheticCsv(10)),
        rawText: syntheticCsv(10),
        asOfDate: "2026-10-26",
      });
      await seedNormalizedFromBytes({
        cwd: dir,
        tldAsciiLabel: "beta",
        reportingPeriod: "2026-06",
        sourceUrl:
          "https://www.icann.org/sites/default/files/mrr/beta/beta-transactions-202606-en.csv",
        resourcePageUrl: "https://example.test/beta",
        rawBytes: new TextEncoder().encode(syntheticCsv(10)),
        rawText: syntheticCsv(10),
        asOfDate: "2026-10-26",
      });
      await writeAcquisitionEvidence({
        cwd: dir,
        runId: "mrr-full-gov",
        runScopeMode: "FULL_STAGE_D",
        asOfDate: "2026-10-26",
        probeReportingPeriod: "2026-06",
        historyUniverseTlds: tlds,
        historyPeriodCount: 3,
        setCurrentIndex: false,
        requests: fullStageDRequests({
          tlds,
          probe: "2026-06",
          historyPeriodCount: 3,
        }),
      });
      // Bounded current with deliberately wrong SHA — must not affect governing A.
      await writeAcquisitionEvidence({
        cwd: dir,
        runId: "mrr-bounded-cur",
        asOfDate: "2026-10-26",
        probeReportingPeriod: "2026-06",
        discoveredTldCount: 4,
        historyUniverseTlds: [],
        historyPeriodCount: 3,
        setCurrentIndex: true,
        currentIndexShaOverride: "b".repeat(64),
        requests: [
          req({
            tldAsciiLabel: "alpha",
            reportingPeriod: "2026-06",
            phase: "PROBE",
            outcome: "SUCCESS",
          }),
        ],
      });
      const built = await publishFromMrrArchive({
        cwd: dir,
        asOfDate: "2026-10-26",
        historyPeriodCount: 3,
      });
      expect(built.index.sourceAcquisitionRunId).toBe("mrr-full-gov");
      expect(built.index.operationalCurrentDiffersFromGoverning).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("1B: acquisition audit metadata is outside semantic content hash", () => {
    const snaps = new Map([
      [snapshotKey("demo", "2026-06"), normalizePeriod("demo", "2026-06", 10)],
    ]);
    const a = buildMarketBaselinePublication({
      asOfDate: "2026-10-26",
      snapshots: snaps,
      universeTlds: ["demo"],
      acquisitionAudit: {
        sourceAcquisitionRunId: "run-a",
        sourceOutcomesArtifactSha256: "a".repeat(64),
        sourceAcquisitionRunScope: "FULL_STAGE_D",
      },
    });
    const b = buildMarketBaselinePublication({
      asOfDate: "2026-10-26",
      snapshots: snaps,
      universeTlds: ["demo"],
      acquisitionAudit: {
        sourceAcquisitionRunId: "run-b",
        sourceOutcomesArtifactSha256: "b".repeat(64),
        sourceAcquisitionRunScope: "BOUNDED",
      },
    });
    expect(a.index.publicationContentSha256).toBe(b.index.publicationContentSha256);
    expect(a.index.sourceAcquisitionRunId).toBe("run-a");
    expect(b.index.sourceAcquisitionRunId).toBe("run-b");
    expect(a.index.sourceAcquisitionRunScope).toBe("FULL_STAGE_D");
    expect(b.index.sourceAcquisitionRunScope).toBe("BOUNDED");
  });

  it("1C: self-consistent 3-TLD BOUNDED run does not auto-qualify", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-pub-1c-3tld-"));
    try {
      const tlds = ["alpha", "beta", "gamma"];
      await writeAcquisitionEvidence({
        cwd: dir,
        runId: "mrr-bounded-3-complete",
        runScopeMode: "BOUNDED",
        asOfDate: "2026-10-26",
        probeReportingPeriod: "2026-06",
        historyUniverseTlds: tlds,
        historyPeriodCount: STAGE_D_HISTORY_PERIOD_COUNT,
        requests: fullStageDRequests({
          tlds,
          probe: "2026-06",
          historyPeriodCount: STAGE_D_HISTORY_PERIOD_COUNT,
        }),
      });
      await expect(
        publishFromMrrArchive({ cwd: dir, asOfDate: "2026-10-26" }),
      ).rejects.toThrow(/no full-qualified/);
      const explicit = await publishFromMrrArchive({
        cwd: dir,
        asOfDate: "2026-10-26",
        runId: "mrr-bounded-3-complete",
        historyPeriodCount: 3,
      });
      expect(explicit.index.sourceAcquisitionRunScope).toBe("BOUNDED");
      expect(explicit.index.sourceAcquisitionRunId).toBe("mrr-bounded-3-complete");
      expect(explicit.index.semantic.coverage.tldCountInPublication).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("1C: legacy 1.0.0 manifest without runScope does not auto-qualify", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-pub-1c-legacy-"));
    try {
      const tlds = ["alpha", "beta"];
      await writeAcquisitionEvidence({
        cwd: dir,
        runId: "mrr-legacy-1319-style",
        legacyManifest: true,
        asOfDate: "2026-10-26",
        probeReportingPeriod: "2026-06",
        historyUniverseTlds: tlds,
        historyPeriodCount: 3,
        requests: fullStageDRequests({
          tlds,
          probe: "2026-06",
          historyPeriodCount: 3,
        }),
      });
      await expect(
        publishFromMrrArchive({ cwd: dir, asOfDate: "2026-10-26" }),
      ).rejects.toThrow(/no full-qualified/);
      const explicit = await publishFromMrrArchive({
        cwd: dir,
        asOfDate: "2026-10-26",
        runId: "mrr-legacy-1319-style",
        historyPeriodCount: 3,
      });
      expect(explicit.index.sourceAcquisitionRunScope).toBe("LEGACY_UNKNOWN");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("1D: order independence — processing order does not change digests", () => {
    const snaps = new Map([
      [snapshotKey("zeta", "2026-06"), normalizePeriod("zeta", "2026-06", 30)],
      [snapshotKey("alpha", "2026-06"), normalizePeriod("alpha", "2026-06", 10)],
      [snapshotKey("mu", "2026-06"), normalizePeriod("mu", "2026-06", 20)],
    ]);
    const forward = buildMarketBaselinePublication({
      asOfDate: "2026-10-27",
      snapshots: snaps,
      universeTlds: ["alpha", "mu", "zeta"],
      generatedAt: "2026-10-27T00:00:00.000Z",
    });
    const reverse = buildMarketBaselinePublication({
      asOfDate: "2026-10-27",
      snapshots: snaps,
      universeTlds: ["zeta", "mu", "alpha"],
      generatedAt: "2026-10-27T00:00:00.000Z",
    });
    expect(forward.index.publicationContentSha256).toBe(
      reverse.index.publicationContentSha256,
    );
    const fwdDigests = Object.fromEntries(
      forward.shards.map((s) => [s.tldAsciiLabel, s.shardContentSha256]),
    );
    const revDigests = Object.fromEntries(
      reverse.shards.map((s) => [s.tldAsciiLabel, s.shardContentSha256]),
    );
    expect(fwdDigests).toEqual(revDigests);
    expect(forward.index.semantic.tldShards.map((e) => e.tldAsciiLabel)).toEqual([
      "alpha",
      "mu",
      "zeta",
    ]);
  });

  it("1D: single shard fact change alters that digest and publication hash only", () => {
    const baseSnaps = new Map([
      [snapshotKey("alpha", "2026-06"), normalizePeriod("alpha", "2026-06", 100)],
      [snapshotKey("beta", "2026-06"), normalizePeriod("beta", "2026-06", 50)],
    ]);
    const changed = new Map([
      [snapshotKey("alpha", "2026-06"), normalizePeriod("alpha", "2026-06", 101)],
      [snapshotKey("beta", "2026-06"), normalizePeriod("beta", "2026-06", 50)],
    ]);
    const a = buildMarketBaselinePublication({
      asOfDate: "2026-10-27",
      snapshots: baseSnaps,
      universeTlds: ["alpha", "beta"],
    });
    const b = buildMarketBaselinePublication({
      asOfDate: "2026-10-27",
      snapshots: changed,
      universeTlds: ["alpha", "beta"],
    });
    const aAlpha = a.shards.find((s) => s.tldAsciiLabel === "alpha")!;
    const bAlpha = b.shards.find((s) => s.tldAsciiLabel === "alpha")!;
    const aBeta = a.shards.find((s) => s.tldAsciiLabel === "beta")!;
    const bBeta = b.shards.find((s) => s.tldAsciiLabel === "beta")!;
    expect(aAlpha.shardContentSha256).not.toBe(bAlpha.shardContentSha256);
    expect(aBeta.shardContentSha256).toBe(bBeta.shardContentSha256);
    expect(a.index.publicationContentSha256).not.toBe(b.index.publicationContentSha256);
  });

  it("1D: audit metadata excluded; sourceReportingPeriod included", () => {
    const snaps = new Map([
      [snapshotKey("demo", "2026-06"), normalizePeriod("demo", "2026-06", 10)],
      [snapshotKey("demo", "2026-07"), normalizePeriod("demo", "2026-07", 11)],
    ]);
    const a = buildMarketBaselinePublication({
      asOfDate: "2026-10-26",
      snapshots: snaps,
      universeTlds: ["demo"],
      generatedAt: "2026-10-26T00:00:00.000Z",
      acquisitionAudit: {
        sourceAcquisitionRunId: "run-a",
        sourceOutcomesArtifactSha256: "a".repeat(64),
        sourceAcquisitionRunScope: "FULL_STAGE_D",
      },
    });
    const b = buildMarketBaselinePublication({
      asOfDate: "2026-10-27",
      snapshots: snaps,
      universeTlds: ["demo"],
      generatedAt: "2099-01-01T00:00:00.000Z",
      acquisitionAudit: {
        sourceAcquisitionRunId: "run-b",
        sourceOutcomesArtifactSha256: "b".repeat(64),
        sourceAcquisitionRunScope: "BOUNDED",
      },
    });
    expect(a.index.semantic.sourceReportingPeriod).toBe("2026-06");
    expect(b.index.semantic.sourceReportingPeriod).toBe("2026-06");
    expect(a.index.publicationContentSha256).toBe(b.index.publicationContentSha256);

    const july = buildMarketBaselinePublication({
      asOfDate: "2026-11-26",
      snapshots: snaps,
      universeTlds: ["demo"],
    });
    expect(july.index.semantic.sourceReportingPeriod).toBe("2026-07");
    expect(july.index.publicationContentSha256).not.toBe(a.index.publicationContentSha256);
  });

  it("1D: coverage change (add/remove TLD or MISSING) changes publication hash", () => {
    const snaps = new Map([
      [snapshotKey("alpha", "2026-06"), normalizePeriod("alpha", "2026-06", 10)],
      [snapshotKey("beta", "2026-06"), normalizePeriod("beta", "2026-06", 20)],
    ]);
    const two = buildMarketBaselinePublication({
      asOfDate: "2026-10-27",
      snapshots: snaps,
      universeTlds: ["alpha", "beta"],
    });
    const one = buildMarketBaselinePublication({
      asOfDate: "2026-10-27",
      snapshots: snaps,
      universeTlds: ["alpha"],
    });
    const withMissing = buildMarketBaselinePublication({
      asOfDate: "2026-10-27",
      snapshots: snaps,
      universeTlds: ["alpha", "beta", "gamma"],
    });
    expect(two.index.publicationContentSha256).not.toBe(one.index.publicationContentSha256);
    expect(two.index.publicationContentSha256).not.toBe(
      withMissing.index.publicationContentSha256,
    );
    expect(
      withMissing.index.semantic.currentPeriod.find((f) => f.tldAsciiLabel === "gamma")
        ?.availability,
    ).toBe("MISSING");
  });

  it("1D: shard integrity — valid PASS; tampered fact/digest/pub linkage FAIL", () => {
    const built = buildMarketBaselinePublication({
      asOfDate: "2026-10-27",
      snapshots: new Map([
        [snapshotKey("demo", "2026-06"), normalizePeriod("demo", "2026-06", 42)],
      ]),
      universeTlds: ["demo"],
    });
    const shard = structuredClone(built.shards[0]!);
    const entry = built.index.semantic.tldShards[0]!;
    expect(
      verifyTldShard({
        shard,
        publicationContentSha256: built.index.publicationContentSha256,
        indexDigestEntry: entry,
      }).ok,
    ).toBe(true);
    assertShardVerified({
      shard,
      publicationContentSha256: built.index.publicationContentSha256,
      indexDigestEntry: entry,
    });
    assertPublicationIndexVerified(built.index);

    const tamperedFact = structuredClone(shard);
    const fact = tamperedFact.periods["2026-06"];
    if (fact?.availability === "AVAILABLE") {
      fact.totalDomains = 999;
    }
    expect(
      verifyTldShard({
        shard: tamperedFact,
        publicationContentSha256: built.index.publicationContentSha256,
        indexDigestEntry: entry,
      }).ok,
    ).toBe(false);

    const badIndexEntry = {
      ...entry,
      shardContentSha256: "0".repeat(64),
    };
    expect(
      verifyTldShard({
        shard,
        publicationContentSha256: built.index.publicationContentSha256,
        indexDigestEntry: badIndexEntry,
      }).ok,
    ).toBe(false);

    expect(
      verifyTldShard({
        shard,
        publicationContentSha256: "f".repeat(64),
        indexDigestEntry: entry,
      }).ok,
    ).toBe(false);
  });

  it("1D: pointer does not advance when finalization fails before commit", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-pub-1d-ptr-"));
    try {
      const snaps = new Map([
        [snapshotKey("alpha", "2026-06"), normalizePeriod("alpha", "2026-06", 10)],
      ]);
      const first = buildMarketBaselinePublication({
        asOfDate: "2026-10-27",
        snapshots: snaps,
        universeTlds: ["alpha"],
        generatedAt: "2026-10-27T00:00:00.000Z",
      });
      const written = await writePublicationArtifacts(first, dir);
      const before = await loadCurrentPublicationPointer(dir);
      expect(before?.publicationContentSha256).toBe(written.contentSha256);

      const secondSnaps = new Map([
        [snapshotKey("alpha", "2026-06"), normalizePeriod("alpha", "2026-06", 11)],
      ]);
      const second = buildMarketBaselinePublication({
        asOfDate: "2026-10-27",
        snapshots: secondSnaps,
        universeTlds: ["alpha"],
        generatedAt: "2026-10-27T01:00:00.000Z",
      });
      await expect(
        writePublicationArtifacts(second, dir, { failBeforePointerCommit: true }),
      ).rejects.toThrow(/simulated finalization failure/);
      const after = await loadCurrentPublicationPointer(dir);
      expect(after?.publicationContentSha256).toBe(written.contentSha256);
      expect(after?.publicationContentSha256).not.toBe(second.index.publicationContentSha256);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("1D: compositional identity never stringifies all shard bodies together", () => {
    const digestEntries = [];
    const currentPeriod = [];
    const historyCounts: Record<string, number> = {};
    // Synthetic scale: many TLDs with fat registrar rows hashed independently.
    for (let i = 0; i < 80; i++) {
      const tld = `t${String(i).padStart(3, "0")}`;
      const registrars = Array.from({ length: 40 }, (_, r) => ({
        tldAsciiLabel: tld,
        reportingPeriod: "2026-06" as const,
        ianaRegistrarId: String(1000 + r),
        registrarName: `Registrar ${r}`,
        classification: "ACCREDITED_OR_STANDARD" as const,
        totalDomains: 1000 - r,
        shareOfTldTotal: { available: true as const, value: (1000 - r) / 20000 },
        provenance: {
          sourceSystem: "icann-mrr-transactions" as const,
          sourceUrl: `https://example.test/${tld}`,
          rawSha256: "a".repeat(64),
          normalizedContentSha256: "b".repeat(64),
          normalizedSchemaVersion: "market-baseline-mrr-transactions/1.0.0" as const,
          parserVersion: "market-baseline-mrr-transactions-parser/1.0.0" as const,
          schemaProfileVersion: "spec3-core-39" as const,
        },
      }));
      const periods = {
        "2026-06": {
          availability: "AVAILABLE" as const,
          tldAsciiLabel: tld,
          reportingPeriod: "2026-06" as const,
          totalDomains: 20000,
          netAddsCount: 1,
          netRenewCount: 1,
          deleteCount: 0,
          transferGainingCount: 0,
          transferLosingCount: 0,
          registrarBreadth: 40,
          topRegistrarShare: { available: true as const, value: 0.05 },
          top5RegistrarShare: { available: true as const, value: 0.2 },
          accreditedRegistrarDomains: 20000,
          specialOrSystemDomains: 0,
          netDomainBaseChange: { available: false as const, reason: "prior_period_unavailable" },
          monthOverMonthGrowth: { available: false as const, reason: "prior_period_unavailable" },
          yearOverYearGrowth: { available: false as const, reason: "prior_period_unavailable" },
          provenance: registrars[0]!.provenance,
        },
      };
      const semantic = shardSemanticFromParts({
        tldAsciiLabel: tld,
        periods,
        registrarsByPeriod: { "2026-06": registrars },
      });
      const shardContentSha256 = hashShardContent(semantic);
      digestEntries.push({
        tldAsciiLabel: tld,
        path: `tlds/${tld}.json`,
        shardContentSha256,
      });
      currentPeriod.push(periods["2026-06"]);
      historyCounts[tld] = 1;
    }

    const { semantic, publicationContentSha256 } = composePublicationIdentity({
      sourceReportingPeriod: "2026-06",
      currentPeriod,
      tldHistoryPeriodCounts: historyCounts,
      digestEntries,
    });

    // Identity input commits only to compact digests — no nested registrar bodies.
    expect(semantic.tldShards).toHaveLength(80);
    for (const entry of semantic.tldShards) {
      expect(entry.shardContentSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(entry).not.toHaveProperty("periods");
      expect(entry).not.toHaveProperty("registrarsByPeriod");
    }
    const identityJson = JSON.stringify(semantic);
    expect(identityJson).not.toContain("Registrar 0");
    expect(identityJson).not.toContain("shareOfTldTotal");
    expect(publicationContentSha256).toBe(hashPublicationContent(semantic));
    expect(verifyPublicationIndexContentSha({
      semantic,
      publicationContentSha256,
      generatedAt: "x",
      asOfDate: "2026-10-27",
    }).ok).toBe(true);
    expect(MARKET_BASELINE_PUBLICATION_SCHEMA_VERSION).toBe(
      "market-baseline-publication/1.1.0",
    );
  });

  it("1D: projectTldPublicationGrain matches in-memory builder digests", () => {
    const snaps = new Map([
      [snapshotKey("demo", "2026-06"), normalizePeriod("demo", "2026-06", 55)],
      [snapshotKey("demo", "2026-05"), normalizePeriod("demo", "2026-05", 50)],
    ]);
    const built = buildMarketBaselinePublication({
      asOfDate: "2026-10-27",
      snapshots: snaps,
      universeTlds: ["demo"],
      historyPeriodsByTld: new Map([["demo", ["2026-06", "2026-05"]]]),
    });
    const grain = projectTldPublicationGrain({
      tldAsciiLabel: "demo",
      sourceReportingPeriod: "2026-06",
      snapshots: snaps,
      historyPeriods: ["2026-06", "2026-05"],
    });
    expect(grain.shardContentSha256).toBe(built.shards[0]!.shardContentSha256);
    expect(built.shards[0]!.schemaVersion).toBe("market-baseline-publication/1.1.0");
    expect(built.index.semantic.schemaVersion).toBe("market-baseline-publication/1.1.0");
  });
});
