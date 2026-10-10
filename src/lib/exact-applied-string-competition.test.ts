import { describe, expect, it } from "vitest";
import fixture from "@/data/fixtures/registry-applications.json";
import { APPROVED_2012_BASELINE } from "@/comparison/approved-2012-baseline";
import {
  blockedContentionSetCountState,
  buildApproved2012ContentionMembershipHistoricalFact,
  buildCommandCenterRoundPulse,
} from "@/comparison/historical-2012-ui-adapter";
import { getMetricEligibility } from "@/comparison/metric-eligibility";
import { groupHistorical2012ApplicationsByString } from "@/historical-2012/explore-historical-table";
import {
  buildExactAppliedStringCompetition,
  buildRoundPulse,
  type Application,
} from "@/lib/registry-data";

const base = fixture.applications[0] as Application;

function row(overrides: Partial<Application> & { id: string; string: string }): Application {
  return { ...base, contentionSet: null, replacement: null, aLabel: undefined, ...overrides } as Application;
}

describe("exact applied-for string competition", () => {
  it("groups by the canonical string field and ignores applicant, organization, category, and type", () => {
    const competition = buildExactAppliedStringCompetition([
      row({ id: "1", string: "atlas", applicant: "One Legal LLC", organization: "One", category: "Technology", type: "Generic" }),
      row({ id: "2", string: "atlas", applicant: "Two Legal Inc.", organization: "Two", category: "Identity", type: "Brand" }),
    ]);
    expect(competition.competingGroups).toEqual([
      { appliedForString: "atlas", applicationCount: 2, applicationIds: ["1", "2"] },
    ]);
    expect(competition.grain).toBe("exact-applied-for-string");
    expect(competition.method).toBe("exact-applied-string-grouping/1.0.0");
  });

  it("does not fold case", () => {
    const competition = buildExactAppliedStringCompetition([
      row({ id: "1", string: "Atlas" }),
      row({ id: "2", string: "Atlas" }),
      row({ id: "3", string: "atlas" }),
      row({ id: "4", string: "atlas" }),
    ]);
    const names = competition.competingGroups.map((group) => group.appliedForString);
    expect(names).toHaveLength(2);
    expect(new Set(names)).toEqual(new Set(["Atlas", "atlas"]));
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("does not trim the applied-for string", () => {
    const competition = buildExactAppliedStringCompetition([
      row({ id: "1", string: "atlas" }),
      row({ id: "2", string: "atlas" }),
      row({ id: "3", string: " atlas" }),
      row({ id: "4", string: " atlas" }),
    ]);
    expect(competition.competingGroups.map((group) => group.appliedForString)).toEqual([" atlas", "atlas"]);
  });

  it("does not group by aLabel", () => {
    const competition = buildExactAppliedStringCompetition([
      row({ id: "1", string: "alpha", aLabel: "xn--same" }),
      row({ id: "2", string: "beta", aLabel: "xn--same" }),
      row({ id: "3", string: "信頼", aLabel: "xn--one" }),
      row({ id: "4", string: "信頼", aLabel: "xn--two" }),
    ]);
    expect(competition.competingGroups).toEqual([
      { appliedForString: "信頼", applicationCount: 2, applicationIds: ["3", "4"] },
    ]);
  });

  it("does not group by replacement string", () => {
    const competition = buildExactAppliedStringCompetition([
      row({ id: "1", string: "atlas", replacement: "atlasnet" }),
      row({ id: "2", string: "atlas", replacement: null }),
      row({ id: "3", string: "atlasnet", replacement: null }),
    ]);
    expect(competition.competingGroups).toEqual([
      { appliedForString: "atlas", applicationCount: 2, applicationIds: ["1", "2"] },
    ]);
  });

  it("does not group by contentionSet", () => {
    const competition = buildExactAppliedStringCompetition([
      row({ id: "1", string: "alpha", contentionSet: "ICS-shared" }),
      row({ id: "2", string: "beta", contentionSet: "ICS-shared" }),
    ]);
    expect(competition.competingGroupCount).toBe(0);
    expect(competition.competingGroups).toEqual([]);
  });

  it("excludes empty applied-for strings from competition and from the eligible count", () => {
    const competition = buildExactAppliedStringCompetition([
      row({ id: "1", string: "" }),
      row({ id: "2", string: "" }),
      row({ id: "3", string: "atlas" }),
      row({ id: "4", string: "atlas" }),
    ]);
    expect(competition.datasetApplicationCount).toBe(4);
    expect(competition.eligibleApplicationCount).toBe(2);
    expect(competition.competingGroups.map((group) => group.appliedForString)).toEqual(["atlas"]);
  });

  it("uses the approved baseline membership value rather than either set-entity figure", () => {
    const fact = buildApproved2012ContentionMembershipHistoricalFact();
    expect(fact.value).toBe(APPROVED_2012_BASELINE.contentionMembershipApplications);
    expect(fact.value).not.toBe(APPROVED_2012_BASELINE.extractedContentionSetEntities);
    expect(fact.value).not.toBe(APPROVED_2012_BASELINE.icannCitedContentionSetEntities);
    expect(fact.label).toBe("Applications in initial contention");
    expect(fact.label).not.toMatch(/identical/i);
    expect(fact.metricId).toBe("contention-membership-exposure");
    expect(fact.sourceSnapshotId).toBe("snap-2012-contention-pdf-v1");
  });

  it("keeps the rehearsal fixture to atlas and secure, two applications each", () => {
    const competition = buildExactAppliedStringCompetition(fixture.applications);
    expect(competition.competingGroups).toEqual([
      { appliedForString: "atlas", applicationCount: 2, applicationIds: ["APP-26001", "APP-26002"] },
      { appliedForString: "secure", applicationCount: 2, applicationIds: ["APP-26008", "APP-26009"] },
    ]);
    expect(competition.applicationsInCompetingGroups).toBe(4);
    expect(competition.eligibleApplicationCount).toBe(fixture.applications.length);
  });

  it("leaves singleton applied-for strings out of the competing groups", () => {
    const competition = buildExactAppliedStringCompetition(fixture.applications);
    const competing = new Set(competition.competingGroups.map((group) => group.appliedForString));
    const singletons = fixture.applications.map((item) => item.string).filter((value) => !competing.has(value));
    expect(singletons.sort()).toEqual(["harbor", "northstar", "orbit", "pulse", "terra", "verde", "مستقبل", "信頼"].sort());
  });

  it("sorts competing groups by count, then applied-for string, with sorted member ids", () => {
    const competition = buildExactAppliedStringCompetition([
      row({ id: "b", string: "zeta" }),
      row({ id: "a", string: "zeta" }),
      row({ id: "d", string: "shared" }),
      row({ id: "c", string: "shared" }),
      row({ id: "e", string: "shared" }),
    ]);
    expect(competition.competingGroups).toEqual([
      { appliedForString: "shared", applicationCount: 3, applicationIds: ["c", "d", "e"] },
      { appliedForString: "zeta", applicationCount: 2, applicationIds: ["a", "b"] },
    ]);
  });

  it("returns the same groups when the input order changes", () => {
    const forward = buildExactAppliedStringCompetition(fixture.applications);
    const reverse = buildExactAppliedStringCompetition([...fixture.applications].reverse());
    expect(reverse).toEqual(forward);
  });

  it("matches the historical exact-string grain for non-empty keys with two or more applications", () => {
    const rows = [
      row({ id: "2", string: "beta" }),
      row({ id: "1", string: "beta" }),
      row({ id: "3", string: "solo" }),
      row({ id: "4", string: "" }),
    ];
    const competition = buildExactAppliedStringCompetition(rows);
    const historical = groupHistorical2012ApplicationsByString(rows)
      .filter((group) => group.stringKey.length > 0 && group.records.length >= 2)
      .map((group) => ({
        appliedForString: group.stringKey,
        applicationIds: group.records.map((record) => record.id),
      }));
    expect(competition.competingGroups.map((group) => ({
      appliedForString: group.appliedForString,
      applicationIds: group.applicationIds,
    }))).toEqual(historical);
  });

  it("still competes when applications share a string but not a contentionSet", () => {
    const competition = buildExactAppliedStringCompetition([
      row({ id: "1", string: "secure", contentionSet: null }),
      row({ id: "2", string: "secure", contentionSet: "ICS-secure" }),
    ]);
    expect(competition.competingGroups).toEqual([
      { appliedForString: "secure", applicationCount: 2, applicationIds: ["1", "2"] },
    ]);
  });

  it("recomputes from the supplied rows and does not keep fixture groups", () => {
    const competition = buildExactAppliedStringCompetition([
      row({ id: "p1", string: "promoted" }),
      row({ id: "p2", string: "promoted" }),
      row({ id: "p3", string: "other" }),
    ]);
    expect(competition.competingGroups.map((group) => group.appliedForString)).toEqual(["promoted"]);
    expect(competition.competingGroups.some((group) => group.appliedForString === "atlas" || group.appliedForString === "secure")).toBe(false);
  });

  it("publishes no set-count headline and keeps the method blocked", () => {
    const blocked = blockedContentionSetCountState();
    expect(blocked.headlineAvailable).toBe(false);
    expect(blocked.metricId).toBe("contention-set-count");
    expect(blocked.methodReadiness).toBe("BLOCKED_METHOD");
    expect(blocked.comparisonAllowed).toBe(false);
    expect(JSON.stringify(blocked)).not.toContain(String(APPROVED_2012_BASELINE.extractedContentionSetEntities));
    expect(JSON.stringify(blocked)).not.toContain(String(APPROVED_2012_BASELINE.icannCitedContentionSetEntities));
    expect(getMetricEligibility("contention-set-count")?.methodReadiness).toBe("BLOCKED_METHOD");
    expect(APPROVED_2012_BASELINE.extractedContentionSetEntities).not.toBe(APPROVED_2012_BASELINE.icannCitedContentionSetEntities);
  });

  it("keeps both set figures on the historical fact limitations and off the membership value", () => {
    const fact = buildApproved2012ContentionMembershipHistoricalFact();
    const limitations = fact.limitations.join(" ");
    expect(limitations).toContain(String(APPROVED_2012_BASELINE.extractedContentionSetEntities));
    expect(limitations).toContain(String(APPROVED_2012_BASELINE.icannCitedContentionSetEntities));
    expect(fact.value).toBe(APPROVED_2012_BASELINE.contentionMembershipApplications);
    expect(fact.comparisonAllowed).toBe(false);
  });

  it("keeps contention membership on the pulse builder used by briefings", () => {
    const pulse = buildCommandCenterRoundPulse(fixture.applications);
    const presented = buildRoundPulse(fixture.applications);
    expect(pulse.some((metric) => metric.metricId === "contention-membership-exposure")).toBe(true);
    expect(presented.find((metric) => metric.metricId === "contention-membership-exposure")?.value).toBe(
      APPROVED_2012_BASELINE.contentionMembershipApplications,
    );
  });
});
