import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FORECAST_V1_EXAMPLE_STRINGS } from "@/lib/registration-forecast";
import { runSuffixDemandCounter, stableStringify } from "./counter";
import { writeSyntheticMidPanel, gzipList, buildActiveDnsListText, sha256HexBuffer } from "./fixtures";
import { sldMatchesCandidate, normalizeAsciiLabel } from "./match";
import { parseRegistrableDomainForTld } from "./parse-domain";
import { MID_PANEL_TLDS } from "./types";

const tempDirs: string[] = [];

afterEach(async () => {
  // Best-effort cleanup is unnecessary for CI tmp; keep list for debugging paths.
  tempDirs.length = 0;
});

async function tempRoot(label: string): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), `rih-fcast-03-${label}-`));
  tempDirs.push(dir);
  return dir;
}

function emptyMidPanelFiles(
  overrides: Partial<Record<(typeof MID_PANEL_TLDS)[number], string[]>> = {},
): Array<{ tld: (typeof MID_PANEL_TLDS)[number]; domains: string[] }> {
  return MID_PANEL_TLDS.map((tld) => ({
    tld,
    domains: overrides[tld] ?? [],
  }));
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
});

describe("offline suffix-demand counter", () => {
  it("counts distinct FQDNs across TLDs without collapsing shared SLDs", async () => {
    const root = await tempRoot("count");
    const dataOut = path.join(root, ".data", "suffix-demand", "aggregate.json");
    const snapshotDate = "2026-11-07";

    const { inputDir, manifestPath } = await writeSyntheticMidPanel({
      dir: path.join(root, "panel"),
      snapshotDate,
      files: [
        {
          tld: "net",
          domains: ["hub.net", "myhub.net", "hub.net", "other.net", "not-a-domain", "foo.org"],
        },
        { tld: "org", domains: ["hub.org", "force.org"] },
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
    // hub.net + myhub.net + hub.org = 3 (duplicate hub.net ignored)
    expect(by.hub).toBe(3);
    expect(by.force).toBe(1);
    expect(by.connect).toBe(1);
    expect(by.stack).toBe(1); // mystack.app
    expect(by.api).toBe(1);
    expect(by.bold).toBe(1);
    expect(by.master).toBe(0);

    expect(result.aggregate.processing.duplicateRecords).toBe(1);
    expect(result.aggregate.processing.rejectedRecords).toBeGreaterThanOrEqual(2);
    expect(result.aggregate.forecastConversion.applied).toBe(false);
    expect(result.aggregate.matching.semanticKeywordAnalysis).toBe(false);

    for (const row of result.aggregate.strings) {
      expect(row.suffixDemandEvidence.status).toBe("available");
      expect(row.suffixDemandEvidence.domainCount).toBe(row.domainCount);
      expect(row.suffixDemandEvidence.sourceId).toContain("activedns-");
    }

    const written = JSON.parse(await readFile(dataOut, "utf8"));
    expect(written.status).toBe("complete");
    expect(written.referencePanelTlds).toEqual([...MID_PANEL_TLDS]);
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
    expect(result.aggregate.status).toBe("complete");
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
    expect(result.failure.reason).toMatch(/validation failed|SHA-256/i);
    await expect(readFile(out, "utf8")).rejects.toThrow();
  });

  it("rejects header metadata mismatches", async () => {
    const root = await tempRoot("header");
    const { inputDir, manifestPath, manifest } = await writeSyntheticMidPanel({
      dir: path.join(root, "panel"),
      snapshotDate: "2026-11-07",
      files: emptyMidPanelFiles({
        net: ["hub.net"],
      }).map((f) =>
        f.tld === "net" ? { ...f, generated: "2026-10-01" } : f,
      ),
    });

    // Manifest still claims 2026-11-07; net file header says 2026-10-01
    expect(manifest.snapshotDate).toBe("2026-11-07");

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

    // Point manifest at a non-existent filename for .biz
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
    expect(result.failure.details.some((d) => d.includes("missing file"))).toBe(true);
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
});
