import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import {
  acquirePilotPortions,
  buildDryRunReport,
  formatDryRunReport,
  isAcquisitionAuthorized,
} from "./acquire";
import { RSP_ACQUISITION_AUTH_ENV, RSP_ACQUISITION_LIMITS } from "./constants";
import { formatMappingDryRun, runMappingDryRun } from "./mapping-dry-run";
import { validatePortionHtml } from "./quarantine";
import { buildPortionUrl } from "./urls";

const workspaceRoot = join(process.cwd());

describe("icann2012-rsp-acquisition", () => {
  it("defaults to unauthorized (dry-run only)", () => {
    const prev = process.env[RSP_ACQUISITION_AUTH_ENV];
    delete process.env[RSP_ACQUISITION_AUTH_ENV];
    expect(isAcquisitionAuthorized()).toBe(false);
    process.env[RSP_ACQUISITION_AUTH_ENV] = prev;
  });

  it("buildDryRunReport lists 25 apps with URLs and staging paths without HTTP", async () => {
    const report = await buildDryRunReport({ workspaceRoot });
    expect(report.plans).toHaveLength(25);
    expect(report.plans.some((p) => p.applicationId === "1-863-45071")).toBe(true);
    const bosch = report.plans.find((p) => p.applicationId === "1-1945-29108");
    expect(bosch?.gtldresultAcId).toBe(170);
    expect(bosch?.portionUrl).toBe(buildPortionUrl(170));
    expect(bosch?.mappingRequired).toBe(false);
    const neustar = report.plans.find((p) => p.applicationId === "1-863-45071");
    expect(neustar?.mappingRequired).toBe(true);
    expect(neustar?.portionUrl).toContain("{gtldresultAcId}");
    const text = formatDryRunReport(report);
    expect(text).toContain("no HTTP");
    expect(text).toContain("mapping required");
  });

  it("mapping dry-run uses manifest only unless real evidence paths are supplied", async () => {
    const result = await runMappingDryRun({ workspaceRoot });
    expect(result.pilotEntries).toBe(25);
    expect(result.manifestResolved).toBe(1);
    expect(result.unresolvedApplicationIds).toHaveLength(24);
    expect(result.resolved.find((r) => r.applicationId === "1-1945-29108")?.gtldresultAcId).toBe(170);
    expect(result.resolved.find((r) => r.applicationId === "1-1945-29108")?.source).toBe("manifest");
    const text = formatMappingDryRun(result);
    expect(text).toContain("mapping dry-run");
    expect(text).toContain("manifest-resolved: 1");
    expect(text).not.toContain("source=grid-html");
  });

  it("acquirePilotPortions uses mock fetch only when authorized", async () => {
    const staging = await mkdtemp(join(tmpdir(), "rsp-staging-"));
    const fetcher = vi.fn(async () => ({
      status: 200,
      body: Buffer.from('<div class="response" id="q23">backend</div>'),
    }));

    const prev = process.env[RSP_ACQUISITION_AUTH_ENV];
    process.env[RSP_ACQUISITION_AUTH_ENV] = "1";

    const result = await acquirePilotPortions(
      { workspaceRoot, stagingRoot: staging, batchId: "test-batch" },
      fetcher,
    );

    expect(result.mode).toBe("live");
    if (result.mode === "live") {
      expect(result.completed).toContain("1-1945-29108");
      expect(fetcher).toHaveBeenCalled();
      const portionPath = join(staging, "sources/portions/1-1945-29108/public-portion.html");
      const bytes = await readFile(portionPath);
      expect(bytes.toString("utf8")).toContain("q23");
    }

    process.env[RSP_ACQUISITION_AUTH_ENV] = prev;
  });

  it("quarantines oversize and missing q23 in live mode", async () => {
    const staging = await mkdtemp(join(tmpdir(), "rsp-staging-"));
    const prev = process.env[RSP_ACQUISITION_AUTH_ENV];
    process.env[RSP_ACQUISITION_AUTH_ENV] = "1";

    const big = new Uint8Array(RSP_ACQUISITION_LIMITS.maxPortionBytes + 1);
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("/170")) {
        return { status: 200, body: big };
      }
      return { status: 404, body: new Uint8Array() };
    });

    const result = await acquirePilotPortions(
      { workspaceRoot, stagingRoot: staging, batchId: "test-q" },
      fetcher,
    );
    expect(result.mode).toBe("live");
    if (result.mode === "live") {
      expect(result.quarantined).toContain("1-1945-29108");
    }

    process.env[RSP_ACQUISITION_AUTH_ENV] = prev;
  });

  it("validatePortionHtml requires q23 anchor", () => {
    expect(validatePortionHtml('<div id="q23">x</div>').ok).toBe(true);
    expect(validatePortionHtml("<html></html>").ok).toBe(false);
  });

  it("dry-run path never invokes fetcher", async () => {
    const fetcher = vi.fn();
    delete process.env[RSP_ACQUISITION_AUTH_ENV];
    const result = await acquirePilotPortions({ workspaceRoot }, fetcher);
    expect(result.mode).toBe("dry-run");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
