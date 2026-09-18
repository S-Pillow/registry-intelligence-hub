// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { CommandCenter } from "./command-center";

afterEach(cleanup);

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

  it("builds a meaningful two-item comparison from low-friction actions", async () => {
    const user = userEvent.setup();
    render(<CommandCenter />);

    await user.click(screen.getByRole("button", { name: "View intelligence for Applications: 12" }));
    await user.click(screen.getByRole("button", { name: "+ Compare" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "View intelligence for Unique strings: 10" }));
    await user.click(screen.getByRole("button", { name: "+ Compare" }));
    await user.click(screen.getByRole("button", { name: "Close" }));

    await user.click(screen.getByRole("button", { name: "Compare 2" }));
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Supporting records")).toBeInTheDocument();
    expect(screen.getAllByText("Complete for fixture")).toHaveLength(2);
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
    await user.click(screen.getByRole("button", { name: /View intelligence for \.secure/ }));

    expect(await screen.findByText(/INTELLIGENCE DRAWER · METRIC/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Compare" })).toBeInTheDocument();
  });

  it("shows a clear empty research state", () => {
    render(<CommandCenter view="explore" exploreParams={{ q: "no-such-record" }} />);

    expect(screen.getByText("No records match this research view")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Clear filters" }).length).toBeGreaterThan(0);
  });
});
