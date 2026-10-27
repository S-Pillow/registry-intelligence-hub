import { accessSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CORE_TRANSACTION_HEADERS } from "@/market-baseline-mrr/schema-profiles";
import { normalizeTransactions } from "@/market-baseline-mrr/normalize";
import { buildMarketBaselinePublication, snapshotKey } from "@/market-baseline-publication/build";
import { writePublicationArtifacts } from "@/market-baseline-publication/write";
import {
  loadRegistryMarketOverview,
  loadRegistryMarketTldDetail,
} from "@/lib/market-baseline-ui-server";
import type { NormalizedTransactionsSnapshot } from "@/market-baseline-mrr/types";

const dirs: string[] = [];

afterEach(() => {
  while (dirs.length) {
    const d = dirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

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

async function seedPublication(dir: string) {
  const snaps = new Map([
    [snapshotKey("com", "2026-06"), normalizePeriod("com", "2026-06", 1000)],
    [snapshotKey("com", "2026-05"), normalizePeriod("com", "2026-05", 900)],
    [snapshotKey("com", "2025-06"), normalizePeriod("com", "2025-06", 800)],
    [snapshotKey("xyz", "2026-06"), normalizePeriod("xyz", "2026-06", 500)],
    [snapshotKey("xyz", "2026-05"), normalizePeriod("xyz", "2026-05", 480)],
  ]);
  const built = buildMarketBaselinePublication({
    asOfDate: "2026-10-27",
    snapshots: snaps,
    universeTlds: ["com", "xyz", "missingtld"],
    historyPeriodsByTld: new Map([
      ["com", ["2026-06", "2026-05", "2025-06"]],
      ["xyz", ["2026-06", "2026-05"]],
      ["missingtld", ["2026-06"]],
    ]),
    generatedAt: "2026-10-27T00:00:00.000Z",
  });
  await writePublicationArtifacts(built, dir);
  return built;
}

describe("market-baseline UI server adapter", () => {
  it("loads overview from a valid pointer/index", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mkt-ui-ov-"));
    dirs.push(dir);
    await seedPublication(dir);
    const overview = await loadRegistryMarketOverview(dir);
    expect(overview.status).toBe("READY");
    expect(overview.coverage?.tldCountInPublication).toBe(3);
    expect(overview.coverage?.availableAtSourcePeriod).toBe(2);
    expect(overview.coverage?.missingAtSourcePeriod).toBe(1);
    expect(overview.sourceReportingPeriod).toBe("2026-06");
    expect(overview.sourcePeriodLabel).toBe("June 2026");
    expect(overview.domainBaseRanking[0]?.tldAsciiLabel).toBe("com");
    expect(overview.currentPeriodRows.some((r) => r.availability === "MISSING")).toBe(true);
  });

  it("returns PUBLICATION_ABSENT when pointer is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mkt-ui-abs-"));
    dirs.push(dir);
    const overview = await loadRegistryMarketOverview(dir);
    expect(overview.status).toBe("PUBLICATION_ABSENT");
    expect(overview.coverage).toBeNull();
  });

  it("fails closed on bad publication index SHA", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mkt-ui-badidx-"));
    dirs.push(dir);
    const built = await seedPublication(dir);
    const sha = built.index.publicationContentSha256;
    const indexPath = join(dir, ".data/market-baseline/publication", sha, "index.json");
    const index = JSON.parse(readFileSync(indexPath, "utf8"));
    index.semantic.coverage.availableAtSourcePeriod = 999;
    writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
    const overview = await loadRegistryMarketOverview(dir);
    expect(overview.status).toBe("PUBLICATION_INVALID");
  });

  it("loads valid TLD shard detail", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mkt-ui-det-"));
    dirs.push(dir);
    await seedPublication(dir);
    const detail = await loadRegistryMarketTldDetail("com", dir);
    expect(detail.status).toBe("READY");
    expect(detail.metrics?.totalDomains).toBe(1000);
    expect(detail.historyRows.length).toBe(3);
    expect(detail.topAccreditedRegistrars.length).toBeGreaterThan(0);
    expect(detail.provenance?.sourceSystem).toBe("icann-mrr-transactions");
  });

  it("fails closed on tampered shard", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mkt-ui-tamp-"));
    dirs.push(dir);
    const built = await seedPublication(dir);
    const sha = built.index.publicationContentSha256;
    const shardPath = join(dir, ".data/market-baseline/publication", sha, "tlds", "com.json");
    const shard = JSON.parse(readFileSync(shardPath, "utf8"));
    shard.periods["2026-06"].totalDomains = 1;
    writeFileSync(shardPath, `${JSON.stringify(shard, null, 2)}\n`);
    const detail = await loadRegistryMarketTldDetail("com", dir);
    expect(detail.status).toBe("TLD_SHARD_INVALID");
    expect(detail.metrics).toBeNull();
  });

  it("returns TLD_NOT_FOUND for nonexistent TLD", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mkt-ui-nf-"));
    dirs.push(dir);
    await seedPublication(dir);
    const detail = await loadRegistryMarketTldDetail("not-in-universe", dir);
    expect(detail.status).toBe("TLD_NOT_FOUND");
  });

  it("keeps MISSING current fact as MISSING, not zero", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mkt-ui-miss-"));
    dirs.push(dir);
    await seedPublication(dir);
    const detail = await loadRegistryMarketTldDetail("missingtld", dir);
    expect(detail.status).toBe("MISSING_CURRENT_REPORT");
    expect(detail.metrics).toBeNull();
    expect(detail.dataStateLabel).toBe("Report unavailable");
    expect(detail.userMessage).toMatch(/does not mean the TLD has zero domains/i);
  });

  it("does not fabricate history for probe-only TLD", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mkt-ui-probe-"));
    dirs.push(dir);
    await seedPublication(dir);
    const detail = await loadRegistryMarketTldDetail("missingtld", dir);
    expect(detail.historyRows).toHaveLength(1);
    expect(detail.historyRows[0]?.reportingPeriod).toBe("2026-06");
    expect(detail.historyNote).toMatch(/Historical series was not acquired/i);
  });

  it("preserves source-period and audit-facing publication SHA", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mkt-ui-period-"));
    dirs.push(dir);
    const built = await seedPublication(dir);
    const overview = await loadRegistryMarketOverview(dir);
    expect(overview.sourceReportingPeriod).toBe("2026-06");
    expect(overview.publicationContentSha256).toBe(built.index.publicationContentSha256);
  });

  it("does not require raw/normalized MRR archive paths", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mkt-ui-noraw-"));
    dirs.push(dir);
    await seedPublication(dir);
    // Ensure no MRR archive tree exists under cwd.
    expect(() => accessSync(join(dir, ".data/market-baseline/mrr"))).toThrow();
    const overview = await loadRegistryMarketOverview(dir);
    expect(overview.status).toBe("READY");
    const detail = await loadRegistryMarketTldDetail("xyz", dir);
    expect(detail.status).toBe("READY");
  });
});
