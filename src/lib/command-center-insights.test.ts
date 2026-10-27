import { describe, expect, it } from "vitest";
import type { CommandCenterIntelligenceV2 } from "@/lib/command-center-intelligence-v2";
import {
  buildCommandCenterInsights,
  wholePercentDecline,
} from "@/lib/command-center-insights";

function baseIntelligence(
  overrides: Partial<CommandCenterIntelligenceV2> = {},
): CommandCenterIntelligenceV2 {
  return {
    roundPosture: {
      officialApplications: 1615,
      officialApplicants: 481,
      officialContentionSets: 263,
      officialContentionMemberships: 891,
      applicationsSource: "official-aggregate",
      applicantsSource: "official-aggregate",
    },
    crossRound: {
      applications: {
        metricId: "application-count",
        baseline2012: 1930,
        active2026: 1615,
        difference: -315,
        limitationLabel: "official totals",
        disclosureKeys: [],
      },
      idn: {
        metricId: "idn-applications",
        baseline2012: 116,
        active2026: 21,
        difference: -95,
        limitationLabel: "official totals",
        disclosureKeys: [],
      },
      omittedBlocked: [],
    },
    competitiveStructure: {
      status: "available",
      terminology: "official-initial-contention",
      setCount: 263,
      membershipCount: 891,
      largestSetSize: 13,
      setSizeDistribution: [{ size: 13, setCount: 1 }],
      mayChangeLater: true,
      notExactStringGrouping: true,
    },
    roundComposition: {
      idn: { value: 21, label: "IDN applications", sourceChannel: "OFFICIAL_AGGREGATE" },
      brand: { value: 333, label: "Brand applications", sourceChannel: "OFFICIAL_AGGREGATE" },
      community: {
        value: 16,
        label: "Community applications",
        sourceChannel: "OFFICIAL_AGGREGATE",
        orientationOnly: true,
      },
      geographic: {
        value: 15,
        label: "Geographic applications (self-identified)",
        sourceChannel: "OFFICIAL_AGGREGATE",
        selfIdentified: true,
      },
      variants: { value: 9, label: "Variant applications", sourceChannel: "OFFICIAL_AGGREGATE" },
      replacements: {
        value: 0,
        label: "Replacement string relationships",
        sourceChannel: "ROW_DERIVED",
        relationshipGrain: true,
      },
    },
    coverage: {
      officialApplications: 1615,
      observedApplicationRecords: 1614,
      completeness: "partial",
      knownExcludedCount: 1,
      knownExcludedIsCoverageMetadataOnly: true,
      dataHealthHref: "/data-health",
    },
    drilldown: {
      exploreApplicationsHref: "/explore",
      searchRecordsHref: "/explore",
      exploreContentionHref: "/contention",
      dataHealthHref: "/data-health",
    },
    ...overrides,
  };
}

describe("wholePercentDecline", () => {
  it("produces accepted structural percentages 16% / 82%", () => {
    expect(wholePercentDecline(1930, 1615)).toBe(16);
    expect(wholePercentDecline(116, 21)).toBe(82);
  });

  it("returns null for increases (never describes them as decline)", () => {
    expect(wholePercentDecline(100, 110)).toBeNull();
  });

  it("returns null for equality", () => {
    expect(wholePercentDecline(100, 100)).toBeNull();
  });

  it("fails closed on non-positive baseline", () => {
    expect(() => wholePercentDecline(0, 10)).toThrow(/positive baseline/);
    expect(() => wholePercentDecline(-5, 1)).toThrow(/positive baseline/);
  });
});

describe("buildCommandCenterInsights", () => {
  it("returns deterministic ordered insights for full eligibility", () => {
    const a = buildCommandCenterInsights({
      intelligence: baseIntelligence(),
      godaddyUniqueContentionSets: 66,
    });
    const b = buildCommandCenterInsights({
      intelligence: baseIntelligence(),
      godaddyUniqueContentionSets: 66,
    });
    expect(a).toEqual(b);
    expect(a.map((insight) => insight.id)).toEqual([
      "contention-concentration",
      "structural-change-2012-2026",
      "coverage-disclosure",
      "official-contention-scale",
      "round-composition-brand",
    ]);
  });

  it("builds contention concentration with accepted values", () => {
    const [first] = buildCommandCenterInsights({
      intelligence: baseIntelligence(),
      godaddyUniqueContentionSets: 66,
    });
    expect(first?.id).toBe("contention-concentration");
    expect(first?.lead).toBe("Competition is concentrated:");
    expect(first?.body).toContain("66 of the 263");
    expect(first?.body).toContain("13 applications");
    expect(first?.href).toBe("/contention");
    expect(first?.linkLabel).toBe("Explore contention");
    expect(first?.body.toLowerCase()).not.toContain("market share");
  });

  it("builds structural change with whole-percent declines", () => {
    const insights = buildCommandCenterInsights({
      intelligence: baseIntelligence(),
      godaddyUniqueContentionSets: 66,
    });
    const structural = insights.find((insight) => insight.id === "structural-change-2012-2026");
    expect(structural?.body).toBe(
      "applications are down 16%, while IDN applications are down 82%.",
    );
    expect(structural?.href).toBe("/cross-round");
  });

  it("omits structural insight when applications increase above baseline", () => {
    const insights = buildCommandCenterInsights({
      intelligence: baseIntelligence({
        crossRound: {
          applications: {
            metricId: "application-count",
            baseline2012: 100,
            active2026: 110,
            difference: 10,
            limitationLabel: "official totals",
            disclosureKeys: [],
          },
          idn: {
            metricId: "idn-applications",
            baseline2012: 116,
            active2026: 21,
            difference: -95,
            limitationLabel: "official totals",
            disclosureKeys: [],
          },
          omittedBlocked: [],
        },
      }),
      godaddyUniqueContentionSets: 66,
    });
    expect(insights.some((insight) => insight.id === "structural-change-2012-2026")).toBe(false);
    expect(insights.map((i) => `${i.lead} ${i.body}`).join(" ")).not.toMatch(/down\s+-?\d+%/i);
  });

  it("omits structural insight when IDN increases above baseline", () => {
    const insights = buildCommandCenterInsights({
      intelligence: baseIntelligence({
        crossRound: {
          applications: {
            metricId: "application-count",
            baseline2012: 1930,
            active2026: 1615,
            difference: -315,
            limitationLabel: "official totals",
            disclosureKeys: [],
          },
          idn: {
            metricId: "idn-applications",
            baseline2012: 100,
            active2026: 110,
            difference: 10,
            limitationLabel: "official totals",
            disclosureKeys: [],
          },
          omittedBlocked: [],
        },
      }),
      godaddyUniqueContentionSets: 66,
    });
    expect(insights.some((insight) => insight.id === "structural-change-2012-2026")).toBe(false);
    expect(insights.map((i) => `${i.lead} ${i.body}`).join(" ")).not.toMatch(/down\s+-?\d+%/i);
  });

  it("omits structural insight when either comparison is equal to baseline", () => {
    const insights = buildCommandCenterInsights({
      intelligence: baseIntelligence({
        crossRound: {
          applications: {
            metricId: "application-count",
            baseline2012: 1615,
            active2026: 1615,
            difference: 0,
            limitationLabel: "official totals",
            disclosureKeys: [],
          },
          idn: {
            metricId: "idn-applications",
            baseline2012: 116,
            active2026: 21,
            difference: -95,
            limitationLabel: "official totals",
            disclosureKeys: [],
          },
          omittedBlocked: [],
        },
      }),
      godaddyUniqueContentionSets: 66,
    });
    expect(insights.some((insight) => insight.id === "structural-change-2012-2026")).toBe(false);
  });

  it("omits coverage insight when knownExcludedCount is zero", () => {
    const insights = buildCommandCenterInsights({
      intelligence: baseIntelligence({
        coverage: {
          officialApplications: 1615,
          observedApplicationRecords: 1615,
          completeness: "complete",
          knownExcludedCount: 0,
          knownExcludedIsCoverageMetadataOnly: true,
          dataHealthHref: "/data-health",
        },
      }),
      godaddyUniqueContentionSets: 66,
    });
    expect(insights.some((insight) => insight.id === "coverage-disclosure")).toBe(false);
  });

  it("builds coverage message with singular excluded-record grammar", () => {
    const insights = buildCommandCenterInsights({
      intelligence: baseIntelligence(),
      godaddyUniqueContentionSets: 66,
    });
    const coverage = insights.find((insight) => insight.id === "coverage-disclosure");
    expect(coverage?.body).toContain("1,614 of the 1,615");
    expect(coverage?.body).toContain("1 administrative-check Application outside");
    expect(coverage?.body).not.toContain("Applications outside");
    expect(coverage?.href).toBe("/data-health");
    expect(coverage?.linkLabel).toBe("View methodology");
  });

  it("uses plural excluded-record grammar when count > 1", () => {
    const insights = buildCommandCenterInsights({
      intelligence: baseIntelligence({
        coverage: {
          officialApplications: 1615,
          observedApplicationRecords: 1613,
          completeness: "partial",
          knownExcludedCount: 2,
          knownExcludedIsCoverageMetadataOnly: true,
          dataHealthHref: "/data-health",
        },
      }),
      godaddyUniqueContentionSets: 66,
    });
    const coverage = insights.find((insight) => insight.id === "coverage-disclosure");
    expect(coverage?.body).toContain("2 administrative-check Applications outside");
  });

  it("omits contention messages when competitive structure is unavailable", () => {
    const insights = buildCommandCenterInsights({
      intelligence: baseIntelligence({
        competitiveStructure: {
          status: "unavailable",
          reason: "unavailable",
          terminology: "official-initial-contention",
          notExactStringGrouping: true,
        },
        roundPosture: {
          officialApplications: 1615,
          officialApplicants: 481,
          officialContentionSets: null,
          officialContentionMemberships: null,
          applicationsSource: "official-aggregate",
          applicantsSource: "official-aggregate",
        },
      }),
      godaddyUniqueContentionSets: 66,
    });
    expect(insights.map((insight) => insight.id)).toEqual([
      "structural-change-2012-2026",
      "coverage-disclosure",
      "round-composition-brand",
    ]);
  });

  it("omits contention concentration when godaddy sets or largest size missing", () => {
    const withoutGodaddy = buildCommandCenterInsights({
      intelligence: baseIntelligence(),
      godaddyUniqueContentionSets: null,
    });
    expect(withoutGodaddy.some((insight) => insight.id === "contention-concentration")).toBe(
      false,
    );
    expect(withoutGodaddy.some((insight) => insight.id === "official-contention-scale")).toBe(
      true,
    );

    const withoutLargest = buildCommandCenterInsights({
      intelligence: baseIntelligence({
        competitiveStructure: {
          status: "available",
          terminology: "official-initial-contention",
          setCount: 263,
          membershipCount: 891,
          largestSetSize: null,
          setSizeDistribution: [],
          mayChangeLater: true,
          notExactStringGrouping: true,
        },
      }),
      godaddyUniqueContentionSets: 66,
    });
    expect(withoutLargest.some((insight) => insight.id === "contention-concentration")).toBe(
      false,
    );
  });

  it("omits structural message when crossRound facts are null", () => {
    const insights = buildCommandCenterInsights({
      intelligence: baseIntelligence({
        crossRound: {
          applications: null,
          idn: null,
          omittedBlocked: [],
        },
      }),
      godaddyUniqueContentionSets: 66,
    });
    expect(insights.some((insight) => insight.id === "structural-change-2012-2026")).toBe(false);
  });

  it("omits composition when roundComposition is null", () => {
    const insights = buildCommandCenterInsights({
      intelligence: baseIntelligence({ roundComposition: null }),
      godaddyUniqueContentionSets: 66,
    });
    expect(insights.some((insight) => insight.id === "round-composition-brand")).toBe(false);
  });

  it("returns empty when nothing qualifies", () => {
    const insights = buildCommandCenterInsights({
      intelligence: baseIntelligence({
        crossRound: { applications: null, idn: null, omittedBlocked: [] },
        competitiveStructure: {
          status: "unavailable",
          reason: "unavailable",
          terminology: "official-initial-contention",
          notExactStringGrouping: true,
        },
        roundComposition: null,
        coverage: {
          officialApplications: 0,
          observedApplicationRecords: 0,
          completeness: "partial",
          knownExcludedCount: 0,
          knownExcludedIsCoverageMetadataOnly: true,
          dataHealthHref: "/data-health",
        },
      }),
      godaddyUniqueContentionSets: null,
    });
    expect(insights).toEqual([]);
  });

  it("does not surface blocked metrics as ordinary values", () => {
    const insights = buildCommandCenterInsights({
      intelligence: baseIntelligence({
        crossRound: {
          applications: null,
          idn: null,
          omittedBlocked: ["community-applications", "organization-round-count"],
        },
      }),
      godaddyUniqueContentionSets: 66,
    });
    const joined = insights.map((insight) => `${insight.lead} ${insight.body}`).join(" ");
    expect(joined.toLowerCase()).not.toContain("organization-round-count");
    expect(joined.toLowerCase()).not.toMatch(/\b0%\b/);
  });
});
