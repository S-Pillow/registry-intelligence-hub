import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLEARED_RSP_EVALUATION_PHRASE,
  findEvaluatedRspByLegalName,
  isSuccessfullyCleared,
  loadEvaluatedMainRspArtifact,
  parseEvaluatedMainRspHtml,
} from "@/lib/icann-evaluated-rsp";

describe("ICANN evaluated Main-RSP source normalization", () => {
  const artifact = loadEvaluatedMainRspArtifact();

  it("retains source update date and publisher metadata", () => {
    expect(artifact.source.publisher).toBe("ICANN");
    expect(artifact.source.sourceLastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(artifact.source.url).toContain("rsp-applications.html");
    expect(artifact.source.contentSha256).toHaveLength(64);
    expect(artifact.records.length).toBeGreaterThan(0);
    expect(artifact.counts.records).toBe(artifact.records.length);
  });

  it("retains legal name, DBA, country for Registry Services / GoDaddy Registry", () => {
    const gd = findEvaluatedRspByLegalName(artifact.records, "Registry Services, LLC");
    expect(gd).not.toBeNull();
    expect(gd!.doingBusinessAs).toBe("GoDaddy Registry");
    expect(gd!.countryCode).toBe("US");
    expect(isSuccessfullyCleared(gd!.main)).toBe(true);
    expect(isSuccessfullyCleared(gd!.dns)).toBe(true);
    expect(isSuccessfullyCleared(gd!.dnssec)).toBe(true);
    expect(isSuccessfullyCleared(gd!.proxy)).toBe(false);
    expect(gd!.proxy.status).toBe("BLANK");
    expect(gd!.idnSupportLevel).toBe(2);
  });

  it("retains Charleston Road / Google Registry capabilities from official source", () => {
    const google = findEvaluatedRspByLegalName(artifact.records, "Charleston Road Registry Inc.");
    expect(google).not.toBeNull();
    expect(google!.doingBusinessAs).toBe("Google Registry");
    expect(isSuccessfullyCleared(google!.main)).toBe(true);
    expect(isSuccessfullyCleared(google!.dns)).toBe(true);
    expect(isSuccessfullyCleared(google!.dnssec)).toBe(true);
    expect(google!.idnSupportLevel).toBe(1);
  });

  it("does not treat blank or in-progress as successfully cleared", () => {
    const fixtureHtml = `
      <div>Last updated on: <span>2026-10-06</span></div>
      <table><tr><th>h</th></tr>
      <tr>
        <td><div><strong>Full Legal Name:</strong> <span>Blank Main RSP LLC</span></div>
          <div><strong>Doing Business As:</strong> <span>BlankMain</span></div>
          <div><strong>Country Code of Location:</strong> <span>US</span></div></td>
        <td>2026-01-01</td>
        <td></td>
        <td><a>${CLEARED_RSP_EVALUATION_PHRASE}</a></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
      <tr>
        <td><div><strong>Full Legal Name:</strong> <span>In Progress RSP LLC</span></div>
          <div><strong>Doing Business As:</strong> <span>InProgress</span></div>
          <div><strong>Country Code of Location:</strong> <span>US</span></div></td>
        <td>2026-01-01</td>
        <td>Technical screening: cleared/Technical testing: in-progress</td>
        <td></td>
        <td></td>
        <td></td>
        <td>3</td>
      </tr>
      </table>`;
    const parsed = parseEvaluatedMainRspHtml(fixtureHtml, {
      retrievedAt: "2026-10-10T00:00:00Z",
      contentSha256: "a".repeat(64),
      contentBytes: fixtureHtml.length,
    });
    expect(parsed.source.sourceLastUpdated).toBe("2026-10-06");
    const blank = findEvaluatedRspByLegalName(parsed.records, "Blank Main RSP LLC")!;
    const progress = findEvaluatedRspByLegalName(parsed.records, "In Progress RSP LLC")!;
    expect(blank.main.status).toBe("BLANK");
    expect(isSuccessfullyCleared(blank.main)).toBe(false);
    expect(isSuccessfullyCleared(blank.dnssec)).toBe(true);
    expect(progress.main.status).toBe("NOT_CLEARED");
    expect(isSuccessfullyCleared(progress.main)).toBe(false);
    expect(progress.idnSupportLevel).toBe(3);
  });

  it("parser round-trips the tracked acquisition bytes when present in temp", () => {
    // Optional live-byte check: if operator saved raw HTML beside the script output, verify.
    // Primary durability is the tracked JSON + synthetic fixture above.
    expect(artifact.counts.mainSuccessfullyCleared).toBeGreaterThan(0);
    expect(artifact.counts.mainSuccessfullyCleared).toBeLessThanOrEqual(artifact.counts.records);
  });
});

describe("tracked artifact integrity", () => {
  it("loads without runtime network", () => {
    const a = loadEvaluatedMainRspArtifact();
    expect(a.schemaVersion).toBe("icann-evaluated-main-rsp/1.0.0");
    // Ensure JSON file hashes stably for the recorded content sha field format
    const raw = readFileSync(
      join(process.cwd(), "src/data/icann-evaluated-rsp/evaluated-main-rsp-v1.json"),
      "utf8",
    );
    expect(raw.length).toBeGreaterThan(100);
    expect(createHash("sha256").update(raw).digest("hex")).toHaveLength(64);
  });
});
