#!/usr/bin/env node
import { parseArgs } from "node:util";
import { join, resolve } from "node:path";
import { fetchOne } from "../pipeline/pipeline";
import {
  evaluateApplicationActualityPromotion,
  organizationMetricsRemainGatedAfterApplicationPromotion,
} from "./claim-actuality";
import {
  readClaimActualityState,
  writeClaimActualityState,
} from "./claim-actuality-persistence";
import { buildComparisonUnlockReport } from "./comparison-unlock";
import { assertNoFixtureContaminationInRealBuild } from "./contamination";
import { loadPublicationSnapshotFromPath, runDryRunIngestion } from "./dry-run";
import { evaluateHumanApprovals } from "./human-approval";
import {
  buildCanonicalPublicationFromHandoff,
  DRILL_2026_SOURCE_ID,
  fetchDrillHandoff,
  resolveLatestManifestForHandoff,
  writePublicationSnapshot,
} from "./intake";
import {
  DEFAULT_PROMOTION_HISTORY_PATH,
  readPromotionHistory,
  recordActualityPromotion,
} from "./promotion-history";
import { runSanityChecks } from "./sanity-checks";
import { buildRevealDayVerificationReport } from "./verify-report";
import { buildBrowserApplicationPayloadFromPublication } from "../lib/registry-application-payload";
import { buildPublicationFromLocalArtifact, writePublicationReview } from "./build-publication";
import { readFile, rm, writeFile } from "node:fs/promises";

const DEFAULT_STATE = "./.data/reveal-2026/claim-actuality-state.json";
const DEFAULT_PIPELINE_ROOT = "./.data/source-pipeline";
const DEFAULT_REHEARSAL_SNAPSHOT =
  "src/reveal-day-2026/fixtures/rehearsal-2026-pipeline-v1/publication.snapshot.json";
const DEFAULT_DRILL_SNAPSHOT =
  "src/reveal-day-2026/fixtures/drill-2026-intake-v1/publication.snapshot.json";

function usage(): string {
  return `Registry Intelligence Hub — 2026 Reveal Day ingestion (offline)

Usage:
  npm run reveal-2026 -- dry-run [--snapshot <path>]
  npm run reveal-2026 -- validate [--snapshot <path>]
  npm run reveal-2026 -- intake-derive [--pipeline-root <dir>] [--out <path>] [--fetch]
  npm run reveal-2026 -- comparison-unlock [--state <path>]
  npm run reveal-2026 -- promote-actuality --snapshot <path> --steward-approval <id> --product-approval <id> [--state <path>] [--history <path>]
  npm run reveal-2026 -- promotion-history [--history <path>]
  npm run reveal-2026 -- verify-reveal-day [--snapshot <path>] [--state <path>] [--workspace <dir>] [--expected-application-count <n>]
  npm run reveal-2026 -- build-browser-payload --snapshot <path> [--out <path>]
  npm run reveal-2026 -- build-publication --input <file> --out <file> --review-out <file> --snapshot-id <id> --artifact-id <id> --capture-id <id> --source-url <url> --source-name <name> --source-version <n> --retrieved-at <utc> --published-at <utc> --media-type application/x-ndjson --round 2026 --evidence-class <id> --expected-row-count <n> --expect-source-hash <sha256> --recorded-http-status <n> --parser-version <version> --normalizer-version <version> --schema-version registry-2026-publication/1.1.0 [--fixture-id <id>] [--limitation <text>]

build-publication reads a local file only. It does not fetch URLs and does not promote.
Every flag above is required. A file name is not treated as an official source.
On failure the publication path is removed if present. The input file is not modified.

Defaults:
  --snapshot  ${DEFAULT_REHEARSAL_SNAPSHOT} (rehearsal-for-pipeline-only)
  --state     ${DEFAULT_STATE}
  --history   ${DEFAULT_PROMOTION_HISTORY_PATH}
  --pipeline-root  ${DEFAULT_PIPELINE_ROOT}
`;
}

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      snapshot: { type: "string" },
      state: { type: "string" },
      workspace: { type: "string" },
      "pipeline-root": { type: "string" },
      out: { type: "string" },
      fetch: { type: "boolean" },
      history: { type: "string" },
      "steward-approval": { type: "string" },
      "product-approval": { type: "string" },
      "expected-application-count": { type: "string" },
      input: { type: "string" },
      "review-out": { type: "string" },
      "snapshot-id": { type: "string" },
      "artifact-id": { type: "string" },
      "capture-id": { type: "string" },
      "source-url": { type: "string" },
      "source-name": { type: "string" },
      "source-version": { type: "string" },
      "retrieved-at": { type: "string" },
      "published-at": { type: "string" },
      "media-type": { type: "string" },
      round: { type: "string" },
      "evidence-class": { type: "string" },
      "expected-row-count": { type: "string" },
      "expect-source-hash": { type: "string" },
      "recorded-http-status": { type: "string" },
      "parser-version": { type: "string" },
      "normalizer-version": { type: "string" },
      "schema-version": { type: "string" },
      "fixture-id": { type: "string" },
      limitation: { type: "string", multiple: true },
    },
  });

  const [command] = positionals;
  const statePath = values.state ?? DEFAULT_STATE;
  const historyPath = values.history ?? DEFAULT_PROMOTION_HISTORY_PATH;
  const pipelineRoot = values["pipeline-root"] ?? DEFAULT_PIPELINE_ROOT;
  const workspaceRoot = values.workspace ?? process.cwd();
  const snapshotPath = values.snapshot ?? join(workspaceRoot, DEFAULT_REHEARSAL_SNAPSHOT);

  switch (command) {
    case "build-browser-payload": {
      if (!values.snapshot) {
        throw new Error("build-browser-payload requires --snapshot");
      }
      const snapshot = await loadPublicationSnapshotFromPath(snapshotPath);
      const payload = buildBrowserApplicationPayloadFromPublication(snapshot);
      const outPath = values.out ?? join(workspaceRoot, "src/data/fixtures/drill-2026-registry-applications.payload.json");
      await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`);
      console.log(
        JSON.stringify(
          {
            outPath,
            payloadVersion: payload.payloadVersion,
            snapshotId: payload.snapshotId,
            snapshotContentHash: payload.snapshotContentHash,
            applicationCount: payload.applications.length,
          },
          null,
          2,
        ),
      );
      return;
    }

    case "dry-run": {
      const snapshot = await loadPublicationSnapshotFromPath(snapshotPath);
      const diagnostics = runDryRunIngestion(snapshot);
      console.log(JSON.stringify(diagnostics, null, 2));
      if (!diagnostics.validation.ok) process.exitCode = 1;
      return;
    }

    case "validate": {
      const snapshot = await loadPublicationSnapshotFromPath(snapshotPath);
      const diagnostics = runDryRunIngestion(snapshot);
      console.log(JSON.stringify(diagnostics.validation, null, 2));
      if (!diagnostics.validation.ok) process.exitCode = 1;
      return;
    }

    case "intake-derive": {
      if (values.fetch) {
        const { entry } = await fetchOne(DRILL_2026_SOURCE_ID, { root: pipelineRoot, mode: "fixture" });
        if (entry.outcome !== "success" && entry.outcome !== "duplicate-skip") {
          throw new Error(`Pipeline fetch failed: ${entry.errorMessage}`);
        }
      }
      const handoff = await fetchDrillHandoff(pipelineRoot);
      const manifest = await resolveLatestManifestForHandoff(pipelineRoot, handoff);
      const snapshot = await buildCanonicalPublicationFromHandoff(pipelineRoot, handoff, manifest, {
        publicationKind: "immutable-publication",
        snapshotId: "snap-drill-2026-intake-v1",
        fixtureId: "drill-2026-intake-v1",
        publishedAt: "2026-09-19T08:00:00Z",
        sourceName: "ICANN New gTLD Program (labeled drill publication)",
        sourceUrl: manifest.url,
        evidenceClass: "synthetic-drill-lineage-complete",
        limitations: [
          "LABELED DRILL PUBLICATION — synthetic bytes with full raw lineage; not unpublished live 2026 ICANN data.",
          "May promote to REAL_SOURCE_READY only with explicit steward + product approvals during operator drill.",
        ],
        redirectChain: [],
      });
      const outPath = values.out ?? join(workspaceRoot, DEFAULT_DRILL_SNAPSHOT);
      await writePublicationSnapshot(outPath, snapshot);
      console.log(
        JSON.stringify(
          {
            derived: true,
            outPath,
            snapshotId: snapshot.snapshotId,
            applicationCount: snapshot.applications.length,
            rawSha256: snapshot.lineage?.rawSha256,
            manifestAttemptId: snapshot.lineage?.manifestAttemptId,
          },
          null,
          2,
        ),
      );
      return;
    }

    case "comparison-unlock": {
      const state = await readClaimActualityState(statePath);
      const report = buildComparisonUnlockReport(state);
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    case "promotion-history": {
      const history = await readPromotionHistory(historyPath);
      console.log(JSON.stringify(history, null, 2));
      return;
    }

    case "promote-actuality": {
      if (!values.snapshot) {
        throw new Error("promote-actuality requires --snapshot pointing at an immutable publication (not the default rehearsal fixture)");
      }
      const humanApproval = evaluateHumanApprovals({
        stewardApprovalId: values["steward-approval"],
        productApprovalId: values["product-approval"],
      });
      const snapshot = await loadPublicationSnapshotFromPath(snapshotPath);
      const contamination = assertNoFixtureContaminationInRealBuild(snapshot, "promote");
      if (!contamination.ok) {
        console.error(contamination.message);
        process.exitCode = 1;
        return;
      }
      const diagnostics = runDryRunIngestion(snapshot);
      const current = await readClaimActualityState(statePath);
      const result = evaluateApplicationActualityPromotion(snapshot, diagnostics, current, humanApproval);
      if (!result.ok) {
        console.error(result.errors.join("\n"));
        process.exitCode = 1;
        return;
      }
      await writeClaimActualityState(statePath, result.nextState);
      if (!snapshot.lineage || !humanApproval.stewardApprovalId || !humanApproval.productApprovalId) {
        throw new Error("Internal error: promotion succeeded without lineage or approvals");
      }
      await recordActualityPromotion({
        historyPath,
        snapshotId: result.nextState.snapshotId!,
        snapshotContentHash: result.nextState.snapshotContentHash!,
        rawSha256: snapshot.lineage.rawSha256,
        stewardApprovalId: humanApproval.stewardApprovalId,
        productApprovalId: humanApproval.productApprovalId,
        previousSnapshotId: current.snapshotId,
      });
      const unlock = buildComparisonUnlockReport(result.nextState);
      console.log(
        JSON.stringify(
          {
            promoted: true,
            round2026ApplicationActuality: result.nextState.round2026ApplicationActuality,
            snapshotId: result.nextState.snapshotId,
            snapshotContentHash: result.nextState.snapshotContentHash,
            rawSha256: result.nextState.rawSha256,
            organizationMetricsRemainGated: organizationMetricsRemainGatedAfterApplicationPromotion(result.nextState),
            newlyUnlocked: unlock.metrics.filter((m) => m.unlockStatus === "newly-eligible").map((m) => m.metricId),
          },
          null,
          2,
        ),
      );
      return;
    }

    case "verify-reveal-day": {
      const snapshot = await loadPublicationSnapshotFromPath(snapshotPath);
      const diagnostics = runDryRunIngestion(snapshot);
      const state = await readClaimActualityState(statePath);
      const expectedCount = values["expected-application-count"]
        ? Number.parseInt(values["expected-application-count"], 10)
        : undefined;
      const sanity = runSanityChecks(snapshot, diagnostics, expectedCount);
      const report = await buildRevealDayVerificationReport(snapshot, diagnostics, state, workspaceRoot, sanity);
      console.log(JSON.stringify(report, null, 2));
      if (!diagnostics.validation.ok || !sanity.ok) process.exitCode = 1;
      return;
    }

    case "build-publication": {
      if (values.fetch) {
        throw new Error("build-publication does not fetch URLs. Remove --fetch.");
      }
      const requiredFlags = [
        "input",
        "out",
        "review-out",
        "snapshot-id",
        "artifact-id",
        "capture-id",
        "source-url",
        "source-name",
        "source-version",
        "retrieved-at",
        "published-at",
        "media-type",
        "round",
        "evidence-class",
        "expected-row-count",
        "expect-source-hash",
        "recorded-http-status",
        "parser-version",
        "normalizer-version",
        "schema-version",
      ] as const;
      const missing = requiredFlags.filter((flag) => {
        const value = values[flag];
        return typeof value !== "string" || value.trim() === "";
      });
      if (missing.length > 0) {
        throw new Error(`build-publication missing required flags: ${missing.map((flag) => `--${flag}`).join(", ")}`);
      }
      const inputPath = values.input as string;
      const outPath = values.out as string;
      const reviewPath = values["review-out"] as string;
      const inputResolved = resolve(inputPath);
      if (resolve(outPath) === inputResolved || resolve(reviewPath) === inputResolved || resolve(outPath) === resolve(reviewPath)) {
        throw new Error("build-publication output paths must differ from each other and from the input artifact");
      }
      const bytes = new Uint8Array(await readFile(inputPath));
      const fixtureId = values["fixture-id"];
      const result = buildPublicationFromLocalArtifact({
        bytes,
        artifactId: values["artifact-id"] as string,
        sourceVersion: values["source-version"] as string,
        captureId: values["capture-id"] as string,
        sourceUrl: values["source-url"] as string,
        sourceName: values["source-name"] as string,
        retrievedAt: values["retrieved-at"] as string,
        publishedAt: values["published-at"] as string,
        mediaType: values["media-type"] as string,
        round: values.round as string,
        evidenceClass: values["evidence-class"] as string,
        snapshotId: values["snapshot-id"] as string,
        ...(fixtureId ? { fixtureId } : {}),
        expectedRowCount: values["expected-row-count"] as string,
        expectSourceHash: values["expect-source-hash"] as string,
        recordedHttpStatus: values["recorded-http-status"] as string,
        parserVersion: values["parser-version"] as string,
        normalizerVersion: values["normalizer-version"] as string,
        schemaVersion: values["schema-version"] as string,
        limitations: values.limitation,
      });
      if (result.ok && result.publication) {
        await writePublicationSnapshot(outPath, result.publication);
      } else {
        await rm(outPath, { force: true });
      }
      await writePublicationReview(reviewPath, result.review);
      console.log(JSON.stringify(result.review, null, 2));
      if (!result.ok) process.exitCode = 1;
      return;
    }

    default:
      console.log(usage());
      if (command && command !== "help") process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
