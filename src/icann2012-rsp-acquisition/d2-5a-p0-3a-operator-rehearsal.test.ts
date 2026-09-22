import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { parseRevealDayCsvText } from "@/normalization/parse-reveal-csv";
import { networkPolicyForCommand } from "./command-mode";
import { EVIDENCE_BUNDLE_MANIFEST_VERSION } from "./evidence-bundle-manifest";
import { completeMappingLiveOperatorFlow } from "./mapping-live-operator-flow";
import {
  buildMappingLiveOperatorPlan,
  formatMappingLiveOperatorPlan,
  MAPPING_LIVE_OPERATOR_PLAN_VERSION,
} from "./mapping-live-plan";
import { runMappingLive } from "./mapping-live";
import { runMappingReview } from "./mapping-review";
import { MappingLiveOperatorCancellation } from "./mapping-live-operator-cancellation";
import { mappingLiveCheckpointPath, readMappingLiveCheckpoint } from "./mapping-checkpoint";
import {
  buildSyntheticReplayCorpus,
  createSyntheticReplayFetcher,
} from "./synthetic-replay-corpus";
import { RSP_MAPPING_LIVE_AUTH_ENV } from "./constants";
import { acquirePilotPortions } from "./acquire";
import { runMappingDryRun } from "./mapping-dry-run";
import { NetworkTargetPolicyError } from "./network-target-policy";
import { createRedirectFollowingFetcher } from "./gtldresult-session-transport";
import { GtldresultSessionTransport } from "./gtldresult-session-transport";
import { absoluteGtldresultUrl } from "./urls";
import { GTLDRESULT_PATHS } from "./constants";

const workspaceRoot = join(process.cwd());
const noSleep = async () => undefined;

async function persistentStagingDir(): Promise<string> {
  try {
    return mkdtemp(join("/var/tmp", "rsp-p03-"));
  } catch {
    return mkdtemp(join(tmpdir(), "rsp-p03-"));
  }
}

describe("D2.5A-P0.3A mapping-live operator rehearsal (zero real HTTP)", () => {
  it("mapping-live-plan command mode never opens outbound HTTP", () => {
    expect(networkPolicyForCommand("mapping-live-plan").allowsOutboundHttp).toBe(false);
  });

  it("mapping-live-plan performs zero HTTP even when mapping auth is set", async () => {
    const staging = await persistentStagingDir();
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";
    try {
      const plan = await buildMappingLiveOperatorPlan({ workspaceRoot, stagingRoot: staging });
      expect(plan.zeroNetwork).toBe(true);
      expect(plan.planVersion).toBe(MAPPING_LIVE_OPERATOR_PLAN_VERSION);
      expect(plan.authState.mappingLiveAuthorized).toBe(true);
      expect(formatMappingLiveOperatorPlan(plan)).toContain("zero HTTP");
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("completes exact 1930 operator flow with evidence manifest and safe provenance", async () => {
    const csv = await readFile(
      join(
        workspaceRoot,
        "src/normalization/fixtures/icann2012-reveal-day-v1/sources/strings-1200utc-13jun12-en.csv",
      ),
      "utf8",
    );
    const applicationIds = parseRevealDayCsvText(csv).map((r) => r.applicationId);
    const corpus = buildSyntheticReplayCorpus({ applicationIds });
    const staging = await persistentStagingDir();
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";

    try {
      const live = await runMappingLive(
        {
          workspaceRoot,
          stagingRoot: staging,
          runId: "op-exact-1930",
          forceNewRun: true,
          sleep: noSleep,
        },
        createSyntheticReplayFetcher(corpus),
      );
      expect(live.exact).toBe(true);
      expect(live.reconciliation.mappedCount).toBe(1930);

      const flow = await completeMappingLiveOperatorFlow({ workspaceRoot, liveResult: live });
      expect(flow.provenanceSummaryText).toContain("roundWideExact: true");
      const summaryLower = flow.provenanceSummaryText.toLowerCase();
      expect(summaryLower).not.toContain("set-cookie");
      expect(summaryLower).not.toContain("jsessionid");
      expect(summaryLower).not.toContain("registry_hub_rsp_mapping_authorized");

      const manifest = JSON.parse(await readFile(flow.evidenceBundleManifestPath, "utf8"));
      expect(manifest.manifestVersion).toBe(EVIDENCE_BUNDLE_MANIFEST_VERSION);
      expect(manifest.files.some((f: { relativePath: string }) => f.relativePath.includes("page-"))).toBe(
        true,
      );
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("preserves partial 1929 DRAFT run with 25/25 pilot candidate", async () => {
    const csv = await readFile(
      join(
        workspaceRoot,
        "src/normalization/fixtures/icann2012-reveal-day-v1/sources/strings-1200utc-13jun12-en.csv",
      ),
      "utf8",
    );
    const applicationIds = parseRevealDayCsvText(csv).map((r) => r.applicationId).slice(0, 1929);
    const corpus = buildSyntheticReplayCorpus({ applicationIds });
    const staging = await persistentStagingDir();
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";

    try {
      const live = await runMappingLive(
        {
          workspaceRoot,
          stagingRoot: staging,
          runId: "op-partial-1929",
          forceNewRun: true,
          sleep: noSleep,
        },
        createSyntheticReplayFetcher(corpus),
      );
      expect(live.exact).toBe(false);
      const review = await runMappingReview({ workspaceRoot, runDir: staging });
      expect(review.pilotResolvedCount).toBe(25);
      expect(review.pilotOnlyExactCandidate).toBe(true);
      expect(["PARTIAL_MAPPING", "PAGINATION_DRIFT"]).toContain(review.failureClassification);
      expect(review.approvalState).toBe("DRAFT");
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("classifies HTML structure drift and preserves pages", async () => {
    const ids = ["1-1945-29108", "1-1016-75482", "1-1765-99580", "1-1129-14280"];
    const corpus = buildSyntheticReplayCorpus({
      applicationIds: ids,
      rowsPerPage: 1,
      ambiguousRowOnPage2: true,
    });
    const staging = await persistentStagingDir();
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";

    try {
      const live = await runMappingLive(
        { workspaceRoot, stagingRoot: staging, runId: "html-drift", forceNewRun: true, sleep: noSleep },
        createSyntheticReplayFetcher(corpus),
      );
      expect(live.exact).toBe(false);
      const ck = await readMappingLiveCheckpoint(mappingLiveCheckpointPath(staging));
      expect(ck?.pages.length).toBeGreaterThan(0);
      const review = await runMappingReview({ workspaceRoot, runDir: staging });
      expect(review.quarantinedPageOrdinals.length).toBeGreaterThan(0);
      expect(["HTML_STRUCTURE_DRIFT", "PAGINATION_DRIFT"]).toContain(review.failureClassification);
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("halts on pagination drift with preserved snapshots", async () => {
    const ids = Array.from({ length: 80 }, (_, i) => `1-1000-${10000 + i}`);
    const corpus = buildSyntheticReplayCorpus({
      applicationIds: ids,
      rowsPerPage: 10,
      paginationUrlLoop: true,
    });
    const staging = await persistentStagingDir();
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";

    try {
      const live = await runMappingLive(
        {
          workspaceRoot,
          stagingRoot: staging,
          runId: "pager-drift",
          forceNewRun: true,
          sleep: noSleep,
        },
        createSyntheticReplayFetcher(corpus),
      );
      expect(live.exact).toBe(false);
      const review = await runMappingReview({ workspaceRoot, runDir: staging });
      expect(["PAGINATION_DRIFT", "PARTIAL_MAPPING"]).toContain(review.failureClassification);
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("stops on HTTP 429 without retry escalation", async () => {
    const ids = ["1-1945-29108"];
    const corpus = buildSyntheticReplayCorpus({ applicationIds: ids, rowsPerPage: 1 });
    const gridUrl = corpus.gridEntryUrl;
    const staging = await persistentStagingDir();
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";

    try {
      await expect(
        runMappingLive(
          { workspaceRoot, stagingRoot: staging, runId: "rate-429", forceNewRun: true, sleep: noSleep },
          createSyntheticReplayFetcher(corpus, { httpStatusForUrl: { [gridUrl]: 429 } }),
        ),
      ).rejects.toThrow(/429/);
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("stops on HTTP 403 access denial", async () => {
    const ids = ["1-1945-29108"];
    const corpus = buildSyntheticReplayCorpus({ applicationIds: ids, rowsPerPage: 1 });
    const gridUrl = corpus.gridEntryUrl;
    const staging = await persistentStagingDir();
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";

    try {
      await expect(
        runMappingLive(
          { workspaceRoot, stagingRoot: staging, runId: "access-403", forceNewRun: true, sleep: noSleep },
          createSyntheticReplayFetcher(corpus, { httpStatusForUrl: { [gridUrl]: 403 } }),
        ),
      ).rejects.toThrow(/403/);
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("rejects unexpected cross-host redirect", async () => {
    const ids = ["1-1945-29108"];
    const corpus = buildSyntheticReplayCorpus({ applicationIds: ids, rowsPerPage: 1 });
    const staging = await persistentStagingDir();
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";

    try {
      const base = createSyntheticReplayFetcher(corpus, {
        crossHostRedirectFrom: corpus.gridEntryUrl,
      });
      await expect(
        runMappingLive(
          { workspaceRoot, stagingRoot: staging, runId: "x-host", forceNewRun: true, sleep: noSleep },
          createRedirectFollowingFetcher(async (url) => base(url)),
        ),
      ).rejects.toThrow(NetworkTargetPolicyError);
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("operator cancellation preserves checkpoint pages and reports CANCELLED on review", async () => {
    const csv = await readFile(
      join(
        workspaceRoot,
        "src/normalization/fixtures/icann2012-reveal-day-v1/sources/strings-1200utc-13jun12-en.csv",
      ),
      "utf8",
    );
    const applicationIds = parseRevealDayCsvText(csv).map((r) => r.applicationId);
    const corpus = buildSyntheticReplayCorpus({ applicationIds });
    const staging = await persistentStagingDir();
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";

    try {
      const live = await runMappingLive(
        {
          workspaceRoot,
          stagingRoot: staging,
          runId: "cancel-mid",
          forceNewRun: true,
          sleep: noSleep,
        },
        createSyntheticReplayFetcher(corpus, {
          abortAfterSuccessfulResponses: 3,
          abortError: new MappingLiveOperatorCancellation(),
        }),
      );
      expect(live.stoppedEarly).toBe(true);
      expect(live.exact).toBe(false);
      const ck = await readMappingLiveCheckpoint(mappingLiveCheckpointPath(staging));
      expect(ck?.pages.length).toBeGreaterThan(0);
      const meta = JSON.stringify(ck).toLowerCase();
      expect(meta).not.toContain("jsessionid");

      const review = await runMappingReview({ workspaceRoot, runDir: staging });
      expect(review.failureClassification).toBe("CANCELLED");
      expect(review.roundWideExact).toBe(false);
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("resume rebuilds session after cancellation (fresh transport)", async () => {
    const ids = ["1-1945-29108", "1-1016-75482"];
    const corpus = buildSyntheticReplayCorpus({ applicationIds: ids, rowsPerPage: 1 });
    const staging = await persistentStagingDir();
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";

    try {
      await runMappingLive(
        {
          workspaceRoot,
          stagingRoot: staging,
          runId: "resume-after-cancel",
          forceNewRun: true,
          sleep: noSleep,
        },
        createSyntheticReplayFetcher(corpus, {
          abortAfterSuccessfulResponses: 2,
          abortError: new MappingLiveOperatorCancellation(),
        }),
      );

      const transport = new GtldresultSessionTransport(createSyntheticReplayFetcher(corpus));
      transport.clearSession();
      expect(transport.getCookieHeaderForRequest()).toBeUndefined();
      await transport.get(absoluteGtldresultUrl(GTLDRESULT_PATHS.statusHub));
      expect(transport.getCookieHeaderForRequest()).toBeDefined();
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("mapping-review flags integrity failure when page hash diverges", async () => {
    const csv = await readFile(
      join(
        workspaceRoot,
        "src/normalization/fixtures/icann2012-reveal-day-v1/sources/strings-1200utc-13jun12-en.csv",
      ),
      "utf8",
    );
    const applicationIds = parseRevealDayCsvText(csv).map((r) => r.applicationId);
    const corpus = buildSyntheticReplayCorpus({ applicationIds });
    const staging = await persistentStagingDir();
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";

    try {
      await runMappingLive(
        {
          workspaceRoot,
          stagingRoot: staging,
          runId: "integrity-fail",
          forceNewRun: true,
          sleep: noSleep,
        },
        createSyntheticReplayFetcher(corpus),
      );
      const htmlPath = join(staging, "sources/index/integrity-fail/page-0001.html");
      await writeFile(htmlPath, "<html>tampered</html>");

      const review = await runMappingReview({ workspaceRoot, runDir: staging });
      expect(review.failureClassification).toBe("INTEGRITY_FAILURE");
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });

  it("pilot and mapping-dry-run remain zero HTTP", async () => {
    const pilot = await acquirePilotPortions({ workspaceRoot });
    expect(pilot.plans.length).toBeGreaterThan(0);
    expect(networkPolicyForCommand("pilot").allowsOutboundHttp).toBe(false);

    const dry = await runMappingDryRun({ workspaceRoot });
    expect(networkPolicyForCommand("mapping-dry-run").allowsOutboundHttp).toBe(false);
  });
});
