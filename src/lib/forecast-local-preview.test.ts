import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildForecastLocalPreviewDisabledHttpResponse,
  filterForecastPreviewRows,
  formatUnknownBoolean,
  isForecastLocalPreviewEnabled,
  normalizeExtensionSearch,
  paginateForecastPreviewRows,
  projectForecastLocalPreviewViewModel,
  resolveForecastLocalPreviewProxy,
  sortForecastPreviewRows,
  type ForecastLocalPreviewRowView,
  type ForecastLocalPreviewViewModel,
} from "@/lib/forecast-local-preview";
import {
  loadForecastLocalPreviewView,
  sha256Hex,
  validateForecastPreviewDocument,
} from "@/lib/forecast-local-preview-server";
import type { ForecastPreviewDocument } from "@/registration-forecast-preview/types";

const SOURCE_PIN = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function syntheticDoc(overrides?: {
  strings?: ForecastPreviewDocument["strings"];
  summary?: Partial<ForecastPreviewDocument["summary"]>;
  sourceSha?: string;
}): ForecastPreviewDocument {
  const strings = overrides?.strings ?? [
    {
      stringLabel: "wdo",
      measuredDomainCount: 62,
      status: "estimated" as const,
      compoundWordCandidate: true,
      range: { conservative: 50, expected: 118, optimistic: 198 },
      statusNote: "experimental",
      brandDesignationObserved: false,
      contested: false,
      fromNormalizedApplication: false,
      fromKnownExcluded: true,
      origins: ["knownExcludedRecords.primaryString"],
    },
    {
      stringLabel: "hub",
      measuredDomainCount: 10,
      status: "estimated" as const,
      compoundWordCandidate: true,
      range: { conservative: 8, expected: 19, optimistic: 32 },
      statusNote: "experimental",
      brandDesignationObserved: true,
      contested: false,
      fromNormalizedApplication: true,
      fromKnownExcluded: false,
      origins: ["appliedString.label"],
    },
    {
      stringLabel: "ab",
      measuredDomainCount: 5,
      status: "conversion_not_recommended" as const,
      compoundWordCandidate: false,
      range: null,
      statusNote: "not recommended",
      brandDesignationObserved: null,
      contested: null,
      fromNormalizedApplication: null,
      fromKnownExcluded: true,
      origins: null,
    },
    {
      stringLabel: "zero",
      measuredDomainCount: 0,
      status: "estimated" as const,
      compoundWordCandidate: true,
      range: { conservative: 0, expected: 0, optimistic: 0 },
      statusNote: "zero demand",
      brandDesignationObserved: false,
      contested: false,
      fromNormalizedApplication: true,
      fromKnownExcluded: false,
      origins: ["appliedString.label"],
    },
  ];
  const estimated = strings.filter((s) => s.status === "estimated").length;
  const notRec = strings.filter((s) => s.status === "conversion_not_recommended").length;
  const zero = strings.filter((s) => s.measuredDomainCount === 0).length;
  return {
    schemaVersion: 1,
    kind: "experimental-registration-forecast-preview",
    status: "complete",
    horizonLabel: "~4 years after launch (experimental)",
    disclaimer: "Estimates, not facts.",
    conversionFactors: { conservative: 0.8, expected: 1.9, optimistic: 3.2 },
    conversionNote: "Experimental factors only.",
    sourceAggregate: {
      path: "fixture-aggregate.json",
      sha256: overrides?.sourceSha ?? SOURCE_PIN,
      schemaVersion: 1,
      status: "complete",
      snapshotDate: "2026-11-07",
      manifestId: "mid-panel",
      sourceId: "activedns",
      sourceName: "ActiveDNS",
      sourceUrl: "https://activedns.net/",
      attribution: "ActiveDNS mid-panel attribution fixture",
      referencePanelTlds: ["net", "org", "info", "biz", "app", "dev"],
      domainScan: {},
      applicationCensus: {},
      candidateProvenance: {},
      processing: {},
    },
    summary: {
      measuredStringCount: strings.length,
      estimatedStringCount: estimated,
      conversionNotRecommendedCount: notRec,
      zeroMeasuredDemandCount: zero,
      ...overrides?.summary,
    },
    limitations: ["Partial inventory", "Literal suffix match"],
    strings,
  };
}

function row(
  partial: Partial<ForecastLocalPreviewRowView> & Pick<ForecastLocalPreviewRowView, "stringLabel">,
): ForecastLocalPreviewRowView {
  return {
    extension: `.${partial.stringLabel}`,
    measuredDomainCount: 0,
    conservative: null,
    expected: null,
    optimistic: null,
    conversionStatus: "estimated",
    statusNote: "",
    brandDesignationObserved: null,
    contested: null,
    origins: null,
    fromKnownExcluded: null,
    fromNormalizedApplication: null,
    sourceDetail: "observed",
    ...partial,
  };
}

describe("forecast local preview gate", () => {
  it("enables only when NODE_ENV=development and RIH_FORECAST_LOCAL_PREVIEW=1", () => {
    expect(
      isForecastLocalPreviewEnabled({
        NODE_ENV: "development",
        RIH_FORECAST_LOCAL_PREVIEW: "1",
      }),
    ).toBe(true);
    expect(
      isForecastLocalPreviewEnabled({
        NODE_ENV: "production",
        RIH_FORECAST_LOCAL_PREVIEW: "1",
      }),
    ).toBe(false);
    expect(
      isForecastLocalPreviewEnabled({
        NODE_ENV: "development",
        RIH_FORECAST_LOCAL_PREVIEW: "0",
      }),
    ).toBe(false);
    expect(isForecastLocalPreviewEnabled({ NODE_ENV: "development" })).toBe(false);
  });

  it("builds a hard HTTP 404 response without forecast payload leakage", async () => {
    const response = buildForecastLocalPreviewDisabledHttpResponse();
    expect(response.status).toBe(404);
    const body = await response.text();
    expect(body).toMatch(/Not Found/i);
    expect(body).not.toMatch(/1,431|Measured demand|experimental-forecast-preview/i);
  });

  it("proxy decision returns HTTP 404 when disabled and pass-through when enabled", async () => {
    const disabled = resolveForecastLocalPreviewProxy({
      NODE_ENV: "production",
      RIH_FORECAST_LOCAL_PREVIEW: "1",
    });
    expect(disabled?.status).toBe(404);
    const body = await disabled!.text();
    expect(body).not.toMatch(/1,431|Measured demand/i);

    const enabled = resolveForecastLocalPreviewProxy({
      NODE_ENV: "development",
      RIH_FORECAST_LOCAL_PREVIEW: "1",
    });
    expect(enabled).toBeUndefined();
  });
});

describe("forecast local preview validation and loading", () => {
  it("validates identity, shape, SHA pins, and summary invariants", () => {
    const doc = syntheticDoc();
    const raw = Buffer.from(JSON.stringify(doc), "utf8");
    const sha = sha256Hex(raw);
    const validated = validateForecastPreviewDocument(doc, {
      expectedPreviewSha256: sha,
      expectedSourceAggregateSha256: SOURCE_PIN,
      rawBytes: raw,
    });
    expect(validated.strings).toHaveLength(4);
  });

  it("rejects SHA mismatch and corrupted summary", () => {
    const doc = syntheticDoc();
    const raw = Buffer.from(JSON.stringify(doc), "utf8");
    expect(() =>
      validateForecastPreviewDocument(doc, {
        expectedPreviewSha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        expectedSourceAggregateSha256: SOURCE_PIN,
        rawBytes: raw,
      }),
    ).toThrow(/SHA-256 mismatch/);

    const bad = syntheticDoc({
      summary: { measuredStringCount: 99, estimatedStringCount: 1, conversionNotRecommendedCount: 1 },
    });
    const badRaw = Buffer.from(JSON.stringify(bad), "utf8");
    expect(() =>
      validateForecastPreviewDocument(bad, {
        expectedPreviewSha256: sha256Hex(badRaw),
        expectedSourceAggregateSha256: SOURCE_PIN,
        rawBytes: badRaw,
      }),
    ).toThrow(/summary invariants/);
  });

  it("projects a client view without absolute paths or unrelated aggregate blobs", () => {
    const doc = syntheticDoc();
    const view = projectForecastLocalPreviewViewModel(doc, "deadbeef");
    expect(view.heading).toBe("Experimental Registration Forecast — 2026");
    expect(JSON.stringify(view)).not.toMatch(/fixture-aggregate\.json/);
    expect(view).not.toHaveProperty("domainScan");
    expect(view.rows.find((r) => r.stringLabel === "wdo")).toMatchObject({
      measuredDomainCount: 62,
      expected: 118,
      conservative: 50,
      optimistic: 198,
    });
    expect(view.rows.find((r) => r.stringLabel === "ab")).toMatchObject({
      expected: null,
      conversionStatus: "conversion_not_recommended",
    });
    expect(view.rows.find((r) => r.stringLabel === "zero")).toMatchObject({
      measuredDomainCount: 0,
      expected: 0,
    });
  });

  it("loads from a fixed relative fixture when gated on, and refuses when disabled", async () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "rih-fcast-05b-"));
    const rel = ".data/registration-forecast/experimental-forecast-preview.json";
    mkdirSync(path.join(cwd, ".data/registration-forecast"), { recursive: true });
    const doc = syntheticDoc();
    const raw = Buffer.from(JSON.stringify(doc), "utf8");
    writeFileSync(path.join(cwd, rel), raw);

    const disabled = await loadForecastLocalPreviewView({
      cwd,
      env: { NODE_ENV: "production", RIH_FORECAST_LOCAL_PREVIEW: "1" },
      expectedPreviewSha256: sha256Hex(raw),
      expectedSourceAggregateSha256: SOURCE_PIN,
    });
    expect(disabled.status).toBe("disabled");

    const ok = await loadForecastLocalPreviewView({
      cwd,
      env: { NODE_ENV: "development", RIH_FORECAST_LOCAL_PREVIEW: "1" },
      expectedPreviewSha256: sha256Hex(raw),
      expectedSourceAggregateSha256: SOURCE_PIN,
    });
    expect(ok.status).toBe("ok");
    if (ok.status === "ok") {
      expect(ok.view.rows.some((r) => r.stringLabel === "wdo")).toBe(true);
      expect(ok.view.rows.some((r) => r.stringLabel === "hub" && r.brandDesignationObserved === true)).toBe(
        true,
      );
    }
  });

  it("returns an error for missing or corrupted preview without fabricating rows", async () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "rih-fcast-05b-missing-"));
    mkdirSync(path.join(cwd, ".data/registration-forecast"), { recursive: true });

    const missing = await loadForecastLocalPreviewView({
      cwd,
      env: { NODE_ENV: "development", RIH_FORECAST_LOCAL_PREVIEW: "1" },
      expectedPreviewSha256: SOURCE_PIN,
      expectedSourceAggregateSha256: SOURCE_PIN,
    });
    expect(missing.status).toBe("error");

    const rel = ".data/registration-forecast/experimental-forecast-preview.json";
    writeFileSync(path.join(cwd, rel), "{not-json");
    const corrupt = await loadForecastLocalPreviewView({
      cwd,
      env: { NODE_ENV: "development", RIH_FORECAST_LOCAL_PREVIEW: "1" },
      expectedPreviewSha256: SOURCE_PIN,
      expectedSourceAggregateSha256: SOURCE_PIN,
    });
    expect(corrupt.status).toBe("error");
  });
});

describe("forecast local preview search/sort/pagination", () => {
  const rows = [
    row({ stringLabel: "wdo", measuredDomainCount: 62, expected: 118 }),
    row({ stringLabel: "hub", measuredDomainCount: 10, expected: 19 }),
    row({ stringLabel: "ab", measuredDomainCount: 5, expected: null }),
    row({ stringLabel: "zero", measuredDomainCount: 0, expected: 0 }),
    row({ stringLabel: "brandx", measuredDomainCount: 3, expected: 6, brandDesignationObserved: true }),
  ];

  it("searches case-insensitively with or without a leading dot", () => {
    expect(normalizeExtensionSearch(".WDO")).toBe("wdo");
    expect(filterForecastPreviewRows(rows, "wdo").map((r) => r.stringLabel)).toEqual(["wdo"]);
    expect(filterForecastPreviewRows(rows, ".wdo").map((r) => r.stringLabel)).toEqual(["wdo"]);
    expect(filterForecastPreviewRows(rows, "nope")).toEqual([]);
  });

  it("sorts by expected with nulls after numerics, never treating null as zero", () => {
    const desc = sortForecastPreviewRows(rows, "expected", "desc");
    expect(desc.map((r) => r.stringLabel)).toEqual(["wdo", "hub", "brandx", "zero", "ab"]);
    const asc = sortForecastPreviewRows(rows, "expected", "asc");
    expect(asc.map((r) => r.stringLabel)).toEqual(["zero", "brandx", "hub", "wdo", "ab"]);
  });

  it("sorts by measured and extension with deterministic ties", () => {
    const tied = [
      row({ stringLabel: "bbb", measuredDomainCount: 5, expected: 1 }),
      row({ stringLabel: "aaa", measuredDomainCount: 5, expected: 1 }),
    ];
    expect(sortForecastPreviewRows(tied, "measured", "desc").map((r) => r.stringLabel)).toEqual([
      "aaa",
      "bbb",
    ]);
    expect(sortForecastPreviewRows(tied, "extension", "asc").map((r) => r.stringLabel)).toEqual([
      "aaa",
      "bbb",
    ]);
  });

  it("paginates 25 rows per page by default", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      row({ stringLabel: `s${String(i).padStart(2, "0")}`, expected: i }),
    );
    const page1 = paginateForecastPreviewRows(many, 1);
    expect(page1.rows).toHaveLength(25);
    expect(page1.pageCount).toBe(2);
    const page2 = paginateForecastPreviewRows(many, 2);
    expect(page2.rows).toHaveLength(5);
  });

  it("formats Unknown for null Brand/contention flags", () => {
    expect(formatUnknownBoolean(true)).toBe("Yes");
    expect(formatUnknownBoolean(false)).toBe("No");
    expect(formatUnknownBoolean(null)).toBe("Unknown");
  });
});

describe("forecast local preview disclosures contract", () => {
  it("keeps methodology fields needed by the UI", () => {
    const view: ForecastLocalPreviewViewModel = projectForecastLocalPreviewViewModel(
      syntheticDoc(),
      "sha",
    );
    expect(view.sourceUrl).toBe("https://activedns.net/");
    expect(view.snapshotDate).toBe("2026-11-07");
    expect(view.referencePanelTlds).toEqual(["net", "org", "info", "biz", "app", "dev"]);
    expect(view.conversionFactors).toEqual({ conservative: 0.8, expected: 1.9, optimistic: 3.2 });
  });
});
