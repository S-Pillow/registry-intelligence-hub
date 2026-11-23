import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FORECAST_V1_EXAMPLE_STRINGS } from "@/lib/registration-forecast";
import { REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20 } from "@/lib/registry-applications-document-v2";
import type { BrowserApplicationV2 } from "@/lib/registry-applications-document-v2";
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
  return mkdtemp(path.join(os.tmpdir(), `rih-fcast-03a-${label}-`));
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

/** Minimal artifact that passes isBrowserApplicationPayloadDocumentV2. */
function mkApplicationsDocument(applications: BrowserApplicationV2[]) {
  return {
    payloadVersion: REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20,
    payloadMode: "inactive-2x",
    snapshotId: "test-snapshot-fcast-03a",
    snapshotContentHash: "abc123contenthash",
    officialApplications: applications.length,
    observedApplicationRecords: applications.length,
    applications,
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
    expect(sldMatchesCandidate("api", "hub")).toBe(false);
  });

  it("parses only exact SLD.TLD registrable forms for the reference TLD", () => {
    expect(parseRegistrableDomainForTld("Example.NET", "net")).toEqual({
      domain: "example.net",
      sld: "example",
      tld: "net",
    });
    expect(parseRegistrableDomainForTld("a.b.net", "net")).toBeNull();
    expect(parseRegistrableDomainForTld("example.org", "net")).toBeNull();
    expect(parseRegistrableDomainForTld("bad domain.net", "net")).toBeNull();
    expect(parseRegistrableDomainForTld("-bad.net", "net")).toBeNull();
  });

  it("reversed suffix trie preserves equals/endsWith semantics", () => {
    const index = buildSuffixMatchIndex(["hub", "api", "stack", "force"]);
    expect([...index.matchAll("hub")].sort()).toEqual(["hub"]);
    expect([...index.matchAll("myhub")].sort()).toEqual(["hub"]);
    expect([...index.matchAll("hubify")]).toEqual([]);
    expect([...index.matchAll("mystack")].sort()).toEqual(["stack"]);
    expect([...index.matchAll("api")].sort()).toEqual(["api"]);
    // Multiple suffix hits
    const multi = buildSuffixMatchIndex(["hub", "yhub"]);
    expect([...multi.matchAll("myhub")].sort()).toEqual(["hub", "yhub"]);
  });
});

describe("offline suffix-demand counter (03A)", () => {
  it("counts distinct FQDNs across TLDs with sorted adjacent duplicate suppression", async () => {
    const root = await tempRoot("count");
    const dataOut = path.join(root, ".data", "suffix-demand", "aggregate.json");
    const snapshotDate = "2026-11-07";

    const { inputDir, manifestPath } = await writeSyntheticMidPanel({
      dir: path.join(root, "panel"),
      snapshotDate,
      files: [
        {
          tld: "net",
          // Sorted; adjacent duplicate hub.net; malformed lines retained in declared count
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
      candidateMode: "example-list",
      candidates: FORECAST_V1_EXAMPLE_STRINGS,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const by = Object.fromEntries(result.aggregate.strings.map((s) => [s.stringLabel, s.domainCount]));
    expect(by.hub).toBe(3); // hub.net + myhub.net + hub.org
    expect(by.force).toBe(1);
    expect(by.connect).toBe(1);
    expect(by.stack).toBe(1);
    expect(by.api).toBe(1);
    expect(by.bold).toBe(1);
    expect(by.master).toBe(0);

    expect(result.aggregate.schemaVersion).toBe(2);
    expect(result.aggregate.processing.duplicateRecords).toBe(1);
    expect(result.aggregate.processing.rejectedRecords).toBeGreaterThanOrEqual(2);
    expect(result.aggregate.matching.implementation).toBe("reversed-suffix-trie");
    expect(result.aggregate.matching.duplicateDetection).toBe("sorted-adjacent-previous-domain");
    expect(result.aggregate.candidateProvenance.mode).toBe("example-list");
    expect(result.aggregate.forecastConversion.applied).toBe(false);

    const written = JSON.parse(await readFile(dataOut, "utf8"));
    expect(written.status).toBe("complete");
    expect(written.referencePanelTlds).toEqual([...MID_PANEL_TLDS]);
  });

  it("fails closed on unsorted input and writes no aggregate", async () => {
    const root = await tempRoot("unsorted");
    const out = path.join(root, ".data", "out.json");
    const { inputDir, manifestPath } = await writeSyntheticMidPanel({
      dir: path.join(root, "panel"),
      snapshotDate: "2026-11-07",
      files: emptyMidPanelFiles({
        net: ["zebra.net", "apple.net"], // unsorted
      }),
    });

    const result = await runSuffixDemandCounter({
      inputDir,
      manifestPath,
      outputPath: out,
      cwd: root,
      candidates: ["hub"],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.reason).toMatch(/Unsorted/i);
    await expect(readFile(out, "utf8")).rejects.toThrow();
  });

  it("allows a fully verified panel to produce legitimate zeros", async () => {
    const root = await tempRoot("zeros");
    const { inputDir, manifestPath } = await writeSyntheticMidPanel({
      dir: path.join(root, "panel"),
      snapshotDate: "2026-11-07",
      files: emptyMidPanelFiles({
        net: ["alpha.net"],
        org: ["beta.org"],
      }),
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
    if (result.ok) return;
    expect(result.failure.status).toBe("failed");
    await expect(readFile(out, "utf8")).rejects.toThrow();
  });

  it("rejects header metadata mismatches", async () => {
    const root = await tempRoot("header");
    const { inputDir, manifestPath } = await writeSyntheticMidPanel({
      dir: path.join(root, "panel"),
      snapshotDate: "2026-11-07",
      files: emptyMidPanelFiles({
        net: ["hub.net"],
      }).map((f) => (f.tld === "net" ? { ...f, generated: "2026-10-01" } : f)),
    });

    const result = await runSuffixDemandCounter({
      inputDir,
      manifestPath,
      outputPath: path.join(root, ".data", "out.json"),
      cwd: root,
      candidates: ["hub"],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.details.join("\n")).toMatch(/Generated mismatch/i);
  });

  it("fails closed when the panel is missing a required file", async () => {
    const root = await tempRoot("missing");
    const { inputDir, manifestPath, manifest } = await writeSyntheticMidPanel({
      dir: path.join(root, "panel"),
      snapshotDate: "2026-11-07",
      files: emptyMidPanelFiles({ net: ["hub.net"] }),
    });

    const biz = manifest.panel.find((p) => p.tld === "biz");
    expect(biz).toBeTruthy();
    if (!biz) return;
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
    if (result.ok) return;
    expect(result.failure.reason).toMatch(/incomplete/i);
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
    if (result.ok) return;
    expect(result.failure.reason).toMatch(/\.data\//);
  });

  it("produces deterministic aggregate JSON", async () => {
    const root = await tempRoot("det");
    const snapshotDate = "2026-11-07";
    const files = emptyMidPanelFiles({
      net: ["hub.net", "myhub.net"],
      org: ["hub.org"],
    });

    const a = await writeSyntheticMidPanel({
      dir: path.join(root, "a"),
      snapshotDate,
      manifestId: "det-panel",
      files,
    });
    const b = await writeSyntheticMidPanel({
      dir: path.join(root, "b"),
      snapshotDate,
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

  it("builds gzip fixtures with stable digests for local inspection", async () => {
    const text = buildActiveDnsListText({
      tld: "net",
      generated: "2026-11-07",
      domains: ["hub.net"],
    });
    const gz = gzipList(text);
    expect(sha256HexBuffer(gz)).toMatch(/^[a-f0-9]{64}$/);
    expect(gz[0]).toBe(0x1f);
    expect(gz[1]).toBe(0x8b);
  });

  it("applications-document mode: replacements, brand exclusion, contested dedupe, provenance", async () => {
    const root = await tempRoot("apps");
    const snapshotDate = "2026-11-07";
    const { inputDir, manifestPath } = await writeSyntheticMidPanel({
      dir: path.join(root, "panel"),
      snapshotDate,
      files: emptyMidPanelFiles({
        // Must be lexicographically sorted (ActiveDNS contract).
        net: ["brandco.net", "cloud.net", "master.net", "mycloud.net"],
        org: ["cloud.org"],
      }),
    });

    const applications = [
      // Contested cloud — two applicants, one demand count
      mkApp({
        applicationId: "A1",
        applicant: "Alpha LLC",
        appliedString: { sourceRowId: "1", label: "cloud" },
        officialContention: {
          membershipPresent: true,
          officialContentionSetIds: ["9"],
          terminology: "official-initial-contention",
        },
      }),
      mkApp({
        applicationId: "A2",
        applicant: "Beta Inc",
        appliedString: { sourceRowId: "2", label: "cloud" },
        officialContention: {
          membershipPresent: true,
          officialContentionSetIds: ["9"],
          terminology: "official-initial-contention",
        },
      }),
      // Selected replacement: brand → master
      mkApp({
        applicationId: "R1",
        applicant: "Replace Co",
        applicationStatus: "Deactivated",
        appliedString: { sourceRowId: "3", label: "oldbrand" },
        replacementString: {
          sourceRowId: "R1-R",
          label: "master",
          applicationStatus: "Active",
          applicationType: "New gTLD",
          processingStage: "String Evaluation Processing",
        },
      }),
      // Confirmed closed-brand proxy — excluded from counting
      mkApp({
        applicationId: "B1",
        applicant: "Brand Co",
        appliedString: { sourceRowId: "4", label: "brandco" },
        designations: {
          idn: false,
          brand: true,
          community: false,
          geoSelfDesignated: false,
          geoStringReviewConfirmed: false,
        },
      }),
      // Withdrawn — excluded
      mkApp({
        applicationId: "W1",
        applicant: "Gone LLC",
        applicationStatus: "Withdrawn",
        appliedString: { sourceRowId: "5", label: "gone" },
      }),
    ];

    const doc = mkApplicationsDocument(applications);
    const docPath = path.join(root, "applications-document.json");
    await writeFile(docPath, `${JSON.stringify(doc)}\n`);

    const result = await runSuffixDemandCounter({
      inputDir,
      manifestPath,
      outputPath: path.join(root, ".data", "full.json"),
      cwd: root,
      candidateMode: "applications-document-v2",
      applicationsDocumentPath: docPath,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const labels = result.aggregate.strings.map((s) => s.stringLabel).sort();
    expect(labels).toEqual(["cloud", "master"]);
    expect(result.aggregate.strings.find((s) => s.stringLabel === "brandco")).toBeUndefined();
    expect(result.aggregate.strings.find((s) => s.stringLabel === "gone")).toBeUndefined();

    const cloud = result.aggregate.strings.find((s) => s.stringLabel === "cloud")!;
    expect(cloud.domainCount).toBe(3); // cloud.net + mycloud.net + cloud.org
    expect(cloud.contested).toBe(true);

    const master = result.aggregate.strings.find((s) => s.stringLabel === "master")!;
    expect(master.domainCount).toBe(1);

    expect(result.aggregate.candidateProvenance.mode).toBe("applications-document-v2");
    expect(result.aggregate.candidateProvenance.snapshotId).toBe("test-snapshot-fcast-03a");
    expect(result.aggregate.candidateProvenance.snapshotContentHash).toBe("abc123contenthash");
    expect(result.aggregate.candidateProvenance.brandExcludedCount).toBe(1);
    expect(result.aggregate.candidateProvenance.brandExcludedLabels).toEqual(["brandco"]);
    expect(result.aggregate.candidateProvenance.eligibleCandidateCount).toBe(2);
    expect(result.aggregate.candidateProvenance.note).toMatch(/proxy only/i);
    expect(result.aggregate.candidateProvenance.documentSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fails closed when applications document is missing or invalid", async () => {
    const root = await tempRoot("nodoc");
    const { inputDir, manifestPath } = await writeSyntheticMidPanel({
      dir: path.join(root, "panel"),
      snapshotDate: "2026-11-07",
      files: emptyMidPanelFiles({ net: ["hub.net"] }),
    });

    const missing = await runSuffixDemandCounter({
      inputDir,
      manifestPath,
      outputPath: path.join(root, ".data", "missing.json"),
      cwd: root,
      candidateMode: "applications-document-v2",
      applicationsDocumentPath: path.join(root, "no-such-document.json"),
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.failure.reason).toMatch(/unavailable|fail closed/i);
    }

    const badPath = path.join(root, "not-v2.json");
    await writeFile(badPath, `${JSON.stringify({ payloadVersion: "1.1", applications: [] })}\n`);
    const invalid = await runSuffixDemandCounter({
      inputDir,
      manifestPath,
      outputPath: path.join(root, ".data", "invalid.json"),
      cwd: root,
      candidateMode: "applications-document-v2",
      applicationsDocumentPath: badPath,
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.failure.reason).toMatch(/validation|fail closed/i);
    }
  });
});
