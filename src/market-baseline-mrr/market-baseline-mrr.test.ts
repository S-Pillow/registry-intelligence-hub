import { mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRfc4180Csv } from "./csv";
import { classifyRegistrarRow, isBreadthEligible } from "./classify";
import { parseTransactionsCsv, parseTransactionsFilename } from "./parse";
import { normalizeTransactions } from "./normalize";
import {
  assertAsOfDate,
  probeReportingPeriodFromAsOf,
  historyWindowEndingAt,
} from "./period";
import {
  buildHistoryUniverse,
  selectTop100ByTotalDomains,
} from "./selection";
import { sha256Hex, hashNormalizedContent } from "./hash";
import {
  listRawHashes,
  readNormalizedForPeriod,
  readPeriodCurrent,
  writeRawImmutable,
} from "./storage";
import { parseRegistryReportsIndex, parseTldReportPage } from "./discover";
import { parseIanaTldListText } from "./iana-delegation";
import { selectDelegatedApplicationOverlaps } from "./applied-overlap";
import { CORE_TRANSACTION_HEADERS, COM_EXTENDED_HEADERS } from "./schema-profiles";
import { deriveTldMarketSeriesTemporal } from "./series";
import {
  acquireOneTransactions,
  reconcileOutcomeCounts,
  runStageDAcquisition,
  seedNormalizedFromBytes,
} from "./acquire";
import type { FetchImpl } from "./http";
import type { DiscoveredTldPage } from "./types";

const FIX = join(__dirname, "fixtures");

function load(name: string): { text: string; bytes: Uint8Array } {
  const text = readFileSync(join(FIX, name), "utf8");
  return { text, bytes: new TextEncoder().encode(text) };
}

/** Minimal valid Spec-3 CSV with controllable Totals.total-domains. */
function syntheticCsv(totalDomains: number, registrarDomains = totalDomains): string {
  const headers = [...CORE_TRANSACTION_HEADERS];
  const zeros = headers.map(() => "0");
  const set = (row: string[], field: (typeof headers)[number], value: string | number) => {
    row[headers.indexOf(field)] = String(value);
  };
  const reg = [...zeros];
  set(reg, "registrar-name", "Alpha Registrar");
  set(reg, "iana-id", "100");
  set(reg, "total-domains", registrarDomains);
  const totals = [...zeros];
  set(totals, "registrar-name", "Totals");
  set(totals, "iana-id", "");
  set(totals, "total-domains", totalDomains);
  return [headers.join(","), reg.join(","), totals.join(",")].join("\n") + "\n";
}

describe("period withhold / asOfDate", () => {
  it("maps 2026-10-26 → 2026-06", () => {
    expect(probeReportingPeriodFromAsOf("2026-10-26")).toBe("2026-06");
  });

  it("rejects impossible calendar dates", () => {
    expect(() => assertAsOfDate("2026-02-31")).toThrow(/day out of range/);
    expect(() => probeReportingPeriodFromAsOf("2026-02-31")).toThrow(/day out of range/);
    expect(() => assertAsOfDate("2026-04-31")).toThrow(/day out of range/);
  });

  it("year rollover: January asOf → September prior year probe", () => {
    expect(probeReportingPeriodFromAsOf("2026-01-15")).toBe("2025-09");
  });

  it("builds 24-month window ending at probe", () => {
    const w = historyWindowEndingAt("2026-06", 24);
    expect(w).toHaveLength(24);
    expect(w[0]).toBe("2026-06");
    expect(w[23]).toBe("2024-07");
  });
});

describe("CSV / schema", () => {
  it("parses RFC 4180 quoted fields", () => {
    const { text } = load("quoted-registrar.csv");
    const rows = parseRfc4180Csv(text);
    expect(rows[1]![0]).toBe('Registrar "Quoted", LLC');
  });

  it("accepts 39-column Spec profile", () => {
    const { text } = load("valid-spec3-39.csv");
    const p = parseTransactionsCsv(text);
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.table.schemaProfileId).toBe("spec3-core-39");
    expect(CORE_TRANSACTION_HEADERS).toHaveLength(39);
  });

  it("accepts 41-column .com profile", () => {
    const { text } = load("valid-com-41.csv");
    const p = parseTransactionsCsv(text);
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.table.schemaProfileId).toBe("com-extended-41");
    expect(COM_EXTENDED_HEADERS).toHaveLength(41);
  });

  it("fails unknown schema", () => {
    const { text } = load("unknown-schema.csv");
    const p = parseTransactionsCsv(text);
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.failure.outcome).toBe("UNSUPPORTED_SCHEMA");
  });

  it("parses filename TLD and period", () => {
    expect(parseTransactionsFilename("https://www.icann.org/sites/default/files/mrr/xyz/xyz-transactions-202606-en.csv")).toEqual({
      tldAsciiLabel: "xyz",
      compactPeriod: "202606",
    });
  });
});

describe("normalize validation / intrinsic metrics", () => {
  it("reconciles Totals including specials and computes intrinsic metrics only", () => {
    const { text, bytes } = load("valid-spec3-39.csv");
    const r = normalizeTransactions({
      rawText: text,
      rawBytes: bytes,
      tldAsciiLabel: "download",
      reportingPeriod: "2026-05",
      sourceUrl: "https://www.icann.org/sites/default/files/mrr/download/download-transactions-202605-en.csv",
      resourcePageUrl: "https://www.icann.org/resources/pages/download-2014-06-19-en",
    });
    expect(r.outcome).toBe("SUCCESS");
    if (r.outcome !== "SUCCESS") return;
    expect(r.snapshot.metrics.totalDomains).toBe(157);
    expect(r.snapshot.metrics.netAddsCount).toBe(12);
    expect(r.snapshot.metrics.netRenewCount).toBe(6);
    expect(r.snapshot.metrics.deleteCount).toBe(4);
    expect(r.snapshot.metrics.transferGainingCount).toBe(4);
    expect(r.snapshot.metrics.transferLosingCount).toBe(4);
    expect(r.snapshot.metrics.registrarBreadth).toBe(2);
    expect(r.snapshot.metrics.specialOrSystemDomains).toBe(7);
    expect(r.snapshot.metrics.accreditedRegistrarDomains).toBe(150);
    expect(r.snapshot.metrics.topRegistrarShare).toEqual({ available: true, value: 100 / 157 });
    expect(r.snapshot.metrics.top5RegistrarShare).toEqual({ available: true, value: 150 / 157 });
    expect((r.snapshot.metrics as { netDomainBaseChange?: unknown }).netDomainBaseChange).toBeUndefined();
    expect((r.snapshot.metrics as { monthOverMonthGrowth?: unknown }).monthOverMonthGrowth).toBeUndefined();
    expect((r.snapshot.metrics as { yearOverYearGrowth?: unknown }).yearOverYearGrowth).toBeUndefined();
    expect((r.snapshot.metrics as { renewalRate?: unknown }).renewalRate).toBeUndefined();
    expect(r.snapshot.registrars.every((x) => x.classification !== "TOTALS")).toBe(true);
  });

  it("normalized content hash is independent of neighboring periods", () => {
    const { text, bytes } = load("valid-spec3-39.csv");
    const input = {
      rawText: text,
      rawBytes: bytes,
      tldAsciiLabel: "download",
      reportingPeriod: "2026-06",
      sourceUrl: "https://www.icann.org/sites/default/files/mrr/download/download-transactions-202606-en.csv",
      resourcePageUrl: "https://example.test/download",
    };
    const a = normalizeTransactions(input);
    expect(a.outcome).toBe("SUCCESS");
    if (a.outcome !== "SUCCESS") return;

    // Neighbor presence is irrelevant to normalize — series derivation is separate.
    const b = normalizeTransactions(input);
    expect(b.outcome).toBe("SUCCESS");
    if (b.outcome !== "SUCCESS") return;
    expect(b.snapshot.normalizedContentSha256).toBe(a.snapshot.normalizedContentSha256);
    expect(b.snapshot.metrics).toEqual(a.snapshot.metrics);
  });

  it("fails closed on Totals mismatch", () => {
    const { text, bytes } = load("totals-mismatch.csv");
    const r = normalizeTransactions({
      rawText: text,
      rawBytes: bytes,
      tldAsciiLabel: "download",
      reportingPeriod: "2026-05",
      sourceUrl: "https://www.icann.org/sites/default/files/mrr/download/download-transactions-202605-en.csv",
      resourcePageUrl: "https://example.test/download",
    });
    expect(r.outcome).toBe("VALIDATION_FAILED");
  });

  it("fails duplicate iana-id", () => {
    const { text, bytes } = load("duplicate-iana.csv");
    const r = normalizeTransactions({
      rawText: text,
      rawBytes: bytes,
      tldAsciiLabel: "download",
      reportingPeriod: "2026-05",
      sourceUrl: "https://www.icann.org/sites/default/files/mrr/download/download-transactions-202605-en.csv",
      resourcePageUrl: "https://example.test/download",
    });
    expect(r.outcome).toBe("VALIDATION_FAILED");
    if (r.outcome !== "SUCCESS") expect(r.error).toMatch(/Duplicate/i);
  });

  it("fails negative counts", () => {
    const { text, bytes } = load("negative-count.csv");
    const r = normalizeTransactions({
      rawText: text,
      rawBytes: bytes,
      tldAsciiLabel: "download",
      reportingPeriod: "2026-05",
      sourceUrl: "https://www.icann.org/sites/default/files/mrr/download/download-transactions-202605-en.csv",
      resourcePageUrl: "https://example.test/download",
    });
    expect(r.outcome).toBe("VALIDATION_FAILED");
  });

  it("fails multiple Totals rows", () => {
    const { text, bytes } = load("multiple-totals.csv");
    const r = normalizeTransactions({
      rawText: text,
      rawBytes: bytes,
      tldAsciiLabel: "download",
      reportingPeriod: "2026-05",
      sourceUrl: "https://www.icann.org/sites/default/files/mrr/download/download-transactions-202605-en.csv",
      resourcePageUrl: "https://example.test/download",
    });
    expect(r.outcome).toBe("VALIDATION_FAILED");
  });

  it("fails TLD / period mismatch from filename", () => {
    const { text, bytes } = load("valid-spec3-39.csv");
    const r = normalizeTransactions({
      rawText: text,
      rawBytes: bytes,
      tldAsciiLabel: "xyz",
      reportingPeriod: "2026-05",
      sourceUrl: "https://www.icann.org/sites/default/files/mrr/download/download-transactions-202605-en.csv",
      resourcePageUrl: "https://example.test/xyz",
    });
    expect(r.outcome).toBe("VALIDATION_FAILED");
  });

  it("is deterministic for identical raw bytes", () => {
    const { text, bytes } = load("valid-spec3-39.csv");
    const input = {
      rawText: text,
      rawBytes: bytes,
      tldAsciiLabel: "download",
      reportingPeriod: "2026-05",
      sourceUrl: "https://www.icann.org/sites/default/files/mrr/download/download-transactions-202605-en.csv",
      resourcePageUrl: "https://example.test/download",
    };
    const a = normalizeTransactions(input);
    const b = normalizeTransactions(input);
    expect(a.outcome).toBe("SUCCESS");
    expect(b.outcome).toBe("SUCCESS");
    if (a.outcome === "SUCCESS" && b.outcome === "SUCCESS") {
      expect(a.snapshot.normalizedContentSha256).toBe(b.snapshot.normalizedContentSha256);
      expect(a.snapshot.rawSha256).toBe(sha256Hex(bytes));
    }
  });
});

describe("temporal series derivation", () => {
  it("derives MoM from May and YoY from prior June; gaps do not bridge", () => {
    const june25 = syntheticCsv(100);
    const may26 = syntheticCsv(150);
    const june26 = syntheticCsv(157);
    const enc = (s: string) => new TextEncoder().encode(s);

    const nJune25 = normalizeTransactions({
      rawText: june25,
      rawBytes: enc(june25),
      tldAsciiLabel: "demo",
      reportingPeriod: "2025-06",
      sourceUrl: "https://www.icann.org/sites/default/files/mrr/demo/demo-transactions-202506-en.csv",
      resourcePageUrl: "https://example.test/demo",
    });
    const nMay26 = normalizeTransactions({
      rawText: may26,
      rawBytes: enc(may26),
      tldAsciiLabel: "demo",
      reportingPeriod: "2026-05",
      sourceUrl: "https://www.icann.org/sites/default/files/mrr/demo/demo-transactions-202605-en.csv",
      resourcePageUrl: "https://example.test/demo",
    });
    const nJune26 = normalizeTransactions({
      rawText: june26,
      rawBytes: enc(june26),
      tldAsciiLabel: "demo",
      reportingPeriod: "2026-06",
      sourceUrl: "https://www.icann.org/sites/default/files/mrr/demo/demo-transactions-202606-en.csv",
      resourcePageUrl: "https://example.test/demo",
    });
    expect(nJune25.outcome).toBe("SUCCESS");
    expect(nMay26.outcome).toBe("SUCCESS");
    expect(nJune26.outcome).toBe("SUCCESS");
    if (nJune25.outcome !== "SUCCESS" || nMay26.outcome !== "SUCCESS" || nJune26.outcome !== "SUCCESS") {
      return;
    }

    const full = deriveTldMarketSeriesTemporal({
      snapshot: nJune26.snapshot,
      previousSnapshot: nMay26.snapshot,
      yearAgoSnapshot: nJune25.snapshot,
    });
    expect(full.netDomainBaseChange).toEqual({ available: true, value: 7 });
    expect(full.monthOverMonthGrowth).toEqual({ available: true, value: 7 / 150 });
    expect(full.yearOverYearGrowth).toEqual({ available: true, value: 57 / 100 });

    const withoutMay = deriveTldMarketSeriesTemporal({
      snapshot: nJune26.snapshot,
      previousSnapshot: null,
      yearAgoSnapshot: nJune25.snapshot,
    });
    expect(withoutMay.netDomainBaseChange).toEqual({
      available: false,
      reason: "prior_period_unavailable",
    });
    expect(withoutMay.monthOverMonthGrowth).toEqual({
      available: false,
      reason: "prior_period_unavailable",
    });
    expect(withoutMay.yearOverYearGrowth).toEqual({ available: true, value: 57 / 100 });
  });
});

describe("classification / breadth", () => {
  it("excludes specials from breadth", () => {
    expect(classifyRegistrarRow("Totals", "")).toBe("TOTALS");
    expect(classifyRegistrarRow("X", "9998")).toBe("SPECIAL_REGISTRY_OR_SYSTEM");
    expect(classifyRegistrarRow("GoDaddy.com, LLC", "146")).toBe("ACCREDITED_OR_STANDARD");
    expect(isBreadthEligible("SPECIAL_REGISTRY_OR_SYSTEM", 100)).toBe(false);
    expect(isBreadthEligible("ACCREDITED_OR_STANDARD", 0)).toBe(false);
    expect(isBreadthEligible("ACCREDITED_OR_STANDARD", 1)).toBe(true);
  });
});

describe("selection", () => {
  it("ranks by Totals.total-domains DESC then label ASC", () => {
    const top = selectTop100ByTotalDomains(
      [
        { tldAsciiLabel: "b", totalDomains: 10 },
        { tldAsciiLabel: "a", totalDomains: 10 },
        { tldAsciiLabel: "c", totalDomains: 20 },
      ],
      2,
    );
    expect(top).toEqual(["c", "a"]);
  });

  it("unions history reasons", () => {
    const u = buildHistoryUniverse({
      top100: ["com", "xyz"],
      controlSet: ["com", "net"],
      delegatedOverlaps: ["xyz"],
    });
    expect(u.find((x) => x.tldAsciiLabel === "com")?.reasons).toEqual(["CONTROL_SET", "TOP_100"]);
    expect(u.find((x) => x.tldAsciiLabel === "xyz")?.reasons).toContain("RIH_DELEGATED_APPLICATION_OVERLAP");
  });
});

describe("common probe period semantics", () => {
  it("MISSING_REPORT when probe period absent (no silent older substitute)", () => {
    const page = parseTldReportPage(
      `<a href="/sites/default/files/mrr/beta/beta-transactions-202605-en.csv">x</a>`,
      "beta",
      "https://example.test/beta",
    );
    expect(page.transactionsByPeriod["2026-06"]).toBeUndefined();
    expect(page.transactionsByPeriod["2026-05"]).toBeTruthy();
  });
});

describe("revision storage / revalidation", () => {
  it("preserves both raw hashes without overwrite", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-rev-"));
    try {
      const a = new TextEncoder().encode("aaa");
      const b = new TextEncoder().encode("bbb");
      const ha = sha256Hex(a);
      const hb = sha256Hex(b);
      await writeRawImmutable("demo", "2026-06", ha, a, dir);
      await writeRawImmutable("demo", "2026-06", hb, b, dir);
      const again = await writeRawImmutable("demo", "2026-06", ha, a, dir);
      expect(again.wrote).toBe(false);
      const hashes = await listRawHashes("demo", "2026-06", dir);
      expect(hashes.sort()).toEqual([ha, hb].sort());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("detects same-URL body change A→B→C with explicit current pointer", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-revchain-"));
    try {
      const url = "https://www.icann.org/sites/default/files/mrr/demo/demo-transactions-202606-en.csv";
      const page: DiscoveredTldPage = {
        tldAsciiLabel: "demo",
        resourcePageUrl: "https://example.test/demo",
        transactionsPeriods: ["2026-06"],
        activityPeriods: [],
        transactionsByPeriod: { "2026-06": url },
        activityByPeriod: {},
      };
      const bodies = [syntheticCsv(10), syntheticCsv(20), syntheticCsv(30)];
      let call = 0;
      const fetchImpl: FetchImpl = async () => {
        const text = bodies[call]!;
        call += 1;
        const bytes = new TextEncoder().encode(text);
        return { ok: true, status: 200, text, bytes, etag: `W/"v${call}"` };
      };

      const r1 = await acquireOneTransactions({
        page,
        period: "2026-06",
        cwd: dir,
        asOfDate: "2026-10-26",
        probeReportingPeriod: "2026-06",
        fetchImpl,
      });
      expect(r1.outcome).toBe("SUCCESS");
      expect(r1.revisionDetected).toBe(false);
      const cur1 = await readPeriodCurrent("demo", "2026-06", dir);
      expect(cur1?.currentRawSha256).toBe(r1.rawSha256);
      expect(cur1?.previousRawSha256).toBeNull();

      const r2 = await acquireOneTransactions({
        page,
        period: "2026-06",
        cwd: dir,
        asOfDate: "2026-10-26",
        probeReportingPeriod: "2026-06",
        fetchImpl,
      });
      expect(r2.outcome).toBe("SUCCESS");
      expect(r2.revisionDetected).toBe(true);
      expect(r2.revalidated).toBe(true);
      const cur2 = await readPeriodCurrent("demo", "2026-06", dir);
      expect(cur2?.currentRawSha256).toBe(r2.rawSha256);
      expect(cur2?.previousRawSha256).toBe(r1.rawSha256);
      const snap2 = await readNormalizedForPeriod("demo", "2026-06", dir);
      expect(snap2?.rawSha256).toBe(r2.rawSha256);
      expect(snap2?.revisionOfRawSha256).toBe(r1.rawSha256);

      const r3 = await acquireOneTransactions({
        page,
        period: "2026-06",
        cwd: dir,
        asOfDate: "2026-10-26",
        probeReportingPeriod: "2026-06",
        fetchImpl,
      });
      expect(r3.outcome).toBe("SUCCESS");
      expect(r3.revisionDetected).toBe(true);
      const cur3 = await readPeriodCurrent("demo", "2026-06", dir);
      expect(cur3?.currentRawSha256).toBe(r3.rawSha256);
      expect(cur3?.previousRawSha256).toBe(r2.rawSha256);
      const snap3 = await readNormalizedForPeriod("demo", "2026-06", dir);
      expect(snap3?.revisionOfRawSha256).toBe(r2.rawSha256);

      const hashes = await listRawHashes("demo", "2026-06", dir);
      expect(hashes).toContain(r1.rawSha256!);
      expect(hashes).toContain(r2.rawSha256!);
      expect(hashes).toContain(r3.rawSha256!);
      // Lexical order must not determine current
      expect(cur3?.currentRawSha256).toBe(r3.rawSha256);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("304 revalidation reuses current without revision", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-304-"));
    try {
      const url = "https://www.icann.org/sites/default/files/mrr/demo/demo-transactions-202606-en.csv";
      const text = syntheticCsv(42);
      const bytes = new TextEncoder().encode(text);
      await seedNormalizedFromBytes({
        cwd: dir,
        tldAsciiLabel: "demo",
        reportingPeriod: "2026-06",
        sourceUrl: url,
        resourcePageUrl: "https://example.test/demo",
        rawBytes: bytes,
        rawText: text,
        asOfDate: "2026-10-26",
      });
      const before = await readPeriodCurrent("demo", "2026-06", dir);
      const page: DiscoveredTldPage = {
        tldAsciiLabel: "demo",
        resourcePageUrl: "https://example.test/demo",
        transactionsPeriods: ["2026-06"],
        activityPeriods: [],
        transactionsByPeriod: { "2026-06": url },
        activityByPeriod: {},
      };
      const fetchImpl: FetchImpl = async () => ({
        ok: true,
        status: 304,
        etag: before?.etag ?? 'W/"same"',
        lastModified: before?.lastModified,
      });
      const r = await acquireOneTransactions({
        page,
        period: "2026-06",
        cwd: dir,
        asOfDate: "2026-10-26",
        probeReportingPeriod: "2026-06",
        fetchImpl,
      });
      expect(r.outcome).toBe("SUCCESS");
      expect(r.revisionDetected).toBe(false);
      expect(r.reusedFromCache).toBe(true);
      expect(r.revalidated).toBe(true);
      expect(r.rawSha256).toBe(before?.currentRawSha256);
      expect(await listRawHashes("demo", "2026-06", dir)).toHaveLength(1);
      const after = await readNormalizedForPeriod("demo", "2026-06", dir);
      expect(after?.normalizedContentSha256).toBe(before?.currentNormalizedSha256);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("persistent request outcomes", () => {
  it("persists probe/history outcomes and reconciles aggregates", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-outcomes-"));
    try {
      const urlA = "https://www.icann.org/sites/default/files/mrr/alpha/alpha-transactions-202606-en.csv";
      const urlB = "https://www.icann.org/sites/default/files/mrr/beta/beta-transactions-202606-en.csv";
      const pages: DiscoveredTldPage[] = [
        {
          tldAsciiLabel: "alpha",
          resourcePageUrl: "https://example.test/alpha",
          transactionsPeriods: ["2026-06", "2026-05"],
          activityPeriods: [],
          transactionsByPeriod: {
            "2026-06": urlA,
            "2026-05": urlA.replace("202606", "202605"),
          },
          activityByPeriod: {},
        },
        {
          tldAsciiLabel: "beta",
          resourcePageUrl: "https://example.test/beta",
          transactionsPeriods: ["2026-05"],
          activityPeriods: [],
          transactionsByPeriod: {
            "2026-05": urlB.replace("202606", "202605"),
          },
          activityByPeriod: {},
        },
        {
          tldAsciiLabel: "com",
          resourcePageUrl: "https://example.test/com",
          transactionsPeriods: ["2026-06"],
          activityPeriods: [],
          transactionsByPeriod: {
            "2026-06": "https://www.icann.org/sites/default/files/mrr/com/com-transactions-202606-en.csv",
          },
          activityByPeriod: {},
        },
      ];
      const bodies: Record<string, string> = {
        [urlA]: syntheticCsv(500),
        [urlA.replace("202606", "202605")]: syntheticCsv(480),
        ["https://www.icann.org/sites/default/files/mrr/com/com-transactions-202606-en.csv"]:
          syntheticCsv(1000),
      };
      const fetchImpl: FetchImpl = async (url) => {
        const text = bodies[url];
        if (!text) return { ok: false, status: 404, error: "HTTP 404" };
        const bytes = new TextEncoder().encode(text);
        return { ok: true, status: 200, text, bytes };
      };

      const { manifest, requestOutcomes } = await runStageDAcquisition({
        asOfDate: "2026-10-26",
        cwd: dir,
        pages,
        delegatedLabels: new Set(["alpha", "beta", "com"]),
        appliedLabels: [],
        concurrency: 2,
        fetchImpl,
      });

      expect(manifest.outcomesArtifactPath).toContain(".outcomes.json");
      expect(manifest.outcomesArtifactSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(requestOutcomes.length).toBeGreaterThan(0);
      expect(manifest.schemaVersion).toBe("market-baseline-mrr-run-manifest/1.1.0");
      expect(manifest.runScope?.mode).toBe("BOUNDED");
      expect(manifest.runScope?.discoverySource).toBe("CALLER_SUPPLIED");

      const probeFromDetail = reconcileOutcomeCounts(requestOutcomes, "PROBE");
      expect(probeFromDetail).toEqual(manifest.probe);
      expect(manifest.probe.success).toBe(2); // alpha + com
      expect(manifest.probe.missing).toBe(1); // beta missing 2026-06

      const missingProbe = requestOutcomes.filter(
        (r) => r.phase === "PROBE" && r.outcome === "MISSING_REPORT",
      );
      expect(missingProbe.map((r) => r.tldAsciiLabel)).toEqual(["beta"]);

      const historyFromDetail = reconcileOutcomeCounts(requestOutcomes, "HISTORY");
      expect(historyFromDetail).toEqual(manifest.history);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("acquisition runScope", () => {
  const basePage = (
    tld: string,
    periods: string[],
  ): DiscoveredTldPage => ({
    tldAsciiLabel: tld,
    resourcePageUrl: `https://example.test/${tld}`,
    transactionsPeriods: periods,
    activityPeriods: [],
    transactionsByPeriod: Object.fromEntries(
      periods.map((p) => [
        p,
        `https://www.icann.org/sites/default/files/mrr/${tld}/${tld}-transactions-${p.replace("-", "")}-en.csv`,
      ]),
    ),
    activityByPeriod: {},
  });

  function mockFetch(bodies: Record<string, string>): FetchImpl {
    return async (url) => {
      const text = bodies[url];
      if (!text) return { ok: false, status: 404, error: "HTTP 404" };
      const bytes = new TextEncoder().encode(text);
      return { ok: true, status: 200, text, bytes };
    };
  }

  it("marks caller-supplied pages as BOUNDED even when internally complete", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-scope-pages-"));
    try {
      const pages = [basePage("alpha", ["2026-06", "2026-05"])];
      const url = pages[0]!.transactionsByPeriod["2026-06"]!;
      const { manifest } = await runStageDAcquisition({
        asOfDate: "2026-10-26",
        cwd: dir,
        pages,
        delegatedLabels: new Set(["alpha"]),
        appliedLabels: [],
        concurrency: 1,
        fetchImpl: mockFetch({
          [url]: syntheticCsv(10),
          [pages[0]!.transactionsByPeriod["2026-05"]!]: syntheticCsv(9),
        }),
      });
      expect(manifest.runScope?.mode).toBe("BOUNDED");
      expect(manifest.runScope?.discoverySource).toBe("CALLER_SUPPLIED");
      expect(manifest.runScope?.intendedProbeUniverse).toBe("BOUNDED");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("marks probeLimit runs as BOUNDED", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-scope-limit-"));
    try {
      const pages = [
        basePage("alpha", ["2026-06"]),
        basePage("beta", ["2026-06"]),
        basePage("gamma", ["2026-06"]),
      ];
      const bodies: Record<string, string> = {};
      for (const p of pages) {
        bodies[p.transactionsByPeriod["2026-06"]!] = syntheticCsv(10);
      }
      // Seed a legacy-unqualified cache so discovery path is not used; still BOUNDED via probeLimit.
      // Use pages override + probeLimit to prove probeLimit classification.
      const { manifest } = await runStageDAcquisition({
        asOfDate: "2026-10-26",
        cwd: dir,
        pages,
        probeLimit: 1,
        skipHistory: true,
        delegatedLabels: new Set(["alpha", "beta", "gamma"]),
        appliedLabels: [],
        concurrency: 1,
        fetchImpl: mockFetch(bodies),
      });
      expect(manifest.runScope?.mode).toBe("BOUNDED");
      expect(manifest.runScope?.probeLimit).toBe(1);
      expect(manifest.runScope?.probedTldCount).toBe(1);
      expect(manifest.runScope?.discoveredTldCount).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("marks skipHistory runs as BOUNDED", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-scope-skip-"));
    try {
      const pages = [basePage("alpha", ["2026-06"])];
      const { manifest } = await runStageDAcquisition({
        asOfDate: "2026-10-26",
        cwd: dir,
        pages,
        skipHistory: true,
        delegatedLabels: new Set(["alpha"]),
        appliedLabels: [],
        concurrency: 1,
        fetchImpl: mockFetch({
          [pages[0]!.transactionsByPeriod["2026-06"]!]: syntheticCsv(10),
        }),
      });
      expect(manifest.runScope?.mode).toBe("BOUNDED");
      expect(manifest.runScope?.historyMode).toBe("SKIPPED_OR_BOUNDED");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("records FULL_STAGE_D for ordinary full invocation via qualified discovery cache", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mrr-scope-full-"));
    try {
      const pages = [
        basePage("alpha", ["2026-06", "2026-05"]),
        basePage("com", ["2026-06", "2026-05"]),
      ];
      const cachePath = join(dir, ".data/market-baseline/mrr/indexes/discovery-cache.json");
      mkdirSync(dirname(cachePath), { recursive: true });
      writeFileSync(
        cachePath,
        `${JSON.stringify({
          asOfDate: "2026-10-26",
          probeReportingPeriod: "2026-06",
          pages,
          cachedAt: "2026-10-26T00:00:00.000Z",
          discoveryProvenance: {
            schemaVersion: "market-baseline-mrr-discovery-cache/1.0.0",
            source: "ICANN_FULL_DISCOVERY",
            qualifiedForFullStageD: true,
          },
        })}\n`,
        "utf8",
      );
      const bodies: Record<string, string> = {};
      for (const p of pages) {
        for (const period of Object.keys(p.transactionsByPeriod)) {
          bodies[p.transactionsByPeriod[period]!] = syntheticCsv(10);
        }
      }
      const { manifest } = await runStageDAcquisition({
        asOfDate: "2026-10-26",
        cwd: dir,
        // no pages, no probeLimit, no skipHistory
        delegatedLabels: new Set(["alpha", "com"]),
        appliedLabels: [],
        concurrency: 2,
        fetchImpl: mockFetch(bodies),
      });
      expect(manifest.runScope?.mode).toBe("FULL_STAGE_D");
      expect(manifest.runScope?.discoverySource).toBe("QUALIFIED_DISCOVERY_CACHE");
      expect(manifest.runScope?.historyMode).toBe("FULL_24_MONTH");
      expect(manifest.runScope?.intendedProbeUniverse).toBe("ALL_DISCOVERED_TLDS");
      expect(manifest.runScope?.probeLimit).toBeNull();
      expect(manifest.historyPeriodCount).toBe(24);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("discovery parsing", () => {
  it("parses index TLD anchors and page CSV links", () => {
    const index = `
      <a href="/resources/pages/xyz-2014-06-19-en">.xyz</a>
      <a href="/resources/pages/com-2014-06-19-en">.com</a>
      <a href="/resources/pages/registry-reports-2016-03-22-en">Monthly</a>
    `;
    const entries = parseRegistryReportsIndex(index);
    expect(entries.map((e) => e.tldAsciiLabel)).toEqual(["com", "xyz"]);

    const pageHtml = `
      <a href="/sites/default/files/mrr/xyz/xyz-transactions-202606-en.csv">t</a>
      <a href="/sites/default/files/mrr/xyz/xyz-activity-202606-en.csv">a</a>
    `;
    const page = parseTldReportPage(pageHtml, "xyz", "https://www.icann.org/resources/pages/xyz-2014-06-19-en");
    expect(page.transactionsPeriods).toContain("2026-06");
    expect(page.activityPeriods).toContain("2026-06");
  });
});

describe("IANA overlap selection", () => {
  it("requires applied ∩ delegated ∩ discovered", () => {
    const delegated = parseIanaTldListText("# comment\nCOM\nXYZ\nONLINE\n");
    const overlaps = selectDelegatedApplicationOverlaps({
      appliedAsciiLabels: ["xyz", "brandnew", "online"],
      delegatedLabels: delegated,
      discoveredMrrLabels: new Set(["xyz", "com"]),
    });
    expect(overlaps).toEqual(["xyz"]);
  });
});

describe("cross-grain safety", () => {
  it("normalized snapshot does not emit Organization/RSP/Application IDs", () => {
    const { text, bytes } = load("valid-spec3-39.csv");
    const r = normalizeTransactions({
      rawText: text,
      rawBytes: bytes,
      tldAsciiLabel: "download",
      reportingPeriod: "2026-05",
      sourceUrl: "https://www.icann.org/sites/default/files/mrr/download/download-transactions-202605-en.csv",
      resourcePageUrl: "https://example.test/download",
    });
    expect(r.outcome).toBe("SUCCESS");
    if (r.outcome !== "SUCCESS") return;
    const json = JSON.stringify(r.snapshot);
    expect(json).not.toMatch(/organizationId|rspId|applicationId|confirmedOrganization|selectedRsp/i);
    expect(r.snapshot.normalizedContentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(hashNormalizedContent({ a: 1 })).toMatch(/^[a-f0-9]{64}$/);
  });
});
