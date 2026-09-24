#!/usr/bin/env node
import { parseArgs } from "node:util";
import { acquirePilotLivePortions, acquirePilotPortions, formatDryRunReport } from "./acquire";
import { runMappingLive } from "./mapping-live";
import {
  buildMappingLivePreflightReport,
  formatMappingLivePreflightReport,
} from "./mapping-live-preflight";
import { formatMappingDryRun, runMappingDryRun } from "./mapping-dry-run";
import { formatMappingReviewReport, runMappingReview } from "./mapping-review";
import {
  buildMappingLiveOperatorPlan,
  formatMappingLiveOperatorPlan,
  formatMappingLiveOperatorPlanJson,
} from "./mapping-live-plan";
import { completeMappingLiveOperatorFlow } from "./mapping-live-operator-flow";
import {
  RSP_ACQUISITION_AUTH_ENV,
  RSP_MAPPING_LIVE_AUTH_ENV,
  RSP_PAGER_DIAGNOSTIC_AUTH_ENV,
  RSP_PILOT_LIVE_AUTH_ENV,
  RSP_PORTION_DIAGNOSTIC_AUTH_ENV,
} from "./constants";
import {
  formatPagerLiveDiagnosticReport,
  runPagerLiveDiagnostic,
} from "./pager-live-diagnostic";
import {
  formatPortionLiveDiagnosticReport,
  runPortionLiveDiagnostic,
} from "./portion-live-diagnostic";
import {
  buildPreflightReport,
  formatPreflightReport,
  type PreflightOperation,
} from "./preflight-report";

function warnLegacyAcquisitionEnv(): void {
  if (process.env[RSP_ACQUISITION_AUTH_ENV] === "1") {
    console.warn(
      `Warning: ${RSP_ACQUISITION_AUTH_ENV} is deprecated and does not grant live HTTP. ` +
        `Use ${RSP_PILOT_LIVE_AUTH_ENV}=1 with steward-approved EVIDENCE mapping for pilot-live.`,
    );
  }
}

function usage(): string {
  return `ICANN 2012 RSP public portions acquisition (offline-first)

Usage:
  npm run acquire-rsp-portions -- pilot [--workspace <dir>] [--staging <dir>]
  npm run acquire-rsp-portions -- pilot-live [--workspace <dir>] [--staging <dir>] [--approved-mapping <json>] [--evidence-index <mapping-run-dir>]
  npm run acquire-rsp-portions -- mapping-dry-run [--workspace <dir>] [--grid-html <sources/index/...>] [--mapping-csv <path>] [--approved-mapping <json>]
  npm run acquire-rsp-portions -- mapping-live [--workspace <dir>] [--staging <dir>] [--run-id <id>] [--resume] [--force-new-run] [--preflight-only]
  npm run acquire-rsp-portions -- mapping-live-plan [--workspace <dir>] [--staging <dir>] [--json]
  npm run acquire-rsp-portions -- mapping-review --run-dir <staging dir> [--workspace <dir>]
  npm run acquire-rsp-portions -- preflight-report --operation <pilot|pilot-live|mapping-dry-run|mapping-live> [--workspace <dir>] [--staging <dir>] [--approved-mapping <json>]
  npm run acquire-rsp-portions -- pager-live-diagnostic
  npm run acquire-rsp-portions -- portion-live-diagnostic

Environment:
  ${RSP_PILOT_LIVE_AUTH_ENV}=1  Required for pilot-live HTTP (with EVIDENCE+APPROVED mapping artifact).
  ${RSP_MAPPING_LIVE_AUTH_ENV}=1  Required for mapping-live grid crawl HTTP. Does not authorize pager-live-diagnostic.
  ${RSP_PAGER_DIAGNOSTIC_AUTH_ENV}=1  Required for the bounded pager diagnostic (page 1, logical page 2, stop).
  ${RSP_PORTION_DIAGNOSTIC_AUTH_ENV}=1  Required for the one-application public-portion diagnostic. Pilot, mapping, and pager gates do not authorize it.
  --evidence-index <dir>  Mapping-live run directory. Required for pilot-live of an APPROVED mapping. Fixture raw-snapshots.json is not accepted.
  ${RSP_ACQUISITION_AUTH_ENV}   Deprecated — does not authorize live requests.

Examples:
  npm run acquire-rsp-portions -- pilot
  npm run acquire-rsp-portions -- preflight-report --operation pilot-live
  REGISTRY_HUB_RSP_PILOT_LIVE_AUTHORIZED=1 npm run acquire-rsp-portions -- pilot-live --staging /var/tmp/icann2012-rsp-staging
`;
}

async function main(): Promise<void> {
  warnLegacyAcquisitionEnv();

  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      workspace: { type: "string", default: process.cwd() },
      staging: { type: "string" },
      "grid-html": { type: "string" },
      "mapping-csv": { type: "string" },
      "approved-mapping": { type: "string" },
      "evidence-index": { type: "string" },
      operation: { type: "string" },
      "run-id": { type: "string" },
      resume: { type: "boolean", default: false },
      "force-new-run": { type: "boolean", default: false },
      "preflight-only": { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      "run-dir": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help || positionals.length === 0) {
    console.log(usage());
    process.exit(0);
  }

  const command = positionals[0];
  const workspaceRoot = values.workspace as string;

  if (command === "pilot") {
    const result = await acquirePilotPortions({
      workspaceRoot,
      stagingRoot: values.staging as string | undefined,
      mappingArtifactPath: values["approved-mapping"] as string | undefined,
    });
    console.log(formatDryRunReport(result));
    return;
  }

  if (command === "pilot-live") {
    const result = await acquirePilotLivePortions({
      workspaceRoot,
      stagingRoot: values.staging as string | undefined,
      mappingArtifactPath: values["approved-mapping"] as string | undefined,
      evidenceIndexPath: values["evidence-index"] as string | undefined,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "mapping-dry-run") {
    const result = await runMappingDryRun({
      workspaceRoot,
      gridHtmlPath: values["grid-html"] as string | undefined,
      mappingCsvPath: values["mapping-csv"] as string | undefined,
      approvedMappingJsonPath: values["approved-mapping"] as string | undefined,
    });
    console.log(formatMappingDryRun(result));
    return;
  }

  if (command === "mapping-live-plan") {
    const plan = await buildMappingLiveOperatorPlan({
      workspaceRoot,
      stagingRoot: values.staging as string | undefined,
    });
    console.log(
      values.json ? formatMappingLiveOperatorPlanJson(plan) : formatMappingLiveOperatorPlan(plan),
    );
    return;
  }

  if (command === "mapping-live") {
    const stagingRoot = values.staging as string | undefined;
    if (values["preflight-only"] as boolean) {
      const plan = await buildMappingLiveOperatorPlan({ workspaceRoot, stagingRoot });
      console.log(formatMappingLiveOperatorPlan(plan));
      return;
    }
    const preflight = await buildMappingLivePreflightReport({ workspaceRoot, stagingRoot });
    console.log(formatMappingLivePreflightReport(preflight));
    if (preflight.blockingReasons.length > 0) {
      process.exit(1);
    }
    const result = await runMappingLive({
      workspaceRoot,
      stagingRoot,
      runId: values["run-id"] as string | undefined,
      resume: values.resume as boolean,
      forceNewRun: values["force-new-run"] as boolean,
    });
    if (result.forceNewRunDisposition) {
      for (const warning of result.forceNewRunDisposition.operatorWarnings) {
        console.warn(`Warning: ${warning}`);
      }
      if (result.forceNewRunDisposition.archivedCheckpointPath) {
        console.warn(
          `Archived prior checkpoint: ${result.forceNewRunDisposition.archivedCheckpointPath}`,
        );
      }
    }
    const flow = await completeMappingLiveOperatorFlow({ workspaceRoot, liveResult: result });
    console.log(flow.provenanceSummaryText);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.exact ? 0 : 1);
  }

  if (command === "mapping-review") {
    const runDir = values["run-dir"] as string | undefined;
    if (!runDir) {
      console.error("--run-dir is required for mapping-review\n");
      console.log(usage());
      process.exit(1);
    }
    const report = await runMappingReview({ workspaceRoot, runDir });
    console.log(formatMappingReviewReport(report));
    const exitCode = report.roundWideExact && report.mappingReviewPass ? 0 : 1;
    console.error(
      `mapping-review exit trace: exitCode=${exitCode} roundWideExact=${report.roundWideExact} mappingReviewPass=${report.mappingReviewPass} failureClassification=${report.failureClassification} pilotResolvedCount=${report.pilotResolvedCount}/${report.pilotExpectedCount}`,
    );
    process.exit(exitCode);
  }

  if (command === "pager-live-diagnostic") {
    const report = await runPagerLiveDiagnostic();
    console.log(formatPagerLiveDiagnosticReport(report));
    process.exit(report.classification === "PAGER_PAGE2_OK" ? 0 : 1);
  }

  if (command === "portion-live-diagnostic") {
    const report = await runPortionLiveDiagnostic();
    console.log(formatPortionLiveDiagnosticReport(report));
    process.exit(report.classification === "PORTION_OK" ? 0 : 1);
  }

  if (command === "preflight-report") {
    const operation = values.operation as PreflightOperation | undefined;
    if (
      !operation ||
      !["pilot", "pilot-live", "mapping-dry-run", "mapping-live"].includes(operation)
    ) {
      console.error("--operation is required (pilot | pilot-live | mapping-dry-run | mapping-live)\n");
      console.log(usage());
      process.exit(1);
    }
    const report = await buildPreflightReport({
      workspaceRoot,
      operation: operation as PreflightOperation,
      stagingRoot: values.staging as string | undefined,
      mappingArtifactPath: values["approved-mapping"] as string | undefined,
      evidenceIndexPath: values["evidence-index"] as string | undefined,
    });
    console.log(formatPreflightReport(report));
    return;
  }

  console.error(`Unknown command: ${command}\n\n${usage()}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
