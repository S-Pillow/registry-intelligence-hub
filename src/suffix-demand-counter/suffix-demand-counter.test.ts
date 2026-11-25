import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FORECAST_V1_EXAMPLE_STRINGS } from "@/lib/registration-forecast";
import {
  REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20,
  type BrowserApplicationV2,
} from "@/lib/registry-applications-document-v2";
import { resolveObservedProposedStringCandidates, toMeasurableDnsIdentity } from "./candidates";
import { runSuffixDemandCounter, stableStringify } from "./counter";
import {
  buildActiveDnsListText,
  gzipList,
  sha256HexBuffer,
  writeSyntheticMidPanel,
} from "./fixtures";
import { normalizeAsciiLabel, sldMatchesCandidate } from "./match";
import { parseRegistrableDomainForTld } from "./parse-domain";
import { buildSuffixMatchIndex } from "./suffix-trie";
import { MID_PANEL_TLDS } from "./types";

async function tempRoot(label: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), `rih-fcast-04b-${label}-`));
}

function emptyMidPanelFiles(
  overrides: Partial<Record<(typeof MID_PANEL_TLDS)[number], string[]>> = {},
): Array<{ tld: (typeof MID_PANEL_TLDS)[number]; domains: string[] }> {
  return MID_PANEL_TLDS.map((tld) => ({
    tld,
    domains: overrides[tld] ?? [],
  }));
}

function emptyLabels() {
  return {
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
  };
}

function mkApp(
  partial: Partial<BrowserApplicationV2> &
    Pick<BrowserApplicationV2, "applicationId" | "applicant" | "appliedString">,
): BrowserApplicationV2 {
  return {
    country: "US",
    region: "NA",
    applicationStatus: "Active",
    processingStage: "String Evaluation Processing",
    applicationType: "New gTLD",
    designations: {
      idn: false,
      brand: false,
      community: false,
      geoSelfDesignated: false,
      geoStringReviewConfirmed: false,
    },
    labels: emptyLabels(),
    officialContention: {
      membershipPresent: false,
      officialContentionSetIds: [],
      terminology: "official-initial-contention",
    },
    ...partial,
  };
}

function mkApplicationsDocument(
  applications: BrowserApplicationV2[],
  extras: Record<string, unknown> = {},
) {
  return {
    payloadVersion: REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20,
    payloadMode: "inactive-2x",
    snapshotId: "test-snapshot-fcast-04b",
    snapshotContentHash: "abc123contenthash",
    officialApplications: extras.officialApplications ?? applications.length + 1,
    observedApplicationRecords: extras.observedApplicationRecords ?? applications.length,
    applicationRecordCoverage: extras.applicationRecordCoverage ?? {
      observed: applications.length,
      official: (extras.officialApplications as number | undefined) ?? applications.length + 1,
      completeness: "partial",
      knownExcludedRecords: extras.knownExcludedRecords ?? [],
    },
    knownExcludedRecords: extras.knownExcludedRecords ?? [],
    applications,
    publishedAt: "2026-10-07T18:00:00Z",
    ...extras,
  };
}

describe("suffix-demand matching policy", () => {
  it("normalizes ASCII case and rejects non-ASCII", () => {
    expect(normalizeAsciiLabel("  Hub ")).toBe("hub");
    expect(normalizeAsciiLabel("hüb")).toBeNull();
  });

  it("matches equals and literal endsWith only", () => {
    expect(sldMatchesCandidate("hub", "hub")).toBe(true);
    expect(sldMatchesCandidate("myhub", "hub")).toBe(true);
    expect(sldMatchesCandidate("hubify", "hub")).toBe(false);
  });

  it("parses only exact SLD.TLD registrable forms for the reference TLD", () => {
    expect(parseRegistrableDomainForTld("Example.NET", "net")).toEqual({
      domain: "example.net",
      sld: "example",
      tld: "net",
    });
    expect(parseRegistrableDomainForTld("a.b.net", "net")).toBeNull();
  });

  it("reversed suffix trie preserves equals/endsWith semantics", () => {
    const index = buildSuffixMatchIndex(["hub", "api", "stack"]);
    expect([...index.matchAll("myhub")].sort()).toEqual(["hub"]);
    expect([...index.matchAll("hubify")]).toEqual([]);
  });

  it("DNS identity accepts A-labels and rejects bare Unicode", () => {
    expect(toMeasurableDnsIdentity("xn--ces6a")).toEqual({ ok: true, label: "xn--ces6a" });
    expect(toMeasurableDnsIdentity("WDO")).toEqual({ ok: true, label: "wdo" });
    const uni = toMeasurableDnsIdentity("网絡");
    expect(uni.ok).toBe(false);
    if (!uni.ok) expect(uni.reason).toMatch(/unicode-label-without-a-label/i);
  });
});

describe("offline suffix-demand counter", () => {
  it("counts distinct FQDNs across TLDs with sorted adjacent duplicate suppression", async () => {
    const root = await tempRoot("count");
    const dataOut = path.join(root, ".data", "suffix-demand", "aggregate.json");
    const { inputDir, manifestPath } = await writeSyntheticMidPanel({
      dir: path.join(root, "panel"),
      snapshotDate: "2026-11-07",
      files: [
        {
          tld: "net",
          domains: ["foo.org", "hub.net", "hub.net", "myhub.net", "not-a-domain", "other.net"],
        },
        { tld: "org", domains: ["force.org", "hub.org"] },
        { tld: "info", domains: ["connect.info"] },
        { tld: "biz", domains: [] },
        { tld: "app", domains: ["mystack.app"] },
        { tld: "dev", domains: ["api.dev", "bold.dev"] },
      ],
    });

    const result = await runSuffixDemandCounter({
      inputDir,
      manifestPath,
      outputPath: dataOut,
      cwd: root,
      candidates: FORECAST_V1_EXAMPLE_STRINGS,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const by = Object.fromEntries(result.aggregate.strings.map((s) => [s.stringLabel, s.domainCount]));
    expect(by.hub).toBe(3);
    expect(result.aggregate.schemaVersion).toBe(3);
    expect(result.aggregate.domainScan.status).toBe("complete");
    expect(result.aggregate.applicationCensus.assertsCompleteRoundInventory).toBe(false);
    expect(result.aggregate.processing.duplicateRecords).toBe(1);
  });

  it("fails closed on unsorted input and writes no aggregate", async () => {
    const root = await tempRoot("unsorted");
    const out = path.join(root, ".data", "out.json");
    const { inputDir, manifestPath } = await writeSyntheticMidPanel({
      dir: path.join(root, "panel"),
      snapshotDate: "2026-11-07",
      files: emptyMidPanelFiles({ net: ["zebra.net", "apple.net"] }),
    });
    const result = await runSuffixDemandCounter({
      inputDir,
      manifestPath,
      outputPath: out,
      cwd: root,
      candidates: ["hub"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.reason).toMatch(/Unsorted/i);
    await expect(readFile(out, "utf8")).rejects.toThrow();
  });

  it("allows a fully verified panel to produce legitimate zeros", async () => {
    const root = await tempRoot("zeros");
    const { inputDir, manifestPath } = await writeSyntheticMidPanel({
      dir: path.join(root, "panel"),
      snapshotDate: "2026-11-07",
      files: emptyMidPanelFiles({ net: ["alpha.net"], org: ["beta.org"] }),
    });
    const result = await runSuffixDemandCounter({
      inputDir,
      manifestPath,
      outputPath: path.join(root, ".data", "out.json"),
      cwd: root,
      candidates: ["hub", "force"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.aggregate.strings.every((s) => s.domainCount === 0)).toBe(true);
  });

  it("rejects SHA-256 mismatches without emitting available zeros", async () => {
    const root = await tempRoot("sha");
    const { inputDir, manifestPath, manifest } = await writeSyntheticMidPanel({
      dir: path.join(root, "panel"),
      snapshotDate: "2026-11-07",
      files: emptyMidPanelFiles({ net: ["hub.net"] }),
    });
    manifest.panel[0].sha256 = "0".repeat(64);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const out = path.join(root, ".data", "out.json");
    const result = await runSuffixDemandCounter({
      inputDir,
      manifestPath,
      outputPath: out,
      cwd: root,
      candidates: ["hub"],
    });
    expect(result.ok).toBe(false);
    await expect(readFile(out, "utf8")).rejects.toThrow();
  });

  it("rejects header metadata mismatches", async () => {
    const root = await tempRoot("header");
    const { inputDir, manifestPath } = await writeSyntheticMidPanel({
      dir: path.join(root, "panel"),
      snapshotDate: "2026-11-07",
      files: emptyMidPanelFiles({ net: ["hub.net"] }).map((f) =>
        f.tld === "net" ? { ...f, generated: "2026-10-01" } : f,
      ),
    });
    const result = await runSuffixDemandCounter({
      inputDir,
      manifestPath,
      outputPath: path.join(root, ".data", "out.json"),
      cwd: root,
      candidates: ["hub"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.details.join("\n")).toMatch(/Generated mismatch/i);
  });

  it("fails closed when the panel is missing a required file", async () => {
    const root = await tempRoot("missing");
    const { inputDir, manifestPath, manifest } = await writeSyntheticMidPanel({
      dir: path.join(root, "panel"),
      snapshotDate: "2026-11-07",
      files: emptyMidPanelFiles({ net: ["hub.net"] }),
    });
    const biz = manifest.panel.find((p) => p.tld === "biz")!;
    biz.filename = "missing-biz.txt.gz";
    biz.sha256 = createHash("sha256").update("x").digest("hex");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const result = await runSuffixDemandCounter({
      inputDir,
      manifestPath,
      outputPath: path.join(root, ".data", "out.json"),
      cwd: root,
      candidates: ["hub"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.reason).toMatch(/incomplete/i);
  });

  it("refuses to write evidence outside .data/", async () => {
    const root = await tempRoot("outdir");
    const { inputDir, manifestPath } = await writeSyntheticMidPanel({
      dir: path.join(root, "panel"),
      snapshotDate: "2026-11-07",
      files: emptyMidPanelFiles(),
    });
    const result = await runSuffixDemandCounter({
      inputDir,
      manifestPath,
      outputPath: path.join(root, "not-data", "out.json"),
      cwd: root,
      candidates: ["hub"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.reason).toMatch(/\.data\//);
  });

  it("produces deterministic aggregate JSON", async () => {
    const root = await tempRoot("det");
    const files = emptyMidPanelFiles({
      net: ["hub.net", "myhub.net"],
      org: ["hub.org"],
    });
    const a = await writeSyntheticMidPanel({
      dir: path.join(root, "a"),
      snapshotDate: "2026-11-07",
      manifestId: "det-panel",
      files,
    });
    const b = await writeSyntheticMidPanel({
      dir: path.join(root, "b"),
      snapshotDate: "2026-11-07",
      manifestId: "det-panel",
      files,
    });
    const ra = await runSuffixDemandCounter({
      inputDir: a.inputDir,
      manifestPath: a.manifestPath,
      outputPath: path.join(root, ".data", "a.json"),
      cwd: root,
      candidates: ["hub", "force"],
    });
    const rb = await runSuffixDemandCounter({
      inputDir: b.inputDir,
      manifestPath: b.manifestPath,
      outputPath: path.join(root, ".data", "b.json"),
      cwd: root,
      candidates: ["hub", "force"],
    });
    expect(ra.ok && rb.ok).toBe(true);
    if (!ra.ok || !rb.ok) return;
    expect(stableStringify(ra.aggregate)).toBe(stableStringify(rb.aggregate));
  });

  it("builds gzip fixtures with stable digests", async () => {
    const gz = gzipList(
      buildActiveDnsListText({ tld: "net", generated: "2026-11-07", domains: ["hub.net"] }),
    );
    expect(sha256HexBuffer(gz)).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("observed-proposed-strings mode (RIH-FCAST-04B)", () => {
  it("includes WDO from knownExcludedRecords, measures Brand, ignores status filters, dedupes labels", async () => {
    const root = await tempRoot("observed");
    const snapshotDate = "2026-11-07";
    const { inputDir, manifestPath } = await writeSyntheticMidPanel({
      dir: path.join(root, "panel"),
      snapshotDate,
      files: emptyMidPanelFiles({
        net: ["brandco.net", "cloud.net", "gone.net", "master.net", "mycloud.net", "oldbrand.net", "wdo.net"],
        org: ["cloud.org"],
      }),
    });

    const knownExcluded = [
      {
        applicationId: "WDO2627T-T45217",
        primaryString: "wdo",
        applicant: "World Data Organization",
        applicationStatus: "Undergoing administrative check",
        notes: "Option A coverage exclusion only",
      },
    ];

    const applications = [
      mkApp({
        applicationId: "A1",
        applicant: "Alpha",
        appliedString: { sourceRowId: "1", label: "cloud" },
        officialContention: {
          membershipPresent: true,
          officialContentionSetIds: ["9"],
          terminology: "official-initial-contention",
        },
      }),
      mkApp({
        applicationId: "A2",
        applicant: "Beta",
        appliedString: { sourceRowId: "2", label: "cloud" },
        officialContention: {
          membershipPresent: true,
          officialContentionSetIds: ["9"],
          terminology: "official-initial-contention",
        },
      }),
      // Brand-designated — still measured in observed mode
      mkApp({
        applicationId: "B1",
        applicant: "Brand Co",
        appliedString: { sourceRowId: "3", label: "brandco" },
        designations: {
          idn: false,
          brand: true,
          community: false,
          geoSelfDesignated: false,
          geoStringReviewConfirmed: false,
        },
      }),
      // Withdrawn — still contributes proposed string
      mkApp({
        applicationId: "W1",
        applicant: "Gone LLC",
        applicationStatus: "Withdrawn",
        appliedString: { sourceRowId: "4", label: "gone" },
      }),
      // Duplicate primary/replacement identical label counted once
      mkApp({
        applicationId: "D1",
        applicant: "Dup Co",
        appliedString: { sourceRowId: "5", label: "master" },
        replacementString: {
          sourceRowId: "D1-R",
          label: "master",
          applicationStatus: "Active",
          applicationType: "New gTLD",
          processingStage: "String Evaluation Processing",
        },
      }),
      // Unresolved-style replacement identity mismatch still contributes applied + replacement labels
      mkApp({
        applicationId: "U1",
        applicant: "Unresolved Co",
        appliedString: { sourceRowId: "6", label: "oldbrand" },
        replacementString: {
          sourceRowId: "wrong-id",
          label: "newbrand",
          applicationStatus: "Active",
          applicationType: "New gTLD",
          processingStage: "String Evaluation Processing",
        },
      }),
    ];

    const doc = mkApplicationsDocument(applications, {
      officialApplications: 1615,
      observedApplicationRecords: applications.length,
      knownExcludedRecords: knownExcluded,
      applicationRecordCoverage: {
        observed: applications.length,
        official: 1615,
        completeness: "partial",
        knownExcludedRecords: knownExcluded,
      },
    });
    const docPath = path.join(root, "applications-document.json");
    await writeFile(docPath, `${JSON.stringify(doc)}\n`);

    // Candidate resolution alone must succeed under partial 1614/1615-style coverage
    const resolved = resolveObservedProposedStringCandidates(doc as never, {
      applicationsDocumentPath: docPath,
      documentSha256: createHash("sha256").update(JSON.stringify(doc)).digest("hex"),
    });
    expect(resolved.provenance.applicationCensusCoverage?.completeness).toBe("partial");
    expect(resolved.provenance.applicationCensusCoverage?.assertsCompleteRoundInventory).toBe(false);
    expect(resolved.eligibleLabels).toContain("wdo");
    expect(resolved.eligibleLabels).toContain("brandco");
    expect(resolved.eligibleLabels).toContain("gone");
    expect(resolved.eligibleLabels).toContain("newbrand");
    expect(resolved.eligibleLabels.filter((l) => l === "master")).toHaveLength(1);

    const wdoCand = resolved.observedCandidates.find((c) => c.stringLabel === "wdo")!;
    expect(wdoCand.fromKnownExcluded).toBe(true);
    expect(wdoCand.brandDesignationObserved).toBeNull();
    expect(wdoCand.contestedObserved).toBeNull();

    const brandCand = resolved.observedCandidates.find((c) => c.stringLabel === "brandco")!;
    expect(brandCand.brandDesignationObserved).toBe(true);

    const result = await runSuffixDemandCounter({
      inputDir,
      manifestPath,
      outputPath: path.join(root, ".data", "observed.json"),
      cwd: root,
      candidateMode: "observed-proposed-strings",
      applicationsDocumentPath: docPath,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.aggregate.candidateProvenance.mode).toBe("observed-proposed-strings");
    expect(result.aggregate.applicationCensus.status).toBe("partial-observed");
    expect(result.aggregate.applicationCensus.assertsCompleteRoundInventory).toBe(false);
    expect(result.aggregate.forecastConversion.applied).toBe(false);

    const wdo = result.aggregate.strings.find((s) => s.stringLabel === "wdo")!;
    expect(wdo).toBeTruthy();
    expect(wdo.domainCount).toBe(1); // wdo.net
    expect(wdo.fromKnownExcluded).toBe(true);
    expect(wdo.brandDesignationObserved).toBeNull();
    expect(wdo.contested).toBeNull();

    const brand = result.aggregate.strings.find((s) => s.stringLabel === "brandco")!;
    expect(brand.domainCount).toBe(1);
    expect(brand.brandDesignationObserved).toBe(true);
    expect(brand.brandExcluded).toBe(false);

    const gone = result.aggregate.strings.find((s) => s.stringLabel === "gone")!;
    expect(gone.domainCount).toBe(1);

    const master = result.aggregate.strings.filter((s) => s.stringLabel === "master");
    expect(master).toHaveLength(1);
    expect(master[0]!.domainCount).toBe(1);
  });

  it("lists Unicode-without-A-label as unmeasured rather than silent zero", () => {
    const doc = mkApplicationsDocument([
      mkApp({
        applicationId: "I1",
        applicant: "Idn Co",
        appliedString: { sourceRowId: "1", label: "网絡" },
        designations: {
          idn: true,
          brand: false,
          community: false,
          geoSelfDesignated: false,
          geoStringReviewConfirmed: false,
        },
      }),
      mkApp({
        applicationId: "A1",
        applicant: "Ascii Co",
        appliedString: { sourceRowId: "2", label: "xn--ces6a" },
      }),
    ]);
    const resolved = resolveObservedProposedStringCandidates(doc as never, {
      applicationsDocumentPath: "/tmp/doc.json",
      documentSha256: "deadbeef",
    });
    expect(resolved.eligibleLabels).toContain("xn--ces6a");
    expect(resolved.eligibleLabels).not.toContain("网絡");
    expect(resolved.unmeasuredCandidates.some((u) => u.rawLabel === "网絡")).toBe(true);
    expect(
      resolved.unmeasuredCandidates.find((u) => u.rawLabel === "网絡")?.reason,
    ).toMatch(/unicode-label-without-a-label/i);
  });

  it("does not treat partial coverage as a blocker for observed-string resolution", () => {
    const knownExcluded = [
      {
        applicationId: "WDO2627T-T45217",
        primaryString: "wdo",
      },
    ];
    const doc = mkApplicationsDocument(
      [mkApp({ applicationId: "A1", applicant: "A", appliedString: { sourceRowId: "1", label: "cloud" } })],
      {
        officialApplications: 1615,
        observedApplicationRecords: 1614,
        knownExcludedRecords: knownExcluded,
        applicationRecordCoverage: {
          observed: 1614,
          official: 1615,
          completeness: "partial",
          knownExcludedRecords: knownExcluded,
        },
      },
    );
    const resolved = resolveObservedProposedStringCandidates(doc as never, {
      applicationsDocumentPath: "/tmp/x.json",
      documentSha256: "abc",
    });
    expect(resolved.eligibleLabels.sort()).toEqual(["cloud", "wdo"]);
    expect(resolved.provenance.applicationCensusCoverage?.status).toBe("partial-observed");
  });
});
