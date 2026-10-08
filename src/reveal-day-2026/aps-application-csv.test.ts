import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contentHash } from "../normalization/hashes";
import { sha256Hex } from "../pipeline/content-store";
import {
  parseAndNormalizeApsApplicationCsv,
  parseApsApplicationExportArtifact,
} from "./aps-application-csv";
import { buildPublicationFromApsApplicationCsv } from "./build-publication-v2";
import {
  applicationGraphHashInput,
  APS_APPLICATION_CSV_ARTIFACT_ROLE,
  PUBLICATION_SCHEMA_VERSION_V20,
} from "./publication-v2-types";
import { validatePublicationSnapshot, validationFailed } from "./validate";
import { loadPublicationSnapshotFromPath, runDryRunIngestion } from "./dry-run";

const FIXTURE_DIR = join(process.cwd(), "src/reveal-day-2026/fixtures/aps-application-csv-synthetic");
const REVEAL_CSV = join(process.cwd(), ".data/reveal-2026/aps-capture/applications.csv");
const EXPECTED_REVEAL_HASH = "a3e2bdba5d3950e87f173e3f576413d9600a6651c99b6946c35bcfd0b9d3553b";

function loadFixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FIXTURE_DIR, name)));
}

function withBom(bytes: Uint8Array): Uint8Array {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return bytes;
  const out = new Uint8Array(bytes.length + 3);
  out[0] = 0xef;
  out[1] = 0xbb;
  out[2] = 0xbf;
  out.set(bytes, 3);
  return out;
}

function mutateCsv(bytes: Uint8Array, mutator: (text: string) => string): Uint8Array {
  let text = new TextDecoder("utf-8").decode(bytes);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return new TextEncoder().encode(mutator(text));
}

const officialAggregates = {
  officialApplicationCount: 3,
  officialApplicantCount: 3,
  provenance: {
    sourceName: "APS Statistics (synthetic test)",
    sourceUrl: "https://newgtldprogram-aps.icann.org/aps/applications/stats",
    retrievedAt: "2026-10-08T00:00:00Z",
    contentSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  },
};

const wdoExcluded = [
  {
    applicationId: "WDO2627T-T45217",
    primaryString: "wdo",
    applicant: "World Data Organization",
    location: "CN",
    region: "AP",
    applicationStatus: "Undergoing administrative check",
    sourceUrl: "https://newgtldprogram-aps.icann.org/applications/WDO2627T-T45217/summary",
    retrievedAt: "2026-10-08T04:12:50Z",
    notes: "Option A coverage exclusion only.",
  },
];

describe("APS Application CSV parser / publication 2.0.0", () => {
  it("normalizes a base application without replacement", () => {
    const parsed = parseAndNormalizeApsApplicationCsv(withBom(loadFixture("minimal-applications.csv")));
    const gamma = parsed.applications.find((a) => a.applicationId === "SYN2000T-T20001");
    expect(gamma).toBeTruthy();
    expect(gamma!.replacementString).toBeUndefined();
    expect(gamma!.appliedString.label).toBe("gamma");
    expect(gamma!.designations.brand).toBe(true);
    expect(gamma!.designations.idn).toBe(false);
  });

  it("attaches replacement to one logical application and preserves -R id", () => {
    const parsed = parseAndNormalizeApsApplicationCsv(withBom(loadFixture("minimal-applications.csv")));
    expect(parsed.applications).toHaveLength(2);
    expect(parsed.replacementCount).toBe(1);
    const alpha = parsed.applications.find((a) => a.applicationId === "SYN1000T-T10001");
    expect(alpha!.replacementString?.sourceRowId).toBe("SYN1000T-T10001-R");
    expect(alpha!.replacementString?.label).toBe("beta");
    expect(alpha!.appliedString.label).toBe("alpha");
    expect(alpha!.appliedString.sourceRowId).toBe("SYN1000T-T10001");
  });

  it("accepts -R + Replacement String as replacement and no -R + normal type as base", () => {
    const parsed = parseAndNormalizeApsApplicationCsv(withBom(loadFixture("minimal-applications.csv")));
    const alpha = parsed.applications.find((a) => a.applicationId === "SYN1000T-T10001")!;
    const gamma = parsed.applications.find((a) => a.applicationId === "SYN2000T-T20001")!;
    expect(alpha.replacementString?.sourceRowId.endsWith("-R")).toBe(true);
    expect(alpha.replacementString?.applicationType).toBe("Replacement String");
    expect(gamma.applicationId.endsWith("-R")).toBe(false);
    expect(gamma.applicationType).toBe("New gTLD");
    expect(gamma.replacementString).toBeUndefined();
  });

  it("rejects -R with non-replacement application type", () => {
    const bytes = mutateCsv(loadFixture("minimal-applications.csv"), (text) =>
      text.replace(
        ",SYN1000T-T10001-R,Alpha Applicant LLC,Replacement String,",
        ",SYN1000T-T10001-R,Alpha Applicant LLC,New gTLD,",
      ));
    expect(() => parseAndNormalizeApsApplicationCsv(withBom(bytes))).toThrow(/replacement indicators disagree/i);
  });

  it("rejects Replacement String without -R suffix", () => {
    const bytes = mutateCsv(loadFixture("minimal-applications.csv"), (text) =>
      text.replace(
        ",SYN1000T-T10001-R,Alpha Applicant LLC,Replacement String,",
        ",SYN1000T-T10001-X,Alpha Applicant LLC,Replacement String,",
      ));
    expect(() => parseAndNormalizeApsApplicationCsv(withBom(bytes))).toThrow(/replacement indicators disagree/i);
  });

  it("links replacement when -R row appears before base", () => {
    const parsed = parseAndNormalizeApsApplicationCsv(withBom(loadFixture("replacement-before-base.csv")));
    expect(parsed.applications).toHaveLength(1);
    expect(parsed.applications[0].replacementString?.label).toBe("beta");
    expect(parsed.applications[0].appliedString.label).toBe("alpha");
  });

  it("rejects unmatched -R", () => {
    const bytes = mutateCsv(loadFixture("minimal-applications.csv"), (text) =>
      text.replace("SYN1000T-T10001,", "SYN9999T-T99999,"));
    expect(() => parseAndNormalizeApsApplicationCsv(withBom(bytes))).toThrow(/unmatched replacement/i);
  });

  it("rejects inconsistent applicant on base/replacement", () => {
    const bytes = mutateCsv(loadFixture("minimal-applications.csv"), (text) => {
      // Change only the replacement applicant
      return text.replace(
        ",SYN1000T-T10001-R,Alpha Applicant LLC,Replacement String,",
        ",SYN1000T-T10001-R,Other Applicant LLC,Replacement String,",
      );
    });
    expect(() => parseAndNormalizeApsApplicationCsv(withBom(bytes))).toThrow(/applicant mismatch/i);
  });

  it("rejects duplicate source Application IDs", () => {
    const bytes = mutateCsv(loadFixture("minimal-applications.csv"), (text) => {
      const lines = text.split(/\r?\n/);
      const data = lines.filter((l) => l.includes("SYN2000T-T20001"));
      return `${text.trimEnd()}\n${data[0]}\n`;
    });
    expect(() => parseAndNormalizeApsApplicationCsv(withBom(bytes))).toThrow(/duplicate Application ID/i);
  });

  it("rejects malformed/missing Application headers", () => {
    const bytes = new TextEncoder().encode("not,a,header\n1,2,3\n");
    expect(() => parseAndNormalizeApsApplicationCsv(bytes)).toThrow(/header/i);
  });

  it("rejects contention CSV shape", () => {
    expect(() => parseAndNormalizeApsApplicationCsv(loadFixture("contention-shape.csv"))).toThrow(
      /contention CSV/i,
    );
  });

  it("requires artifact role for export entrypoint", () => {
    expect(() =>
      parseApsApplicationExportArtifact({
        artifactRole: "wrong-role",
        mediaType: "text/csv",
        bytes: withBom(loadFixture("minimal-applications.csv")),
      }),
    ).toThrow(/artifact role/i);
  });

  it("keeps explicit FALSE as false and omits empty optional string fields", () => {
    const parsed = parseAndNormalizeApsApplicationCsv(withBom(loadFixture("minimal-applications.csv")));
    const gamma = parsed.applications.find((a) => a.applicationId === "SYN2000T-T20001")!;
    expect(gamma.labels.inContentionExportLabel).toBe(false);
    expect(gamma.designations.community).toBe(false);
    expect(gamma.appliedString.unicodeLabel).toBeUndefined();
    expect(gamma.priority).toBeUndefined();
  });

  it("does not fabricate organization/category/returning/confidence", () => {
    const parsed = parseAndNormalizeApsApplicationCsv(withBom(loadFixture("minimal-applications.csv")));
    for (const app of parsed.applications) {
      const keys = Object.keys(app);
      expect(keys).not.toContain("organization");
      expect(keys).not.toContain("category");
      expect(keys).not.toContain("returning");
      expect(keys).not.toContain("confidence");
      expect(keys).not.toContain("contentionSet");
    }
  });

  it("builds 2.0.0 publication with distinct official vs observed coverage", () => {
    const bytes = withBom(loadFixture("minimal-applications.csv"));
    const result = buildPublicationFromApsApplicationCsv({
      bytes,
      artifactId: "aps-2026-application-export",
      sourceVersion: 1,
      captureId: "capture-synthetic-1",
      sourceUrl: "https://newgtldprogram-aps.icann.org/aps/applications/export/csv",
      sourceName: "APS Application CSV (synthetic)",
      retrievedAt: "2026-10-08T00:00:00Z",
      publishedAt: "2026-10-07T18:00:00Z",
      mediaType: "text/csv",
      artifactRole: APS_APPLICATION_CSV_ARTIFACT_ROLE,
      evidenceClass: "synthetic-aps-application-csv",
      snapshotId: "snap-synthetic-aps-csv-v1",
      recordedHttpStatus: 200,
      expectSourceHash: sha256Hex(bytes),
      officialAggregates,
      knownExcludedRecords: wdoExcluded,
    });
    expect(result.ok).toBe(true);
    expect(result.publication?.schemaVersion).toBe(PUBLICATION_SCHEMA_VERSION_V20);
    expect(result.publication?.applications).toHaveLength(2);
    expect(result.publication?.coverage.normalizedApplicationRecordsObserved).toBe(2);
    expect(result.publication?.officialAggregates.officialApplicationCount).toBe(3);
    expect(result.publication?.coverage.applicationRecordCoverage.completeness).toBe("partial");
    expect(result.publication?.coverage.applicationRecordCoverage.knownExcludedRecords[0].applicationId).toBe(
      "WDO2627T-T45217",
    );
    expect(result.review.promotionStatus).toBe("NOT_PROMOTED");
    expect(result.review.claimActualityWritten).toBe(false);
    expect(result.publication?.applications.some((a) => a.applicationId === "WDO2627T-T45217")).toBe(false);
  });

  it("application graph hash ignores retrievedAt", () => {
    const bytes = withBom(loadFixture("minimal-applications.csv"));
    const hash = sha256Hex(bytes);
    const a = buildPublicationFromApsApplicationCsv({
      bytes,
      artifactId: "aps-2026-application-export",
      sourceVersion: 1,
      captureId: "capture-synthetic-1",
      sourceUrl: "https://newgtldprogram-aps.icann.org/aps/applications/export/csv",
      sourceName: "APS Application CSV (synthetic)",
      retrievedAt: "2026-10-08T00:00:00Z",
      publishedAt: "2026-10-07T18:00:00Z",
      mediaType: "text/csv",
      artifactRole: APS_APPLICATION_CSV_ARTIFACT_ROLE,
      evidenceClass: "synthetic-aps-application-csv",
      snapshotId: "snap-synthetic-aps-csv-v1",
      recordedHttpStatus: 200,
      expectSourceHash: hash,
      officialAggregates,
      knownExcludedRecords: wdoExcluded,
    });
    const b = buildPublicationFromApsApplicationCsv({
      bytes,
      artifactId: "aps-2026-application-export",
      sourceVersion: 1,
      captureId: "capture-synthetic-1",
      sourceUrl: "https://newgtldprogram-aps.icann.org/aps/applications/export/csv",
      sourceName: "APS Application CSV (synthetic)",
      retrievedAt: "2099-01-01T00:00:00Z",
      publishedAt: "2026-10-07T18:00:00Z",
      mediaType: "text/csv",
      artifactRole: APS_APPLICATION_CSV_ARTIFACT_ROLE,
      evidenceClass: "synthetic-aps-application-csv",
      snapshotId: "snap-synthetic-aps-csv-v1",
      recordedHttpStatus: 200,
      expectSourceHash: hash,
      officialAggregates,
      knownExcludedRecords: wdoExcluded,
    });
    expect(a.ok && b.ok).toBe(true);
    expect(a.review.applicationGraphContentHash).toBe(b.review.applicationGraphContentHash);
    expect(contentHash(applicationGraphHashInput(a.publication!))).toBe(
      contentHash(applicationGraphHashInput(b.publication!)),
    );
  });

  it("application graph hash ignores aggregate/coverage enrichment-like metadata", () => {
    const bytes = withBom(loadFixture("minimal-applications.csv"));
    const hash = sha256Hex(bytes);
    const base = {
      bytes,
      artifactId: "aps-2026-application-export",
      sourceVersion: 1,
      captureId: "capture-synthetic-1",
      sourceUrl: "https://newgtldprogram-aps.icann.org/aps/applications/export/csv",
      sourceName: "APS Application CSV (synthetic)",
      retrievedAt: "2026-10-08T00:00:00Z",
      publishedAt: "2026-10-07T18:00:00Z",
      mediaType: "text/csv",
      artifactRole: APS_APPLICATION_CSV_ARTIFACT_ROLE,
      evidenceClass: "synthetic-aps-application-csv",
      snapshotId: "snap-synthetic-aps-csv-v1",
      recordedHttpStatus: 200,
      expectSourceHash: hash,
      knownExcludedRecords: wdoExcluded,
    } as const;
    const a = buildPublicationFromApsApplicationCsv({
      ...base,
      officialAggregates,
    });
    const b = buildPublicationFromApsApplicationCsv({
      ...base,
      officialAggregates: {
        ...officialAggregates,
        provenance: {
          ...officialAggregates.provenance,
          retrievedAt: "2099-01-01T00:00:00Z",
          contentSha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
      },
      knownExcludedRecords: [
        {
          ...wdoExcluded[0],
          notes: "Changed coverage notes must not alter application graph hash.",
          evidenceSha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        },
      ],
    });
    expect(a.ok && b.ok).toBe(true);
    expect(a.review.applicationGraphContentHash).toBe(b.review.applicationGraphContentHash);
    expect(a.review.officialAggregatesContentSha256).not.toBe(b.review.officialAggregatesContentSha256);
    expect(a.review.coverageDescriptorSha256).not.toBe(b.review.coverageDescriptorSha256);
  });

  it("keeps existing 1.1.0 synthetic rehearsal path green", async () => {
    const snapshot = await loadPublicationSnapshotFromPath(
      "src/reveal-day-2026/fixtures/rehearsal-2026-pipeline-v1/publication.snapshot.json",
    );
    const diagnostics = runDryRunIngestion(snapshot);
    expect(diagnostics.validation.ok).toBe(true);
    const { issues } = validatePublicationSnapshot(snapshot, { enforceProductionRowBounds: false });
    expect(validationFailed(issues)).toBe(false);
  });
});

describe("APS Application CSV real-source Reveal Day capture", () => {
  it("normalizes verified Reveal Day capture with official vs observed separation", () => {
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(readFileSync(REVEAL_CSV));
    } catch {
      expect.fail(`Missing Reveal Day capture at ${REVEAL_CSV}`);
      return;
    }
    const hash = sha256Hex(bytes);
    if (hash !== EXPECTED_REVEAL_HASH) {
      expect.fail(`SOURCE_CHANGED: expected ${EXPECTED_REVEAL_HASH}, got ${hash} bytes=${bytes.byteLength}`);
    }

    const aggregates = JSON.parse(
      readFileSync(join(process.cwd(), ".data/reveal-2026/aps-capture/official-aggregates.json"), "utf8"),
    ) as {
      officialApplicationCount: number;
      officialApplicantCount: number;
      retrievedAt: string;
      sourceUrl: string;
      contentSha256: string;
      lastPublishedAt?: string;
    };
    const wdo = JSON.parse(
      readFileSync(join(process.cwd(), ".data/reveal-2026/aps-capture/wdo-coverage-descriptor.json"), "utf8"),
    ) as {
      applicationId: string;
      primaryString: string;
      applicant: string;
      location: string;
      region: string;
      applicationStatus: string;
      applicationType?: string;
      processingStage?: string;
      sourceUrl: string;
      retrievedAt: string;
      evidenceSha256?: string;
      htmlSha256?: string;
      notes: string;
    };
    const wdoEvidenceSha256 = wdo.evidenceSha256 ?? wdo.htmlSha256;

    const result = buildPublicationFromApsApplicationCsv({
      bytes,
      artifactId: "aps-2026-application-export",
      sourceVersion: 1,
      captureId: "capture-reveal-day-2026-10-08",
      sourceUrl: "https://newgtldprogram-aps.icann.org/aps/applications/export/csv",
      sourceName: "ICANN APS Application CSV export",
      retrievedAt: "2026-10-08T04:11:53Z",
      publishedAt: "2026-10-07T18:00:00Z",
      mediaType: "text/csv;charset=UTF-8",
      artifactRole: APS_APPLICATION_CSV_ARTIFACT_ROLE,
      evidenceClass: "icann-aps-application-csv",
      snapshotId: "snap-aps-2026-applications-reveal-day-v1",
      recordedHttpStatus: 200,
      expectSourceHash: EXPECTED_REVEAL_HASH,
      officialAggregates: {
        officialApplicationCount: aggregates.officialApplicationCount,
        officialApplicantCount: aggregates.officialApplicantCount,
        provenance: {
          sourceName: "ICANN APS Statistics",
          sourceUrl: aggregates.sourceUrl,
          retrievedAt: aggregates.retrievedAt,
          contentSha256: aggregates.contentSha256,
          ...(aggregates.lastPublishedAt ? { lastPublishedAt: aggregates.lastPublishedAt } : {}),
        },
      },
      knownExcludedRecords: [
        {
          applicationId: wdo.applicationId,
          primaryString: wdo.primaryString,
          applicant: wdo.applicant,
          location: wdo.location,
          region: wdo.region,
          applicationStatus: wdo.applicationStatus,
          ...(wdo.applicationType ? { applicationType: wdo.applicationType } : {}),
          ...(wdo.processingStage ? { processingStage: wdo.processingStage } : {}),
          sourceUrl: wdo.sourceUrl,
          retrievedAt: wdo.retrievedAt,
          ...(wdoEvidenceSha256 ? { evidenceSha256: wdoEvidenceSha256 } : {}),
          notes: wdo.notes,
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.review.sourceRowCount).toBe(2783);
    expect(result.review.normalizedApplicationRecordsObserved).toBe(1614);
    expect(result.review.replacementCount).toBe(1169);
    expect(result.publication?.applications.filter((a) => a.replacementString).length).toBe(1169);
    expect(result.review.officialApplicationCount).toBe(1615);
    expect(result.review.officialApplicantCount).toBe(481);
    expect(result.review.observedDistinctApplicantNames).toBe(480);
    // Indicator agreement: every attached replacement has both -R id and Replacement String type.
    for (const app of result.publication!.applications) {
      if (!app.replacementString) continue;
      expect(app.replacementString.sourceRowId.endsWith("-R")).toBe(true);
      expect(app.replacementString.applicationType).toBe("Replacement String");
      expect(app.applicationId.endsWith("-R")).toBe(false);
    }
    expect(result.review.observedDistinctApplicantNames).not.toBe(result.review.officialApplicantCount);
    expect(result.review.normalizedApplicationRecordsObserved).not.toBe(result.review.officialApplicationCount);
    expect(result.review.applicationCoverageCompleteness).toBe("partial");
    expect(result.publication?.applications.some((a) => a.applicationId === "WDO2627T-T45217")).toBe(false);
    expect(result.publication?.coverage.applicationRecordCoverage.knownExcludedRecords).toHaveLength(1);
    expect(result.review.promotionStatus).toBe("NOT_PROMOTED");
    expect(result.review.claimActualityWritten).toBe(false);
    expect(result.review.qualityLines.join("\n")).toContain("APPLICATION COVERAGE: PARTIAL 1614/1615");
    expect(result.review.qualityLines.join("\n")).toContain("WDO2627T-T45217");

    // Determinism
    const again = buildPublicationFromApsApplicationCsv({
      bytes,
      artifactId: "aps-2026-application-export",
      sourceVersion: 1,
      captureId: "capture-reveal-day-2026-10-08",
      sourceUrl: "https://newgtldprogram-aps.icann.org/aps/applications/export/csv",
      sourceName: "ICANN APS Application CSV export",
      retrievedAt: "2099-01-01T00:00:00Z",
      publishedAt: "2026-10-07T18:00:00Z",
      mediaType: "text/csv;charset=UTF-8",
      artifactRole: APS_APPLICATION_CSV_ARTIFACT_ROLE,
      evidenceClass: "icann-aps-application-csv",
      snapshotId: "snap-aps-2026-applications-reveal-day-v1",
      recordedHttpStatus: 200,
      expectSourceHash: EXPECTED_REVEAL_HASH,
      officialAggregates: {
        officialApplicationCount: aggregates.officialApplicationCount,
        officialApplicantCount: aggregates.officialApplicantCount,
        provenance: {
          sourceName: "ICANN APS Statistics",
          sourceUrl: aggregates.sourceUrl,
          retrievedAt: aggregates.retrievedAt,
          contentSha256: aggregates.contentSha256,
        },
      },
      knownExcludedRecords: result.publication!.coverage.applicationRecordCoverage.knownExcludedRecords,
    });
    expect(again.review.applicationGraphContentHash).toBe(result.review.applicationGraphContentHash);
  });
});
