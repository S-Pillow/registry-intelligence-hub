import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRevealDayCsvText } from "../normalization/parse-reveal-csv";
import { contentHash } from "../normalization/hashes";
import { classify2012RevealDayApplications, buildTaxonomyCoverageReport } from "./classify-2012";
import { REGISTRY_MARKET_TAXONOMY_VERSION } from "./taxonomy-1.0";

const csvPath = join(
  import.meta.dirname,
  "..",
  "normalization/fixtures/icann2012-reveal-day-v1/sources/strings-1200utc-13jun12-en.csv",
);

describe("registry-market-taxonomy/1.0 — 2012 Reveal Day", () => {
  it("classifies deterministically with evidence refs on ICANN flags", async () => {
    const csv = await readFile(csvPath, "utf8");
    const rows = parseRevealDayCsvText(csv);
    const first = classify2012RevealDayApplications(rows);
    const second = classify2012RevealDayApplications(rows);
    expect(contentHash(first)).toBe(contentHash(second));
    expect(first.length).toBe(1930);
    expect(first.every((r) => r.taxonomyVersion === REGISTRY_MARKET_TAXONOMY_VERSION)).toBe(true);
    expect(first.every((r) => r.modelVersion === null)).toBe(true);

    const withCommunity = first.filter((r) => r.categories.some((c) => c.categoryId === "community"));
    expect(withCommunity.length).toBeGreaterThan(0);
    for (const record of withCommunity) {
      expect(record.categories[0].evidenceRefs[0]).toContain("Community?");
      expect(record.categories[0].confidence).toBe(1);
    }
  });

  it("reports taxonomy coverage without forcing non-flag applications", async () => {
    const csv = await readFile(csvPath, "utf8");
    const rows = parseRevealDayCsvText(csv);
    const records = classify2012RevealDayApplications(rows);
    const coverage = buildTaxonomyCoverageReport(records);
    expect(coverage.applicationCount).toBe(1930);
    expect(coverage.classifiedCount + coverage.unclassifiedCount).toBe(1930);
    expect(coverage.unclassifiedCount).toBeGreaterThan(0);
  });
});
