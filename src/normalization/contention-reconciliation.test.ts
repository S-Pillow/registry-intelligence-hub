import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ICANN_CITED_CONTENTION_SET_COUNT,
  OFFICIAL_CONTENTION_MEMBERSHIP_COUNT,
  reconcileContentionSets,
  buildStringByApplicationId,
} from "./contention-reconciliation";
import { parseRevealDayCsvText } from "./parse-reveal-csv";

const workspaceRoot = join(import.meta.dirname, "..", "..");
const bundleRoot = join(workspaceRoot, "src/normalization/fixtures/icann2012-reveal-day-v1");

describe("contention set reconciliation (2012 PDF extraction)", () => {
  it("reconciles 234 extracted entities to ICANN-cited 232 with 754 membership", async () => {
    const csv = await readFile(join(bundleRoot, "sources/strings-1200utc-13jun12-en.csv"), "utf8");
    const rows = parseRevealDayCsvText(csv);
    const stringByApp = buildStringByApplicationId(rows);
    const contention = JSON.parse(await readFile(join(bundleRoot, "contention-sets.json"), "utf8"));

    const report = reconcileContentionSets(contention.sets, stringByApp, {
      applicationMembershipCount: contention.applicationMembershipCount,
      uniqueApplicationIds: contention.uniqueApplicationIds,
    });

    expect(report.extractorSetEntityCount).toBe(234);
    expect(report.icannCitedSetEntityCount).toBe(ICANN_CITED_CONTENTION_SET_COUNT);
    expect(report.reconciledSetEntityCount).toBe(232);
    expect(report.setEntityGap).toBe(2);
    expect(report.membershipMatchesOfficial).toBe(true);
    expect(report.uniqueMembershipApplicationIds).toBe(OFFICIAL_CONTENTION_MEMBERSHIP_COUNT);
    expect(report.productionSetCountIntelligence).toBe("blocked");
    expect(report.adjustments.some((a) => a.kind === "pdf_number_row_artifact")).toBe(true);
    expect(report.extractorEntityCountAfterArtifactDissolve).toBe(233);
    expect(report.stringFragmentationEntityDelta).toBe(1);
  });
});
