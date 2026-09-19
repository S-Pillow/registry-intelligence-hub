#!/usr/bin/env node
import { parseArgs } from "node:util";
import { join } from "node:path";
import {
  evaluateApplicationActualityPromotion,
  organizationMetricsRemainGatedAfterApplicationPromotion,
  readClaimActualityState,
  writeClaimActualityState,
} from "./claim-actuality";
import { buildComparisonUnlockReport } from "./comparison-unlock";
import { assertNoFixtureContaminationInRealBuild } from "./contamination";
import { loadPublicationSnapshotFromPath, runDryRunIngestion } from "./dry-run";
import { buildRevealDayVerificationReport } from "./verify-report";

const DEFAULT_STATE = "./.data/reveal-2026/claim-actuality-state.json";
const DEFAULT_REHEARSAL_SNAPSHOT =
  "src/reveal-day-2026/fixtures/rehearsal-2026-pipeline-v1/publication.snapshot.json";

function usage(): string {
  return `Registry Intelligence Hub — 2026 Reveal Day ingestion (offline)

Usage:
  npm run reveal-2026 -- dry-run [--snapshot <path>]
  npm run reveal-2026 -- validate [--snapshot <path>]
  npm run reveal-2026 -- comparison-unlock [--state <path>]
  npm run reveal-2026 -- promote-actuality --snapshot <path> [--state <path>]
  npm run reveal-2026 -- verify-reveal-day [--snapshot <path>] [--state <path>] [--workspace <dir>]

Defaults:
  --snapshot  ${DEFAULT_REHEARSAL_SNAPSHOT} (rehearsal-for-pipeline-only)
  --state     ${DEFAULT_STATE}
`;
}

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      snapshot: { type: "string" },
      state: { type: "string" },
      workspace: { type: "string" },
    },
  });

  const [command] = positionals;
  const statePath = values.state ?? DEFAULT_STATE;
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

    case "comparison-unlock": {
      const state = await readClaimActualityState(statePath);
      const report = buildComparisonUnlockReport(state);
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    case "promote-actuality": {
      if (!values.snapshot) {
        throw new Error("promote-actuality requires --snapshot pointing at an immutable publication (not the default rehearsal fixture)");
      }
      const snapshot = await loadPublicationSnapshotFromPath(snapshotPath);
      const contamination = assertNoFixtureContaminationInRealBuild(snapshot, "promote");
      if (!contamination.ok) {
        console.error(contamination.message);
        process.exitCode = 1;
        return;
      }
      const diagnostics = runDryRunIngestion(snapshot);
      const current = await readClaimActualityState(statePath);
      const result = evaluateApplicationActualityPromotion(snapshot, diagnostics, current);
      if (!result.ok) {
        console.error(result.errors.join("\n"));
        process.exitCode = 1;
        return;
      }
      await writeClaimActualityState(statePath, result.nextState);
      const unlock = buildComparisonUnlockReport(result.nextState);
      console.log(
        JSON.stringify(
          {
            promoted: true,
            round2026ApplicationActuality: result.nextState.round2026ApplicationActuality,
            snapshotId: result.nextState.snapshotId,
            snapshotContentHash: result.nextState.snapshotContentHash,
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
      const report = await buildRevealDayVerificationReport(snapshot, diagnostics, state, workspaceRoot);
      console.log(JSON.stringify(report, null, 2));
      if (!diagnostics.validation.ok) process.exitCode = 1;
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
