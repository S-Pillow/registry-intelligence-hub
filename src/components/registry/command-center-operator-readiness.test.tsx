// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { CommandCenter } from "@/components/registry/command-center";
import { HubClaimActualityProvider } from "@/components/registry/hub-claim-actuality-provider";
import { HubRegistryDataProvider } from "@/components/registry/hub-registry-data-provider";
import { APPROVED_2012_BASELINE } from "@/comparison/approved-2012-baseline";
import { DEFAULT_CLAIM_ACTUALITY_STATE, type ClaimActualityState } from "@/reveal-day-2026/claim-actuality";
import { defaultSectionsForScope, generateEditionContent } from "@/lib/briefing-data";
import { rehearsalRegistryApplicationsDocument } from "@/lib/registry-application-payload-shared";
import {
  applicantsInvestigationQueueForLens,
  buildRoundPulse,
  orientationMetricIsPrimaryPeer,
  type Application,
} from "@/lib/registry-data";

afterEach(() => {
  cleanup();
});

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

function renderPromoted(applications?: Application[]) {
  const claim = promotedClaim();
  const base = rehearsalRegistryApplicationsDocument();
  render(
    <HubClaimActualityProvider claimActualityState={claim}>
      <HubRegistryDataProvider
        resolution={{
          document: {
            ...base,
            applications: (applications ?? base.applications) as typeof base.applications,
            payloadMode: "promoted-2026",
            snapshotId: claim.snapshotId!,
          },
          mode: "promoted-2026",
          selectionReason: "promoted-active",
        }}
      >
        <CommandCenter presentation="rehearsal" />
      </HubRegistryDataProvider>
    </HubClaimActualityProvider>,
  );
}

describe("CC-OR-1 operator readiness", () => {
  it("1 — the primary Applications card shows the metric name and approved value", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const card = document.querySelector("[data-testid='primary-orientation-metrics'] [data-metric-id='application-count']");
    expect(card).not.toBeNull();
    expect(card).toHaveTextContent("Applications");
    expect(card).toHaveTextContent(String(APPROVED_2012_BASELINE.applications));
  });

  it("2 — the primary Unique strings card shows the metric name and approved value", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const card = document.querySelector("[data-testid='primary-orientation-metrics'] [data-metric-id='unique-applied-strings']");
    expect(card).toHaveTextContent("Unique strings");
    expect(card).toHaveTextContent(String(APPROVED_2012_BASELINE.uniqueStrings));
  });

  it("3 — the primary IDN card shows the metric name and approved value", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const card = document.querySelector("[data-testid='primary-orientation-metrics'] [data-metric-id='idn-applications']");
    expect(card).toHaveTextContent("IDN applications");
    expect(card).toHaveTextContent(String(APPROVED_2012_BASELINE.idnApplications));
  });

  it("4 — primary cards keep a concise 2012 identity and the pending-publication state", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const primary = screen.getByTestId("primary-orientation-metrics");
    expect(within(primary).getAllByText("Historical aggregate · 2012 Reveal Day")).toHaveLength(3);
    expect(within(primary).getAllByText(/2026 comparison pending publication/)).toHaveLength(3);
  });

  it("5 — primary cards do not show method ids or archived-copy detail", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const primary = screen.getByTestId("primary-orientation-metrics");
    expect(primary).not.toHaveTextContent("count(application)");
    expect(primary).not.toHaveTextContent("count(distinct stringUlabel)");
    expect(primary).not.toHaveTextContent("archived-copy");
    expect(primary).not.toHaveTextContent("ICANN_PRIMARY_ARCHIVED_COPY");
  });

  it("6 — Applications provenance still exposes method, archived copy, snapshot, eligibility, and limitations", async () => {
    const user = userEvent.setup();
    render(<CommandCenter presentation="rehearsal" />);
    await user.click(screen.getByRole("button", { name: "View intelligence for Applications: 1930" }));
    const drawer = await screen.findByTestId("technical-provenance");
    expect(drawer).toHaveTextContent("official-aggregate(application-count)");
    expect(drawer).toHaveTextContent(/archived copy/i);
    expect(drawer).toHaveTextContent("snap-2012-reveal-day-csv-v1");
    expect(drawer).toHaveTextContent("Not eligible");
    expect(drawer).toHaveTextContent(/cross-round comparison withheld/i);
    expect(drawer).not.toHaveTextContent(/BLOCKED_/);
  });

  it("7 — one global rehearsal disclosure states fixture, unpublished 2026, and not official", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const disclosure = screen.getByTestId("publication-state-summary");
    expect(disclosure).toHaveTextContent("Rehearsal data only.");
    expect(disclosure).toHaveTextContent("Demo / Rehearsal mode");
    expect(disclosure).toHaveTextContent("not an ICANN publication");
    expect(disclosure).toHaveTextContent("not a promoted 2026 application list");
  });

  it("8 — the long rehearsal essay is not repeated beside that disclosure", () => {
    render(<CommandCenter presentation="rehearsal" />);
    expect(screen.getAllByText(/Rehearsal data only\./)).toHaveLength(1);
    expect(screen.queryByText(/proves the experience and calculation contract/i)).not.toBeInTheDocument();
  });

  it("9 — applicant concentration keeps a short local rehearsal qualifier", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const disclosure = within(screen.getByTestId("applicant-concentration")).getByTestId("applicant-concentration-disclosure");
    expect(disclosure).toHaveTextContent("Rehearsal.");
    expect(disclosure).toHaveTextContent("Not a published 2026 result.");
    expect(disclosure).not.toHaveTextContent("proves the experience");
  });

  it("10 — exact-string competition keeps a short local rehearsal qualifier", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const disclosure = screen.getByTestId("initial-string-competition-disclosure");
    expect(disclosure).toHaveTextContent("Rehearsal.");
    expect(disclosure).toHaveTextContent("Not published 2026 contention.");
  });

  it("11 — organization labels keep a short local rehearsal qualifier", () => {
    render(<CommandCenter presentation="rehearsal" />);
    expect(screen.getByTestId("organization-label-gate")).toHaveTextContent("Rehearsal.");
    expect(screen.getByTestId("organization-label-gate")).toHaveTextContent("not an approved portfolio comparison");
  });

  it("12 — interest by category keeps a short local rehearsal qualifier", () => {
    render(<CommandCenter presentation="rehearsal" />);
    expect(screen.getByTestId("interest-by-category-disclosure")).toHaveTextContent("Demo / Rehearsal.");
  });

  it("13 — the primary orientation peers are only Applications, Unique strings, and IDN applications", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const ids = [...document.querySelectorAll("[data-testid='primary-orientation-metrics'] [data-metric-id]")].map((node) => node.getAttribute("data-metric-id"));
    expect(ids).toEqual(["application-count", "unique-applied-strings", "idn-applications"]);
  });

  it("14 — Organizations sit outside the primary peer row", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const card = document.querySelector("[data-metric-id='organization-round-count']");
    expect(card).toHaveAttribute("data-orientation-role", "rehearsal-context");
    expect(screen.getByTestId("primary-orientation-metrics").contains(card)).toBe(false);
  });

  it("15 — Regions sit outside the primary peer row", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const card = document.querySelector("[data-metric-id='distinct-regions']");
    expect(card).toHaveAttribute("data-orientation-role", "rehearsal-context");
    expect(screen.getByTestId("primary-orientation-metrics").contains(card)).toBe(false);
  });

  it("16 — the organization count is still the loaded-snapshot calculation", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const expected = buildRoundPulse(rehearsalRegistryApplicationsDocument().applications).find((metric) => metric.metricId === "organization-round-count");
    const card = document.querySelector("[data-metric-id='organization-round-count']");
    expect(card).toHaveTextContent("Organizations");
    expect(card).toHaveTextContent(String(expected?.value));
  });

  it("17 — the region count is still the loaded-snapshot calculation", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const expected = buildRoundPulse(rehearsalRegistryApplicationsDocument().applications).find((metric) => metric.metricId === "distinct-regions");
    const card = document.querySelector("[data-metric-id='distinct-regions']");
    expect(card).toHaveTextContent("Regions");
    expect(card).toHaveTextContent(String(expected?.value));
  });

  it("18 — demoted organization and region copy does not call them published 2026 facts", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const note = screen.getByTestId("rehearsal-structural-context-note");
    expect(note).toHaveTextContent("not a published 2026 fact");
    expect(note).not.toHaveTextContent(/published 2026 (organization|region) total/i);
    const context = screen.getByTestId("rehearsal-structural-context");
    expect(context).toHaveTextContent("Round-wide organization comparison not approved");
    expect(context).toHaveTextContent("not an approved cross-round comparison");
  });

  it("19 — demoted cards do not invent a 2012 historical equivalent", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const context = screen.getByTestId("rehearsal-structural-context");
    expect(context).toHaveTextContent("Not an approved 2012 baseline");
    expect(context).not.toHaveTextContent("1930");
    expect(context).not.toHaveTextContent("1409");
    expect(context).not.toHaveTextContent("60");
    expect(within(context).queryByText("Historical aggregate · 2012 Reveal Day")).not.toBeInTheDocument();
  });

  it("20 — applicant concentration stays on legal names", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const card = screen.getByTestId("applicant-concentration");
    expect(within(card).getByText("Applicant concentration")).toBeInTheDocument();
    expect(within(card).getByTestId("applicant-concentration-0")).toHaveTextContent("Atlas Digital Registry LLC");
    expect(within(card).queryByText("Atlas Digital")).not.toBeInTheDocument();
  });

  it("21 — the supporting organization module is not titled Application concentration", () => {
    render(<CommandCenter presentation="rehearsal" />);
    expect(screen.queryByText("Application concentration")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("organization-label-counts")).getByText("Organization labels")).toBeInTheDocument();
  });

  it("22 — the supporting module states organization-label grain", () => {
    render(<CommandCenter presentation="rehearsal" />);
    expect(screen.getByTestId("organization-label-counts")).toHaveTextContent("Applications grouped by organization label. Not applicant legal name.");
  });

  it("23 — the organization coverage gate remains closed", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const gate = screen.getByTestId("organization-label-gate");
    expect(gate).toHaveTextContent("Round-wide concentration gated.");
    expect(gate).toHaveTextContent("not an approved portfolio comparison");
    const org = buildRoundPulse(rehearsalRegistryApplicationsDocument().applications).find((metric) => metric.metricId === "organization-round-count");
    expect(org?.comparisonAllowed).toBe(false);
    expect(org?.methodReadiness).toBe("BLOCKED_SOURCE");
  });

  it("24 — legal-name concentration and organization labels stay separate modules", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const legal = screen.getByTestId("applicant-concentration");
    const organizations = screen.getByTestId("organization-label-counts");
    expect(legal).not.toHaveTextContent("Organization labels");
    expect(organizations).not.toHaveTextContent("Applicant concentration");
    expect(within(organizations).getByText("Atlas Digital")).toBeInTheDocument();
    expect(within(legal).queryByText(/^Atlas Digital$/)).not.toBeInTheDocument();
  });

  it("25 — category comparison is a compact full-width status, not a half-row beside the queue", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const section = screen.getByTestId("gated-structure-section");
    const category = screen.getByTestId("category-mix-comparison");
    const queue = screen.getByText("Evidence-led investigation queue").closest("[data-slot=card]");
    expect(category).toHaveAttribute("data-compact", "true");
    expect(category.parentElement).toBe(section);
    expect(queue?.parentElement).toBe(section);
    expect(category.className).not.toMatch(/lg:col-span-1|lg:w-1\/2/);
  });

  it("26 — the category status keeps the blocked reason", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const status = screen.getByTestId("category-mix-comparison");
    expect(status).toHaveTextContent("Comparison not yet approved.");
    expect(status).toHaveTextContent("2012 taxonomy coverage does not support a category delta.");
    expect(status).toHaveTextContent("No 2026 category comparison is shown.");
  });

  it("27 — the category status keeps provenance and a Data Health handoff", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const status = screen.getByTestId("category-mix-comparison");
    expect(within(status).getByRole("button", { name: "View intelligence for Category mix comparison unavailable" })).toBeInTheDocument();
    expect(within(status).getByRole("link", { name: "Open Data Health" })).toHaveAttribute("href", "/data-health?presentation=rehearsal");
  });

  it("28 — the category status shows no directional or fixture delta", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const status = screen.getByTestId("category-mix-comparison");
    expect(status).not.toHaveTextContent(/rose|doubled|increased|decreased|\+\d|previous/i);
    expect(status).not.toHaveTextContent("Identity");
  });

  it("29 — the investigation queue discloses that its order is a fixed fixture list", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const note = screen.getByTestId("lens-investigation-note");
    expect(note).toHaveTextContent("Fixed rehearsal display order");
    expect(note).toHaveTextContent("Atlas Digital, Northstar Group, Kizuna Registry");
    expect(note).toHaveTextContent("Not a ranking.");
    expect(screen.getByText("Evidence-led investigation queue").parentElement).toHaveTextContent("Fixed fixture order. Not a ranking.");
  });

  it("30 — investigation reasons do not use lead, opportunity, risk, or sales language", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const queue = screen.getByText("Evidence-led investigation queue").closest("[data-slot=card]") as HTMLElement;
    expect(queue).not.toHaveTextContent(/\blead\b|opportunit|risk score|sales|recommendation|account research/i);
  });

  it("31 — investigation reasons do not claim final contention or an approved category comparison", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const queue = screen.getByText("Evidence-led investigation queue").closest("[data-slot=card]") as HTMLElement;
    expect(queue).not.toHaveTextContent(/final contention|approved category|versus the 2012|in initial contention/i);
    expect(queue).toHaveTextContent("contention-set label");
    expect(queue).toHaveTextContent("category labels on the loaded snapshot");
  });

  it("32 — a lens change reorders the same fixture list and does not change legal-name concentration", async () => {
    const user = userEvent.setup();
    render(<CommandCenter presentation="rehearsal" />);
    expect(screen.getByTestId("investigation-queue-0")).toHaveTextContent("Atlas Digital");
    expect(applicantsInvestigationQueueForLens("strategy").map((item) => item.organization)).toEqual([
      "Kizuna Registry",
      "Atlas Digital",
      "Northstar Group",
    ]);
    await user.click(screen.getByRole("button", { name: "Product & Strategy" }));
    expect(screen.getByTestId("investigation-queue-0")).toHaveTextContent("Kizuna Registry");
    expect(screen.getByTestId("lens-investigation-note")).toHaveTextContent("Kizuna Registry, Atlas Digital, Northstar Group");
    expect(screen.getByTestId("applicant-concentration-0")).toHaveTextContent("Atlas Digital Registry LLC");
  });

  it("33 — interest by category stays within the loaded snapshot and rehearsal-only", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const card = screen.getByTestId("interest-by-category");
    expect(within(card).getByText("Interest by category")).toBeInTheDocument();
    expect(screen.getByTestId("interest-by-category-disclosure")).toHaveTextContent("Within this loaded snapshot.");
    expect(screen.getByTestId("interest-by-category-disclosure")).toHaveTextContent("Demo / Rehearsal.");
  });

  it("34 — interest by category does not bridge taxonomy to 2012", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const card = screen.getByTestId("interest-by-category");
    expect(card).toHaveTextContent("Not a cross-round comparison.");
    expect(card).not.toHaveTextContent(/2012|taxonomy bridge|rose|doubled/i);
  });

  it("35 — applicant legal name is not labeled as an organization", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const legal = screen.getByTestId("applicant-concentration");
    expect(legal).toHaveTextContent("applicant legal name");
    expect(legal).not.toHaveTextContent(/organization concentration|organization portfolio/i);
  });

  it("36 — exact applied-for string groups are not labeled as a contention-set total", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const competition = screen.getByTestId("initial-string-competition");
    expect(within(competition).getByTestId("exact-string-competition-summary")).toHaveTextContent("local grouping of loaded rows");
    expect(within(competition).getByTestId("exact-string-competition-summary")).not.toHaveTextContent(/contention/i);
    expect(within(competition).getByTestId("contention-set-count-unavailable")).toHaveTextContent("Contention-set count is unavailable.");
    expect(within(competition).getByText(/Not an exact applied-for string recount/i)).toBeInTheDocument();
  });

  it("37 — values present in both rounds are not called comparable on the rehearsal strip", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const primary = screen.getByTestId("primary-orientation-metrics");
    expect(primary).toHaveTextContent("2026 comparison pending publication");
    expect(primary).not.toHaveTextContent("Difference");
    expect(primary).not.toHaveTextContent("Comparable method");
    expect(screen.getByTestId("orientation-count-basis")).toHaveTextContent("not 2026 publication totals");
  });

  it("38 — navigation, lenses, time basis, search, and Instant Briefing stay in place", () => {
    render(<CommandCenter presentation="rehearsal" />);
    const nav = screen.getByTestId("hub-primary-nav");
    for (const name of ["Command Center", "Explore", "Competitive Landscape"]) {
      expect(within(nav).getByRole("link", { name })).toBeInTheDocument();
    }
    for (const name of ["Compare", "Saved", "Briefings", "Data Health"]) {
      expect(within(nav).queryByRole("link", { name })).not.toBeInTheDocument();
    }
    expect(within(nav).getByRole("link", { name: "Data & methodology" })).toHaveAttribute(
      "href",
      "/data-health?presentation=rehearsal",
    );
    expect(screen.getByRole("link", { name: "Open Data Health" })).toHaveAttribute("href", "/data-health?presentation=rehearsal");
    for (const name of ["All Intelligence", "Commercial", "Product & Strategy", "Marketing"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Reveal Day" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Current" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Compare" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Search rehearsal records" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Instant Briefing" })).toBeInTheDocument();
  });

  it("39 — promoted eligible comparisons still show loaded-row differences for application and IDN only", () => {
    const base = rehearsalRegistryApplicationsDocument().applications[0];
    renderPromoted([
      { ...base, id: "p1", string: "Alpha", idn: false },
      { ...base, id: "p2", string: "Beta", idn: true },
    ] as Application[]);
    expect(screen.getByTestId("cross-round-delta-applications")).toHaveTextContent("2012 baseline 1930. Loaded snapshot 2. Difference -1928.");
    expect(screen.queryByTestId("cross-round-delta-strings")).not.toBeInTheDocument();
    expect(screen.getByTestId("cross-round-delta-idn")).toHaveTextContent("2012 baseline 116. Loaded snapshot 1. Difference -115.");
  });

  it("40 — promoted mode still identifies the 2012 baseline", () => {
    renderPromoted();
    expect(screen.getByTestId("orientation-count-basis")).toHaveTextContent(/loaded snapshot minus 2012 baseline|historical 2012 baseline/i);
    expect(screen.getByTestId("cross-round-delta-applications")).toHaveTextContent("2012 baseline 1930");
  });

  it("41 — promoted mode does not keep the rehearsal-only warning", () => {
    renderPromoted();
    expect(screen.queryByText(/Rehearsal data only\./)).not.toBeInTheDocument();
    expect(screen.queryByText(/not an official 2026 publication/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Rehearsal fixture\./)).not.toBeInTheDocument();
    expect(screen.getByTestId("initial-string-competition-disclosure")).not.toHaveTextContent(/Rehearsal fixture only|Rehearsal\./);
    expect(screen.getByTestId("applicant-concentration-disclosure")).toHaveTextContent("Promoted snapshot.");
    expect(screen.getByTestId("interest-by-category-disclosure")).not.toHaveTextContent("Rehearsal fixture.");
  });

  it("42 — promoted applicant concentration recomputes from legal names", () => {
    const base = rehearsalRegistryApplicationsDocument();
    const applications = base.applications.map((app, index) => ({
      ...app,
      applicant: index < 2 ? "Promoted Legal Name Alpha" : "Promoted Legal Name Beta",
      organization: "Resolved Organization Label",
    }));
    renderPromoted(applications as Application[]);
    const card = screen.getByTestId("applicant-concentration");
    expect(within(card).getByTestId("applicant-concentration-0")).toHaveTextContent("Promoted Legal Name Beta");
    expect(within(card).queryByText("Atlas Digital Registry LLC")).not.toBeInTheDocument();
    expect(within(card).queryByText("Resolved Organization Label")).not.toBeInTheDocument();
  });

  it("43 — promoted exact-string groups recompute from loaded rows", () => {
    const base = rehearsalRegistryApplicationsDocument().applications[0];
    renderPromoted([
      { ...base, id: "p1", string: "promoted", contentionSet: null },
      { ...base, id: "p2", string: "promoted", contentionSet: "ICS-other" },
      { ...base, id: "p3", string: "solo", contentionSet: "ICS-other" },
    ] as Application[]);
    const competition = screen.getByTestId("initial-string-competition");
    expect(within(competition).getByText(".promoted")).toBeInTheDocument();
    expect(within(competition).queryByText(".atlas")).not.toBeInTheDocument();
    expect(within(competition).getByTestId("initial-string-competition-disclosure")).toHaveTextContent("not an approved contention-set count");
  });

  it("44 — round-wide stand-out findings stay empty and What You Should Know stays retired", () => {
    render(<CommandCenter presentation="rehearsal" />);
    expect(screen.queryByTestId("standout-insights-section")).not.toBeInTheDocument();
    expect(screen.queryByText("WHAT YOU SHOULD KNOW")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Reveal Day Intelligence" })).not.toBeInTheDocument();
    const edition = generateEditionContent({
      scope: { kind: "round-wide" },
      emphasis: "all",
      detailLevel: "standard",
      sectionsWanted: defaultSectionsForScope("round-wide"),
    });
    expect(edition.sections.find((section) => section.id === "what-stands-out")?.claims).toEqual([]);
  });

  it("45 — a contract-permitted organization or region metric is not forced off the primary row", () => {
    const rehearsalOrg = buildRoundPulse(rehearsalRegistryApplicationsDocument().applications).find((metric) => metric.metricId === "organization-round-count")!;
    expect(orientationMetricIsPrimaryPeer(rehearsalOrg)).toBe(false);
    expect(orientationMetricIsPrimaryPeer({ ...rehearsalOrg, claimReadiness2026: "REAL_SOURCE_READY" })).toBe(true);
    expect(orientationMetricIsPrimaryPeer({ ...rehearsalOrg, comparisonAllowed: true })).toBe(true);
    const region = buildRoundPulse(rehearsalRegistryApplicationsDocument().applications).find((metric) => metric.metricId === "distinct-regions")!;
    expect(orientationMetricIsPrimaryPeer(region)).toBe(false);
    expect(orientationMetricIsPrimaryPeer({ ...region, displayTier: "production-ready" })).toBe(true);
    for (const metricId of ["application-count", "unique-applied-strings", "idn-applications"]) {
      const metric = buildRoundPulse(rehearsalRegistryApplicationsDocument().applications).find((item) => item.metricId === metricId)!;
      expect(orientationMetricIsPrimaryPeer(metric)).toBe(true);
    }
  });

  it("46 — provenance stays reachable for the snapshot, the method, and the unavailable contention-set count", async () => {
    const user = userEvent.setup();
    render(<CommandCenter presentation="rehearsal" />);
    await user.click(screen.getByRole("button", { name: "View intelligence for Snapshot snap-rehearsal-2026-09-16" }));
    expect(await screen.findByText(/INTELLIGENCE DRAWER · DATASET/)).toBeInTheDocument();
    expect(screen.getByText("round-pulse/1.0.0")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.getByTestId("contention-set-count-unavailable")).toHaveTextContent("No set total is shown.");
    expect(screen.getByTestId("contention-set-count-unavailable")).toHaveAttribute("data-set-count-available", "false");
  });
});
