import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { reconcileContentionSets, buildStringByApplicationId, type ContentionSetRecord } from "./contention-reconciliation";
import { loadFixtureBundle } from "./load-bundle";
import { parseRevealDayCsvText } from "./parse-reveal-csv";
import { classify2012RevealDayApplications, buildTaxonomyCoverageReport } from "../registry-market-taxonomy/classify-2012";

export async function buildContentionReconciliationForBundle(bundleId: string, workspaceRoot: string) {
  const loaded = await loadFixtureBundle(bundleId, workspaceRoot);
  if (loaded.applicationFormat !== "reveal-day-csv") {
    throw new Error(`contention-reconcile requires reveal-day-csv bundle (got ${loaded.applicationFormat})`);
  }

  const csvPath = join(loaded.workspaceRoot, loaded.definition.fixtureRoot, "sources", "strings-1200utc-13jun12-en.csv");
  const csv = await readFile(csvPath, "utf8");
  const rows = parseRevealDayCsvText(csv);
  const stringByApp = buildStringByApplicationId(rows);

  const contentionPath = join(loaded.workspaceRoot, loaded.definition.fixtureRoot, "contention-sets.json");
  const contention = JSON.parse(await readFile(contentionPath, "utf8")) as {
    sets: ContentionSetRecord[];
    applicationMembershipCount: number;
    uniqueApplicationIds: number;
  };

  return reconcileContentionSets(contention.sets, stringByApp, {
    applicationMembershipCount: contention.applicationMembershipCount,
    uniqueApplicationIds: contention.uniqueApplicationIds,
  });
}

export async function buildTaxonomyCoverageForBundle(bundleId: string, workspaceRoot: string) {
  const loaded = await loadFixtureBundle(bundleId, workspaceRoot);
  if (loaded.applicationFormat !== "reveal-day-csv") {
    throw new Error(`taxonomy-coverage requires reveal-day-csv bundle (got ${loaded.applicationFormat})`);
  }

  const csvPath = join(loaded.workspaceRoot, loaded.definition.fixtureRoot, "sources", "strings-1200utc-13jun12-en.csv");
  const csv = await readFile(csvPath, "utf8");
  const rows = parseRevealDayCsvText(csv);
  const records = classify2012RevealDayApplications(rows);
  return {
    coverage: buildTaxonomyCoverageReport(records),
    recordCount: records.length,
  };
}
