import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import {
  acquirePilotLivePortions,
  acquirePilotPortions,
  buildDryRunReport,
  formatDryRunReport,
} from "./acquire";
import { RSP_PILOT_LIVE_AUTH_ENV, RSP_ACQUISITION_LIMITS } from "./constants";
import { formatMappingDryRun, runMappingDryRun } from "./mapping-dry-run";
import { validatePortionHtml } from "./quarantine";
import { buildPortionUrl } from "./urls";
import { defaultLiveStagingRoot } from "./staging-containment";
import { isPilotLiveAuthorized } from "./preflight-report";

const workspaceRoot = join(process.cwd());

describe("icann2012-rsp-acquisition", () => {
  it("pilot dry-run defaults to unauthorized live and external staging root", async () => {
    expect(isPilotLiveAuthorized()).toBe(false);
  });

  it("buildDryRunReport lists 25 apps with URLs and staging paths without HTTP", async () => {
    const report = await buildDryRunReport({ workspaceRoot });
    expect(report.plans).toHaveLength(25);
    expect(report.stagingRoot).toBe(defaultLiveStagingRoot());
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

  it("acquirePilotPortions never invokes fetcher", async () => {
    const fetcher = vi.fn();
    const result = await acquirePilotPortions({ workspaceRoot });
    expect(result.mode).toBe("dry-run");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("quarantines oversize responses in pilot-live mode", async () => {
    const staging = await mkdtemp(join(tmpdir(), "rsp-staging-"));
    const prev = process.env[RSP_PILOT_LIVE_AUTH_ENV];
    process.env[RSP_PILOT_LIVE_AUTH_ENV] = "1";

    const big = new Uint8Array(RSP_ACQUISITION_LIMITS.maxPortionBytes + 1);
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("/170")) {
        return { status: 200, body: big };
      }
      return { status: 404, body: new Uint8Array() };
    });

    await expect(
      acquirePilotLivePortions({ workspaceRoot, stagingRoot: staging, batchId: "test-q" }, fetcher),
    ).rejects.toThrow(/preflight|TEST_ONLY|PILOT_LIVE/i);

    process.env[RSP_PILOT_LIVE_AUTH_ENV] = prev;
  });

  it("validatePortionHtml requires q23 anchor", () => {
    expect(validatePortionHtml('<div id="q23">x</div>').ok).toBe(true);
    expect(validatePortionHtml("<html></html>").ok).toBe(false);
  });
});
