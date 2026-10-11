import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { GODADDY_FOCAL_APPLICANT_LEGAL_NAME } from "@/lib/participant-intelligence";
import { bootstrapChangeIntel } from "@/change-intel/bootstrap";
import { deriveDiff } from "@/change-intel/derive-diff";
import { makeRepresentativeFeed } from "@/change-intel/fixtures";
import { buildObservationFromTracked } from "@/change-intel/observation";
import { refreshChangeIntel } from "@/change-intel/refresh";
import {
  persistRefresh,
  readIndex,
  readLatestFeed,
  readObservation,
  resetChangeIntelRoot,
} from "@/change-intel/state-io";
import { diffApplications } from "@/change-intel/application-diff";
import { diffContentionMemberships } from "@/change-intel/contention-diff";
import { sortChangeRecords } from "@/change-intel/impact";
import { hashTrackedApplications } from "@/change-intel/hash";
import type { TrackedApplicationFields } from "@/change-intel/types";

const temps: string[] = [];

afterEach(async () => {
  for (const dir of temps.splice(0)) {
    await resetChangeIntelRoot(dir);
  }
});

async function tempCwd(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "change-intel-"));
  temps.push(dir);
  return dir;
}

function tinyApp(id: string, applicant: string, extras: Partial<TrackedApplicationFields> = {}): TrackedApplicationFields {
  return {
    applicationId: id,
    applicantLegalName: applicant,
    appliedForString: id.toLowerCase(),
    applicationStatus: "Active",
    processingStage: "Initial Evaluation",
    applicationType: "Standard",
    country: "US",
    region: "NA",
    idn: false,
    community: false,
    brand: false,
    geoSelfDesignated: false,
    ...extras,
  };
}

describe("CHANGE-INTEL-1 state / bootstrap / refresh", () => {
  it("bootstrap creates initial state and does not overwrite", async () => {
    const cwd = await tempCwd();
    // Minimal browser payload for bootstrap
    const browserDir = join(cwd, ".data/reveal-2026/browser");
    await mkdir(browserDir, { recursive: true });
    const first = await bootstrapChangeIntel({
      cwd,
      observedAt: "2026-10-10T12:00:00.000Z",
      browserPayloadPath: join(process.cwd(), ".data/reveal-2026/browser/applications-browser-v2.json"),
    });
    expect(first.status).toBe("initialized");
    if (first.status !== "initialized") return;
    expect(first.observation.observedApplicationRecords).toBe(1614);
    expect(first.observation.officialContentionMemberships).toBe(891);
    const second = await bootstrapChangeIntel({ cwd });
    expect(second.status).toBe("already-initialized");
    const index = await readIndex(cwd);
    expect(index?.currentObservationId).toBe(first.observation.observationId);
  });

  it("dry-run writes nothing; failed refresh preserves prior state", async () => {
    const cwd = await tempCwd();
    const boot = await bootstrapChangeIntel({
      cwd,
      browserPayloadPath: join(process.cwd(), ".data/reveal-2026/browser/applications-browser-v2.json"),
    });
    expect(boot.status).toBe("initialized");
    if (boot.status !== "initialized") return;
    const beforeIndex = await readIndex(cwd);
    const dry = await refreshChangeIntel({
      cwd,
      dryRun: true,
      mode: "file",
      applicationPathOrUrl: join(process.cwd(), ".data/reveal-2026/aps-capture/applications.csv"),
      contentionPathOrUrl: join(process.cwd(), ".data/reveal-2026/aps-capture/reveal-day-contention-sets.csv"),
    });
    expect(dry.wroteState).toBe(false);
    expect(dry.status).toBe("dry-run");
    const afterDry = await readIndex(cwd);
    expect(afterDry?.currentObservationId).toBe(beforeIndex?.currentObservationId);

    await expect(
      refreshChangeIntel({
        cwd,
        mode: "file",
        applicationPathOrUrl: join(cwd, "missing-apps.csv"),
        contentionPathOrUrl: join(process.cwd(), ".data/reveal-2026/aps-capture/reveal-day-contention-sets.csv"),
      }),
    ).rejects.toThrow(/APPLICATION_ACQUISITION_FAILED|ENOENT|no such file/i);
    const afterFail = await readIndex(cwd);
    expect(afterFail?.currentObservationId).toBe(beforeIndex?.currentObservationId);
  });

  it("no-change refresh updates last-checked and preserves meaningful history", async () => {
    const cwd = await tempCwd();
    const { baseline, current, diff } = makeRepresentativeFeed();
    // Seed state via persist helpers
    const { persistBootstrap } = await import("@/change-intel/state-io");
    await persistBootstrap({ observation: baseline, cwd });
    await persistRefresh({ observation: current, diff, cwd });
    const before = await readIndex(cwd);
    expect(before?.lastMeaningfulChangeAt).toBe(current.observedAt);

    // Write identical CSVs from tracked? Use file mode against real capture which may equal baseline semantics.
    // Instead persist a synthetic no-change refresh:
    const noChangeObs = buildObservationFromTracked({
      observedAt: "2026-10-11T18:00:00.000Z",
      previousObservationId: current.observationId,
      bootstrap: false,
      applicationSource: { ...current.applicationSource, retrievedAt: "2026-10-11T18:00:00.000Z" },
      contentionSource: { ...current.contentionSource, retrievedAt: "2026-10-11T18:00:00.000Z" },
      applications: current.applications,
      contentionMemberships: current.contentionMemberships,
      officialApplications: 1615,
      officialApplicants: 481,
    });
    const noChangeDiff = deriveDiff({ previous: current, current: noChangeObs });
    expect(noChangeDiff.semanticUnchanged).toBe(true);
    await persistRefresh({ observation: noChangeObs, diff: noChangeDiff, cwd });
    const after = await readIndex(cwd);
    expect(after?.lastCheckedAt).toBe("2026-10-11T18:00:00.000Z");
    expect(after?.lastMeaningfulChangeAt).toBe(current.observedAt);
    const feed = await readLatestFeed(cwd);
    expect(feed.initialized).toBe(true);
    if (!feed.initialized) return;
    expect(feed.recentMeaningfulDiffs[0]?.diffId).toBe(diff.diffId);
    expect(await readObservation(baseline.observationId, cwd)).not.toBeNull();
  });

  it("source ordering does not create false changes; semantic hashes deterministic", () => {
    const a = [tinyApp("B", "Beta"), tinyApp("A", "Alpha")];
    const b = [tinyApp("A", "Alpha"), tinyApp("B", "Beta")];
    expect(hashTrackedApplications(a)).toBe(hashTrackedApplications(b));
    const changes = diffApplications({
      observationId: "obs-test",
      observedAt: "2026-10-11T00:00:00.000Z",
      previous: a,
      current: b,
    });
    expect(changes).toHaveLength(0);
  });
});

describe("CHANGE-INTEL-1 application / contention / impact", () => {
  it("tracks now-present, no-longer-present, and field changes", () => {
    const prev = [tinyApp("1", "A", { region: "NA" }), tinyApp("2", "B")];
    const curr = [tinyApp("1", "A", { region: "EU" }), tinyApp("3", "C")];
    const changes = diffApplications({
      observationId: "obs",
      observedAt: "t",
      previous: prev,
      current: curr,
    });
    expect(changes.map((c) => c.changeType).sort()).toEqual([
      "APPLICATION_FIELD_CHANGED",
      "APPLICATION_NOW_PRESENT",
      "APPLICATION_NO_LONGER_PRESENT",
    ]);
  });

  it("diffs contention memberships order-insensitively", () => {
    const prev = [
      { contentionSetId: "2", applicationId: "B" },
      { contentionSetId: "1", applicationId: "A" },
    ];
    const curr = [
      { contentionSetId: "1", applicationId: "A" },
      { contentionSetId: "2", applicationId: "B" },
      { contentionSetId: "1", applicationId: "C" },
    ];
    const apps = new Map([
      ["A", tinyApp("A", "Alpha")],
      ["B", tinyApp("B", "Beta")],
      ["C", tinyApp("C", "Gamma")],
    ]);
    const changes = diffContentionMemberships({
      observationId: "obs",
      observedAt: "t",
      previous: prev,
      current: curr,
      applicationsById: apps,
    });
    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe("CONTENTION_MEMBERSHIP_ADDED");
  });

  it("assigns GoDaddy impact precedence and RSP research ordering", () => {
    const { diff } = makeRepresentativeFeed();
    expect(diff.changes.some((c) => c.primaryImpact === "GODADDY_DIRECT")).toBe(true);
    expect(diff.changes.some((c) => c.primaryImpact === "GODADDY_CONTENTION")).toBe(true);
    expect(diff.changes.some((c) => c.primaryImpact === "RSP_RESEARCH_RELEVANT")).toBe(true);
    expect(diff.changes.some((c) => c.primaryImpact === "MARKET_CHANGE")).toBe(true);
    const sorted = sortChangeRecords(diff.changes);
    const ranks = sorted.map((c) => c.primaryImpact);
    const firstDirect = ranks.indexOf("GODADDY_DIRECT");
    const firstMarket = ranks.indexOf("MARKET_CHANGE");
    expect(firstDirect).toBeGreaterThanOrEqual(0);
    expect(firstDirect).toBeLessThan(firstMarket);
    const godaddy = sorted.find((c) => c.primaryImpact === "GODADDY_DIRECT");
    expect(godaddy?.applicantLegalName).toBe(GODADDY_FOCAL_APPLICANT_LEGAL_NAME);
  });

  it("does not invent commercial availability language in impact reasons", () => {
    const { diff } = makeRepresentativeFeed();
    const blob = diff.changes.map((c) => c.impactReasons.join(" ")).join(" ");
    expect(blob).not.toMatch(/available customer|unassigned RSP|needs an RSP|sales lead/i);
  });
});

describe("CHANGE-INTEL-1 reveal-day untouched contract", () => {
  it("does not mutate claim actuality path during bootstrap", async () => {
    const claimPath = join(process.cwd(), ".data/reveal-2026/claim-actuality-state.json");
    let before: string | null = null;
    try {
      before = await readFile(claimPath, "utf8");
    } catch {
      before = null;
    }
    const cwd = await tempCwd();
    await bootstrapChangeIntel({
      cwd,
      browserPayloadPath: join(process.cwd(), ".data/reveal-2026/browser/applications-browser-v2.json"),
    });
    if (before !== null) {
      const after = await readFile(claimPath, "utf8");
      expect(after).toBe(before);
      expect(createHash("sha256").update(after).digest("hex")).toBe(
        createHash("sha256").update(before).digest("hex"),
      );
    }
  });
});
