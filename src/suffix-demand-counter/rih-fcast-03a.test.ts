import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { BrowserApplicationV2 } from "@/lib/registry-applications-document-v2";
import { loadAuthoritative2026Candidates } from "./candidate-source";
import { runSuffixDemandCounter, stableStringify } from "./counter";
import { writeSyntheticMidPanel } from "./fixtures";
import { createSuffixMatcher } from "./suffix-matcher";
import { MID_PANEL_TLDS } from "./types";

const HASH = "a".repeat(64);

function app(
  id: string,
  label: string,
  overrides: Partial<BrowserApplicationV2> = {},
): BrowserApplicationV2 {
  return {
    applicationId: id,
    applicant: `Applicant ${id}`,
    country: "US",
    region: "NA",
    applicationStatus: "Active",
    processingStage: "String Evaluation Processing",
    applicationType: "New gTLD",
    designations: {
      brand: false, community: false, geoSelfDesignated: false,
      geoStringReviewConfirmed: false, idn: false,
    },
    labels: {} as BrowserApplicationV2["labels"],
    appliedString: { sourceRowId: id, label },
    ...overrides,
  };
}

function documentFixture() {
  const applications = [
    app("A", "hub", { officialContention: {
      membershipPresent: true, officialContentionSetIds: ["1"],
      terminology: "official-initial-contention",
    } }),
    app("B", "hub", { officialContention: {
      membershipPresent: true, officialContentionSetIds: ["1"],
      terminology: "official-initial-contention",
    } }),
    app("C", "oldmaster", {
      applicationStatus: "Deactivated",
      replacementString: {
        sourceRowId: "C-R", label: "master", applicationStatus: "Active",
        applicationType: "New gTLD", processingStage: "String Evaluation Processing",
      },
    }),
    app("D", "brandco", { designations: {
      brand: true, community: false, geoSelfDesignated: false,
      geoStringReviewConfirmed: false, idn: false,
    } }),
    app("E", "novel"),
    app("F", "withdrawn", { applicationStatus: "Withdrawn" }),
    app("G", "unknown", { replacementString: {
      sourceRowId: "WRONG", label: "uncertain", applicationStatus: "Active",
      applicationType: "New gTLD", processingStage: "String Evaluation Processing",
    } }),
    app("H", "mixed", { designations: {
      brand: true, community: false, geoSelfDesignated: false,
      geoStringReviewConfirmed: false, idn: false,
    } }),
    app("I", "mixed"),
  ];
  const count = applications.length;
  return {
    payloadVersion: "registry-browser-applications/2.0.0",
    payloadMode: "promoted-2026",
    snapshotId: "synthetic-2026-complete",
    snapshotContentHash: HASH,
    publicationSchemaVersion: "registry-2026-publication/2.0.0",
    publishedAt: "2026-11-18T00:00:00.000Z",
    retrievedAt: "2026-11-18T00:00:00.000Z",
    source: { name: "APS Application CSV export (synthetic test)", url: "https://newgtldprogram-aps.icann.org/aps/applications/export/csv", evidenceClass: "public-aps-export" },
    rawSha256: HASH,
    bundleManifest: { applicationGraphContentSha256: HASH, officialAggregatesContentSha256: HASH, coverageDescriptorSha256: HASH },
    applicationRecordCoverage: {
      observed: count, official: count, completeness: "complete", knownExcludedRecords: [],
    },
    knownExcludedRecords: [],
    officialApplications: count,
    observedApplicationRecords: count,
    officialAggregates: { officialApplicationCount: count, provenance: { sourceUrl: "https://newgtldprogram-aps.icann.org/aps/applications/stats", contentSha256: HASH } },
    applications,
  };
}

async function setup(label: string, net: string[] = []) {
  const root = await mkdtemp(path.join(os.tmpdir(), `rih-fcast-03a-${label}-`));
  const panel = await writeSyntheticMidPanel({
    dir: path.join(root, "panel"),
    snapshotDate: "2026-11-07",
    files: MID_PANEL_TLDS.map((tld) => ({
      tld,
      domains: tld === "net" ? net : tld === "org" ? ["hub.org"] : [],
    })),
  });
  const applicationPath = path.join(root, "applications.json");
  await writeFile(applicationPath, JSON.stringify(documentFixture()));
  return {
    root, ...panel, applicationPath,
    out: path.join(root, ".data", "suffix-demand", "out.json"),
  };
}

describe("RIH-FCAST-03A bounded suffix processing", () => {
  it("matches literal overlapping suffixes without candidate-by-domain scans", () => {
    const matcher = createSuffixMatcher(["hub", "ub", "api", "z"]);
    const counts = new Map(["hub", "ub", "api", "z"].map((x) => [x, 0]));
    matcher.countMatches("superhub", counts);
    matcher.countMatches("api", counts);
    expect(Object.fromEntries(counts)).toEqual({ hub: 1, ub: 1, api: 1, z: 0 });
  });

  it("suppresses sorted duplicates but preserves distinct cross-TLD domains", async () => {
    const p = await setup("sorted", [
      "brandco.net", "hub.net", "hub.net", "mixed.net",
      "myhub.net", "novel.net", "premaster.net",
    ]);
    const result = await runSuffixDemandCounter({
      inputDir: p.inputDir, manifestPath: p.manifestPath, outputPath: p.out,
      cwd: p.root, applicationsDocumentPath: p.applicationPath,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const by = Object.fromEntries(result.aggregate.strings.map((s) => [s.stringLabel, s.domainCount]));
    expect(by).toEqual({ hub: 3, master: 1, mixed: 1, novel: 1 });
    expect(Object.keys(by)).not.toContain("brandco");
    expect(Object.keys(by)).not.toContain("oldmaster");
    expect(Object.keys(by)).not.toContain("withdrawn");
    expect(Object.keys(by)).not.toContain("unknown");
    expect(result.aggregate.processing.duplicateRecords).toBe(1);
    expect(result.aggregate.candidateProvenance.mode).toBe("applications-document-v2");
    expect(result.aggregate.candidateProvenance.excludedBrandStrings).toBe(1);
    expect(result.aggregate.candidateProvenance.applicationSnapshot?.snapshotId).toBe("synthetic-2026-complete");
    const again = await runSuffixDemandCounter({
      inputDir: p.inputDir, manifestPath: p.manifestPath, outputPath: p.out,
      cwd: p.root, applicationsDocumentPath: p.applicationPath,
    });
    expect(again.ok).toBe(true);
    if (again.ok) expect(stableStringify(result.aggregate)).toBe(stableStringify(again.aggregate));
  });

  it("rejects out-of-order normalized domains and removes a stale aggregate", async () => {
    const p = await setup("unsorted", ["z.net", "a.net"]);
    await mkdir(path.dirname(p.out), { recursive: true });
    await writeFile(p.out, "old-success");
    const result = await runSuffixDemandCounter({
      inputDir: p.inputDir, manifestPath: p.manifestPath, outputPath: p.out,
      cwd: p.root, applicationsDocumentPath: p.applicationPath,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.details.join(" ")).toMatch(/Unsorted|previous=|current=/);
    await expect(readFile(p.out, "utf8")).rejects.toThrow();
  });

  it("fails closed on missing or partial authoritative source", async () => {
    const p = await setup("missing", ["hub.net"]);
    const missing = await runSuffixDemandCounter({
      inputDir: p.inputDir, manifestPath: p.manifestPath, outputPath: p.out,
      cwd: p.root, applicationsDocumentPath: "absent.json",
    });
    expect(missing.ok).toBe(false);
    await expect(readFile(p.out, "utf8")).rejects.toThrow();

    const doc = documentFixture();
    doc.applicationRecordCoverage.completeness = "partial";
    await writeFile(p.applicationPath, JSON.stringify(doc));
    const partial = await runSuffixDemandCounter({
      inputDir: p.inputDir, manifestPath: p.manifestPath, outputPath: p.out,
      cwd: p.root, applicationsDocumentPath: p.applicationPath,
    });
    expect(partial.ok).toBe(false);
    await expect(readFile(p.out, "utf8")).rejects.toThrow();
    await expect(loadAuthoritative2026Candidates(p.applicationPath)).rejects.toThrow(/complete promoted/i);
  });

  it("retains example mode independently from a full-round source", async () => {
    const p = await setup("examples", ["hub.net"]);
    const result = await runSuffixDemandCounter({
      inputDir: p.inputDir, manifestPath: p.manifestPath, outputPath: p.out,
      cwd: p.root,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.aggregate.candidateProvenance.mode).toBe("examples");
      expect(result.aggregate.candidateProvenance.applicationSnapshot).toBeNull();
    }
  });
});
