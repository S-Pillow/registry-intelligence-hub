#!/usr/bin/env node
import { parseArgs } from "node:util";
import { join } from "node:path";
import { fetchOne } from "../pipeline/pipeline";
import {
  evaluateApplicationActualityPromotion,
  organizationMetricsRemainGatedAfterApplicationPromotion,
  readClaimActualityState,
  writeClaimActualityState,
} from "./claim-actuality";
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
    },
  });

  const [command] = positionals;
  const statePath = values.state ?? DEFAULT_STATE;
  const historyPath = values.history ?? DEFAULT_PROMOTION_HISTORY_PATH;
  const pipelineRoot = values["pipeline-root"] ?? DEFAULT_PIPELINE_ROOT;
  const workspaceRoot = values.workspace ?? process.cwd();
  const snapshotPath = values.snapshot ?? join(workspaceRoot, DEFAULT_REHEARSAL_SNAPSHOT);

  switch (command) {
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

    default:
      console.log(usage());
      if (command && command !== "help") process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
