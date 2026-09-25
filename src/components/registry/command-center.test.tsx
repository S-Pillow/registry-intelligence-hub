// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HubRegistryDataProvider } from "@/components/registry/hub-registry-data-provider";
import { rehearsalRegistryApplicationsDocument } from "@/lib/registry-application-payload-shared";
import { exploreDrillDownHref, exploreEntityResearchHref, exploreFullHrefForInvestigation, exploreResearchHref } from "@/lib/registry-data";
import { CommandCenter } from "./command-center";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("Command Center interactions", () => {
  it("passes the cover-the-buttons contract for all four Views", async () => {
    const user = userEvent.setup();
    render(<CommandCenter />);

    const lensCopyBundle = () =>
      `${screen.getByTestId("above-fold-lens-surface").textContent ?? ""}${screen.getByTestId("round-pulse-section").textContent ?? ""}`;
    const panelLine = () => screen.getByTestId("lens-view-panel-line").textContent ?? "";
    const condensedWhy = () => screen.getByTestId("lens-why-matters-condensed").textContent ?? "";
    const pulseEyebrow = () => screen.getByTestId("lens-round-pulse-eyebrow").textContent ?? "";
    const pulseSubtitle = () => screen.getByTestId("lens-round-pulse-subtitle").textContent ?? "";
    const focusMarkers = () => screen.queryAllByTestId("lens-view-focus-marker").map((node) => node.textContent ?? "");
    const factValues = () =>
      within(screen.getByTestId("round-pulse-section"))
        .getAllByText(/^\d+$/)
        .map((node) => node.textContent);
    const hubTitle = () => screen.getByRole("heading", { level: 1, name: "Registry Intelligence Hub" });
    const documentBefore = (earlier: Element, later: Element) =>
      Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING);

    expect(panelLine()).toMatch(/All Intelligence:/);
    expect(condensedWhy()).toMatch(/Why this matters for All Intelligence:/);
    expect(pulseEyebrow()).toBe("ROUND PULSE · ALL INTELLIGENCE");
    expect(pulseSubtitle()).toBe("Round intelligence at a glance");
    expect(screen.getByTestId("round-pulse-dataset-split")).toHaveTextContent(
      "2026 rehearsal signals with approved 2012 historical baselines.",
    );
    expect(focusMarkers()).toHaveLength(0);
    const rehearsalBanner = () => screen.getByText(/Rehearsal data only\./);
    const roundPulseSection = () => screen.getByTestId("round-pulse-section");
    expect(documentBefore(screen.getByTestId("publication-state"), hubTitle())).toBe(true);
    expect(documentBefore(hubTitle(), screen.getByTestId("lens-round-pulse-eyebrow"))).toBe(true);
    expect(documentBefore(roundPulseSection(), screen.getByLabelText("Dataset health"))).toBe(true);
    expect(documentBefore(rehearsalBanner(), roundPulseSection())).toBe(true);
    expect(screen.getByTestId("publication-state-summary")).toHaveTextContent("Rehearsal fixture. The 2026 round is not published.");
    expect(screen.queryByText("REHEARSAL READY")).not.toBeInTheDocument();
    expect(rehearsalBanner()).toBeInTheDocument();
    const baselineFacts = factValues();
    expect(baselineFacts).toContain("1930");
    expect(baselineFacts).toContain("1409");
    expect(baselineFacts).toContain("116");
    expect(baselineFacts).toContain("754");

    const allAbove = lensCopyBundle();
    await user.click(screen.getByRole("button", { name: "Commercial" }));
    expect(lensCopyBundle()).not.toBe(allAbove);
    expect(panelLine()).toBe("Commercial: Focuses on applicant portfolios, organizations, and contention.");
    expect(condensedWhy()).toMatch(/Why this matters for Commercial:/);
    expect(pulseEyebrow()).toBe("ROUND PULSE · COMMERCIAL VIEW");
    expect(pulseSubtitle()).toBe("Applicant portfolios, organizations, and contention signals at a glance");
    expect(focusMarkers()).toEqual(
      expect.arrayContaining(["View focus · Portfolio depth signal", "View focus · Contention timing watch"]),
    );
    expect(factValues()).toEqual(baselineFacts);

    const commercialAbove = lensCopyBundle();
    await user.click(screen.getByRole("button", { name: "Product & Strategy" }));
    expect(lensCopyBundle()).not.toBe(commercialAbove);
    expect(panelLine()).toBe("Product & Strategy: Focuses on composition, IDN participation, and contention.");
    expect(condensedWhy()).toMatch(/how the round is structured and where participation patterns differ/);
    expect(pulseEyebrow()).toBe("ROUND PULSE · PRODUCT & STRATEGY VIEW");
    expect(pulseSubtitle()).toBe("Composition, IDN participation, and contention signals at a glance");
    expect(focusMarkers()).toEqual(
      expect.arrayContaining([
        "View focus · Composition geography",
        "View focus · Composition shift",
        "View focus · Round-structure signal",
      ]),
    );
    expect(factValues()).toEqual(baselineFacts);

    const strategyAbove = lensCopyBundle();
    await user.click(screen.getByRole("button", { name: "Marketing" }));
    expect(lensCopyBundle()).not.toBe(strategyAbove);
    expect(panelLine()).toBe(
      "Marketing: Focuses on geographic reach, IDN participation, and themes that may shape external narratives.",
    );
    expect(condensedWhy()).toMatch(/Why this matters for Marketing:/);
    expect(condensedWhy()).toMatch(/cross-region and language patterns that may shape market narratives/);
    expect(pulseEyebrow()).toBe("ROUND PULSE · MARKETING VIEW");
    expect(pulseSubtitle()).toBe("Geographic reach and IDN signals at a glance");
    expect(focusMarkers()).toEqual(
      expect.arrayContaining(["View focus · Cross-region narrative", "View focus · Geographic reach signal"]),
    );
    expect(factValues()).toEqual(baselineFacts);
    expect(documentBefore(hubTitle(), screen.getByTestId("lens-round-pulse-eyebrow"))).toBe(true);
    expect(documentBefore(rehearsalBanner(), roundPulseSection())).toBe(true);
  });

  it("keeps downstream lens-dependent content when Views change", async () => {
    const user = userEvent.setup();
    render(<CommandCenter />);
    const fullWhy = () => screen.getByTestId("lens-why-matters").textContent ?? "";
    const topInvestigation = () => screen.getByTestId("investigation-queue-0").textContent ?? "";
    expect(fullWhy()).toMatch(/concentrated portfolios, increased IDN representation/);
    expect(topInvestigation()).toBe("Atlas Digital");

    await user.click(screen.getByRole("button", { name: "Commercial" }));
    expect(screen.queryByText("IDN interest reaches two regions and two scripts")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Product & Strategy" }));
    expect(topInvestigation()).toBe("Kizuna Registry");
  });

  it("opens the intelligence drawer and separates evidence from classification", async () => {
    const user = userEvent.setup();
    render(<CommandCenter />);

    await user.click(screen.getByRole("button", { name: "View intelligence for Applications: 1930" }));

    expect(await screen.findByText(/INTELLIGENCE DRAWER · METRIC/)).toBeInTheDocument();
    expect(screen.getByText("Applications: 1930")).toBeInTheDocument();
    expect(screen.getByText("Deterministic source-backed fact")).toBeInTheDocument();
    expect(screen.getByText("Confidence: not applicable to deterministic facts")).toBeInTheDocument();
    expect(screen.getAllByText("snap-rehearsal-2026-09-16").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Watch" }));
    expect(screen.getByRole("button", { name: "Watching" })).toBeInTheDocument();
  });

  it("connects like-entity Explore selections to the full Compare route", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="explore" exploreParams={{ entity: "organizations" }} />);

    await user.click(screen.getAllByRole("button", { name: "Add to compare Atlas Digital" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Add to compare Kizuna Registry" })[0]);

    const compareLink = screen.getByRole("link", { name: "Compare 2" });
    expect(compareLink).toHaveAttribute("href", expect.stringContaining("/compare?type=organizations"));
  });

  it("explains fixture-backed source coverage exceptions", async () => {
    const user = userEvent.setup();
    render(<CommandCenter />);

    await user.click(screen.getByRole("button", { name: "View intelligence for Source coverage" }));

    expect(await screen.findByText("COVERAGE EXCEPTIONS")).toBeInTheDocument();
    expect(screen.getByText("not yet published")).toBeInTheDocument();
    expect(screen.getByText("not public")).toBeInTheDocument();
    expect(screen.getByText("missing")).toBeInTheDocument();
    expect(screen.getByText(/Affected: Market Opportunity Map/)).toBeInTheDocument();
  });

  it("links Command Center search to the Explore research context", async () => {
    const user = userEvent.setup();
    render(<CommandCenter />);
    const search = screen.getByRole("textbox", { name: "Search fixture records" });
    await user.type(search, "Atlas");
    expect(exploreResearchHref("Atlas")).toBe("/explore?q=Atlas");
    expect(screen.getByRole("link", { name: "Open in Explore" })).toHaveAttribute("href", "/explore?q=Atlas");
  });

  it("opens provenance for snapshot lineage from dataset health", async () => {
    const user = userEvent.setup();
    render(<CommandCenter />);
    await user.click(screen.getByRole("button", { name: "View intelligence for Snapshot snap-rehearsal-2026-09-16" }));
    expect(await screen.findByText(/INTELLIGENCE DRAWER · DATASET/)).toBeInTheDocument();
    expect(screen.getByText("snap-rehearsal-2026-09-16")).toBeInTheDocument();
  });

  it("wires Investigate, Compare, and Watch for applicants worth investigating", async () => {
    const user = userEvent.setup();
    render(<CommandCenter />);
    const applicantCard = screen.getByText("Evidence-led investigation queue").closest("[data-slot=card]") as HTMLElement;
    await user.click(within(applicantCard).getByRole("button", { name: "Add to compare Atlas Digital investigation profile" }));
    expect(screen.getByLabelText("Comparison selection tray")).toBeInTheDocument();
    await user.click(within(applicantCard).getByRole("button", { name: "Watch Atlas Digital investigation profile" }));
    await waitFor(() => expect(within(applicantCard).getByRole("button", { name: "Watching Atlas Digital investigation profile" })).toBeInTheDocument());
    await user.click(within(applicantCard).getAllByRole("button", { name: "View intelligence for Atlas Digital investigation profile" })[1]);
    expect(await screen.findByText(/INTELLIGENCE DRAWER · APPLICANT/)).toBeInTheDocument();
  });

  it("does not show internal blocked-eligibility codes in Biggest Changes copy", () => {
    render(<CommandCenter />);
    expect(screen.queryByText(/BLOCKED_COVERAGE/)).not.toBeInTheDocument();
    expect(screen.getByText(/category mix comparison not yet approved/i)).toBeInTheDocument();
  });

  it("focuses global search with the slash shortcut", async () => {
    const user = userEvent.setup();
    render(<CommandCenter />);
    const search = screen.getByRole("textbox", { name: "Search fixture records" });

    await user.keyboard("/");

    expect(search).toHaveFocus();
  });

  it("freezes the Command Center terminology while preserving Watch actions", async () => {
    const user = userEvent.setup();
    render(<CommandCenter />);

    expect(screen.getByText("APPLICANTS WORTH INVESTIGATING")).toBeInTheDocument();
    expect(screen.queryByText("APPLICANTS TO WATCH")).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "View intelligence for Atlas Digital investigation profile" })[0]);
    expect(screen.getByRole("button", { name: "Watch" })).toBeInTheDocument();
  });
});

describe("Explore interactions", () => {
  it("composes filters, updates counts, and writes shareable URL state", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="explore" />);

    expect(screen.getByText("12 applications results · 12 applications")).toBeInTheDocument();
    await user.keyboard("/");
    expect(screen.getByRole("textbox", { name: "Search all registry records" })).toHaveFocus();
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by IDN" }), "idn");

    expect(screen.getByText("2 applications results · 2 applications")).toBeInTheDocument();
    expect(window.location.search).toContain("idn=idn");
    await user.selectOptions(screen.getByRole("combobox", { name: "Browse by" }), "organizations");
    expect(screen.getByText("2 organizations results · 2 applications")).toBeInTheDocument();
  });

  it("restores initial URL filters and opens records in the shared drawer", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="explore" exploreParams={{ category: "Identity", status: "returning" }} />);

    expect(screen.getByText("2 applications results · 2 applications")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Add to compare \.secure/ }).length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole("button", { name: "View intelligence for .secure" }).find((button) => button.textContent === "Investigate")!);

    expect(await screen.findByText(/INTELLIGENCE DRAWER · APPLICATION/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Compare" })).toBeInTheDocument();
  });

  it("shows a clear empty research state", () => {
    render(<CommandCenter view="explore" exploreParams={{ q: "no-such-record" }} />);

    expect(screen.getByText("No records match this research view")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Clear filters" }).length).toBeGreaterThan(0);
  });

  it("focuses Explore search with Ctrl/Cmd+K", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="explore" />);
    const search = screen.getByRole("textbox", { name: "Search all registry records" });
    await user.keyboard("{Control>}k{/Control}");
    expect(search).toHaveFocus();
  });

  it("covers Explore loading and error rehearsal states", () => {
    const { rerender } = render(<CommandCenter view="explore" state="loading" />);
    expect(screen.getByLabelText("Loading Explore")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Search all registry records" })).toBeInTheDocument();

    rerender(<CommandCenter view="explore" state="error" />);
    expect(screen.getByText("Explore is temporarily unavailable")).toBeInTheDocument();
  });

  it("disables compare and watch in strings browse with explicit guidance", () => {
    render(<CommandCenter view="explore" exploreParams={{ entity: "strings" }} />);
    const compare = screen.getAllByRole("button", { name: /\+ Compare/ })[0];
    expect(compare).toBeDisabled();
    expect(compare).toHaveAttribute("title", expect.stringContaining("Strings browse"));
  });

  it("writes sort choice to shareable URL state", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="explore" exploreParams={{ entity: "organizations", sort: "name-asc" }} />);
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("Atlas Digital")).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort records" }), "contention-desc");
    expect(window.location.search).toContain("sort=contention-desc");
  });

  it("shows catalog-gated historical disclosure without local comparison gates", () => {
    render(<CommandCenter view="explore" />);
    expect(screen.getByText(/Historical intelligence follows/)).toBeInTheDocument();
    expect(screen.getByText(/cross-round comparison withheld/i)).toBeInTheDocument();
    expect(screen.queryByText(/BLOCKED_/)).not.toBeInTheDocument();
  });
});

describe("Command Center → Explore drill-down", () => {
  it("links rehearsal Round Pulse metrics and supporting charts into Explore — not historical aggregates", () => {
    render(<CommandCenter />);
    expect(screen.queryByRole("link", { name: "Open IDN applications in Explore" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open Applications in Explore" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open Unique strings in Explore" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Organizations in 2026 rehearsal Explore" })).toHaveAttribute(
      "href",
      exploreDrillDownHref("organizations"),
    );
    expect(screen.queryByRole("link", { name: /Open Initial contention sets in 2026 rehearsal Explore/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("historical-aggregate-only-contention")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Atlas Digital in 2026 rehearsal Explore" })).toHaveAttribute(
      "href",
      exploreEntityResearchHref("organizations", "Atlas Digital"),
    );
    expect(screen.getByRole("link", { name: "Open Technology category in 2026 rehearsal Explore" })).toHaveAttribute(
      "href",
      exploreEntityResearchHref("categories", "Technology"),
    );
  });
});

describe("Compare interactions", () => {
  it("renders stable organization rows with provenance and unavailable states", () => {
    render(<CommandCenter view="compare" compareParams={{ type: "organizations", ids: "Atlas Digital,Northstar Group" }} />);

    expect(screen.getByText("Stable dimension")).toBeInTheDocument();
    expect(screen.getAllByText("2026 applications").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Initial contention exposure").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Snapshot snap-rehearsal-2026-09-16/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "View intelligence for Atlas Digital" }).length).toBeGreaterThanOrEqual(1);
  });

  it("adds, reorders, replaces, and removes like entities with URL state", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="compare" compareParams={{ type: "categories", ids: "Technology,Identity" }} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Add category" }), "Consumer");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("button", { name: "Remove Consumer" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Move Identity left" }));
    await waitFor(() => expect(window.location.search).toContain("ids=Identity%2CTechnology%2CConsumer"));

    await user.selectOptions(screen.getByRole("combobox", { name: "Replace Technology" }), "Community");
    await waitFor(() => expect(window.location.search).toContain("Community"));

    await user.click(screen.getByRole("button", { name: "Remove Consumer" }));
    expect(screen.queryByRole("button", { name: "Remove Consumer" })).not.toBeInTheDocument();
  });

  it("keeps application unavailable and not-comparable states distinct", () => {
    render(<CommandCenter view="compare" compareParams={{ type: "applications", ids: "APP-26001,APP-26003" }} />);

    expect(screen.getAllByText("Unavailable").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Not comparable").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Not available — not published").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/outcome not verified|New \(fixture\)/).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/^Returning$/)).not.toBeInTheDocument();
  });

  it("covers empty, loading, and error states", () => {
    const { rerender } = render(<CommandCenter view="compare" state="empty" />);
    expect(screen.getByText("Choose at least two organizations")).toBeInTheDocument();

    rerender(<CommandCenter view="compare" state="loading" />);
    expect(screen.getByLabelText("Loading Compare")).toBeInTheDocument();

    rerender(<CommandCenter view="compare" state="error" />);
    expect(screen.getByText("Comparison unavailable")).toBeInTheDocument();
  });

  it("groups dimensions into scalable sections while preserving unavailable states", () => {
    render(<CommandCenter view="compare" compareParams={{ type: "organizations", ids: "Atlas Digital,Northstar Group" }} />);

    expect(screen.getAllByText("Round Activity").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Historical Participation").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Existing Portfolio").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Market Context").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThanOrEqual(2);
  });

  it("labels the same sections differently per entity type while comparing the same underlying dimensions", () => {
    const { unmount } = render(<CommandCenter view="compare" compareParams={{ type: "organizations", ids: "Atlas Digital,Northstar Group" }} />);
    expect(screen.getAllByText("Round Activity").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Existing Portfolio").length).toBeGreaterThan(0);
    unmount();

    const { unmount: unmountApplications } = render(<CommandCenter view="compare" compareParams={{ type: "applications", ids: "APP-26001,APP-26003" }} />);
    expect(screen.getAllByText("Application Details").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Application Context").length).toBeGreaterThan(0);
    expect(screen.queryByText("Round Activity")).not.toBeInTheDocument();
    expect(screen.queryByText("Existing Portfolio")).not.toBeInTheDocument();
    unmountApplications();

    render(<CommandCenter view="compare" compareParams={{ type: "categories", ids: "Technology,Identity" }} />);
    expect(screen.getAllByText("Round Composition").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Category Footprint").length).toBeGreaterThan(0);
    expect(screen.queryByText("Round Activity")).not.toBeInTheDocument();
    expect(screen.queryByText("Existing Portfolio")).not.toBeInTheDocument();
    // Historical Participation and Market Context are shared/generic labels across entity types.
    expect(screen.getAllByText("Historical Participation").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Market Context").length).toBeGreaterThan(0);
  });

  it("shows a deterministic Key differences summary with actual directional facts and shared dimensions, never AI or winner language", () => {
    render(<CommandCenter view="compare" compareParams={{ type: "organizations", ids: "Atlas Digital,Northstar Group" }} />);

    expect(screen.getByText("Key differences")).toBeInTheDocument();
    expect(screen.getByText(/of \d+ dimensions differ across selections/)).toBeInTheDocument();
    const summarySection = screen.getByText("Key differences").closest("section") as HTMLElement;
    // Directional facts: the actual entity + value, not just the dimension name.
    expect(within(summarySection).getByText(/2026 applications — Atlas Digital 3, Northstar Group 2/)).toBeInTheDocument();
    // Meaningful shared dimensions are named, not just counted.
    expect(within(summarySection).getByText(/Selections match on/)).toBeInTheDocument();
    expect(within(summarySection).queryByText(/win|best|worst|leads|recommend|\bAI\b|\brank/i)).not.toBeInTheDocument();
  });

  it("toggles between All dimensions and Differences only, hiding matching rows", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="compare" compareParams={{ type: "organizations", ids: "Atlas Digital,Northstar Group" }} />);

    expect(screen.getByRole("button", { name: "All dimensions" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("Historical market demand").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Differences only" }));

    expect(screen.getByRole("button", { name: "Differences only" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Historical market demand")).not.toBeInTheDocument();
    expect(screen.getAllByText("2026 applications").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "All dimensions" }));
    expect(screen.getAllByText("Historical market demand").length).toBeGreaterThan(0);
  });

  it("displays an unambiguous delta naming the reference entity for a differing numeric dimension", () => {
    render(<CommandCenter view="compare" compareParams={{ type: "organizations", ids: "Atlas Digital,Northstar Group" }} />);

    // Atlas Digital (reference) has 3 applications; Northstar Group has 2 — a deterministic -1 delta.
    expect(screen.getAllByText("(-1 vs Atlas Digital)").length).toBeGreaterThan(0);
  });

  it("explicitly labels the first selected entity as Reference and keeps it deterministic under reorder/replace", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="compare" compareParams={{ type: "organizations", ids: "Atlas Digital,Northstar Group" }} />);

    const headerBefore = screen.getByRole("columnheader", { name: /Atlas Digital/ });
    expect(within(headerBefore).getByText("Reference")).toBeInTheDocument();
    expect(screen.getAllByText("Reference").length).toBeGreaterThan(0);
    expect(screen.getAllByText("(-1 vs Atlas Digital)").length).toBeGreaterThan(0);

    // Reordering so Northstar Group becomes index 0 makes it the new, deterministic reference.
    await user.click(screen.getByRole("button", { name: "Move Northstar Group left" }));
    await waitFor(() => expect(window.location.search).toContain("ids=Northstar+Group%2CAtlas+Digital"));

    const headerAfter = screen.getByRole("columnheader", { name: /Northstar Group/ });
    expect(within(headerAfter).getByText("Reference")).toBeInTheDocument();
    expect(screen.getAllByText("(+1 vs Northstar Group)").length).toBeGreaterThan(0);
  });

  it("caps Key differences to a concise, ranked set and reveals the rest via 'View all N differences'", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="compare" compareParams={{ type: "organizations", ids: "Atlas Digital,Northstar Group,Verde Cooperative,Future MENA" }} />);

    const summarySection = screen.getByText("Key differences").closest("section") as HTMLElement;
    const initialFindings = within(summarySection).getAllByRole("listitem");
    expect(initialFindings.length).toBeLessThanOrEqual(4);

    const viewAllButton = screen.getByRole("button", { name: /^View all \d+ differences$/ });
    await user.click(viewAllButton);

    const expandedFindings = within(summarySection).getAllByRole("listitem");
    expect(expandedFindings.length).toBeGreaterThan(initialFindings.length);
    expect(screen.getByRole("button", { name: "Show fewer differences" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show fewer differences" }));
    expect(within(summarySection).getAllByRole("listitem")).toHaveLength(initialFindings.length);
  });

  it("scales the Key differences summary down to a single concise finding for a two-entity comparison with one real difference", () => {
    render(<CommandCenter view="compare" compareParams={{ type: "organizations", ids: "Atlas Digital,Northstar Group" }} />);

    const summarySection = screen.getByText("Key differences").closest("section") as HTMLElement;
    expect(screen.queryByRole("button", { name: /View all/ })).not.toBeInTheDocument();
    expect(within(summarySection).getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  it("uses a neutral, non-amber tint for difference affordances, reserving amber for warning/evidence banners", () => {
    const { container } = render(<CommandCenter view="compare" compareParams={{ type: "organizations", ids: "Atlas Digital,Northstar Group" }} />);

    const differingCells = container.querySelectorAll("td.bg-sky-50\\/70");
    expect(differingCells.length).toBeGreaterThan(0);
    differingCells.forEach((cell) => expect(cell.className).not.toMatch(/amber|yellow/));

    // The rehearsal-baseline banner is a warning/evidence caveat, so it keeps its amber treatment.
    expect(screen.getByText("Rehearsal comparison.").closest("div")?.className).toMatch(/amber/);
  });

  it("keeps entity column headers sticky for long comparisons", () => {
    render(<CommandCenter view="compare" compareParams={{ type: "organizations", ids: "Atlas Digital,Northstar Group" }} />);

    const header = screen.getByRole("columnheader", { name: /Atlas Digital/ });
    expect(header.className).toContain("sticky");
    expect(header.className).toContain("top-0");
  });

  it("keeps sticky, correctly aligned entity headers with three selected entities", () => {
    render(<CommandCenter view="compare" compareParams={{ type: "categories", ids: "Technology,Identity,Consumer" }} />);

    const dimensionHeader = screen.getByRole("columnheader", { name: "Stable dimension" });
    expect(dimensionHeader.className).toContain("sticky");
    expect(dimensionHeader.className).toContain("left-0");
    expect(dimensionHeader.className).toContain("top-0");
    ["Technology", "Identity", "Consumer"].forEach((label) => {
      const header = screen.getByRole("columnheader", { name: new RegExp(label) });
      expect(header.className).toContain("sticky");
      expect(header.className).toContain("top-0");
      expect(header.className).toContain("z-20");
    });
    // Every data row must have exactly one cell per selected entity, keeping columns aligned under the sticky headers.
    const firstRow = screen.getAllByText("2026 applications")[0].closest("tr") as HTMLElement;
    expect(within(firstRow).getAllByRole("cell")).toHaveLength(3);
  });

  it("keeps sticky, correctly aligned entity headers with four selected entities", () => {
    render(<CommandCenter view="compare" compareParams={{ type: "categories", ids: "Technology,Identity,Consumer,Community" }} />);

    const dimensionHeader = screen.getByRole("columnheader", { name: "Stable dimension" });
    expect(dimensionHeader.className).toContain("sticky");
    expect(dimensionHeader.className).toContain("left-0");
    ["Technology", "Identity", "Consumer", "Community"].forEach((label) => {
      const header = screen.getByRole("columnheader", { name: new RegExp(label) });
      expect(header.className).toContain("sticky");
      expect(header.className).toContain("top-0");
      expect(header.className).toContain("z-20");
    });
    const firstRow = screen.getAllByText("2026 applications")[0].closest("tr") as HTMLElement;
    expect(within(firstRow).getAllByRole("cell")).toHaveLength(4);
  });

  it("collapses the large entity selector into a compact editable selection bar and back", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="compare" compareParams={{ type: "organizations", ids: "Atlas Digital,Northstar Group" }} />);

    expect(screen.getByText("Entity type boundary")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Collapse selector" }));

    expect(screen.queryByText("Entity type boundary")).not.toBeInTheDocument();
    const compactBar = screen.getByLabelText("Compact comparison selection");
    expect(within(compactBar).getByText("Atlas Digital")).toBeInTheDocument();
    expect(within(compactBar).getByText("Northstar Group")).toBeInTheDocument();

    await user.click(within(compactBar).getByRole("button", { name: "Remove Northstar Group" }));
    expect(screen.getByText("Choose at least two organizations")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit selection" }));
    expect(screen.getByText("Entity type boundary")).toBeInTheDocument();
  });

  it("replaces consumer-shopping copy with internal intelligence language and shows originating context", () => {
    render(<CommandCenter view="compare" compareParams={{ type: "organizations", ids: "Atlas Digital,Northstar Group" }} />);

    expect(screen.queryByText(/^Shop /)).not.toBeInTheDocument();
    expect(screen.getByText(/Review two to four like entities side by side/)).toBeInTheDocument();
    expect(screen.getByText("Context: Direct entity selection in Compare")).toBeInTheDocument();
  });
});

describe("Command Center information hierarchy", () => {
  const documentBefore = (earlier: Element, later: Element) =>
    Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING);

  it("reads publication state, one count strip, then gated modules, demoted insights, and trust", () => {
    render(<CommandCenter />);

    const publication = screen.getByTestId("publication-state");
    const pulse = screen.getByTestId("round-pulse-section");
    const gated = screen.getByTestId("gated-structure-section");
    const supportingHeading = screen.getByRole("heading", { name: "Explore the shape behind the signals" });
    const supporting = supportingHeading.closest("section") as HTMLElement;
    const insights = screen.getByTestId("standout-insights-section");
    const trust = screen.getByLabelText("Dataset health");

    expect(documentBefore(publication, pulse)).toBe(true);
    expect(documentBefore(pulse, gated)).toBe(true);
    expect(documentBefore(gated, supportingHeading)).toBe(true);
    expect(documentBefore(supportingHeading, insights)).toBe(true);
    expect(documentBefore(insights, trust)).toBe(true);
    expect(screen.getByRole("button", { name: "Current" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Compare" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reveal Day" })).toHaveAttribute("aria-pressed", "true");
    expect(within(gated).getByText("Comparison not yet approved.")).toBeInTheDocument();
    expect(within(supporting).getByText(/Round-wide concentration gated/i)).toBeInTheDocument();
    expect(screen.getByText("Atlas Digital holds the rehearsal fixture’s largest portfolio")).toBeInTheDocument();
    expect(screen.queryByText(/registry service provider/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bRSP\b/)).not.toBeInTheDocument();
    expect(screen.queryByText("Q176")).not.toBeInTheDocument();
  });

  it("keeps promoted publication state distinct without inventing 2026 totals", () => {
    const document = {
      ...rehearsalRegistryApplicationsDocument(),
      payloadMode: "promoted-2026" as const,
      snapshotId: "snap-promoted-2026-example",
    };
    render(
      <HubRegistryDataProvider resolution={{ document, mode: "promoted-2026", selectionReason: "promoted-active" }}>
        <CommandCenter />
      </HubRegistryDataProvider>,
    );

    const publication = screen.getByTestId("publication-state");
    expect(publication).toHaveTextContent("Promoted 2026 snapshot");
    expect(publication).toHaveTextContent("snap-promoted-2026-example");
    expect(publication).toHaveTextContent("This view is not the rehearsal fixture.");
    expect(publication).not.toHaveTextContent("The 2026 round is not published.");
    expect(screen.queryByText("REHEARSAL READY")).not.toBeInTheDocument();
    expect(screen.getByText("Promoted 2026 applications.")).toBeInTheDocument();
    expect(screen.queryByText("Rehearsal data only.")).not.toBeInTheDocument();
    expect(screen.getByTestId("orientation-count-basis")).toHaveTextContent(/remain historical 2012 baseline facts/i);
    expect(screen.getAllByText("1930")).toHaveLength(1);
    expect(screen.getAllByText("1409")).toHaveLength(1);
    expect(screen.getAllByText("116")).toHaveLength(1);
    expect(screen.queryByText("REVEAL DAY AT A GLANCE")).not.toBeInTheDocument();
  });
});

describe("Investigate — shared intelligence drawer", () => {
  it("opens the intelligence drawer from Compare selection cards via Investigate", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="compare" compareParams={{ type: "organizations", ids: "Atlas Digital,Northstar Group" }} />);

    await user.click(screen.getByRole("button", { name: "Investigate Atlas Digital" }));
    expect(await screen.findByText(/INTELLIGENCE DRAWER · APPLICANT/)).toBeInTheDocument();
  });

  it("opens from Compare entity provenance with entity-scoped View full", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="compare" compareParams={{ type: "organizations", ids: "Atlas Digital,Northstar Group" }} />);

    await user.click(screen.getAllByRole("button", { name: "View intelligence for Atlas Digital" })[0]);
    expect(await screen.findByText(/INTELLIGENCE DRAWER · APPLICANT/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View full" })).toHaveAttribute(
      "href",
      exploreFullHrefForInvestigation({ entityType: "organizations", entityKey: "Atlas Digital", records: [] }),
    );
  });

  it("separates approved 2012 historical aggregates from rehearsal entity browse in Round Pulse", async () => {
    const user = userEvent.setup();
    render(<CommandCenter />);

    await user.click(screen.getByRole("button", { name: "View intelligence for Applications: 1930" }));
    expect(await screen.findByText("Approved 2012 historical aggregate")).toBeInTheDocument();
    expect(screen.getByText(/Entity-level historical records not yet loaded/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View full" })).not.toBeInTheDocument();
    expect(screen.queryByText(/SUPPORTING RECORDS · 12/)).not.toBeInTheDocument();
  });

  it("keeps one orientation surface for the approved 2012 counts", async () => {
    const user = userEvent.setup();
    render(<CommandCenter />);

    expect(screen.queryByText("REVEAL DAY AT A GLANCE")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View intelligence for Application count: 1930 (2012 approved baseline)" })).not.toBeInTheDocument();
    expect(screen.getAllByText("1930")).toHaveLength(1);
    expect(screen.getAllByText("1409")).toHaveLength(1);
    expect(screen.getAllByText("116")).toHaveLength(1);
    expect(screen.getByTestId("orientation-count-basis")).toHaveTextContent(/historical 2012 baseline facts/i);
    expect(screen.getByTestId("orientation-count-basis")).toHaveTextContent(/not 2026 publication totals/i);

    await user.click(screen.getByRole("button", { name: "View intelligence for Applications: 1930" }));
    expect(await screen.findByText(/INTELLIGENCE DRAWER · METRIC/)).toBeInTheDocument();
    expect(screen.queryByText(/BLOCKED_/)).not.toBeInTheDocument();
    expect(screen.getByText(/Entity-level historical records not yet loaded/i)).toBeInTheDocument();
  });

  it("labels signal insights as calculated and dataset health as action-unavailable", async () => {
    const user = userEvent.setup();
    render(<CommandCenter />);

    await user.click(screen.getByRole("button", { name: "View intelligence for IDN interest reaches two regions and two scripts" }));
    expect(await screen.findByText("Calculated insight")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "View intelligence for Dataset state" }));
    expect(await screen.findByText(/Compare, Watch, and View full are not available/i)).toBeInTheDocument();
  });

  it("routes organization Explore drawer View full to entity browse, not application ids", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="explore" exploreParams={{ entity: "organizations" }} />);

    await user.click(screen.getAllByRole("button", { name: "View intelligence for Atlas Digital" })[0]);
    expect(screen.getByRole("link", { name: "View full" })).toHaveAttribute(
      "href",
      exploreEntityResearchHref("organizations", "Atlas Digital"),
    );
  });
});

describe("Saved navigation and one-click Watch", () => {
  it("enables Saved, Briefings, and Data Health navigation links", () => {
    render(<CommandCenter />);

    expect(screen.getByRole("link", { name: "Saved" })).toHaveAttribute("href", "/saved");
    expect(screen.getByRole("link", { name: "Briefings" })).toHaveAttribute("href", "/briefings");
    expect(screen.getByRole("link", { name: "Data Health" })).toHaveAttribute("href", "/data-health");
  });

  it("exposes Briefings and Data Health in Hub nav without relying on horizontal scroll", () => {
    render(<CommandCenter view="data-health" />);

    const briefings = screen.getByRole("link", { name: "Briefings" });
    const dataHealth = screen.getByRole("link", { name: "Data Health" });
    expect(briefings).toHaveAttribute("href", "/briefings");
    expect(dataHealth).toHaveAttribute("href", "/data-health");
    expect(dataHealth).toHaveAttribute("aria-current", "page");
  });

  it("one-click Watches an entity from Explore and reflects the same watched state from the intelligence drawer", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="explore" exploreParams={{ entity: "organizations" }} />);

    await user.click(screen.getAllByRole("button", { name: "Watch Atlas Digital" })[0]);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Watching Atlas Digital" }).length).toBeGreaterThan(0));

    await user.click(screen.getAllByRole("button", { name: "View intelligence for Atlas Digital" })[0]);
    expect(await screen.findByRole("button", { name: "Watching" })).toBeInTheDocument();
  });

  it("does not persist a watch action for non-entity metric or signal cards", async () => {
    const user = userEvent.setup();
    render(<CommandCenter />);

    await user.click(screen.getByRole("button", { name: "View intelligence for Applications: 1930" }));
    await user.click(screen.getByRole("button", { name: "Watch" }));
    expect(screen.getByRole("button", { name: "Watching" })).toBeInTheDocument();

    expect(window.localStorage.getItem("registry-hub:watchlists:v1")).toBeNull();
  });
});
