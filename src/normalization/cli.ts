#!/usr/bin/env node
import { parseArgs } from "node:util";
import { FIXTURE_BUNDLE_REGISTRY } from "./registry";
import { createStore, normalizeAndPersist, runNormalization } from "./pipeline";
import { traceEntity } from "./trace";
import { verifyStoredBuild } from "./store";
import { contentHash } from "./hashes";
import { summarizeStates, totalEntities } from "./report";
import { buildContentionReconciliationForBundle, buildTaxonomyCoverageForBundle } from "./offline-reports";
import { buildOrganizationPromotionReportForBundle } from "./organization-promotion-report";
import { crossRoundIdentityCliReport } from "../cross-round-identity/load-registry";
import { runFirstPassOrganizationResolution } from "../organization-resolution-2026/run-first-pass";

const DEFAULT_ROOT = "./.data/normalization";
const DEFAULT_BUNDLE = "icann2012-representative-v1";

function usage(): string {
  return `Registry Intelligence Hub — offline normalization (2012 foundation slice)

Usage:
  npm run normalize -- list-bundles
  npm run normalize -- normalize [--bundle <id>] [--root <dir>] [--workspace <dir>]
  npm run normalize -- report [--build <buildId>] [--root <dir>]
  npm run normalize -- reconcile [--build <buildId>] [--root <dir>]
  npm run normalize -- contention-reconcile [--bundle <id>] [--workspace <dir>]
  npm run normalize -- taxonomy-coverage [--bundle <id>] [--workspace <dir>]
  npm run normalize -- organization-promotion [--bundle <id>] [--workspace <dir>]
  npm run normalize -- cross-round-identity [--workspace <dir>]
  npm run normalize -- organization-resolution-2026 [--workspace <dir>] [--write]
  npm run normalize -- trace <entityKind> <entityId> [--build <buildId>] [--root <dir>]
  npm run normalize -- verify [--build <buildId>] [--root <dir>]

Options:
  --root <dir>       Normalization artifact store (default "${DEFAULT_ROOT}", gitignored)
  --workspace <dir>  Repo root containing fixture bundles (default cwd)
  --bundle <id>      Fixture bundle id (default "${DEFAULT_BUNDLE}")
  --build <buildId>  Existing build to read (default: latest in store)
`;
}

async function resolveBuild(store: ReturnType<typeof createStore>, buildId?: string) {
  if (buildId) return store.readBuild(buildId);
  const ids = await store.listBuildIds();
  if (ids.length === 0) throw new Error("No builds in store — run normalize first");
  return store.readBuild(ids[ids.length - 1]);
}

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      root: { type: "string" },
      workspace: { type: "string" },
      bundle: { type: "string" },
      build: { type: "string" },
      write: { type: "boolean", default: false },
    },
  });

  const [command, ...rest] = positionals;
  const storeRoot = values.root ?? DEFAULT_ROOT;
  const workspaceRoot = values.workspace ?? process.cwd();
  const bundleId = values.bundle ?? DEFAULT_BUNDLE;

  switch (command) {
    case "list-bundles": {
      for (const b of FIXTURE_BUNDLE_REGISTRY) {
        console.log(`${b.id} (v${b.version}) — ${b.label}`);
        console.log(`  ${b.coverageNote}`);
      }
      return;
    }

    case "normalize": {
      const artifacts = await normalizeAndPersist({ bundleId, workspaceRoot, storeRoot });
      console.log(`Build ${artifacts.manifest.buildId} written to ${storeRoot}`);
      console.log(`  entities: ${artifacts.manifest.entityCount}, observations: ${artifacts.manifest.observationCount}`);
      console.log(`  input hash: ${artifacts.manifest.inputContentHash}`);
      console.log(`  output hash: ${artifacts.manifest.outputContentHash}`);
      return;
    }

    case "contention-reconcile": {
      const report = await buildContentionReconciliationForBundle(bundleId, workspaceRoot);
      console.log(JSON.stringify(report, null, 2));
      if (report.reconciledSetEntityCount !== report.icannCitedSetEntityCount) process.exitCode = 1;
      return;
    }

    case "taxonomy-coverage": {
      const { coverage } = await buildTaxonomyCoverageForBundle(bundleId, workspaceRoot);
      console.log(JSON.stringify(coverage, null, 2));
      return;
    }

    case "organization-promotion": {
      const report = await buildOrganizationPromotionReportForBundle(bundleId, workspaceRoot);
      console.log(JSON.stringify(report, null, 2));
      if (!report.highImpactCoverageComplete) process.exitCode = 1;
      return;
    }

    case "cross-round-identity": {
      const report = await crossRoundIdentityCliReport(workspaceRoot);
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    case "organization-resolution-2026": {
      const result = await runFirstPassOrganizationResolution({
        workspaceRoot,
        writeArtifacts: Boolean(values.write),
      });
      console.log(
        JSON.stringify(
          {
            inventory: result.inventory,
            quality: result.snapshot.quality,
            semanticContentSha256: result.snapshot.semanticContentSha256,
            applicationPublicationPin: result.snapshot.applicationPublicationPin,
            artifacts: result.artifacts ?? null,
            productEligible: result.inventory.productEligible,
          },
          null,
          2,
        ),
      );
      return;
    }

    case "report":
    case "reconcile": {
      const store = createStore(storeRoot);
      const artifacts = await resolveBuild(store, values.build);
      const report = artifacts.report;
      console.log(JSON.stringify(report, null, 2));
      console.log(`Summary: ${totalEntities(report.entityCounts)} entities; ${summarizeStates(report.reconciliationSummary)}`);
      return;
    }

    case "trace": {
      const [entityKind, entityId] = rest;
      if (!entityKind || !entityId) throw new Error("trace requires <entityKind> <entityId>");
      const store = createStore(storeRoot);
      const artifacts = await resolveBuild(store, values.build);
      const result = traceEntity(artifacts, entityKind, entityId);
      console.log(JSON.stringify(result, null, 2));
      if (!result.entity) process.exitCode = 1;
      return;
    }

    case "verify": {
      const store = createStore(storeRoot);
      const artifacts = await resolveBuild(store, values.build);
      const verification = verifyStoredBuild(artifacts);
      const rebuild = await runNormalization({ bundleId: artifacts.manifest.bundleId, workspaceRoot, storeRoot });
      const reportMatch =
        contentHash({ ...artifacts.report, generatedAt: "FIXED" }) === contentHash({ ...rebuild.report, generatedAt: "FIXED" });
      const byteMatch =
        artifacts.manifest.outputContentHash === rebuild.manifest.outputContentHash &&
        artifacts.manifest.inputContentHash === rebuild.manifest.inputContentHash;
      console.log(`${verification.ok ? "OK" : "FAIL"} stored artifact integrity`);
      for (const err of verification.errors) console.log(`  - ${err}`);
      console.log(`${byteMatch ? "OK" : "FAIL"} deterministic offline rebuild (content hashes)`);
      console.log(`${reportMatch ? "OK" : "FAIL"} quality report stable across rebuild`);
      if (!verification.ok || !byteMatch || !reportMatch) process.exitCode = 1;
      return;
    }

    default: {
      console.log(usage());
      if (command && command !== "help") process.exitCode = 1;
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
