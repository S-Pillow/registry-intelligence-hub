import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRevealDayCsvText } from "@/normalization/parse-reveal-csv";
import { runCrossRoundOrganizationIdentityPass } from "@/cross-round-organization-identity/run-pass";
import {
  lineagesForCurrentOrganizationKey,
  listApprovedHistoricalLineages,
  loadHistoricalOrganizationLineageRegistry,
  resolveLineageByAlias,
} from "./load-lineage";

const workspaceRoot = process.cwd();
const csvPath = join(
  workspaceRoot,
  "src/normalization/fixtures/icann2012-reveal-day-v1/sources/strings-1200utc-13jun12-en.csv",
);
const promotionsPath = join(
  workspaceRoot,
  "src/normalization/fixtures/icann2012-reveal-day-v1/organization-promotions.json",
);

describe("RIH-HIST-ORG-LINEAGE-1 GoDaddy Registry / NeuStar", () => {
  it("preserves exact 2012 Applicant NeuStar, Inc. for application 1-863-45071", async () => {
    const text = await readFile(csvPath, "utf8");
    const rows = parseRevealDayCsvText(text);
    const row = rows.find((r) => r.applicationId === "1-863-45071");
    expect(row).toBeTruthy();
    expect(row!.applicantLegalName).toBe("NeuStar, Inc.");
    expect(row!.stringUlabel).toBe("NEUSTAR");
    expect(row!.preservedColumns.Website).toBe("http://www.neustar.biz");
  });

  it("promotes NeuStar through the governed 2012 Organization path", async () => {
    const registry = JSON.parse(await readFile(promotionsPath, "utf8")) as {
      operations: Array<{
        organizationKey: string;
        canonicalOrganizationName: string;
        promotionState: string;
        reviewState: string;
        applicationIds: string[];
      }>;
    };
    const op = registry.operations.find((o) => o.organizationKey === "neustar");
    expect(op).toBeTruthy();
    expect(op!.canonicalOrganizationName).toBe("NeuStar, Inc.");
    expect(op!.promotionState).toBe("CONFIRMED");
    expect(op!.reviewState).toBe("steward-approved");
    expect(op!.applicationIds).toEqual(["1-863-45071"]);
  });

  it("keeps Go Daddy East, LLC separate from NeuStar lineage", async () => {
    const text = await readFile(csvPath, "utf8");
    const rows = parseRevealDayCsvText(text);
    const east = rows.filter((r) => r.applicantLegalName === "Go Daddy East, LLC");
    expect(east.map((r) => r.stringUlabel).sort()).toEqual(["CASA", "GODADDY", "HOME"]);
    const lineage = listApprovedHistoricalLineages().find((r) => r.historicalOrganizationKey === "neustar");
    expect(lineage).toBeTruthy();
    expect(lineage!.nonClaims.some((n) => /Go Daddy East/i.test(n))).toBe(true);
    expect(lineage!.aliases.every((a) => !/go daddy east/i.test(a))).toBe(true);
  });

  it("joins NeuStar historical Organization to existing GoDaddy Registry Organization as BUSINESS_LINE_SUCCESSION", () => {
    const registry = loadHistoricalOrganizationLineageRegistry();
    expect(registry.records).toHaveLength(1);
    const record = registry.records[0]!;
    expect(record.historicalOrganizationId).toBe("organization:promoted:neustar");
    expect(record.currentOrganizationId).toBe("organization:resolved-2026:godaddy-registry-services");
    expect(record.currentCanonicalName).toBe("GoDaddy (Registry Services, LLC)");
    expect(record.relationshipType).toBe("BUSINESS_LINE_SUCCESSION");
    expect(record.relationshipType).not.toBe("SAME_ENTITY_RENAME");
    expect(record.effectiveDateOrYear).toBe("2020-08");
    expect(record.stewardState).toBe("steward-approved");
    expect(record.evidence.some((e) => e.sourceType === "sec-filing")).toBe(true);
  });

  it("does not create a duplicate GoDaddy Registry Organization", () => {
    const forGoDaddy = lineagesForCurrentOrganizationKey("godaddy-registry-services");
    expect(forGoDaddy).toHaveLength(1);
    expect(forGoDaddy[0]!.currentOrganizationKey).toBe("godaddy-registry-services");
  });

  it("resolves Neustar / GoDaddy Registry aliases into lineage context", () => {
    for (const q of [
      "Neustar",
      "NeuStar",
      "NeuStar, Inc.",
      "GoDaddy Registry",
      "Registry Services, LLC",
      "GoDaddy Registry Services",
    ]) {
      const hits = resolveLineageByAlias(q);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0]!.historicalOrganizationKey).toBe("neustar");
      expect(hits[0]!.currentOrganizationKey).toBe("godaddy-registry-services");
    }
  });

  it("keeps historical and current labels distinguished", () => {
    const record = listApprovedHistoricalLineages()[0]!;
    expect(record.historicalCanonicalName).toBe("NeuStar, Inc.");
    expect(record.currentCanonicalName).toContain("GoDaddy");
    expect(record.historicalCanonicalName).not.toEqual(record.currentCanonicalName);
    expect(record.nonClaims.some((n) => /rename/i.test(n))).toBe(true);
  });

  it("preserves GoDaddy ↔ Uniregistry ACQUIRED_AFTER_2012 rejection and GoDaddy app count", async () => {
    const { snapshot } = await runCrossRoundOrganizationIdentityPass({
      workspaceRoot,
      writeArtifacts: false,
      applyStewardApprovals: true,
    });
    const godaddy = snapshot.mappings.find((m) => m.organization2026Key === "godaddy-registry-services");
    expect(godaddy?.organization2012Key).toBe("uniregistry");
    expect(godaddy?.relationshipType).toBe("ACQUIRED_AFTER_2012");
    expect(godaddy?.state).toBe("REJECTED");
    expect(godaddy?.organization2026ApplicationCount).toBe(77);
    expect(godaddy?.organization2012Key).not.toBe("neustar");
  });
});
