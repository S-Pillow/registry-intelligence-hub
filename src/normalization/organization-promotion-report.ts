import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadFixtureBundle } from "./load-bundle";
import { observationsFromParsedRecords } from "./observations";
import { normalizeFromObservations } from "./normalize";
import { parseBundle } from "./parse";
import { parseRevealDayCsvText } from "./parse-reveal-csv";
import {
  buildOrganizationPromotionReport,
  portfolioSizeByLegalNameFromRows,
} from "./organization-promotion";

export async function buildOrganizationPromotionReportForBundle(bundleId: string, workspaceRoot: string) {
  const loaded = await loadFixtureBundle(bundleId, workspaceRoot);
  const parsed = parseBundle(loaded);
  const observations = observationsFromParsedRecords(parsed);
  const entities = normalizeFromObservations(loaded, parsed, observations);

  let portfolioSizeByLegalName = new Map<string, number>();
  if (loaded.applicationFormat === "reveal-day-csv") {
    const csvPath = join(loaded.workspaceRoot, loaded.definition.fixtureRoot, "sources", "strings-1200utc-13jun12-en.csv");
    const csv = await readFile(csvPath, "utf8");
    portfolioSizeByLegalName = portfolioSizeByLegalNameFromRows(parseRevealDayCsvText(csv));
  } else {
    for (const entity of entities) {
      if (entity.entityKind !== "applicant") continue;
      const name = entity.legalName.value?.trim();
      if (!name) continue;
      portfolioSizeByLegalName.set(name, (portfolioSizeByLegalName.get(name) ?? 0) + 1);
    }
  }

  const applicationCount = entities.filter((e) => e.entityKind === "application").length;

  return buildOrganizationPromotionReport({
    bundleId,
    registry: loaded.organizationPromotions,
    entities,
    applicationCount,
    portfolioSizeByLegalName,
  });
}
