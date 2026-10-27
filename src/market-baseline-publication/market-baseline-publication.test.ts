import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CORE_TRANSACTION_HEADERS } from "@/market-baseline-mrr/schema-profiles";
import { normalizeTransactions } from "@/market-baseline-mrr/normalize";
import { seedNormalizedFromBytes } from "@/market-baseline-mrr/acquire";
import type { NormalizedTransactionsSnapshot } from "@/market-baseline-mrr/types";
import {
  buildMarketBaselinePublication,
  snapshotKey,
} from "./build";
import { loadCurrentPublicationPointer, loadPublicationIndex, loadTldShard } from "./load";
import { writePublicationArtifacts } from "./write";
import { publishFromMrrArchive } from "./from-archive";

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

      // Lexically reorder pointers would not matter — current must be C (last seed).
      const current = JSON.parse(
        readFileSync(
          join(dir, `.data/market-baseline/mrr/indexes/periods/${tld}/${period}.json`),
          "utf8",
        ),
      );
      expect(current.currentRawSha256).toBe(hashes[2]);
      expect(current.previousRawSha256).toBe(hashes[1]);

      // Poison: write a fake pointer file name order distraction by adding empty
      // normalized sibling with lexicographically greater hash name — publish must
      // still follow period-current.
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
      const index = await loadPublicationIndex(written.contentSha256, dir);
      expect(index.semantic.coverage.tldCountInPublication).toBe(2);
      const shard = await loadTldShard(written.contentSha256, "alpha", dir);
      expect(shard.tldAsciiLabel).toBe("alpha");
      expect(shard.periods["2026-06"]?.availability).toBe("AVAILABLE");
      // Provenance present
      const fact = shard.periods["2026-06"]!;
      if (fact.availability === "AVAILABLE") {
        expect(fact.provenance.sourceSystem).toBe("icann-mrr-transactions");
        expect(fact.provenance.normalizedContentSha256).toMatch(/^[a-f0-9]{64}$/);
      }
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
});
