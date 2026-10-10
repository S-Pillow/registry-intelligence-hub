import { describe, expect, it } from "vitest";
import {
  AUDIENCES,
  buildBriefingCompareRows,
  compareEntitiesFromParams,
  currentScopeRecordCount,
  defaultDetailLevelForAudience,
  defaultEmphasisForAudience,
  defaultSectionsForScope,
  describeBriefingScope,
  detailLevelCap,
  generateEditionContent,
  type BriefingClaim,
  type BriefingScope,
  type GenerateEditionInput,
} from "./briefing-data";
import { APPROVED_2012_BASELINE } from "@/comparison/approved-2012-baseline";
import { rehearsalRegistryApplicationsDocument } from "./registry-application-payload-shared";
import { registryFixture, type Lens } from "./registry-data";

const RETIRED_FIXTURE_FINDING_PHRASES = [
  "Atlas Digital holds the rehearsal fixture",
  "IDN interest reaches two regions and two scripts",
  "each contain an identical-string set",
  "portfolio-ranking/1.0.0",
  "idn-share/1.0.0",
  "initial-contention/1.0.0",
];

function editionClaimText(edition: ReturnType<typeof generateEditionContent>) {
  return edition.sections.flatMap((section) => section.claims.map((claim) => `${claim.text} ${claim.method ?? ""}`)).join("\n");
}

function claimTexts(claims: BriefingClaim[]): string[] {
  return claims.map((claim) => claim.text);
}

describe("audience defaults", () => {
  it("exposes exactly the four Executive/Commercial/Product & Strategy/Marketing audiences", () => {
    expect(AUDIENCES.map((entry) => entry.id).sort()).toEqual(["commercial", "executive", "marketing", "product-strategy"].sort());
  });

  it("maps each audience's default emphasis onto Command Center's lens vocabulary", () => {
    expect(defaultEmphasisForAudience("executive")).toBe("all");
    expect(defaultEmphasisForAudience("commercial")).toBe("commercial");
    expect(defaultEmphasisForAudience("product-strategy")).toBe("strategy");
    expect(defaultEmphasisForAudience("marketing")).toBe("marketing");
  });

  it("defaults Executive to brief and the rest to standard", () => {
    expect(defaultDetailLevelForAudience("executive")).toBe("brief");
    expect(defaultDetailLevelForAudience("commercial")).toBe("standard");
    expect(defaultDetailLevelForAudience("product-strategy")).toBe("standard");
    expect(defaultDetailLevelForAudience("marketing")).toBe("standard");
  });
});

describe("scope defaults (briefings-design.md §12)", () => {
  it("never offers comparison-table, watchlist-summary, or saved-research-summary to a mismatched scope kind", () => {
    expect(defaultSectionsForScope("round-wide")).not.toContain("comparison-table");
    expect(defaultSectionsForScope("entity")).not.toContain("watchlist-summary");
    expect(defaultSectionsForScope("explore-view")).not.toContain("saved-research-summary");
    expect(defaultSectionsForScope("compare-config")).toContain("comparison-table");
    expect(defaultSectionsForScope("watchlist")).toContain("watchlist-summary");
    expect(defaultSectionsForScope("saved-research")).toContain("saved-research-summary");
  });

  it("always includes limitations by default for every scope kind", () => {
    const kinds: BriefingScope["kind"][] = ["round-wide", "entity", "explore-view", "compare-config", "watchlist", "saved-research"];
    for (const kind of kinds) expect(defaultSectionsForScope(kind)).toContain("limitations");
  });
});

describe("generateEditionContent — round-wide scope", () => {
  const input: GenerateEditionInput = {
    scope: { kind: "round-wide" },
    emphasis: "all",
    detailLevel: "standard",
    sectionsWanted: defaultSectionsForScope("round-wide"),
  };

  it("produces headline metrics from roundPulse, a narrative frame, and a non-empty limitations section", () => {
    const edition = generateEditionContent(input);
    const headline = edition.sections.find((section) => section.id === "headline-metrics")!;
    expect(headline.claims.length).toBeGreaterThan(0);
    expect(headline.narrativeFrame).toMatch(/rehearsal fixture/i);

    const limitations = edition.sections.find((section) => section.id === "limitations")!;
    expect(limitations.claims.length).toBeGreaterThan(0);
    expect(edition.limitations.every((limitation) => limitation.nonRemovable)).toBe(true);
    expect(claimTexts(limitations.claims).some((text) => text.includes("Rehearsal fixture only"))).toBe(true);
  });

  it("pins snapshotId, methodVersion, and dataAsOfTime to the current fixture at generation time", () => {
    const edition = generateEditionContent(input);
    expect(edition.snapshotId).toBe(registryFixture.snapshotId);
    expect(edition.methodVersion).toBe(registryFixture.methodVersion);
    expect(edition.dataAsOfTime).toBe(registryFixture.baselineAt);
  });

  it("does not export static fixture findings for any lens", () => {
    const lenses: Lens[] = ["all", "commercial", "strategy", "marketing"];
    for (const emphasis of lenses) {
      const edition = generateEditionContent({ ...input, emphasis });
      const standout = edition.sections.find((section) => section.id === "what-stands-out")!;
      expect(standout.claims).toEqual([]);
      expect(standout.overflowCount).toBe(0);
      expect(standout.asOfNote).toMatch(/no eligible derived findings are available/i);
      expect(standout.asOfNote).toContain(registryFixture.snapshotId);
      const serialized = editionClaimText(edition);
      for (const phrase of RETIRED_FIXTURE_FINDING_PHRASES) expect(serialized).not.toContain(phrase);
      expect(serialized).not.toContain("applicant-legal-name-count");
      expect(serialized).not.toContain("exact-applied-string-grouping");
      expect(serialized).not.toContain("Initial string competition");
      expect(serialized).not.toContain("Community applications");
      expect(serialized).not.toContain("Geographic applications");
      expect(serialized).toContain("Applications in initial contention");
      expect(serialized).toContain(String(APPROVED_2012_BASELINE.contentionMembershipApplications));
      const headline = edition.sections.find((section) => section.id === "headline-metrics")!;
      expect(headline.claims.length).toBeGreaterThan(0);
      expect(headline.narrativeFrame?.length).toBeGreaterThan(0);
      if (emphasis === "all") expect(headline.narrativeFrame).toMatch(/rehearsal fixture/i);
      expect(edition.snapshotId).toBe(registryFixture.snapshotId);
      expect(claimTexts(edition.sections.find((section) => section.id === "limitations")!.claims).some((text) => text.includes("Rehearsal fixture only"))).toBe(true);
    }
  });

  it("does not let a promoted payload inherit static fixture findings", () => {
    const promoted = {
      ...rehearsalRegistryApplicationsDocument(),
      payloadMode: "promoted-2026" as const,
      snapshotId: "snap-promoted-2026-example",
    };
    const lenses: Lens[] = ["all", "commercial", "strategy", "marketing"];
    for (const emphasis of lenses) {
      const edition = generateEditionContent({ ...input, emphasis, registryDocument: promoted });
      const standout = edition.sections.find((section) => section.id === "what-stands-out")!;
      expect(standout.claims).toEqual([]);
      expect(standout.asOfNote).toMatch(/no eligible derived findings are available/i);
      expect(standout.asOfNote).toContain("snap-promoted-2026-example");
      const serialized = editionClaimText(edition);
      for (const phrase of RETIRED_FIXTURE_FINDING_PHRASES) expect(serialized).not.toContain(phrase);
      expect(serialized).not.toContain("applicant-legal-name-count");
      expect(serialized).not.toContain("exact-applied-string-grouping");
      expect(serialized).not.toContain("Initial string competition");
      expect(serialized).not.toContain("Community applications");
      expect(serialized).not.toContain("Geographic applications");
      expect(edition.snapshotId).toBe("snap-promoted-2026-example");
      expect(claimTexts(edition.sections.find((section) => section.id === "limitations")!.claims).some((text) => text.includes("Promoted 2026 application rows"))).toBe(true);
      expect(claimTexts(edition.sections.find((section) => section.id === "headline-metrics")!.claims).length).toBeGreaterThan(0);
    }
  });

  it("never emits a reserved truth class (public-enrichment, ai-assisted-inference, human-reviewed-assertion)", () => {
    const edition = generateEditionContent(input);
    const reserved = new Set(["public-enrichment", "ai-assisted-inference", "human-reviewed-assertion"]);
    for (const section of edition.sections) {
      for (const claim of section.claims) expect(reserved.has(claim.truthClass)).toBe(false);
    }
  });

  it("is deterministic: the same input produces the same claim text and order every time", () => {
    const first = generateEditionContent(input);
    const second = generateEditionContent(input);
    expect(first.sections.map((section) => claimTexts(section.claims))).toEqual(second.sections.map((section) => claimTexts(section.claims)));
    expect(first.recordedScopeCount).toBe(second.recordedScopeCount);
  });

  it("keeps round-wide stand-out empty at every detail level", () => {
    for (const detailLevel of ["brief", "standard", "deep"] as const) {
      const edition = generateEditionContent({ ...input, detailLevel });
      const standout = edition.sections.find((section) => section.id === "what-stands-out")!;
      expect(standout.claims).toEqual([]);
      expect(standout.overflowCount).toBe(0);
    }
  });

  it("never discards a generated claim: overflow is a count, not a deletion, so 'Show N more' has something to reveal", () => {
    const compareInput: GenerateEditionInput = {
      scope: { kind: "compare-config", params: { type: "organizations", ids: "Atlas Digital,Northstar Group" } },
      emphasis: "all",
      detailLevel: "brief",
      sectionsWanted: defaultSectionsForScope("compare-config"),
    };
    const brief = generateEditionContent(compareInput);
    const standard = generateEditionContent({ ...compareInput, detailLevel: "standard" });
    const briefSection = brief.sections.find((section) => section.id === "comparison-table")!;
    const standardSection = standard.sections.find((section) => section.id === "comparison-table")!;
    expect(briefSection.claims.length).toBe(standardSection.claims.length);
    expect(briefSection.claims.length).toBeGreaterThan(detailLevelCap("brief"));
    expect(briefSection.overflowCount).toBe(briefSection.claims.length - detailLevelCap("brief"));
    expect(briefSection.claims.length - briefSection.overflowCount).toBe(detailLevelCap("brief"));
  });
});

describe("generateEditionContent — entity scope", () => {
  it("scopes headline metrics and stand-out claims to only that entity's records", () => {
    const edition = generateEditionContent({
      scope: { kind: "entity", entityType: "organizations", entityKey: "Atlas Digital", label: "Atlas Digital" },
      emphasis: "all",
      detailLevel: "standard",
      sectionsWanted: defaultSectionsForScope("entity"),
    });
    expect(edition.recordedScopeCount).toBeGreaterThan(0);
    const headline = edition.sections.find((section) => section.id === "headline-metrics")!;
    expect(claimTexts(headline.claims).some((text) => text.includes("Atlas Digital"))).toBe(true);
  });
});

describe("generateEditionContent — explore-view scope", () => {
  it("states the cohort definition and result count, and flags an empty cohort as a limitation", () => {
    const nonEmpty = generateEditionContent({
      scope: { kind: "explore-view", params: { category: "Technology" } },
      emphasis: "all",
      detailLevel: "standard",
      sectionsWanted: defaultSectionsForScope("explore-view"),
    });
    const headline = nonEmpty.sections.find((section) => section.id === "headline-metrics")!;
    expect(claimTexts(headline.claims).some((text) => text.startsWith("Cohort / filter definition:"))).toBe(true);

    const empty = generateEditionContent({
      scope: { kind: "explore-view", params: { q: "no-such-record-xyz" } },
      emphasis: "all",
      detailLevel: "standard",
      sectionsWanted: defaultSectionsForScope("explore-view"),
    });
    expect(empty.recordedScopeCount).toBe(0);
    expect(empty.limitations.some((limitation) => limitation.text.includes("No records matched"))).toBe(true);
  });
});

describe("generateEditionContent — compare-config scope", () => {
  const params = { type: "organizations", ids: "Atlas Digital,Northstar Group" };

  it("reuses the same deterministic comparison engine as Compare for both the table and what-stands-out", () => {
    const edition = generateEditionContent({
      scope: { kind: "compare-config", params },
      emphasis: "all",
      detailLevel: "standard",
      sectionsWanted: defaultSectionsForScope("compare-config"),
    });
    const table = edition.sections.find((section) => section.id === "comparison-table")!;
    const standout = edition.sections.find((section) => section.id === "what-stands-out")!;
    expect(table.claims.length).toBeGreaterThan(0);
    expect(standout.claims.length).toBeGreaterThan(0);
    expect(standout.claims.every((claim) => claim.method === "compare-differences/1.0.0")).toBe(true);
  });

  it("surfaces unavailable/not-comparable cells as limitations linked to the originating claim, never dropped", () => {
    const edition = generateEditionContent({
      scope: { kind: "compare-config", params },
      emphasis: "all",
      detailLevel: "deep",
      sectionsWanted: defaultSectionsForScope("compare-config"),
    });
    const table = edition.sections.find((section) => section.id === "comparison-table")!;
    const marketDemandClaim = table.claims.find((claim) => claim.text.startsWith("Market demand:"));
    expect(marketDemandClaim).toBeDefined();
    expect(marketDemandClaim!.limitationRefs.length).toBeGreaterThan(0);
    const referencedLimitation = edition.limitations.find((limitation) => limitation.id === marketDemandClaim!.limitationRefs[0]);
    expect(referencedLimitation).toBeDefined();
    expect(referencedLimitation!.text).toMatch(/not comparable/i);
  });

  it("builds comparison rows with the same CompareRowLike shape the Compare engine consumes", () => {
    const { entities, type } = compareEntitiesFromParams(params);
    const rows = buildBriefingCompareRows(type, entities);
    expect(rows.every((row) => typeof row.label === "string" && Array.isArray(row.cells))).toBe(true);
  });
});

describe("generateEditionContent — watchlist scope", () => {
  it("computes entity/changed/contention/returning intelligence from the provided watchlist context", () => {
    const edition = generateEditionContent({
      scope: { kind: "watchlist", watchlistId: "w1", watchlistName: "Test list" },
      emphasis: "all",
      detailLevel: "standard",
      sectionsWanted: defaultSectionsForScope("watchlist"),
      context: { watchlist: { items: [{ entityType: "organizations", entityKey: "Atlas Digital", label: "Atlas Digital", recordCountAtAdd: 999 }] } },
    });
    const headline = edition.sections.find((section) => section.id === "headline-metrics")!;
    expect(claimTexts(headline.claims).some((text) => text.includes("1 entity watched"))).toBe(true);
    const standout = edition.sections.find((section) => section.id === "what-stands-out")!;
    expect(claimTexts(standout.claims).some((text) => text.includes("Atlas Digital") && text.includes("999"))).toBe(true);
  });

  it("flags an empty watchlist as a limitation rather than silently showing zeroes", () => {
    const edition = generateEditionContent({
      scope: { kind: "watchlist", watchlistId: "w1", watchlistName: "Empty list" },
      emphasis: "all",
      detailLevel: "standard",
      sectionsWanted: defaultSectionsForScope("watchlist"),
      context: { watchlist: { items: [] } },
    });
    expect(edition.limitations.some((limitation) => limitation.text.includes("no entities at generation time"))).toBe(true);
  });
});

describe("generateEditionContent — saved-research scope", () => {
  it("states the cohort definition and result-count delta from the saved-research context", () => {
    const edition = generateEditionContent({
      scope: { kind: "saved-research", savedResearchId: "s1", savedResearchName: "Test research" },
      emphasis: "all",
      detailLevel: "standard",
      sectionsWanted: defaultSectionsForScope("saved-research"),
      context: { savedResearch: { kind: "explore-view", summary: "All applications, no filters applied", recordCountAtSave: 999, params: {} } },
    });
    const headline = edition.sections.find((section) => section.id === "headline-metrics")!;
    expect(claimTexts(headline.claims).some((text) => text.includes("was 999 at save"))).toBe(true);
    expect(edition.sections.some((section) => section.id === "saved-research-summary")).toBe(true);
    expect(edition.sections.some((section) => section.id === "what-stands-out")).toBe(false);
  });
});

describe("structurally attached evidence and limitations", () => {
  it("every non-limitation claim carries at least one evidence reference with a stable record-id list", () => {
    const edition = generateEditionContent({
      scope: { kind: "round-wide" },
      emphasis: "all",
      detailLevel: "deep",
      sectionsWanted: defaultSectionsForScope("round-wide"),
    });
    for (const section of edition.sections) {
      if (section.id === "limitations") continue;
      for (const claim of section.claims) {
        expect(claim.evidence.length).toBeGreaterThan(0);
        for (const ref of claim.evidence) expect(Array.isArray(ref.recordIds)).toBe(true);
      }
    }
  });
});

describe("describeBriefingScope and currentScopeRecordCount", () => {
  it("describes every scope kind with a human-readable string", () => {
    expect(describeBriefingScope({ kind: "round-wide" })).toMatch(/round-wide/i);
    expect(describeBriefingScope({ kind: "entity", entityType: "organizations", entityKey: "Atlas Digital", label: "Atlas Digital" })).toContain("Atlas Digital");
  });

  it("recounts a scope live, defensively returning 0 for a since-deleted watchlist/saved-research source", () => {
    expect(currentScopeRecordCount({ kind: "watchlist", watchlistId: "gone", watchlistName: "Gone" })).toBe(0);
    expect(currentScopeRecordCount({ kind: "round-wide" })).toBe(registryFixture.applications.length);
  });
});
