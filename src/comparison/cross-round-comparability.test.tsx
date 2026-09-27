// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import fixture from "@/data/fixtures/registry-applications.json";
import { CommandCenter } from "@/components/registry/command-center";
import { HubClaimActualityProvider } from "@/components/registry/hub-claim-actuality-provider";
import { HubHistorical2012Provider } from "@/components/registry/hub-historical-2012-provider";
import { HubRegistryDataProvider } from "@/components/registry/hub-registry-data-provider";
import { APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH } from "@/historical-2012/approved-corpus-hash";
import { parse2012ApplicationPayloadJson } from "@/historical-2012/payload-server";
import { resolveHistorical2012BrowserPayload } from "@/historical-2012/payload-shared";
import { marketDemandCells } from "@/comparison/compare-dimensions";
import { APPROVED_2012_BASELINE } from "@/comparison/approved-2012-baseline";
import {
  countDistinctAppliedForStrings,
  formatCrossRoundCountStatement,
  presentPromotedCrossRoundCount,
  type CountableApplicationRow,
} from "@/comparison/cross-round-count-comparison";
import {
  blockedContentionSetCountState,
  buildApproved2012DesignationHistoricalFacts,
  buildCommandCenterRoundPulse,
} from "@/comparison/historical-2012-ui-adapter";
import { METRIC_ELIGIBILITY_CATALOG } from "@/comparison/metric-eligibility-catalog";
import {
  APPLICATION_ACTUALITY_METRIC_IDS,
  DEFAULT_CLAIM_ACTUALITY_STATE,
  type ClaimActualityState,
} from "@/reveal-day-2026/claim-actuality";
import { buildSourceHealthRows } from "@/lib/data-health-report";
import {
  defaultSectionsForScope,
  generateEditionContent,
} from "@/lib/briefing-data";
import { rehearsalRegistryApplicationsDocument } from "@/lib/registry-application-payload-shared";
import {
  buildExactAppliedStringCompetition,
  type Application,
} from "@/lib/registry-data";
import { resolveHubMetricEligibility } from "@/lib/hub-metric-eligibility";

const evaluative = /%|increased|decreased|surged|collapsed|\bbetter\b|\bworse\b|\brose\b|doubled|percent/i;

function promotedClaim(): ClaimActualityState {
  return {
    ...DEFAULT_CLAIM_ACTUALITY_STATE,
    round2026ApplicationActuality: "REAL_SOURCE_READY",
    promotedAt: "2026-06-01T12:00:00.000Z",
    snapshotId: "snap-compare-promoted",
    snapshotContentHash: "abc",
    rawSha256: "def",
    stewardApprovalId: "stew",
    productApprovalId: "prod",
    promotionGates: {
      snapshotValidated: true,
      parserPassed: true,
      normalizationPassed: true,
      provenanceRecorded: true,
      validationPassed: true,
      contaminationClear: true,
    },
  };
}

const promotedPayload = { payloadMode: "promoted-2026" as const, snapshotId: "snap-compare-promoted" };

function baseApplication(): Application {
  return rehearsalRegistryApplicationsDocument().applications[0];
}

function row(overrides: Partial<Application> & { id: string }): Application {
  return { ...baseApplication(), ...overrides } as Application;
}

afterEach(() => {
  cleanup();
});

describe("CC-COMPARE-1 cross-round comparability", () => {
  it("1 — unpublished application count has no numeric delta", () => {
    const pulse = buildCommandCenterRoundPulse(fixture.applications);
    const apps = pulse.find((metric) => metric.metricId === "application-count")!;
    expect(apps.value).toBe(1930);
    expect(apps.comparisonAllowed).toBe(false);
    expect(apps.crossRound).toBeNull();
    expect(apps.deltaLabel).not.toMatch(/Difference/);
    expect(apps.deltaLabel).toMatch(/2026 comparison pending publication/);
  });

  it("2 — unpublished unique strings have no numeric delta", () => {
    const pulse = buildCommandCenterRoundPulse(fixture.applications);
    const strings = pulse.find((metric) => metric.metricId === "unique-applied-strings")!;
    expect(strings.value).toBe(1409);
    expect(strings.crossRound).toBeNull();
    expect(strings.deltaLabel).not.toMatch(/Difference/);
  });

  it("3 — unpublished IDN count has no numeric delta", () => {
    const pulse = buildCommandCenterRoundPulse(fixture.applications);
    const idn = pulse.find((metric) => metric.metricId === "idn-applications")!;
    expect(idn.value).toBe(116);
    expect(idn.crossRound).toBeNull();
    expect(idn.deltaLabel).not.toMatch(/Difference/);
  });

  it("4 — a promoted claim with a rehearsal payload does not use fixture rows as a 2026 delta", () => {
    const pulse = buildCommandCenterRoundPulse(fixture.applications, promotedClaim(), {
      payloadMode: "rehearsal",
      snapshotId: fixture.snapshotId,
    });
    for (const metricId of ["application-count", "unique-applied-strings", "idn-applications"] as const) {
      const metric = pulse.find((item) => item.metricId === metricId)!;
      expect(metric.comparisonAllowed).toBe(true);
      expect(metric.crossRound).toBeNull();
      expect(metric.value).toBe(metric.historicalFact?.value);
      expect(metric.deltaLabel).toMatch(/withheld until the active payload is the promoted snapshot/);
      expect(metric.deltaLabel).not.toMatch(/Difference/);
    }
  });

  it("5 — a promoted payload without publication claim keeps the 2012 baseline and no difference", () => {
    const pulse = buildCommandCenterRoundPulse(fixture.applications, DEFAULT_CLAIM_ACTUALITY_STATE, promotedPayload);
    const apps = pulse.find((metric) => metric.metricId === "application-count")!;
    expect(apps.comparisonAllowed).toBe(false);
    expect(apps.crossRound).toBeNull();
    expect(apps.value).toBe(APPROVED_2012_BASELINE.applications);
    expect(apps.deltaLabel).not.toMatch(/Difference/);
  });

  it("6 — promoted application count is loaded rows minus the approved 1930 baseline", () => {
    const applications = [row({ id: "p1", string: "Alpha" }), row({ id: "p2", string: "Beta" }), row({ id: "p3", string: "Gamma" })];
    const presented = presentPromotedCrossRoundCount("application-count", applications, promotedClaim(), promotedPayload)!;
    expect(presented.numericDelta).toBe(true);
    expect(presented.baseline2012).toBe(1930);
    expect(presented.active2026).toBe(3);
    expect(presented.difference).toBe(3 - 1930);
    expect(presented.statement).toBe("2012 baseline 1930. Loaded snapshot 3. Difference -1927.");
  });

  it("7 — unique strings use the applied-for string, not aLabel", () => {
    const applications = [row({ id: "p1", string: "atlas", aLabel: "xn--not-the-string", idn: true })];
    const presented = presentPromotedCrossRoundCount("unique-applied-strings", applications, promotedClaim(), promotedPayload)!;
    expect(presented.active2026).toBe(1);
    expect(presented.statement).not.toContain("xn--not-the-string");
  });

  it("8 — unique strings do not use replacement", () => {
    const applications = [row({ id: "p1", string: "atlas", replacement: "atlasnet" })];
    const presented = presentPromotedCrossRoundCount("unique-applied-strings", applications, promotedClaim(), promotedPayload)!;
    expect(presented.active2026).toBe(1);
    expect(presented.statement).not.toContain("atlasnet");
  });

  it("9 — duplicate applied-for strings count once while each application row still counts", () => {
    const applications = [row({ id: "p1", string: "Alpha" }), row({ id: "p2", string: "Alpha" })];
    const apps = presentPromotedCrossRoundCount("application-count", applications, promotedClaim(), promotedPayload)!;
    const strings = presentPromotedCrossRoundCount("unique-applied-strings", applications, promotedClaim(), promotedPayload)!;
    expect(apps.active2026).toBe(2);
    expect(strings.active2026).toBe(1);
  });

  it("10 — IDN count is an application flag count, not a distinct IDN string count", () => {
    const applications = [
      row({ id: "p1", string: "信頼", idn: true }),
      row({ id: "p2", string: "信頼", idn: true }),
    ];
    const idn = presentPromotedCrossRoundCount("idn-applications", applications, promotedClaim(), promotedPayload)!;
    const strings = presentPromotedCrossRoundCount("unique-applied-strings", applications, promotedClaim(), promotedPayload)!;
    expect(idn.active2026).toBe(2);
    expect(strings.active2026).toBe(1);
  });

  it("11 — applied-for string comparison does not fold case", () => {
    const applications = [row({ id: "p1", string: "Alpha" }), row({ id: "p2", string: "alpha" })];
    expect(countDistinctAppliedForStrings(applications)).toBe(2);
  });

  it("12 — applied-for string comparison does not trim", () => {
    const applications = [row({ id: "p1", string: " beta " }), row({ id: "p2", string: "beta" })];
    expect(countDistinctAppliedForStrings(applications)).toBe(2);
  });

  it("13 — an empty applied-for string is its own key", () => {
    expect(countDistinctAppliedForStrings([row({ id: "p1", string: "" })])).toBe(1);
    expect(countDistinctAppliedForStrings([row({ id: "p1", string: "" }), row({ id: "p2", string: "a" })])).toBe(2);
  });

  it("14 — a missing string field makes the unique-string delta unavailable, not zero", () => {
    const applications: CountableApplicationRow[] = [{ string: "Alpha", idn: false }, { idn: false }];
    const presented = presentPromotedCrossRoundCount("unique-applied-strings", applications, promotedClaim(), promotedPayload)!;
    expect(presented.numericDelta).toBe(false);
    expect(presented.active2026).toBeNull();
    expect(presented.difference).toBeNull();
    expect(presented.statement).toBe("2026 value unavailable. No difference is shown.");
    expect(presented.statement).not.toMatch(/Difference 0|Loaded snapshot 0/);
  });

  it("15 — a missing IDN flag makes the IDN delta unavailable, not zero", () => {
    const applications: CountableApplicationRow[] = [{ string: "Alpha", idn: false }, { string: "Beta" }];
    const presented = presentPromotedCrossRoundCount("idn-applications", applications, promotedClaim(), promotedPayload)!;
    expect(presented.numericDelta).toBe(false);
    expect(presented.active2026).toBeNull();
    expect(presented.difference).toBeNull();
    expect(presented.statement).not.toMatch(/Loaded snapshot 0/);
  });

  it("16 — a missing application list is unavailable, and an empty list is a real zero", () => {
    const missing = presentPromotedCrossRoundCount("application-count", null, promotedClaim(), promotedPayload)!;
    expect(missing.numericDelta).toBe(false);
    expect(missing.active2026).toBeNull();
    expect(missing.statement).not.toMatch(/Loaded snapshot 0/);
    const empty = presentPromotedCrossRoundCount("application-count", [], promotedClaim(), promotedPayload)!;
    expect(empty.numericDelta).toBe(true);
    expect(empty.active2026).toBe(0);
    expect(empty.difference).toBe(0 - 1930);
  });

  it("17 — the statement is baseline, loaded snapshot, and signed difference", () => {
    expect(formatCrossRoundCountStatement(1930, 3)).toBe("2012 baseline 1930. Loaded snapshot 3. Difference -1927.");
    expect(formatCrossRoundCountStatement(10, 12)).toBe("2012 baseline 10. Loaded snapshot 12. Difference 2.");
  });

  it("18 — a zero active count still has no percentage", () => {
    const applications = [row({ id: "p1", string: "Alpha", idn: false })];
    const presented = presentPromotedCrossRoundCount("idn-applications", applications, promotedClaim(), promotedPayload)!;
    expect(presented.active2026).toBe(0);
    expect(presented.difference).toBe(0 - 116);
    expect(presented.statement).not.toMatch(/%|percent/i);
    expect(formatCrossRoundCountStatement(1930, 0)).not.toMatch(/%/);
  });

  it("19 — difference language stays arithmetic", () => {
    const applications = [row({ id: "p1", string: "Alpha", idn: true }), row({ id: "p2", string: "Beta", idn: false })];
    for (const metricId of ["application-count", "unique-applied-strings", "idn-applications"] as const) {
      const presented = presentPromotedCrossRoundCount(metricId, applications, promotedClaim(), promotedPayload)!;
      expect(presented.statement).not.toMatch(evaluative);
    }
  });

  it("20 — category mix stays blocked after application promotion", () => {
    const resolved = resolveHubMetricEligibility("category-mix", promotedClaim())!;
    expect(resolved.methodReadiness).toBe("BLOCKED_COVERAGE");
    expect(resolved.comparisonAllowed).toBe(false);
    expect(resolved.claimReadiness.round2026).not.toBe("REAL_SOURCE_READY");
  });

  it("21 — the category card does not say rose or doubled", () => {
    render(<CommandCenter />);
    const card = screen.getByTestId("category-mix-comparison");
    expect(within(card).queryByText(/rose/i)).not.toBeInTheDocument();
    expect(within(card).queryByText(/doubled/i)).not.toBeInTheDocument();
    expect(within(card).getByText(/category mix comparison not yet approved/i)).toBeInTheDocument();
  });

  it("22 — the category card does not render fixture previous-to-current deltas", () => {
    render(<CommandCenter />);
    const card = screen.getByTestId("category-mix-comparison");
    expect(within(card).queryByText(/→/)).not.toBeInTheDocument();
    expect(within(card).queryByText(/Why this stands out/i)).not.toBeInTheDocument();
    expect(card).not.toHaveTextContent(/\+\d/);
    expect(card).not.toHaveTextContent(/Identity/);
    expect(card).not.toHaveTextContent(/Technology doubled/);
  });

  it("23 — community designation stays the 2012 historical count with no 2026 delta", () => {
    const fact = buildApproved2012DesignationHistoricalFacts(promotedClaim()).find((item) => item.metricId === "community-designation-count")!;
    expect(fact.value).toBe(84);
    expect(fact.comparisonAllowed).toBe(false);
    expect(fact.crossRoundNote).toBeUndefined();
    expect(fact.limitations.join(" ")).toMatch(/not published/i);
  });

  it("24 — geographic designation stays the 2012 historical count with no 2026 delta", () => {
    const fact = buildApproved2012DesignationHistoricalFacts(promotedClaim()).find((item) => item.metricId === "geographic-designation-count")!;
    expect(fact.value).toBe(66);
    expect(fact.comparisonAllowed).toBe(false);
    expect(resolveHubMetricEligibility("geographic-designation-count", promotedClaim())?.comparisonAllowed).toBe(false);
  });

  it("25 — rehearsal type is not a designation count", () => {
    const communityTypes = fixture.applications.filter((item) => item.type === "Community").length;
    const geographicTypes = fixture.applications.filter((item) => item.type === "Geographic").length;
    const facts = buildApproved2012DesignationHistoricalFacts();
    expect(communityTypes).not.toBe(84);
    expect(geographicTypes).not.toBe(66);
    expect(facts.map((fact) => fact.value)).toEqual([84, 66]);
    expect(facts.every((fact) => fact.comparisonAllowed === false)).toBe(true);
  });

  it("26 — contention membership is not differenced against exact-string groups", () => {
    const pulse = buildCommandCenterRoundPulse(fixture.applications, promotedClaim(), promotedPayload);
    const contention = pulse.find((metric) => metric.metricId === "contention-membership-exposure")!;
    const groups = buildExactAppliedStringCompetition(fixture.applications);
    expect(contention.value).toBe(754);
    expect(contention.crossRound).toBeNull();
    expect(contention.deltaLabel).not.toMatch(/Difference/);
    expect(contention.value).not.toBe(groups.competingGroupCount);
    expect(contention.value).not.toBe(groups.applicationsInCompetingGroups);
  });

  it("27 — set count stays unavailable and does not pick 234 or 232", () => {
    const blocked = blockedContentionSetCountState(promotedClaim());
    expect(blocked.headlineAvailable).toBe(false);
    expect(blocked.comparisonAllowed).toBe(false);
    expect(blocked.methodReadiness).toBe("BLOCKED_METHOD");
    const serialized = JSON.stringify(blocked);
    expect(serialized).not.toContain("234");
    expect(serialized).not.toContain("232");
  });

  it("28 — organization round count is not a cross-round delta", () => {
    const pulse = buildCommandCenterRoundPulse(fixture.applications, promotedClaim(), promotedPayload);
    const orgs = pulse.find((metric) => metric.metricId === "organization-round-count")!;
    expect(orgs.comparisonAllowed).toBe(false);
    expect(orgs.crossRound).toBeNull();
    expect(orgs.deltaLabel).toMatch(/not approved/i);
    expect(orgs.deltaLabel).not.toMatch(/Difference/);
    expect(resolveHubMetricEligibility("organization-round-count", promotedClaim())?.methodReadiness).toBe("BLOCKED_COVERAGE");
  });

  it("29 — round-wide portfolio concentration stays blocked after promotion", () => {
    const resolved = resolveHubMetricEligibility("portfolio-concentration-round-wide", promotedClaim())!;
    expect(resolved.methodReadiness).toBe("BLOCKED_COVERAGE");
    expect(resolved.comparisonAllowed).toBe(false);
    expect(resolveHubMetricEligibility("confirmed-portfolio-facts", promotedClaim())?.comparisonAllowed).toBe(false);
  });

  it("30 — applicant legal name is not an unlocked organization comparison", () => {
    expect(APPLICATION_ACTUALITY_METRIC_IDS).not.toContain("applicant-legal-name-count");
    const pulse = buildCommandCenterRoundPulse(fixture.applications, promotedClaim(), promotedPayload);
    const orgs = pulse.find((metric) => metric.metricId === "organization-round-count")!;
    expect(orgs.deltaLabel).not.toMatch(/legal name/i);
    expect(orgs.label).toBe("Organizations");
  });

  it("31 — market demand stays unavailable", () => {
    const cells = marketDemandCells(2, promotedClaim());
    expect(cells).toHaveLength(2);
    for (const cell of cells) {
      expect(cell.state).toBe("unavailable");
      expect(cell.comparisonAllowed).toBe(false);
      expect(cell.methodReadiness).toBe("BLOCKED_SOURCE");
      expect(String(cell.value)).toMatch(/not approved/i);
    }
  });

  it("32 — the region card does not pair a fixture country count with the 2012 country count", () => {
    const pulse = buildCommandCenterRoundPulse(fixture.applications, promotedClaim(), promotedPayload);
    const regions = pulse.find((metric) => metric.metricId === "distinct-regions")!;
    expect(regions.baseline2012).toBeNull();
    expect(regions.crossRound).toBeNull();
    expect(regions.deltaLabel).toBe("Loaded-snapshot region count is not an approved cross-round comparison.");
    expect(regions.deltaLabel).not.toMatch(/2012 had|60/);
    expect(regions.comparisonAllowed).toBe(false);
  });

  it("33 — a promoted difference cites method, historical source, and the active snapshot", async () => {
    const applications = [row({ id: "p1", string: "Alpha", idn: false }), row({ id: "p2", string: "Beta", idn: true })];
    const claim = promotedClaim();
    render(
      <HubClaimActualityProvider claimActualityState={claim}>
        <HubRegistryDataProvider
          resolution={{
            document: {
              ...rehearsalRegistryApplicationsDocument(),
              applications,
              payloadMode: "promoted-2026",
              snapshotId: claim.snapshotId!,
            },
            mode: "promoted-2026",
            selectionReason: "promoted-active",
          }}
        >
          <CommandCenter />
        </HubRegistryDataProvider>
      </HubClaimActualityProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /View intelligence for Applications: 2012 baseline 1930/ }));
    const provenance = await screen.findByTestId("cross-round-provenance-applications");
    expect(provenance).toHaveTextContent("Method count(application)");
    expect(provenance).toHaveTextContent("Historical source");
    expect(provenance).toHaveTextContent("snap-2012-reveal-day-csv-v1");
    expect(provenance).toHaveTextContent("Active snapshot snap-compare-promoted");
    expect(screen.getByTestId("cross-round-delta-applications")).toHaveTextContent("2012 baseline 1930. Loaded snapshot 2. Difference -1928.");
    expect(screen.getByTestId("cross-round-delta-strings")).toHaveTextContent("2012 baseline 1409. Loaded snapshot 2. Difference -1407.");
    expect(screen.getByTestId("cross-round-delta-idn")).toHaveTextContent("2012 baseline 116. Loaded snapshot 1. Difference -115.");
    expect(screen.getByTestId("orientation-count-basis")).toHaveTextContent(/loaded snapshot minus 2012 baseline/i);
    expect(screen.getByTestId("round-pulse-section")).not.toHaveTextContent(evaluative);
  });

  it("34 — lens choice does not change count arithmetic", async () => {
    const user = userEvent.setup();
    render(<CommandCenter />);
    const counts = () => {
      const section = screen.getByTestId("round-pulse-section");
      return {
        applications: within(section).getAllByText("1930").length,
        strings: within(section).getAllByText("1409").length,
        idn: within(section).getAllByText("116").length,
        difference: /Difference/.test(section.textContent ?? ""),
      };
    };
    const first = counts();
    expect(first).toEqual({ applications: 1, strings: 1, idn: 1, difference: false });
    for (const label of ["Commercial", "Product & Strategy", "Marketing", "All Intelligence"]) {
      await user.click(screen.getByRole("button", { name: label }));
      expect(counts()).toEqual(first);
    }
    expect(screen.queryByTestId("cross-round-delta-applications")).not.toBeInTheDocument();
  });

  it("35 — round-wide briefing stand-out stays empty when a promoted comparison exists", () => {
    const claim = promotedClaim();
    const edition = generateEditionContent({
      scope: { kind: "round-wide" },
      emphasis: "strategy",
      detailLevel: "standard",
      sectionsWanted: defaultSectionsForScope("round-wide"),
      claimActualityState: claim,
      registryDocument: {
        ...rehearsalRegistryApplicationsDocument(),
        payloadMode: "promoted-2026",
        snapshotId: claim.snapshotId!,
        applications: [row({ id: "p1", string: "Alpha" })],
      },
    });
    const standout = edition.sections.find((section) => section.id === "what-stands-out")!;
    expect(standout.claims).toEqual([]);
    const frame = edition.sections.find((section) => section.id === "headline-metrics")!.narrativeFrame ?? "";
    expect(frame).toMatch(/not an approved comparison/i);
    expect(frame).not.toMatch(/differs from the normalized 2012 fixture cohort/);
  });

  it("36 — unpublished briefing headlines have no percentage and no numeric difference", () => {
    const edition = generateEditionContent({
      scope: { kind: "round-wide" },
      emphasis: "all",
      detailLevel: "standard",
      sectionsWanted: defaultSectionsForScope("round-wide"),
    });
    const headlines = edition.sections.find((section) => section.id === "headline-metrics")!.claims.map((claim) => claim.text).join("\n");
    expect(headlines).not.toMatch(/%|Difference|increased/i);
    expect(headlines).not.toMatch(/2012 had/);
    expect(headlines).toContain("1930");
    expect(headlines).toContain("not an approved cross-round comparison");
  });

  it("37 — promoted briefing differences are limited to the three eligible counts", () => {
    const claim = promotedClaim();
    const edition = generateEditionContent({
      scope: { kind: "round-wide" },
      emphasis: "all",
      detailLevel: "standard",
      sectionsWanted: defaultSectionsForScope("round-wide"),
      claimActualityState: claim,
      registryDocument: {
        ...rehearsalRegistryApplicationsDocument(),
        payloadMode: "promoted-2026",
        snapshotId: claim.snapshotId!,
        applications: [row({ id: "p1", string: "Alpha", idn: true }), row({ id: "p2", string: "Beta", idn: false })],
      },
    });
    const claims = edition.sections.find((section) => section.id === "headline-metrics")!.claims.map((claim) => claim.text);
    const withDifference = claims.filter((text) => text.includes("Difference"));
    expect(withDifference).toHaveLength(3);
    expect(withDifference.join("\n")).toMatch(/Applications:/);
    expect(withDifference.join("\n")).toMatch(/Unique strings:/);
    expect(withDifference.join("\n")).toMatch(/IDN applications:/);
    expect(claims.find((text) => text.startsWith("Organizations:"))).not.toMatch(/Difference/);
    expect(claims.find((text) => text.startsWith("Regions:"))).not.toMatch(/Difference/);
    expect(claims.find((text) => text.startsWith("Applications in initial contention:"))).not.toMatch(/Difference/);
    expect(claims.join("\n")).not.toMatch(evaluative);
    expect(edition.sections.find((section) => section.id === "what-stands-out")!.claims).toEqual([]);
  });

  it("38 — a promoted document without a publication claim does not brief fixture differences", () => {
    const edition = generateEditionContent({
      scope: { kind: "round-wide" },
      emphasis: "all",
      detailLevel: "standard",
      sectionsWanted: defaultSectionsForScope("round-wide"),
      registryDocument: {
        ...rehearsalRegistryApplicationsDocument(),
        payloadMode: "promoted-2026",
        snapshotId: "snap-promoted-without-claim",
      },
    });
    const headlines = edition.sections.find((section) => section.id === "headline-metrics")!.claims.map((claim) => claim.text).join("\n");
    expect(headlines).not.toMatch(/Difference/);
    expect(headlines).toContain("1930");
    expect(edition.sections.find((section) => section.id === "what-stands-out")!.claims).toEqual([]);
  });

  it("39 — Current and Compare time basis stay disabled", () => {
    render(<CommandCenter />);
    expect(screen.getByRole("button", { name: "Current" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Compare" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reveal Day" })).toHaveAttribute("aria-pressed", "true");
  });

  it("40 — 2012 entity Compare, Watch, and Brief stay unavailable", () => {
    const historical = resolveHistorical2012BrowserPayload(
      parse2012ApplicationPayloadJson(
        readFileSync(join(process.cwd(), "src/data/fixtures/registry-2012-applications.payload.json"), "utf8"),
      ),
      APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH,
    );
    render(
      <HubClaimActualityProvider claimActualityState={DEFAULT_CLAIM_ACTUALITY_STATE}>
        <HubRegistryDataProvider
          resolution={{
            document: rehearsalRegistryApplicationsDocument(),
            mode: "rehearsal",
            selectionReason: "rehearsal-default",
          }}
        >
          <HubHistorical2012Provider
            applicationPayload={historical}
            confirmedPortfolios={{ status: "not-loaded", reason: "not-configured", errorMessage: "not configured" }}
          >
            <CommandCenter view="explore" exploreParams={{ dataset: "2012-historical" }} />
          </HubHistorical2012Provider>
        </HubRegistryDataProvider>
      </HubClaimActualityProvider>,
    );
    const compares = screen.getAllByRole("button", { name: "+ Compare" });
    const watches = screen.getAllByRole("button", { name: "Watch" });
    expect(compares.length).toBeGreaterThan(0);
    expect(watches.length).toBeGreaterThan(0);
    for (const button of compares) expect(button).toBeDisabled();
    for (const button of watches) expect(button).toBeDisabled();
    expect(screen.getByRole("button", { name: "Brief this view" })).toBeDisabled();
  }, 60_000);

  it("41 — Data Health still shows both contention set figures", () => {
    const rows = buildSourceHealthRows(
      {
        document: rehearsalRegistryApplicationsDocument(),
        mode: "rehearsal",
        selectionReason: "rehearsal-default",
      },
      promotedClaim(),
    );
    const contention = rows.find((row) => row.id === "2012-contention-pdf")!;
    expect(contention.limitation).toContain(String(APPROVED_2012_BASELINE.extractedContentionSetEntities));
    expect(contention.limitation).toContain(String(APPROVED_2012_BASELINE.icannCitedContentionSetEntities));
    expect(contention.limitation).toContain("234");
    expect(contention.limitation).toContain("232");
  });

  it("42 — the illustrative contention-set value 3 is not a set-count delta", () => {
    expect(fixture.historicalContext.contentionSets).toBe(3);
    const blocked = blockedContentionSetCountState();
    expect(JSON.stringify(blocked)).not.toContain("3");
    const pulse = buildCommandCenterRoundPulse(fixture.applications);
    const contention = pulse.find((metric) => metric.metricId === "contention-membership-exposure")!;
    expect(contention.value).toBe(754);
    expect(contention.value).not.toBe(fixture.historicalContext.contentionSets);
    expect(contention.deltaLabel).not.toContain("3");
  });

  it("43 — illustrative historicalContext totals are not the 2012 side", () => {
    expect(fixture.historicalContext.applications).toBe(10);
    expect(fixture.historicalContext.uniqueStrings).toBe(9);
    expect(fixture.historicalContext.idnApplications).toBe(1);
    const presented = presentPromotedCrossRoundCount(
      "application-count",
      fixture.applications,
      promotedClaim(),
      promotedPayload,
    )!;
    expect(presented.baseline2012).toBe(1930);
    expect(presented.baseline2012).not.toBe(fixture.historicalContext.applications);
    expect(presented.active2026).toBe(fixture.applications.length);
    expect(presented.active2026).not.toBe(fixture.historicalContext.applications);
  });

  it("44 — replacement text does not add applied-for strings", () => {
    const applications = [
      row({ id: "p1", string: "atlas", replacement: "atlasnet" }),
      row({ id: "p2", string: "atlas", replacement: "other" }),
      row({ id: "p3", string: "secure", replacement: "trusted" }),
    ];
    expect(countDistinctAppliedForStrings(applications)).toBe(2);
    const presented = presentPromotedCrossRoundCount("unique-applied-strings", applications, promotedClaim(), promotedPayload)!;
    expect(presented.active2026).toBe(2);
    expect(presented.statement).not.toMatch(/atlasnet|trusted|other/);
  });

  it("45 — no RSP or provider comparison is unlocked", () => {
    const rsp = METRIC_ELIGIBILITY_CATALOG.filter((entry) => /rsp|provider/i.test(`${entry.metricId} ${entry.label}`));
    expect(rsp).toEqual([]);
    const delegated = resolveHubMetricEligibility("returning-delegated-operator", promotedClaim())!;
    expect(delegated.methodReadiness).toBe("BLOCKED_SOURCE");
    expect(delegated.comparisonAllowed).toBe(false);
    expect(APPLICATION_ACTUALITY_METRIC_IDS).not.toContain("returning-delegated-operator");
  });

  it("46 — promotion still unlocks only the existing three count metrics and no new readiness state", () => {
    expect([...APPLICATION_ACTUALITY_METRIC_IDS]).toEqual([
      "application-count",
      "unique-applied-strings",
      "idn-applications",
    ]);
    const readiness = [...new Set(METRIC_ELIGIBILITY_CATALOG.map((entry) => entry.methodReadiness))].sort();
    expect(readiness).toEqual(["BLOCKED_COVERAGE", "BLOCKED_METHOD", "BLOCKED_SOURCE", "COMPARABLE", "PARTIAL"]);
    const claimReadiness = [...new Set(METRIC_ELIGIBILITY_CATALOG.flatMap((entry) => [entry.claimReadiness.round2012, entry.claimReadiness.round2026]))].sort();
    expect(claimReadiness).toEqual(["HISTORICAL_ONLY", "NOT_PUBLISHED", "REAL_SOURCE_READY", "REHEARSAL_ONLY"]);
    for (const metricId of APPLICATION_ACTUALITY_METRIC_IDS) {
      expect(resolveHubMetricEligibility(metricId, promotedClaim())?.comparisonAllowed).toBe(true);
    }
    const stillBlocked = METRIC_ELIGIBILITY_CATALOG
      .map((entry) => entry.metricId)
      .filter((metricId) => !(APPLICATION_ACTUALITY_METRIC_IDS as readonly string[]).includes(metricId));
    for (const metricId of stillBlocked) {
      expect(resolveHubMetricEligibility(metricId, promotedClaim())?.comparisonAllowed).toBe(false);
    }
  });
});
