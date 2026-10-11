// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ChangesContent, CommandCenterRecentChangesCard } from "@/components/registry/changes-content";
import { makeRepresentativeFeed } from "@/change-intel/fixtures";
import { CommandCenter } from "@/components/registry/command-center";

afterEach(() => cleanup());

describe("Changes surface", () => {
  it("renders not-initialized state safely", () => {
    render(<ChangesContent feed={{ initialized: false }} />);
    expect(screen.getByTestId("changes-not-initialized")).toHaveTextContent(
      /has not been initialized/i,
    );
  });

  it("renders representative feed with impact priority and filters", async () => {
    const user = userEvent.setup();
    const { feed } = makeRepresentativeFeed();
    render(<ChangesContent feed={feed} fixtureMode />);
    expect(screen.getByRole("heading", { name: /What changed in the 2026 round/i })).toBeInTheDocument();
    expect(screen.getByTestId("changes-last-checked")).toBeInTheDocument();
    const entries = screen.getAllByTestId(/change-entry-/);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]).toHaveAttribute("data-impact", "GODADDY_DIRECT");
    await user.selectOptions(screen.getByTestId("changes-filter-impact"), "RSP_RESEARCH_RELEVANT");
    const filtered = screen.getAllByTestId(/change-entry-/);
    expect(filtered.every((el) => el.getAttribute("data-impact") === "RSP_RESEARCH_RELEVANT")).toBe(true);
    expect(screen.queryByText(/available customer/i)).not.toBeInTheDocument();
  });

  it("shows healthy zero-change state with prior history", () => {
    const { zeroChangeFeed } = makeRepresentativeFeed();
    render(<ChangesContent feed={zeroChangeFeed} />);
    expect(screen.getByTestId("changes-zero-state")).toHaveTextContent(
      /No public Application or official contention changes were detected/i,
    );
    expect(screen.getByText(/Recent meaningful changes/i)).toBeInTheDocument();
  });

  it("Command Center recent-changes card links to /changes", () => {
    const { feed } = makeRepresentativeFeed();
    render(<CommandCenterRecentChangesCard feed={feed} />);
    expect(screen.getByTestId("cc-view-changes-cta")).toHaveAttribute("href", "/changes");
  });

  it("primary nav includes Changes and excludes Compare/Saved/Briefings/Data Health", () => {
    render(<CommandCenter presentation="rehearsal" changeFeed={{ initialized: false }} />);
    const nav = screen.getByTestId("hub-primary-nav");
    expect(within(nav).getByRole("link", { name: "Changes" })).toHaveAttribute(
      "href",
      "/changes?presentation=rehearsal",
    );
    expect(within(nav).getByRole("link", { name: "Command Center" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Explore" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Competitive Landscape" })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Compare" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Saved" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Briefings" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Data Health" })).not.toBeInTheDocument();
  });
});
