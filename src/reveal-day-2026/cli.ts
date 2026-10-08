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
import {
  buildPublicationFromApsApplicationCsv,
  writePublicationV2Artifacts,
} from "./build-publication-v2";
import {
  buildContentionMembershipFromLocalArtifact,
  writeContentionMembershipArtifacts,
} from "./build-contention-membership";
import {
  applicationGraphHashInput,
  APS_APPLICATION_CSV_ARTIFACT_ROLE,
  APS_APPLICATION_CSV_MEDIA_TYPE,
  APS_APPLICATION_CSV_NORMALIZER_VERSION,
  APS_APPLICATION_CSV_PARSER_VERSION,
  PUBLICATION_SCHEMA_VERSION_V20,
  type KnownExcludedRecordV2,
  type OfficialAggregatesV2,
  type Registry2026PublicationV2,
} from "./publication-v2-types";
import {
  APS_CONTENTION_CSV_ARTIFACT_ROLE,
  APS_CONTENTION_CSV_MEDIA_TYPE,
  APS_CONTENTION_CSV_NORMALIZER_VERSION,
  APS_CONTENTION_CSV_PARSER_VERSION,
  CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
} from "./contention-membership-types";
import {
  loadContentionMembershipFromPath,
  loadPublicationV2FromPath,
  runRevealDayPromotion2xDryRun,
} from "./promotion-contract-2x";
import { contentHash } from "../normalization/hashes";
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
  npm run reveal-2026 -- dry-run-promotion-2x --snapshot <path> [--contention-snapshot <path>] [--state <path>]
  npm run reveal-2026 -- validate [--snapshot <path>]
  npm run reveal-2026 -- intake-derive [--pipeline-root <dir>] [--out <path>] [--fetch]
  npm run reveal-2026 -- comparison-unlock [--state <path>]
  npm run reveal-2026 -- promote-actuality --snapshot <path> --steward-approval <id> --product-approval <id> [--state <path>] [--history <path>]
  npm run reveal-2026 -- promotion-history [--history <path>]
  npm run reveal-2026 -- verify-reveal-day [--snapshot <path>] [--state <path>] [--workspace <dir>] [--expected-application-count <n>]
  npm run reveal-2026 -- build-browser-payload --snapshot <path> [--out <path>]
  npm run reveal-2026 -- build-publication --input <file> --out <file> --review-out <file> --snapshot-id <id> --artifact-id <id> --capture-id <id> --source-url <url> --source-name <name> --source-version <n> --retrieved-at <utc> --published-at <utc> --media-type application/x-ndjson --round 2026 --evidence-class <id> --expected-row-count <n> --expect-source-hash <sha256> --recorded-http-status <n> --parser-version <version> --normalizer-version <version> --schema-version registry-2026-publication/1.1.0 [--fixture-id <id>] [--limitation <text>]
  npm run reveal-2026 -- build-publication-aps-csv --input <csv> --aggregates <json> --excluded <json> --out <file> --review-out <file> --snapshot-id <id> --artifact-id <id> --capture-id <id> --source-url <url> --source-name <name> --source-version <n> --retrieved-at <utc> --published-at <utc> --expect-source-hash <sha256> --recorded-http-status <n> [--evidence-class <id>] [--limitation <text>]
  npm run reveal-2026 -- build-contention-membership --input <csv> --application-publication <json> --out <file> --review-out <file> --bundle-out <file> --snapshot-id <id> --artifact-id <id> --capture-id <id> --source-url <url> --source-name <name> --source-version <n> --retrieved-at <utc> --published-at <utc> --expect-source-hash <sha256> --expect-application-graph-hash <sha256> --recorded-http-status <n> [--final-url <url>] [--evidence-class <id>] [--limitation <text>]

build-publication reads a local NDJSON wire file only (1.1.0 rehearsal/drill). It does not fetch or promote.
build-publication-aps-csv reads a local APS Application CSV + official aggregate/coverage JSON (2.0.0). Role-gated; not an unrestricted text/csv parser. Does not fetch, promote, or mutate claim actuality.
build-contention-membership reads a local Reveal Day contention CSV + pinned Application 2.0.0 publication into registry-2026-contention-membership/1.0.0. Does not rewrite the Application publication, promote, or mutate claim actuality.
dry-run-promotion-2x validates Application 2.0.0 (± contention sidecar) promotion candidates without writing claim actuality, promotion history, or browser payloads. Actual 2.0 promote-actuality is not authorized by this command.

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
      aggregates: { type: "string" },
      excluded: { type: "string" },
      "application-publication": { type: "string" },
      "bundle-out": { type: "string" },
      "expect-application-graph-hash": { type: "string" },
      "final-url": { type: "string" },
      "bundle-id": { type: "string" },
      "contention-snapshot": { type: "string" },
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

    case "dry-run-promotion-2x": {
      if (!values.snapshot) {
        throw new Error("dry-run-promotion-2x requires --snapshot pointing at a registry-2026-publication/2.0.0 artifact");
      }
      const beforeState = await readClaimActualityState(statePath);
      const publication = await loadPublicationV2FromPath(resolve(snapshotPath));
      const contention = values["contention-snapshot"]
        ? await loadContentionMembershipFromPath(resolve(values["contention-snapshot"]))
        : null;
      const report = runRevealDayPromotion2xDryRun({
        publication,
        contention,
        applicationOnly: !contention,
      });
      const afterState = await readClaimActualityState(statePath);
      if (JSON.stringify(beforeState) !== JSON.stringify(afterState)) {
        throw new Error("dry-run-promotion-2x mutated claim actuality state — abort");
      }
      console.log(JSON.stringify(report, null, 2));
      if (report.application.status !== "PROMOTABLE") process.exitCode = 1;
      if (contention && report.contention?.status !== "PROMOTABLE") process.exitCode = 1;
      return;
    }

    case "promote-actuality": {
      if (!values.snapshot) {
        throw new Error("promote-actuality requires --snapshot pointing at an immutable publication (not the default rehearsal fixture)");
      }
      // Schema dispatch: refuse 2.0.0 actual writes (contract-only ticket). Keep 1.1 path intact.
      const peek = JSON.parse(await readFile(resolve(snapshotPath), "utf8")) as { schemaVersion?: string };
      if (peek.schemaVersion === PUBLICATION_SCHEMA_VERSION_V20) {
        console.error(
          "RIH-PROMOTION-2X-1: actual promote-actuality for registry-2026-publication/2.0.0 is not authorized. Use dry-run-promotion-2x.",
        );
        process.exitCode = 1;
        return;
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

    case "build-publication-aps-csv": {
      if (values.fetch) {
        throw new Error("build-publication-aps-csv does not fetch URLs. Remove --fetch.");
      }
      const requiredFlags = [
        "input",
        "aggregates",
        "excluded",
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
        "expect-source-hash",
        "recorded-http-status",
      ] as const;
      const missing = requiredFlags.filter((flag) => {
        const value = values[flag];
        return typeof value !== "string" || value.trim() === "";
      });
      if (missing.length > 0) {
        throw new Error(
          `build-publication-aps-csv missing required flags: ${missing.map((flag) => `--${flag}`).join(", ")}`,
        );
      }
      const inputPath = values.input as string;
      const outPath = values.out as string;
      const reviewPath = values["review-out"] as string;
      const inputResolved = resolve(inputPath);
      if (resolve(outPath) === inputResolved || resolve(reviewPath) === inputResolved || resolve(outPath) === resolve(reviewPath)) {
        throw new Error("build-publication-aps-csv output paths must differ from each other and from the input artifact");
      }
      const bytes = new Uint8Array(await readFile(inputPath));
      const aggregatesRaw = JSON.parse(await readFile(values.aggregates as string, "utf8")) as {
        officialApplicationCount: number;
        officialApplicantCount: number;
        retrievedAt: string;
        sourceUrl: string;
        contentSha256: string;
        lastPublishedAt?: string;
        sourceName?: string;
      };
      const excludedRaw = JSON.parse(await readFile(values.excluded as string, "utf8")) as
        | (KnownExcludedRecordV2 & { htmlSha256?: string })
        | Array<KnownExcludedRecordV2 & { htmlSha256?: string }>;
      const knownExcludedRecords = Array.isArray(excludedRaw) ? excludedRaw : [excludedRaw];
      const officialAggregates: OfficialAggregatesV2 = {
        officialApplicationCount: aggregatesRaw.officialApplicationCount,
        officialApplicantCount: aggregatesRaw.officialApplicantCount,
        provenance: {
          sourceName: aggregatesRaw.sourceName ?? "ICANN APS Statistics",
          sourceUrl: aggregatesRaw.sourceUrl,
          retrievedAt: aggregatesRaw.retrievedAt,
          contentSha256: aggregatesRaw.contentSha256,
          ...(aggregatesRaw.lastPublishedAt ? { lastPublishedAt: aggregatesRaw.lastPublishedAt } : {}),
        },
      };
      const sourceVersion = Number.parseInt(values["source-version"] as string, 10);
      const recordedHttpStatus = Number.parseInt(values["recorded-http-status"] as string, 10);
      const result = buildPublicationFromApsApplicationCsv({
        bytes,
        artifactId: values["artifact-id"] as string,
        sourceVersion,
        captureId: values["capture-id"] as string,
        sourceUrl: values["source-url"] as string,
        sourceName: values["source-name"] as string,
        retrievedAt: values["retrieved-at"] as string,
        publishedAt: values["published-at"] as string,
        mediaType: (values["media-type"] as string | undefined) ?? APS_APPLICATION_CSV_MEDIA_TYPE,
        artifactRole: APS_APPLICATION_CSV_ARTIFACT_ROLE,
        evidenceClass: (values["evidence-class"] as string | undefined) ?? "icann-aps-application-csv",
        snapshotId: values["snapshot-id"] as string,
        recordedHttpStatus,
        expectSourceHash: values["expect-source-hash"] as string,
        officialAggregates,
        knownExcludedRecords: knownExcludedRecords.map((row) => {
          const evidenceSha256 = row.evidenceSha256 ?? row.htmlSha256;
          return {
            applicationId: row.applicationId,
            primaryString: row.primaryString,
            applicant: row.applicant,
            location: row.location,
            region: row.region,
            applicationStatus: row.applicationStatus,
            ...(row.applicationType ? { applicationType: row.applicationType } : {}),
            ...(row.processingStage ? { processingStage: row.processingStage } : {}),
            sourceUrl: row.sourceUrl,
            retrievedAt: row.retrievedAt,
            ...(evidenceSha256 ? { evidenceSha256 } : {}),
            notes: row.notes,
          };
        }),
        limitations: values.limitation,
      });
      if (result.ok && result.publication) {
        await writePublicationV2Artifacts({
          publicationPath: outPath,
          reviewPath,
          publication: result.publication,
          review: result.review,
        });
      } else {
        await rm(outPath, { force: true });
        await writeFile(reviewPath, `${JSON.stringify(result.review, null, 2)}\n`, "utf8");
      }
      for (const line of result.review.qualityLines) console.log(line);
      console.log(
        JSON.stringify(
          {
            ok: result.ok,
            schemaVersion: PUBLICATION_SCHEMA_VERSION_V20,
            parserVersion: APS_APPLICATION_CSV_PARSER_VERSION,
            normalizerVersion: APS_APPLICATION_CSV_NORMALIZER_VERSION,
            artifactRole: APS_APPLICATION_CSV_ARTIFACT_ROLE,
            review: result.review,
          },
          null,
          2,
        ),
      );
      if (!result.ok) process.exitCode = 1;
      return;
    }

    case "build-contention-membership": {
      if (values.fetch) {
        throw new Error("build-contention-membership does not fetch URLs. Remove --fetch.");
      }
      const requiredFlags = [
        "input",
        "application-publication",
        "out",
        "review-out",
        "bundle-out",
        "snapshot-id",
        "artifact-id",
        "capture-id",
        "source-url",
        "source-name",
        "source-version",
        "retrieved-at",
        "published-at",
        "expect-source-hash",
        "expect-application-graph-hash",
        "recorded-http-status",
      ] as const;
      const missing = requiredFlags.filter((flag) => {
        const value = values[flag];
        return typeof value !== "string" || value.trim() === "";
      });
      if (missing.length > 0) {
        throw new Error(
          `build-contention-membership missing required flags: ${missing.map((flag) => `--${flag}`).join(", ")}`,
        );
      }
      const inputPath = values.input as string;
      const outPath = values.out as string;
      const reviewPath = values["review-out"] as string;
      const bundlePath = values["bundle-out"] as string;
      const appPubPath = values["application-publication"] as string;
      const inputResolved = resolve(inputPath);
      const paths = [outPath, reviewPath, bundlePath, appPubPath].map((p) => resolve(p));
      if (new Set([inputResolved, ...paths]).size !== 1 + paths.length) {
        throw new Error("build-contention-membership output paths must differ from each other and from input/publication paths");
      }
      const bytes = new Uint8Array(await readFile(inputPath));
      const applicationPublication = JSON.parse(await readFile(appPubPath, "utf8")) as Registry2026PublicationV2;
      const sourceVersion = Number.parseInt(values["source-version"] as string, 10);
      const recordedHttpStatus = Number.parseInt(values["recorded-http-status"] as string, 10);
      const computedPin = contentHash(applicationGraphHashInput(applicationPublication));
      const result = buildContentionMembershipFromLocalArtifact({
        bytes,
        artifactId: values["artifact-id"] as string,
        sourceVersion,
        captureId: values["capture-id"] as string,
        sourceUrl: values["source-url"] as string,
        finalUrl: values["final-url"] as string | undefined,
        sourceName: values["source-name"] as string,
        retrievedAt: values["retrieved-at"] as string,
        publishedAt: values["published-at"] as string,
        mediaType: (values["media-type"] as string | undefined) ?? APS_CONTENTION_CSV_MEDIA_TYPE,
        artifactRole: APS_CONTENTION_CSV_ARTIFACT_ROLE,
        evidenceClass: (values["evidence-class"] as string | undefined) ?? "icann-reveal-day-contention-csv",
        snapshotId: values["snapshot-id"] as string,
        recordedHttpStatus,
        expectSourceHash: values["expect-source-hash"] as string,
        applicationPublication,
        expectApplicationGraphHash: values["expect-application-graph-hash"] as string,
        bundleId: values["bundle-id"] as string | undefined,
        limitations: values.limitation,
      });
      if (result.ok && result.snapshot && result.evidenceBundle) {
        await writeContentionMembershipArtifacts({
          snapshotPath: outPath,
          reviewPath,
          bundlePath,
          snapshot: result.snapshot,
          review: result.review,
          evidenceBundle: result.evidenceBundle,
        });
      } else {
        await rm(outPath, { force: true });
        await rm(bundlePath, { force: true });
        await writeFile(reviewPath, `${JSON.stringify(result.review, null, 2)}\n`, "utf8");
      }
      for (const line of result.review.qualityLines) console.log(line);
      console.log(
        JSON.stringify(
          {
            ok: result.ok,
            schemaVersion: CONTENTION_MEMBERSHIP_SCHEMA_VERSION,
            parserVersion: APS_CONTENTION_CSV_PARSER_VERSION,
            normalizerVersion: APS_CONTENTION_CSV_NORMALIZER_VERSION,
            artifactRole: APS_CONTENTION_CSV_ARTIFACT_ROLE,
            computedApplicationGraphHash: computedPin,
            review: result.review,
          },
          null,
          2,
        ),
      );
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
