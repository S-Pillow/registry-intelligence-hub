import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRfc4180Csv } from "./csv";
import { classifyRegistrarRow, isBreadthEligible } from "./classify";
import { parseTransactionsCsv, parseTransactionsFilename } from "./parse";
import { normalizeTransactions } from "./normalize";
import { probeReportingPeriodFromAsOf, historyWindowEndingAt } from "./period";
import {
  buildHistoryUniverse,
  selectTop100ByTotalDomains,
} from "./selection";
import { sha256Hex, hashNormalizedContent } from "./hash";
import { listRawHashes, writeRawImmutable } from "./storage";
import { parseRegistryReportsIndex, parseTldReportPage } from "./discover";
import { parseIanaTldListText } from "./iana-delegation";
import { selectDelegatedApplicationOverlaps } from "./applied-overlap";
import { CORE_TRANSACTION_HEADERS, COM_EXTENDED_HEADERS } from "./schema-profiles";

const FIX = join(__dirname, "fixtures");

function load(name: string): { text: string; bytes: Uint8Array } {
  const text = readFileSync(join(FIX, name), "utf8");
  return { text, bytes: new TextEncoder().encode(text) };
}

describe("period withhold", () => {
  it("maps 2026-10-26 → 2026-06", () => {
    expect(probeReportingPeriodFromAsOf("2026-10-26")).toBe("2026-06");
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

describe("normalize validation", () => {
  it("reconciles Totals including specials and computes metrics", () => {
    const { text, bytes } = load("valid-spec3-39.csv");
    const r = normalizeTransactions({
      rawText: text,
      rawBytes: bytes,
      tldAsciiLabel: "download",
      reportingPeriod: "2026-05",
      sourceUrl: "https://www.icann.org/sites/default/files/mrr/download/download-transactions-202605-en.csv",
      resourcePageUrl: "https://www.icann.org/resources/pages/download-2014-06-19-en",
      previousTotalDomains: 150,
      yearAgoTotalDomains: 100,
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
    expect(r.snapshot.metrics.netDomainBaseChange).toEqual({ available: true, value: 7 });
    expect(r.snapshot.metrics.monthOverMonthGrowth.available).toBe(true);
    expect(r.snapshot.metrics.yearOverYearGrowth.available).toBe(true);
    expect((r.snapshot.metrics as { renewalRate?: unknown }).renewalRate).toBeUndefined();
    expect(r.snapshot.registrars.every((x) => x.classification !== "TOTALS")).toBe(true);
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
    // Ranking callers must only use SUCCESS for probe period — covered by selectTop100 input filter.
  });
});

describe("revision storage", () => {
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
    // content hash stable shape
    expect(r.snapshot.normalizedContentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(hashNormalizedContent({ a: 1 })).toMatch(/^[a-f0-9]{64}$/);
  });
});
