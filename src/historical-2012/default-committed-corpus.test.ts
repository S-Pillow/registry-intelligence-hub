import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { APPROVED_2012_BASELINE } from "@/comparison/approved-2012-baseline";
import { APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH } from "@/historical-2012/approved-corpus-hash";
import {
  CONFIRMED_2012_MAPPED_APPLICATION_COUNT,
  CONFIRMED_2012_PORTFOLIO_COUNT,
  HISTORICAL_2012_CONFIRMED_PORTFOLIO_COVERAGE_BANNER,
  OFFLINE_2012_ORG_UNRESOLVED_APPLICATIONS,
} from "@/historical-2012/confirmed-portfolios-constants";
import {
  CONFIRMED_PORTFOLIOS_2012_JSON_ENV,
  CONFIRMED_PORTFOLIOS_2012_PATH_ENV,
  loadCommitted2012ConfirmedPortfoliosSidecar,
  loadHistorical2012ConfirmedPortfoliosResolution,
} from "@/historical-2012/confirmed-portfolios-server";
import {
  APPLICATION_PAYLOAD_2012_JSON_ENV,
  APPLICATION_PAYLOAD_2012_PATH_ENV,
  loadHistorical2012PayloadResolution,
} from "@/historical-2012/payload-server";
import {
  historical2012CorpusApplicationCount,
  omitHistoricalApplicationsForSharedLayout,
} from "@/historical-2012/payload-shared";

const ENV_KEYS = [
  APPLICATION_PAYLOAD_2012_JSON_ENV,
  APPLICATION_PAYLOAD_2012_PATH_ENV,
  CONFIRMED_PORTFOLIOS_2012_JSON_ENV,
  CONFIRMED_PORTFOLIOS_2012_PATH_ENV,
] as const;

const previousEnv = new Map<string, string | undefined>();

function clearHistoricalEnv() {
  for (const key of ENV_KEYS) {
    previousEnv.set(key, process.env[key]);
    delete process.env[key];
  }
}

function restoreHistoricalEnv() {
  for (const key of ENV_KEYS) {
    const previous = previousEnv.get(key);
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
}

describe("committed 2012 corpus default (PR-5)", () => {
  afterEach(() => {
    restoreHistoricalEnv();
  });

  it("loads the committed 1,930-row corpus when no override is set", async () => {
    clearHistoricalEnv();
    const resolution = await loadHistorical2012PayloadResolution();
    expect(resolution.status).toBe("loaded");
    if (resolution.status !== "loaded") return;
    expect(resolution.applicationCount).toBe(1930);
    expect(resolution.document.applications).toHaveLength(APPROVED_2012_BASELINE.applications);
    expect(resolution.document.corpusContentHash).toBe(APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH);
    expect(resolution.document.source.name).toMatch(/2012 Reveal Day/i);
    expect(resolution.document.source.name).not.toMatch(/rehearsal/i);
    expect(resolution.document.source.evidenceClass).toBe("historical-archive-preserved");
    expect(new Set(resolution.document.applications.map((row) => row.string)).size).toBe(1409);
    expect(resolution.document.applications.filter((row) => row.idn)).toHaveLength(116);
    expect(resolution.document.applications.every((row) => row.category === "Unclassified")).toBe(true);
    expect(resolution.document.applications.every((row) => row.returning === false)).toBe(true);
    expect(resolution.document.applications.every((row) => row.confidence === 1)).toBe(true);
    expect(resolution.document.applications.filter((row) => row.type === "Geographic")).toHaveLength(55);
    expect(APPROVED_2012_BASELINE.geographicDesignations).toBe(66);
    expect(APPROVED_2012_BASELINE.communityDesignations).toBe(84);
    expect(APPROVED_2012_BASELINE.contentionMembershipApplications).toBe(754);
  });

  it("keeps an explicit valid application override ahead of the committed file", async () => {
    clearHistoricalEnv();
    const committed = await loadHistorical2012PayloadResolution();
    if (committed.status !== "loaded") throw new Error("committed corpus did not load");
    const override = {
      ...committed.document,
      snapshotId: "pr5-explicit-override-snapshot",
    };
    const dir = await mkdtemp(join(tmpdir(), "pr5-app-"));
    const path = join(dir, "override.json");
    await writeFile(path, JSON.stringify(override));
    process.env[APPLICATION_PAYLOAD_2012_PATH_ENV] = path;
    const resolution = await loadHistorical2012PayloadResolution();
    expect(resolution.status).toBe("loaded");
    if (resolution.status !== "loaded") return;
    expect(resolution.document.snapshotId).toBe("pr5-explicit-override-snapshot");
    expect(resolution.applicationCount).toBe(1930);
  });

  it("fails closed when an explicit application override is missing or malformed", async () => {
    clearHistoricalEnv();
    process.env[APPLICATION_PAYLOAD_2012_PATH_ENV] = join(tmpdir(), "pr5-missing-application-payload.json");
    const missing = await loadHistorical2012PayloadResolution();
    expect(missing.status).toBe("not-loaded");
    if (missing.status === "not-loaded") {
      expect(missing.reason).toBe("invalid-document");
      expect(missing.errorMessage).toMatch(/not substituted/i);
    }

    process.env[APPLICATION_PAYLOAD_2012_PATH_ENV] = "";
    process.env[APPLICATION_PAYLOAD_2012_JSON_ENV] = "{";
    const malformed = await loadHistorical2012PayloadResolution();
    expect(malformed.status).toBe("not-loaded");
    if (malformed.status === "not-loaded") {
      expect(malformed.errorMessage).toMatch(/not substituted/i);
    }
  });

  it("loads the committed confirmed sidecar and keeps unresolved coverage", async () => {
    clearHistoricalEnv();
    const sidecar = await loadCommitted2012ConfirmedPortfoliosSidecar();
    expect(sidecar.confirmedPortfolioCount).toBe(CONFIRMED_2012_PORTFOLIO_COUNT);
    expect(sidecar.confirmedMappedApplicationCount).toBe(CONFIRMED_2012_MAPPED_APPLICATION_COUNT);
    expect(sidecar.portfolios).toHaveLength(16);
    expect(sidecar.portfolios.every((portfolio) => portfolio.promotionState === "CONFIRMED")).toBe(true);
    expect(OFFLINE_2012_ORG_UNRESOLVED_APPLICATIONS).toBe(1429);
    expect(HISTORICAL_2012_CONFIRMED_PORTFOLIO_COVERAGE_BANNER).toContain("1,429");
    expect(HISTORICAL_2012_CONFIRMED_PORTFOLIO_COVERAGE_BANNER).toContain("16");
    expect(HISTORICAL_2012_CONFIRMED_PORTFOLIO_COVERAGE_BANNER).toContain("466");

    const resolution = await loadHistorical2012ConfirmedPortfoliosResolution();
    expect(resolution.status).toBe("loaded");
    if (resolution.status !== "loaded") return;
    const memberIds = resolution.document.portfolios.flatMap((portfolio) => portfolio.memberApplicationIds);
    expect(new Set(memberIds).size).toBe(466);
  });

  it("fails closed when an explicit sidecar override is missing", async () => {
    clearHistoricalEnv();
    process.env[CONFIRMED_PORTFOLIOS_2012_PATH_ENV] = join(tmpdir(), "pr5-missing-sidecar.json");
    const sidecar = await loadHistorical2012ConfirmedPortfoliosResolution();
    expect(sidecar.status).toBe("not-loaded");
    if (sidecar.status === "not-loaded") {
      expect(sidecar.errorMessage).toMatch(/not substituted/i);
    }
    const applications = await loadHistorical2012PayloadResolution();
    expect(applications.status).toBe("loaded");
  });

  it("omits application rows from the shared layout transfer without dropping the count", async () => {
    clearHistoricalEnv();
    const full = await loadHistorical2012PayloadResolution();
    const shared = omitHistoricalApplicationsForSharedLayout(full);
    expect(shared.status).toBe("loaded");
    if (shared.status !== "loaded" || full.status !== "loaded") return;
    expect(shared.document.applications).toHaveLength(0);
    expect(historical2012CorpusApplicationCount(shared)).toBe(1930);
    expect(full.document.applications).toHaveLength(1930);
    expect(shared.document.corpusContentHash).toBe(full.document.corpusContentHash);
    expect(shared.document.source.evidenceClass).toBe("historical-archive-preserved");
  });
});
