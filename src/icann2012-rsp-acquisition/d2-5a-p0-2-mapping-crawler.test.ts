import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { parseRevealDayCsvText } from "@/normalization/parse-reveal-csv";
import { loadRevealDayApplicationIds, reconcileCanonicalMapping } from "./canonical-reconciliation";
import {
  createRedirectFollowingFetcher,
  GtldresultSessionTransport,
} from "./gtldresult-session-transport";
import { buildMappingLivePreflightReport } from "./mapping-live-preflight";
import { runMappingLive, buildMappingArtifactFromCheckpoint } from "./mapping-live";
import { mappingLiveCheckpointPath, readMappingLiveCheckpoint } from "./mapping-checkpoint";
import {
  buildSyntheticReplayCorpus,
  createSyntheticReplayFetcher,
  REGRESSION_MAPPING_LEADS,
  SYNTHETIC_REPLAY_CORPUS_MARKER,
} from "./synthetic-replay-corpus";
import { RSP_MAPPING_LIVE_AUTH_ENV } from "./constants";
import { acquirePilotPortions } from "./acquire";
import { runMappingDryRun } from "./mapping-dry-run";
import { buildPreflightReport } from "./preflight-report";
import { NetworkTargetPolicyError } from "./network-target-policy";
import { absoluteGtldresultUrl } from "./urls";
import { GTLDRESULT_PATHS } from "./constants";

const workspaceRoot = join(process.cwd());
const noSleep = async () => undefined;

describe("D2.5A-P0.2 mapping-live crawler (mock/replay only)", () => {
  it("marks synthetic replay corpus as TEST_ONLY", () => {
    expect(SYNTHETIC_REPLAY_CORPUS_MARKER).toContain("TEST_ONLY");
  });

  it("forwards Set-Cookie in-memory on session transport", async () => {
    const corpus = buildSyntheticReplayCorpus({ applicationIds: ["1-1945-29108"], rowsPerPage: 1 });
    const base = createSyntheticReplayFetcher(corpus);
    const transport = new GtldresultSessionTransport(base);
    await transport.get(corpus.statusHubUrl);
    expect(transport.getCookieHeaderForRequest()).toContain("JSESSIONID");
    await transport.get(corpus.gridEntryUrl);
  });

  it("omits cookies and CSRF tokens from index snapshot metadata", async () => {
    const staging = await mkdtemp(join(tmpdir(), "rsp-map-"));
    const corpus = buildSyntheticReplayCorpus({ applicationIds: ["1-1945-29108"], rowsPerPage: 1 });
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";
    try {
      await runMappingLive(
        { workspaceRoot, stagingRoot: staging, runId: "meta-test", forceNewRun: true },
        createSyntheticReplayFetcher(corpus),
      );
      const meta = JSON.parse(
        await readFile(join(staging, "sources/index/meta-test/page-0001.fetch.json"), "utf8"),
      );
      const serialized = JSON.stringify(meta).toLowerCase();
      expect(serialized).not.toContain("set-cookie");
      expect(serialized).not.toContain("csrf");
      expect(serialized).not.toContain("cookie");
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("rejects cross-host redirect in transport", async () => {
    const ids = ["1-1945-29108"];
    const corpus = buildSyntheticReplayCorpus({ applicationIds: ids, rowsPerPage: 1 });
    const base = createSyntheticReplayFetcher(corpus, {
      crossHostRedirectFrom: corpus.gridEntryUrl,
    });
    const fetcher = createRedirectFollowingFetcher(async (url) => base(url));
    const staging = await mkdtemp(join(tmpdir(), "rsp-map-"));
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";
    try {
      await expect(
        runMappingLive(
          { workspaceRoot, stagingRoot: staging, runId: "redirect-test", forceNewRun: true },
          fetcher,
        ),
      ).rejects.toThrow(NetworkTargetPolicyError);
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("replays full 1930 corpus with exact canonical reconciliation and regression leads", async () => {
    const csv = await readFile(
      join(
        workspaceRoot,
        "src/normalization/fixtures/icann2012-reveal-day-v1/sources/strings-1200utc-13jun12-en.csv",
      ),
      "utf8",
    );
    const applicationIds = parseRevealDayCsvText(csv).map((r) => r.applicationId);
    expect(applicationIds).toHaveLength(1930);

    const corpus = buildSyntheticReplayCorpus({ applicationIds });
    const fetcher = createSyntheticReplayFetcher(corpus);
    const staging = await mkdtemp(join(tmpdir(), "rsp-map-"));
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";

    try {
      const result = await runMappingLive(
        {
          workspaceRoot,
          stagingRoot: staging,
          runId: "round-wide-replay",
          forceNewRun: true,
          sleep: noSleep,
        },
        fetcher,
      );

      expect(result.exact).toBe(true);
      expect(result.reconciliation.missingApplicationIds).toHaveLength(0);
      expect(result.reconciliation.extraApplicationIds).toHaveLength(0);
      expect(result.reconciliation.duplicateGtldresultAcIds).toHaveLength(0);
      expect(result.approvalState).toBe("DRAFT");
      expect(result.artifactPurpose).toBe("EVIDENCE");

      const artifact = JSON.parse(await readFile(result.mappingArtifactPath, "utf8"));
      expect(artifact.scope).toBe("ROUND_WIDE_EXACT");
      expect(artifact.approvalState).toBe("DRAFT");
      expect(artifact.entries).toHaveLength(1930);

      for (const lead of Object.values(REGRESSION_MAPPING_LEADS)) {
        const row = artifact.entries.find(
          (e: { applicationId: string }) => e.applicationId === lead.applicationId,
        );
        expect(row?.gtldresultAcId).toBe(lead.gtldresultAcId);
      }
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("resumes after simulated interrupt without silent overwrite", async () => {
    const csv = await readFile(
      join(
        workspaceRoot,
        "src/normalization/fixtures/icann2012-reveal-day-v1/sources/strings-1200utc-13jun12-en.csv",
      ),
      "utf8",
    );
    const applicationIds = parseRevealDayCsvText(csv).map((r) => r.applicationId);
    const corpus = buildSyntheticReplayCorpus({ applicationIds });
    const base = createSyntheticReplayFetcher(corpus);
    let gridFetches = 0;
    const interruptFetcher = async (url: string) => {
      const res = await base(url);
      if (url.includes("viewstatus")) {
        gridFetches += 1;
        if (gridFetches > 8) {
          throw new Error("simulated operator interrupt");
        }
      }
      return res;
    };

    const staging = await mkdtemp(join(tmpdir(), "rsp-map-"));
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";
    const runId = "resume-replay";

    try {
      await expect(
        runMappingLive(
          { workspaceRoot, stagingRoot: staging, runId, forceNewRun: true, sleep: noSleep },
          interruptFetcher,
        ),
      ).rejects.toThrow(/interrupt/);

      const ck = await readMappingLiveCheckpoint(mappingLiveCheckpointPath(staging));
      expect(ck?.lastCompletedPageOrdinal).toBeGreaterThan(0);

      const result = await runMappingLive(
        { workspaceRoot, stagingRoot: staging, runId, resume: true, sleep: noSleep },
        base,
      );
      expect(result.exact).toBe(true);
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("detects pagination loops and malformed overlap", async () => {
    const ids = await loadRevealDayApplicationIds(workspaceRoot);
    const slice = ids.slice(0, 140);
    const loopCorpus = buildSyntheticReplayCorpus({
      applicationIds: slice,
      paginationUrlLoop: true,
    });
    const staging = await mkdtemp(join(tmpdir(), "rsp-map-"));
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";
    try {
      await expect(
        runMappingLive(
          {
            workspaceRoot,
            stagingRoot: staging,
            runId: "loop-test",
            forceNewRun: true,
          },
          createSyntheticReplayFetcher(loopCorpus),
        ),
      ).rejects.toThrow(/Pagination loop/);
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("mapping-live preflight is zero HTTP and reports round-wide fields", async () => {
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    delete process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    const report = await buildMappingLivePreflightReport({ workspaceRoot });
    expect(report.roundWideExpectedCount).toBe(1930);
    expect(report.outputApprovalState).toBe("DRAFT");
    expect(report.networkRequestsExpected).toBe(0);
    expect(report.blockingReasons.some((r) => r.includes(RSP_MAPPING_LIVE_AUTH_ENV))).toBe(true);

    const generic = await buildPreflightReport({ workspaceRoot, operation: "mapping-live" });
    expect(generic.blockingReasons).not.toContain("MAPPING_LIVE_NOT_IMPLEMENTED");
    expect(generic.blockingReasons.some((r) => r.includes("TEST_ONLY"))).toBe(false);
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
  });

  it("pilot and mapping-dry-run remain zero HTTP", async () => {
    const pilot = await acquirePilotPortions({ workspaceRoot });
    expect(pilot.mode).toBe("dry-run");
    const dry = await runMappingDryRun({ workspaceRoot });
    expect(dry.mode).toBe("mapping-dry-run");
  });

  it("generated mapping artifact never self-approves", async () => {
    const checkpoint = {
      checkpointVersion: "icann2012-rsp-mapping-live-checkpoint/1.0.0" as const,
      runId: "x",
      corpusContentHash: "abc",
      state: "completed" as const,
      lastCompletedPageOrdinal: 1,
      pages: [
        {
          pageOrdinal: 1,
          snapshotId: "snap-index-x-p0001-deadbeefdead",
          contentSha256: "a".repeat(64),
          resolvedUrl: absoluteGtldresultUrl(GTLDRESULT_PATHS.viewStatusGrid),
          diagnostics: {
            displayStart: 1,
            displayEnd: 1,
            displayTotal: 1,
            parsedRowCount: 1,
            quarantinedBlockCount: 0,
            nextPageHref: null,
          },
        },
      ],
      mappings: { "1-1945-29108": 170 },
      applicationPageOrdinal: { "1-1945-29108": 1 },
    };
    const artifact = buildMappingArtifactFromCheckpoint(checkpoint);
    expect(artifact.approvalState).toBe("DRAFT");
    expect(artifact.artifactPurpose).toBe("EVIDENCE");
  });
});

describe("canonical reconciliation", () => {
  it("computes missing/extra/dup ac counts", () => {
    const stats = reconcileCanonicalMapping(
      ["1-a", "1-b"],
      new Map([
        ["1-a", 1],
        ["1-c", 2],
        ["1-d", 3],
      ]),
    );
    expect(stats.missingApplicationIds).toEqual(["1-b"]);
    expect(stats.extraApplicationIds).toEqual(["1-c", "1-d"]);
    expect(stats.exact).toBe(false);
  });
});
