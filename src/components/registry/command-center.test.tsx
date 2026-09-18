// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CommandCenter } from "./command-center";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("Command Center interactions", () => {
  it("changes the intelligence set when the View lens changes", async () => {
    const user = userEvent.setup();
    render(<CommandCenter />);

    expect(screen.getByText("IDN interest reaches two regions and two scripts")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Commercial" }));

    expect(screen.getByRole("button", { name: "Commercial" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("IDN interest reaches two regions and two scripts")).not.toBeInTheDocument();
    expect(screen.getByText("Atlas Digital holds the rehearsal fixture’s largest portfolio")).toBeInTheDocument();
    expect(screen.getByText(/Portfolio concentration and contention expose/)).toBeInTheDocument();
  });

  it("opens the intelligence drawer and separates evidence from classification", async () => {
    const user = userEvent.setup();
    render(<CommandCenter />);

    await user.click(screen.getByRole("button", { name: "View intelligence for Applications: 12" }));

    expect(await screen.findByText(/INTELLIGENCE DRAWER · METRIC/)).toBeInTheDocument();
    expect(screen.getByText("Applications: 12")).toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: "View intelligence for Atlas Digital investigation profile" }));
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
});

describe("Compare interactions", () => {
  it("renders stable organization rows with provenance and unavailable states", () => {
    render(<CommandCenter view="compare" compareParams={{ type: "organizations", ids: "Atlas Digital,Northstar Group" }} />);

    expect(screen.getByText("Stable dimension")).toBeInTheDocument();
    expect(screen.getAllByText("2026 applications").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Initial contention exposure").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Snapshot snap-rehearsal-2026-09-16/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View intelligence for Atlas Digital" })).toBeInTheDocument();
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
  });

  it("covers empty, loading, and error states", () => {
    const { rerender } = render(<CommandCenter view="compare" state="empty" />);
    expect(screen.getByText("Choose at least two organizations")).toBeInTheDocument();

    rerender(<CommandCenter view="compare" state="loading" />);
    expect(screen.getByLabelText("Loading Command Center")).toBeInTheDocument();

    rerender(<CommandCenter view="compare" state="error" />);
    expect(screen.getByText("Comparison unavailable")).toBeInTheDocument();
  });
});

describe("Saved navigation and one-click Watch", () => {
  it("enables the Saved navigation link while Briefings and Data Health remain planned", () => {
    render(<CommandCenter />);

    expect(screen.getByRole("link", { name: "Saved" })).toHaveAttribute("href", "/tools/registry-intelligence-hub/saved");
    expect(screen.getByText("Briefings").closest("button")).toBeDisabled();
    expect(screen.getByText("Data Health").closest("button")).toBeDisabled();
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

    await user.click(screen.getByRole("button", { name: "View intelligence for Applications: 12" }));
    await user.click(screen.getByRole("button", { name: "Watch" }));
    expect(screen.getByRole("button", { name: "Watching" })).toBeInTheDocument();

    expect(window.localStorage.getItem("registry-hub:watchlists:v1")).toBeNull();
  });
});
