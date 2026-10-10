import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contentHash } from "../normalization/hashes";
import { sha256Hex } from "../pipeline/content-store";
import fixture from "@/data/fixtures/registry-applications.json";
import {
  EXACT_APPLIED_STRING_COMPETITION_METHOD,
  buildExactAppliedStringCompetition,
  type Application,
} from "@/lib/registry-data";
import {
  parseAndNormalizeApsContentionCsv,
  parseApsContentionExportArtifact,
} from "./aps-contention-csv";
import { buildContentionMembershipFromLocalArtifact } from "./build-contention-membership";
import {
  APS_CONTENTION_CSV_ARTIFACT_ROLE,
  CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
  OFFICIAL_VS_EXACT_STRING_NOTE,
  contentionSidecarHashInput,
} from "./contention-membership-types";
import {
  applicationGraphHashInput,
  PUBLICATION_SCHEMA_VERSION_V20,
  type Registry2026ApplicationV2,
  type Registry2026PublicationV2,
} from "./publication-v2-types";

const FIXTURE_DIR = join(process.cwd(), "src/reveal-day-2026/fixtures/aps-contention-csv-synthetic");
const REVEAL_CONTENTION_CSV = join(process.cwd(), ".data/reveal-2026/aps-capture/reveal-day-contention-sets.csv");
const REVEAL_APP_PUBLICATION = join(
  process.cwd(),
  ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json",
);
const EXPECTED_CONTENTION_HASH = "86f2ebd3764d1f3ea21d5d844cff004e271a443a3431e8ac440da7f72c67e2bf";
const EXPECTED_APP_GRAPH_HASH = "09e75b1c83baa2a7466033de991332f396b108dc3d8c0775d3c17d99ec6b45d2";

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

function stubApp(applicationId: string, label: string): Registry2026ApplicationV2 {
  return {
    applicationId,
    applicant: `${applicationId} Applicant`,
    country: "US",
    region: "NA",
    applicationStatus: "Active",
    processingStage: "Pre-Evaluation Processing",
    applicationType: "New gTLD",
    designations: {
      brand: false,
      community: false,
      geoSelfDesignated: false,
      geoStringReviewConfirmed: false,
      idn: false,
    },
    labels: {
      gacEarlyWarning: false,
      gacAdvice: false,
      highRiskString: false,
      objection: false,
      safeguard: false,
      inContentionExportLabel: false,
      clarifyingQuestions: false,
      changeRequest: false,
      openCommentPeriod: false,
      comments: false,
      rvc: false,
      applicantSupport: false,
      variantOnlyExistingTld: false,
      variantIncluded: false,
      cocExemption: false,
      reservedName: false,
      cpe: false,
      singularPlural: false,
    },
    appliedString: { sourceRowId: applicationId, label },
  };
}

function makePinnedPublication(appIds: Array<{ id: string; label: string }>): Registry2026PublicationV2 {
  const applications = appIds.map((a) => stubApp(a.id, a.label)).sort((a, b) =>
    a.applicationId.localeCompare(b.applicationId)
  );
  const draft: Registry2026PublicationV2 = {
    schemaVersion: PUBLICATION_SCHEMA_VERSION_V20,
    publicationKind: "immutable-publication",
    snapshotId: "snap-synthetic-app-for-contention",
    publishedAt: "2026-10-07T18:00:00Z",
    retrievedAt: "2026-10-08T00:00:00Z",
    parserVersion: "aps-2026-application-csv-parser/1.0.0",
    normalizerVersion: "aps-2026-application-csv-normalizer/1.0.0",
    source: { name: "synthetic", url: "https://example.test/apps.csv", evidenceClass: "synthetic" },
    limitations: ["synthetic"],
    officialAggregates: {
      officialApplicationCount: applications.length + 1,
      officialApplicantCount: applications.length + 1,
      provenance: {
        sourceName: "synthetic",
        sourceUrl: "https://example.test/stats",
        retrievedAt: "2026-10-08T00:00:00Z",
        contentSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
    },
    coverage: {
      sourceRowCount: applications.length,
      normalizedApplicationRecordsObserved: applications.length,
      applicationRecordCoverage: {
        observed: applications.length,
        official: applications.length + 1,
        completeness: "partial",
        knownExcludedRecords: [],
      },
    },
    lineage: {
      intakeAdapterVersion: "aps-2026-application-csv-parser/1.0.0",
      artifactRole: "aps-2026-application-export",
      rawSha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      pipelineSourceId: "synthetic",
      pipelineSourceVersion: 1,
      manifestAttemptId: "capture-synthetic",
      fetchUrl: "https://example.test/apps.csv",
      retrievedAt: "2026-10-08T00:00:00Z",
      httpStatus: 200,
      adapterId: "local-artifact",
      adapterSchemaVersion: "local-artifact-adapter/1.0.0",
      redirectChain: [],
      responseHeaderDigest: null,
    },
    supplementalArtifactPins: {
      contentionMembershipSchema: "registry-2026-contention-membership/1.0.0",
      contentionMembershipPin: null,
    },
    bundleManifest: {
      officialAggregatesContentSha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      coverageDescriptorSha256: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      applicationGraphContentSha256: "",
    },
    applications,
  };
  draft.bundleManifest.applicationGraphContentSha256 = contentHash(applicationGraphHashInput(draft));
  return draft;
}

const validApps = [
  { id: "SYN1000T-T10001", label: "alpha" },
  { id: "SYN2000T-T20001", label: "alpha" },
  { id: "SYN3000T-T30001", label: "beta" },
  { id: "SYN3000T-T30002", label: "beta" },
  { id: "SYN3000T-T30003", label: "beta" },
];

describe("APS Contention CSV parser / membership 1.0.0", () => {
  it("parses a valid two-member set and multiple sets", () => {
    const parsed = parseAndNormalizeApsContentionCsv(withBom(loadFixture("valid-sets.csv")));
    expect(parsed.contentionSets).toHaveLength(2);
    expect(parsed.sourceMembershipRowCount).toBe(5);
    const set1 = parsed.contentionSets.find((s) => s.officialContentionSetId === "1")!;
    expect(set1.members).toHaveLength(2);
    expect(set1.members.map((m) => m.applicationId).sort()).toEqual([
      "SYN1000T-T10001",
      "SYN2000T-T20001",
    ]);
  });

  it("preserves set size >2 and official set id", () => {
    const parsed = parseAndNormalizeApsContentionCsv(withBom(loadFixture("large-set.csv")));
    expect(parsed.contentionSets).toHaveLength(1);
    expect(parsed.contentionSets[0].officialContentionSetId).toBe("9");
    expect(parsed.contentionSets[0].members).toHaveLength(4);
  });

  it("rejects missing set id", () => {
    const bytes = mutateCsv(loadFixture("valid-sets.csv"), (text) =>
      text.replace(/^1,/m, ","));
    expect(() => parseAndNormalizeApsContentionCsv(withBom(bytes))).toThrow(/missing set identifier/i);
  });

  it("rejects missing Application ID", () => {
    const bytes = mutateCsv(loadFixture("valid-sets.csv"), (text) =>
      text.replace('"SYN1000T-T10001"', '""'));
    expect(() => parseAndNormalizeApsContentionCsv(withBom(bytes))).toThrow(/missing Application ID/i);
  });

  it("rejects -R member", () => {
    const bytes = mutateCsv(loadFixture("valid-sets.csv"), (text) =>
      text.replace("SYN1000T-T10001", "SYN1000T-T10001-R"));
    expect(() => parseAndNormalizeApsContentionCsv(withBom(bytes))).toThrow(/replacement -R/i);
  });

  it("rejects duplicate membership", () => {
    const bytes = mutateCsv(loadFixture("valid-sets.csv"), (text) => {
      const line = text.split(/\r?\n/).find((l) => l.includes("SYN1000T-T10001"))!;
      return `${text.trimEnd()}\n${line}\n`;
    });
    expect(() => parseAndNormalizeApsContentionCsv(withBom(bytes))).toThrow(/duplicate membership/i);
  });

  it("rejects malformed header", () => {
    expect(() => parseAndNormalizeApsContentionCsv(new TextEncoder().encode("a,b,c\n1,2,3\n"))).toThrow(
      /header/i,
    );
  });

  it("rejects Application CSV shape", () => {
    expect(() => parseAndNormalizeApsContentionCsv(loadFixture("application-shape.csv"))).toThrow(
      /Application CSV/i,
    );
  });

  it("requires artifact role", () => {
    expect(() =>
      parseApsContentionExportArtifact({
        artifactRole: "wrong",
        mediaType: "text/csv",
        bytes: withBom(loadFixture("valid-sets.csv")),
      }),
    ).toThrow(/artifact role/i);
  });

  it("retains Org Name as publishedOrgName and preserves applied-for strings", () => {
    const parsed = parseAndNormalizeApsContentionCsv(withBom(loadFixture("valid-sets.csv")));
    const member = parsed.contentionSets[0].members.find((m) => m.applicationId === "SYN1000T-T10001")!;
    expect(member.publishedOrgName).toBe("Alpha Applicant LLC");
    expect(member.appliedForStringsAsPublished).toBe("alpha");
    expect(Object.keys(member)).not.toContain("organization");
    expect(Object.keys(member)).not.toContain("resolvedOrganization");
  });

  it("builds sidecar with publication pin and rejects unknown Application ID", () => {
    const bytes = withBom(loadFixture("valid-sets.csv"));
    const publication = makePinnedPublication(validApps);
    const ok = buildContentionMembershipFromLocalArtifact({
      bytes,
      artifactId: "aps-2026-reveal-day-contention",
      sourceVersion: 1,
      captureId: "capture-contention-synthetic-1",
      sourceUrl: "https://newgtldprogram.icann.org/en/application-rounds/round2/reveal-day-contention-sets.csv",
      sourceName: "Reveal Day contention CSV (synthetic)",
      retrievedAt: "2026-10-08T00:00:00Z",
      publishedAt: "2026-10-07T18:00:00Z",
      mediaType: "text/csv",
      artifactRole: APS_CONTENTION_CSV_ARTIFACT_ROLE,
      evidenceClass: "icann-reveal-day-contention-csv",
      snapshotId: "snap-synthetic-contention-v1",
      recordedHttpStatus: 200,
      expectSourceHash: sha256Hex(bytes),
      applicationPublication: publication,
      expectApplicationGraphHash: publication.bundleManifest.applicationGraphContentSha256,
    });
    expect(ok.ok).toBe(true);
    expect(ok.snapshot?.schemaVersion).toBe(CONTENTION_MEMBERSHIP_SCHEMA_VERSION);
    expect(ok.review.promotionStatus).toBe("NOT_PROMOTED");
    expect(ok.review.claimActualityWritten).toBe(false);
    expect(ok.review.applicationPublicationMutated).toBe(false);
    expect(ok.evidenceBundle?.applicationPublication.supplementalContentionPinOnPublication).toBeNull();
    expect(publication.supplementalArtifactPins.contentionMembershipPin).toBeNull();

    const missingPub = makePinnedPublication(validApps.slice(0, 2));
    const bad = buildContentionMembershipFromLocalArtifact({
      bytes,
      artifactId: "aps-2026-reveal-day-contention",
      sourceVersion: 1,
      captureId: "capture-contention-synthetic-1",
      sourceUrl: "https://newgtldprogram.icann.org/en/application-rounds/round2/reveal-day-contention-sets.csv",
      sourceName: "Reveal Day contention CSV (synthetic)",
      retrievedAt: "2026-10-08T00:00:00Z",
      publishedAt: "2026-10-07T18:00:00Z",
      mediaType: "text/csv",
      artifactRole: APS_CONTENTION_CSV_ARTIFACT_ROLE,
      evidenceClass: "icann-reveal-day-contention-csv",
      snapshotId: "snap-synthetic-contention-v1",
      recordedHttpStatus: 200,
      expectSourceHash: sha256Hex(bytes),
      applicationPublication: missingPub,
      expectApplicationGraphHash: missingPub.bundleManifest.applicationGraphContentSha256,
    });
    expect(bad.ok).toBe(false);
    expect(bad.review.errors.join(" ")).toMatch(/Unknown Application ID/i);
  });

  it("rejects wrong Application publication pin hash", () => {
    const bytes = withBom(loadFixture("valid-sets.csv"));
    const publication = makePinnedPublication(validApps);
    const result = buildContentionMembershipFromLocalArtifact({
      bytes,
      artifactId: "aps-2026-reveal-day-contention",
      sourceVersion: 1,
      captureId: "capture-contention-synthetic-1",
      sourceUrl: "https://newgtldprogram.icann.org/en/application-rounds/round2/reveal-day-contention-sets.csv",
      sourceName: "Reveal Day contention CSV (synthetic)",
      retrievedAt: "2026-10-08T00:00:00Z",
      publishedAt: "2026-10-07T18:00:00Z",
      mediaType: "text/csv",
      artifactRole: APS_CONTENTION_CSV_ARTIFACT_ROLE,
      evidenceClass: "icann-reveal-day-contention-csv",
      snapshotId: "snap-synthetic-contention-v1",
      recordedHttpStatus: 200,
      expectSourceHash: sha256Hex(bytes),
      applicationPublication: publication,
      expectApplicationGraphHash: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    });
    expect(result.ok).toBe(false);
    expect(result.review.errors.join(" ")).toMatch(/pin mismatch/i);
  });

  it("sidecar content hash is deterministic and ignores retrievedAt", () => {
    const bytes = withBom(loadFixture("valid-sets.csv"));
    const publication = makePinnedPublication(validApps);
    const hash = sha256Hex(bytes);
    const pin = publication.bundleManifest.applicationGraphContentSha256;
    const a = buildContentionMembershipFromLocalArtifact({
      bytes,
      artifactId: "aps-2026-reveal-day-contention",
      sourceVersion: 1,
      captureId: "capture-contention-synthetic-1",
      sourceUrl: "https://newgtldprogram.icann.org/en/application-rounds/round2/reveal-day-contention-sets.csv",
      sourceName: "Reveal Day contention CSV (synthetic)",
      retrievedAt: "2026-10-08T00:00:00Z",
      publishedAt: "2026-10-07T18:00:00Z",
      mediaType: "text/csv",
      artifactRole: APS_CONTENTION_CSV_ARTIFACT_ROLE,
      evidenceClass: "icann-reveal-day-contention-csv",
      snapshotId: "snap-synthetic-contention-v1",
      recordedHttpStatus: 200,
      expectSourceHash: hash,
      applicationPublication: publication,
      expectApplicationGraphHash: pin,
    });
    const b = buildContentionMembershipFromLocalArtifact({
      bytes,
      artifactId: "aps-2026-reveal-day-contention",
      sourceVersion: 1,
      captureId: "capture-contention-synthetic-1",
      sourceUrl: "https://newgtldprogram.icann.org/en/application-rounds/round2/reveal-day-contention-sets.csv",
      sourceName: "Reveal Day contention CSV (synthetic)",
      retrievedAt: "2099-01-01T00:00:00Z",
      publishedAt: "2026-10-07T18:00:00Z",
      mediaType: "text/csv",
      artifactRole: APS_CONTENTION_CSV_ARTIFACT_ROLE,
      evidenceClass: "icann-reveal-day-contention-csv",
      snapshotId: "snap-synthetic-contention-v1",
      recordedHttpStatus: 200,
      expectSourceHash: hash,
      applicationPublication: publication,
      expectApplicationGraphHash: pin,
    });
    expect(a.ok && b.ok).toBe(true);
    expect(a.review.sidecarContentHash).toBe(b.review.sidecarContentHash);
    expect(contentHash(contentionSidecarHashInput(a.snapshot!))).toBe(
      contentHash(contentionSidecarHashInput(b.snapshot!)),
    );
  });

  it("normalized semantic hash ignores CSV row order, set order, and sourceRowIndex", () => {
    const ordered = withBom(loadFixture("valid-sets.csv"));
    const reorderedText = `\uFEFF"#","Application ID","Org Name","Applied-for string(s)"\r
2,"SYN3000T-T30002","Delta Partners","beta"\r
1,"SYN2000T-T20001","Beta Applicant Inc","alpha"\r
2,"SYN3000T-T30001","Gamma Holdings","beta"\r
2,"SYN3000T-T30003","Epsilon Group","beta"\r
1,"SYN1000T-T10001","Alpha Applicant LLC","alpha"\r
`;
    const reordered = new TextEncoder().encode(reorderedText);
    const publication = makePinnedPublication(validApps);
    const pin = publication.bundleManifest.applicationGraphContentSha256;
    const build = (bytes: Uint8Array) =>
      buildContentionMembershipFromLocalArtifact({
        bytes,
        artifactId: "aps-2026-reveal-day-contention",
        sourceVersion: 1,
        captureId: "capture-contention-synthetic-1",
        sourceUrl: "https://newgtldprogram.icann.org/en/application-rounds/round2/reveal-day-contention-sets.csv",
        sourceName: "Reveal Day contention CSV (synthetic)",
        retrievedAt: "2026-10-08T00:00:00Z",
        publishedAt: "2026-10-07T18:00:00Z",
        mediaType: "text/csv",
        artifactRole: APS_CONTENTION_CSV_ARTIFACT_ROLE,
        evidenceClass: "icann-reveal-day-contention-csv",
        snapshotId: "snap-synthetic-contention-v1",
        recordedHttpStatus: 200,
        expectSourceHash: sha256Hex(bytes),
        applicationPublication: publication,
        expectApplicationGraphHash: pin,
      });
    const a = build(ordered);
    const b = build(reordered);
    expect(a.ok && b.ok).toBe(true);
    expect(a.review.sidecarContentHash).toBe(b.review.sidecarContentHash);
    // Raw SHA remains order-sensitive.
    expect(sha256Hex(ordered)).not.toBe(sha256Hex(reordered));
    expect(a.review.sourceHash).not.toBe(b.review.sourceHash);

    // sourceRowIndex-only mutation must not change semantic hash.
    const mutated = structuredClone(a.snapshot!);
    for (const set of mutated.contentionSets) {
      for (const member of set.members) member.sourceRowIndex += 1000;
    }
    expect(contentHash(contentionSidecarHashInput(mutated))).toBe(a.review.sidecarContentHash);

    // Set array order on snapshot object must not change semantic hash.
    const setSwapped = structuredClone(a.snapshot!);
    setSwapped.contentionSets = [...setSwapped.contentionSets].reverse();
    expect(contentHash(contentionSidecarHashInput(setSwapped))).toBe(a.review.sidecarContentHash);
  });

  it("normalized semantic hash changes when membership semantics change", () => {
    const bytes = withBom(loadFixture("valid-sets.csv"));
    const publication = makePinnedPublication(validApps);
    const result = buildContentionMembershipFromLocalArtifact({
      bytes,
      artifactId: "aps-2026-reveal-day-contention",
      sourceVersion: 1,
      captureId: "capture-contention-synthetic-1",
      sourceUrl: "https://newgtldprogram.icann.org/en/application-rounds/round2/reveal-day-contention-sets.csv",
      sourceName: "Reveal Day contention CSV (synthetic)",
      retrievedAt: "2026-10-08T00:00:00Z",
      publishedAt: "2026-10-07T18:00:00Z",
      mediaType: "text/csv",
      artifactRole: APS_CONTENTION_CSV_ARTIFACT_ROLE,
      evidenceClass: "icann-reveal-day-contention-csv",
      snapshotId: "snap-synthetic-contention-v1",
      recordedHttpStatus: 200,
      expectSourceHash: sha256Hex(bytes),
      applicationPublication: publication,
      expectApplicationGraphHash: publication.bundleManifest.applicationGraphContentSha256,
    });
    expect(result.ok).toBe(true);
    const baseHash = result.review.sidecarContentHash!;

    const changeAppId = structuredClone(result.snapshot!);
    changeAppId.contentionSets[0].members[0].applicationId = "SYN9999T-T99999";
    expect(contentHash(contentionSidecarHashInput(changeAppId))).not.toBe(baseHash);

    const changeSetId = structuredClone(result.snapshot!);
    changeSetId.contentionSets[0].officialContentionSetId = "99";
    expect(contentHash(contentionSidecarHashInput(changeSetId))).not.toBe(baseHash);

    const changeString = structuredClone(result.snapshot!);
    changeString.contentionSets[0].members[0].appliedForStringsAsPublished = "changed-string";
    expect(contentHash(contentionSidecarHashInput(changeString))).not.toBe(baseHash);

    const changeOrg = structuredClone(result.snapshot!);
    changeOrg.contentionSets[0].members[0].publishedOrgName = "Changed Org Name LLC";
    expect(contentHash(contentionSidecarHashInput(changeOrg))).not.toBe(baseHash);

    const changePin = structuredClone(result.snapshot!);
    changePin.applicationPublicationPin = {
      ...changePin.applicationPublicationPin,
      applicationGraphContentSha256: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    };
    expect(contentHash(contentionSidecarHashInput(changePin))).not.toBe(baseHash);
  });

  it("keeps exact-string method separate and untouched", () => {
    const base = fixture.applications[0] as Application;
    const row = (overrides: Partial<Application> & { id: string; string: string }): Application =>
      ({ ...base, contentionSet: null, replacement: null, aLabel: undefined, ...overrides }) as Application;
    const competition = buildExactAppliedStringCompetition([
      row({ id: "1", string: "alpha" }),
      row({ id: "2", string: "alpha" }),
    ]);
    expect(competition.method).toBe(EXACT_APPLIED_STRING_COMPETITION_METHOD);
    expect(competition.method).not.toBe(CONTENTION_MEMBERSHIP_SCHEMA_VERSION);
    expect(OFFICIAL_VS_EXACT_STRING_NOTE).toContain("EXACT-STRING");
  });
});

describe("APS Contention CSV real-source Reveal Day capture", () => {
  it("normalizes verified contention CSV against pinned Application 2.0.0 publication", () => {
    let bytes: Uint8Array;
    let publication: Registry2026PublicationV2;
    try {
      bytes = new Uint8Array(readFileSync(REVEAL_CONTENTION_CSV));
      publication = JSON.parse(readFileSync(REVEAL_APP_PUBLICATION, "utf8")) as Registry2026PublicationV2;
    } catch {
      expect.fail("Missing Reveal Day contention CSV or Application publication artifact");
      return;
    }
    const hash = sha256Hex(bytes);
    if (hash !== EXPECTED_CONTENTION_HASH) {
      expect.fail(`SOURCE_CHANGED: expected ${EXPECTED_CONTENTION_HASH}, got ${hash} bytes=${bytes.byteLength}`);
    }
    expect(publication.schemaVersion).toBe(PUBLICATION_SCHEMA_VERSION_V20);
    expect(publication.applications).toHaveLength(1614);
    expect(publication.coverage.applicationRecordCoverage.completeness).toBe("partial");
    const appGraph = contentHash(applicationGraphHashInput(publication));
    expect(appGraph).toBe(EXPECTED_APP_GRAPH_HASH);
    expect(publication.bundleManifest.applicationGraphContentSha256).toBe(EXPECTED_APP_GRAPH_HASH);
    expect(publication.supplementalArtifactPins.contentionMembershipPin).toBeNull();

    const beforePin = publication.supplementalArtifactPins.contentionMembershipPin;
    const result = buildContentionMembershipFromLocalArtifact({
      bytes,
      artifactId: "aps-2026-reveal-day-contention",
      sourceVersion: 1,
      captureId: "capture-reveal-day-contention-2026-10-08",
      sourceUrl: "https://newgtldprogram.icann.org/en/application-rounds/round2/reveal-day-contention-sets.csv",
      finalUrl: "https://newgtldprogram.icann.org/sites/default/files/documents/reveal-day-contention-sets.csv",
      sourceName: "ICANN Reveal Day contention sets CSV",
      retrievedAt: "2026-10-08T05:38:20Z",
      publishedAt: "2026-10-07T18:00:00Z",
      mediaType: "text/csv;charset=UTF-8",
      artifactRole: APS_CONTENTION_CSV_ARTIFACT_ROLE,
      evidenceClass: "icann-reveal-day-contention-csv",
      snapshotId: "snap-aps-2026-contention-reveal-day-v1",
      recordedHttpStatus: 200,
      expectSourceHash: EXPECTED_CONTENTION_HASH,
      applicationPublication: publication,
      expectApplicationGraphHash: EXPECTED_APP_GRAPH_HASH,
      redirectChain: [
        "https://newgtldprogram.icann.org/en/application-rounds/round2/reveal-day-contention-sets.csv",
        "https://newgtldprogram.icann.org/sites/default/files/documents/reveal-day-contention-sets.csv",
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.review.sourceMembershipRowCount).toBe(891);
    expect(result.review.officialContentionSetCount).toBe(263);
    expect(result.review.joinedMemberCount).toBe(891);
    expect(result.review.unjoinedMemberCount).toBe(0);
    expect(result.review.replacementIdCount).toBe(0);
    expect(result.review.minSetSize).toBe(2);
    expect(result.review.maxSetSize).toBe(13);
    expect(result.review.applicationsAppearingInMultipleSets).toBe(0);
    expect(result.review.wdoPresentInContentionSource).toBe(false);
    expect(result.review.promotionStatus).toBe("NOT_PROMOTED");
    expect(result.review.claimActualityWritten).toBe(false);
    expect(result.review.applicationPublicationMutated).toBe(false);
    expect(publication.supplementalArtifactPins.contentionMembershipPin).toBe(beforePin);
    expect(publication.coverage.applicationRecordCoverage.completeness).toBe("partial");
    expect(publication.coverage.normalizedApplicationRecordsObserved).toBe(1614);
    expect(result.review.qualityLines.join("\n")).toContain("SOURCE MEMBERSHIP ROWS: 891");
    expect(result.review.qualityLines.join("\n")).toContain(OFFICIAL_VS_EXACT_STRING_NOTE);
    expect(result.snapshot?.quality.applicationCoverageUnchangedByContentionJoin).toBe(true);
    // Hash-boundary correction: old order-sensitive hash must not be re-emitted.
    expect(result.review.sidecarContentHash).not.toBe(
      "0e7aeea4b2a1f5a541da5d5eb7c747595b1a0a686547da6d2c27b65b53453a5d",
    );
    expect(result.review.sourceHash).toBe(EXPECTED_CONTENTION_HASH);
    expect(result.review.claimActualityWritten).toBe(false);
    expect(result.review.promotionStatus).toBe("NOT_PROMOTED");
  });
});
