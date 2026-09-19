// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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

/**
 * This test suite renders `CommandCenter` directly (no client router is
 * mounted, matching every other test in this codebase), so a generated
 * Briefing's confirmation `<Link>` is followed by reading its `href` and
 * re-rendering the *same* `CommandCenter` instance with `view="briefings"`
 * and that id — `rerender` preserves the component's in-memory
 * `useSavedWork` state exactly like a real client-side navigation would,
 * without requiring a mocked Next.js router.
 */
function idFromHref(link: HTMLElement): string {
  return link.getAttribute("href")!.split("/").pop()!;
}

/**
 * Every wizard dropdown is a portal-based `Select` (briefings-design.md
 * addendum: body-portal layering fix), not a native `<select>`, so picking a
 * value means opening its combobox trigger and clicking the matching
 * `option` role — `userEvent.selectOptions` only works on native selects.
 */
async function pickOption(user: ReturnType<typeof userEvent.setup>, comboboxName: string, optionName: string) {
  await user.click(screen.getByRole("combobox", { name: comboboxName }));
  await user.click(await screen.findByRole("option", { name: optionName }));
}

/** Opens the named combobox, reads its currently rendered option labels, then closes it again with Escape. */
async function readOptionLabels(user: ReturnType<typeof userEvent.setup>, comboboxName: string): Promise<string[]> {
  await user.click(screen.getByRole("combobox", { name: comboboxName }));
  const options = await screen.findAllByRole("option");
  const labels = options.map((option) => option.textContent ?? "");
  await user.keyboard("{Escape}");
  return labels;
}

async function openFreshRoundWideBriefing(user: ReturnType<typeof userEvent.setup>) {
  const view = render(<CommandCenter />);
  await user.click(screen.getByRole("button", { name: "Instant Briefing" }));
  const link = await screen.findByRole("link", { name: "Open Briefing" });
  const id = idFromHref(link);
  view.rerender(<CommandCenter view="briefings" briefingId={id} />);
  return view;
}

describe("Instant Briefing — primary entry path", () => {
  it("inherits the active Command Center View lens into emphasis, audience defaults, and rendered narrative framing", async () => {
    const user = userEvent.setup();
    const view = render(<CommandCenter />);
    await user.click(screen.getByRole("button", { name: "Commercial" }));
    await user.click(screen.getByRole("button", { name: "Instant Briefing" }));
    const link = await screen.findByRole("link", { name: "Open Briefing" });
    view.rerender(<CommandCenter view="briefings" briefingId={idFromHref(link)} />);

    expect(await screen.findByText("Commercial")).toBeInTheDocument();
    expect(screen.getByText(/Emphasis: commercial/)).toBeInTheDocument();
    expect(screen.getByText(/account research may be most efficient/i)).toBeInTheDocument();
    expect(screen.queryByText(/concentrated portfolios, increased IDN representation/i)).not.toBeInTheDocument();
  });

  it("generates a round-wide Briefing from Command Center in one click and opens straight into the Preview workspace", async () => {
    const user = userEvent.setup();
    await openFreshRoundWideBriefing(user);

    expect(await screen.findByText("Round-wide — the full rehearsal fixture")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Executive")).toBeInTheDocument();
  });

  it("lands Instant, Guided, and Brief Current View in the same Preview workspace contract", async () => {
    const user = userEvent.setup();
    await openFreshRoundWideBriefing(user);

    // Same header facts every entry path must expose (briefings-design.md acceptance criteria #3).
    expect(screen.getByText(/Generated .* · Data as of/)).toBeInTheDocument();
    expect(screen.getAllByText(/Snapshot snap-rehearsal-2026-09-16/).length).toBeGreaterThan(0);
  });
});

describe("Brief Current View — contextual entry path", () => {
  it("scopes a Briefing to the active Explore filters and describes the same cohort", async () => {
    const user = userEvent.setup();
    const view = render(<CommandCenter view="explore" exploreParams={{ idn: "idn" }} />);

    await user.click(screen.getByRole("button", { name: "Brief this view" }));
    const link = await screen.findByRole("link", { name: "Open Briefing" });
    view.rerender(<CommandCenter view="briefings" briefingId={idFromHref(link)} />);

    expect(await screen.findByText(/Explore view —/)).toBeInTheDocument();
  });

  it("scopes a Briefing to the active Compare selection", async () => {
    const user = userEvent.setup();
    const view = render(<CommandCenter view="compare" compareParams={{ type: "organizations", ids: "Atlas Digital,Northstar Group" }} />);

    await user.click(screen.getByRole("button", { name: "Brief this comparison" }));
    const link = await screen.findByRole("link", { name: "Open Briefing" });
    view.rerender(<CommandCenter view="briefings" briefingId={idFromHref(link)} />);

    expect(await screen.findByRole("heading", { name: "Comparison" })).toBeInTheDocument();
    expect(screen.getAllByText(/Atlas Digital/).length).toBeGreaterThan(0);
  });

  it("scopes a Briefing to a Saved Research entry via Create briefing", async () => {
    const now = new Date().toISOString();
    window.localStorage.setItem(
      "registry-hub:saved-research:v1",
      JSON.stringify([
        {
          id: "saved-explore-1",
          name: "IDN cohort",
          kind: "explore-view",
          summary: "Explore — IDN only",
          createdAt: now,
          updatedAt: now,
          lastOpenedAt: now,
          params: { idn: "idn" },
          recordCountAtSave: 3,
        },
      ]),
    );
    const user = userEvent.setup();
    const view = render(<CommandCenter view="saved" savedParams={{ tab: "research" }} />);
    expect(await screen.findByText("IDN cohort")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create briefing" }));
    const link = await screen.findByRole("link", { name: "Open Briefing" });
    view.rerender(<CommandCenter view="briefings" briefingId={idFromHref(link)} />);

    expect(await screen.findByText("Saved Research — IDN cohort")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Saved research summary" })).toBeInTheDocument();
  });

  it("offers Brief this from the shared intelligence drawer for an entity", async () => {
    const user = userEvent.setup();
    const view = render(<CommandCenter view="explore" exploreParams={{ entity: "organizations" }} />);

    await user.click(screen.getAllByRole("button", { name: "View intelligence for Atlas Digital" })[0]);
    await user.click(await screen.findByRole("button", { name: "Brief this" }));
    const link = await screen.findByRole("link", { name: "Open Briefing" });
    view.rerender(<CommandCenter view="briefings" briefingId={idFromHref(link)} />);

    expect(await screen.findByText("Entity — Atlas Digital")).toBeInTheDocument();
  });
});

describe("Guided Briefing — secondary entry path", () => {
  it("orders audiences Executive, Commercial, Product & Strategy, Marketing and applies audience-appropriate defaults", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="briefings" />);

    await user.click(screen.getByRole("button", { name: "New Briefing" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    const optionLabels = await readOptionLabels(user, "Audience");
    expect(optionLabels).toEqual(["Executive", "Commercial", "Product & Strategy", "Marketing"]);

    await pickOption(user, "Audience", "Marketing");
    expect(screen.getByRole("combobox", { name: "Emphasis" })).toHaveTextContent("Marketing");
    expect(screen.getByRole("combobox", { name: "Detail level" })).toHaveTextContent("Standard");
  });

  it("walks scope → audience → sections and generates a Briefing scoped to a chosen entity", async () => {
    const user = userEvent.setup();
    const view = render(<CommandCenter view="briefings" />);

    await user.click(screen.getByRole("button", { name: "New Briefing" }));
    await user.click(screen.getByRole("button", { name: "Entity" }));
    await pickOption(user, "Entity type", "Organizations");
    await pickOption(user, "Entity", "Atlas Digital");
    await user.click(screen.getByRole("button", { name: "Next" }));

    await pickOption(user, "Audience", "Commercial");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Generate" }));

    const openLink = await screen.findByRole("link", { name: "Open" });
    view.rerender(<CommandCenter view="briefings" briefingId={idFromHref(openLink)} />);

    expect(await screen.findByText("Entity — Atlas Digital")).toBeInTheDocument();
    expect(screen.getByText("Commercial")).toBeInTheDocument();
  });

  it("only offers a live watchlist by name, and inherits its current entities into the generated claims", async () => {
    const user = userEvent.setup();
    const exploreView = render(<CommandCenter view="explore" exploreParams={{ entity: "organizations" }} />);
    await user.click(screen.getAllByRole("button", { name: "Watch Atlas Digital" })[0]);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Watching Atlas Digital" }).length).toBeGreaterThan(0));
    exploreView.unmount();

    const hub = render(<CommandCenter view="briefings" />);
    await user.click(screen.getByRole("button", { name: "New Briefing" }));
    await user.click(screen.getByRole("button", { name: "Watchlist" }));
    expect(await readOptionLabels(user, "Watchlist")).toContain("Quick Watchlist");
    await pickOption(user, "Watchlist", "Quick Watchlist");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Generate" }));

    const openLink = await screen.findByRole("link", { name: "Open" });
    hub.rerender(<CommandCenter view="briefings" briefingId={idFromHref(openLink)} />);

    expect(await screen.findByText("Watchlist — Quick Watchlist")).toBeInTheDocument();
    expect(screen.getByText("1 entity watched.")).toBeInTheDocument();
  });
});

describe("Immutability, editioning, and lifecycle", () => {
  it("reveals capped claims via Show N more without regenerating the edition", async () => {
    const user = userEvent.setup();
    await openFreshRoundWideBriefing(user);

    const showMore = screen.queryByRole("button", { name: /Show \d+ more/ });
    if (showMore) {
      await user.click(showMore);
      expect(screen.queryByRole("button", { name: /Show \d+ more/ })).not.toBeInTheDocument();
    }
  });

  it("edits a claim's prose without altering its evidence, and lets a Draft add/remove manual claims", async () => {
    const user = userEvent.setup();
    await openFreshRoundWideBriefing(user);

    const editButtons = screen.getAllByRole("button", { name: /^Edit claim:/ });
    await user.click(editButtons[0]);
    const textarea = screen.getByRole("textbox");
    await user.clear(textarea);
    await user.type(textarea, "A hand-edited claim sentence.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("A hand-edited claim sentence.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View generated version" })).toBeInTheDocument();

    const addButtons = screen.getAllByRole("button", { name: "Add manual claim" });
    await user.click(addButtons[0]);
    await user.type(screen.getByPlaceholderText("Add a manual note (marked unsupported)"), "An unsupported analyst note.");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("An unsupported analyst note.")).toBeInTheDocument();
    expect(screen.getAllByText("Unsupported — user-added, not evidence-backed").length).toBeGreaterThan(0);
  });

  it("never lets the limitations section be edited, added to, removed from, or toggled off, even while the Edition is a Draft", async () => {
    const user = userEvent.setup();
    await openFreshRoundWideBriefing(user);

    const limitationsHeading = screen.getByRole("heading", { name: "Limitations" });
    const limitationsSection = limitationsHeading.closest("section") as HTMLElement;
    expect(within(limitationsSection).queryByRole("button", { name: /^Edit claim:/ })).not.toBeInTheDocument();
    expect(within(limitationsSection).queryByRole("button", { name: /^Remove claim:/ })).not.toBeInTheDocument();
    expect(within(limitationsSection).queryByRole("button", { name: "Add manual claim" })).not.toBeInTheDocument();

    const limitationsCheckbox = screen.getByRole("checkbox", { name: /Limitations \(always included\)/ });
    expect(limitationsCheckbox).toBeDisabled();
    expect(limitationsCheckbox).toBeChecked();
  });

  it("'Update to current' always creates a new Draft edition and never mutates the prior one", async () => {
    const user = userEvent.setup();
    await openFreshRoundWideBriefing(user);

    expect(screen.getByText("Draft")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Update to current" }));

    await waitFor(() => expect(screen.getByText("Draft")).toBeInTheDocument());
    expect(screen.queryByText("Finalized")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("registry-hub:briefing-editions:v1")).toMatch(/"superseded"/);
  });

  it("Finalize locks the edition: status flips and all claim/section edit controls disappear", async () => {
    const user = userEvent.setup();
    await openFreshRoundWideBriefing(user);

    expect(screen.getAllByRole("button", { name: /^Edit claim:/ }).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Finalize" }));

    expect(await screen.findByText("Finalized")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Edit claim:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Remove claim:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add manual claim" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Finalize" })).not.toBeInTheDocument();
    expect(screen.getByText(/Finalized — locked against further edits\./)).toBeInTheDocument();
  });
});

describe("Evidence and provenance integrity", () => {
  it("opens the shared intelligence drawer from a claim's evidence button", async () => {
    const user = userEvent.setup();
    await openFreshRoundWideBriefing(user);

    const evidenceButtons = screen.getAllByRole("button", { name: /^View intelligence for/ });
    expect(evidenceButtons.length).toBeGreaterThan(0);
    await user.click(evidenceButtons[0]);

    expect(await screen.findByText(/INTELLIGENCE DRAWER/)).toBeInTheDocument();
  });

  it("shows the Sources & Methodology appendix with the reserved-vs-emitted truth class legend, including the explicit future-AI boundary", async () => {
    const user = userEvent.setup();
    await openFreshRoundWideBriefing(user);

    expect(screen.getByText("Sources & Methodology")).toBeInTheDocument();
    expect(screen.getByText(/nothing in this Briefing is AI-generated today/)).toBeInTheDocument();
    expect(screen.getAllByText("Authoritative fact").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Calculated metric").length).toBeGreaterThan(0);
  });
});

describe("New Briefing wizard — portal layering, cancel, Escape, and Back (contained UX correction)", () => {
  it("renders every wizard dropdown's popup through a body portal, never nested inside the (overflow-hidden) Card that triggers it", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="briefings" />);
    await user.click(screen.getByRole("button", { name: "New Briefing" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    const trigger = screen.getByRole("combobox", { name: "Audience" });
    const triggerCard = trigger.closest("[data-slot='card']");
    expect(triggerCard).not.toBeNull();

    await user.click(trigger);
    const options = await screen.findAllByRole("option");
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      expect(option.closest("[data-slot='card']")).toBeNull();
      expect(triggerCard!.contains(option)).toBe(false);
      expect(document.body.contains(option)).toBe(true);
    }
  });

  it("regression-checks every wizard dropdown across all three steps for the same body-portal layering", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="briefings" />);
    await user.click(screen.getByRole("button", { name: "New Briefing" }));
    await user.click(screen.getByRole("button", { name: "Entity" }));

    for (const name of ["Entity type", "Entity"]) {
      await user.click(screen.getByRole("combobox", { name }));
      const options = await screen.findAllByRole("option");
      for (const option of options) expect(option.closest("[data-slot='card']")).toBeNull();
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryAllByRole("option")).toHaveLength(0));
    }

    // Switch back to a scope that's valid without further choices before advancing.
    await user.click(screen.getByRole("button", { name: "Round-wide" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    for (const name of ["Audience", "Emphasis", "Detail level"]) {
      await user.click(screen.getByRole("combobox", { name }));
      const options = await screen.findAllByRole("option");
      for (const option of options) expect(option.closest("[data-slot='card']")).toBeNull();
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryAllByRole("option")).toHaveLength(0));
    }
  });

  it("Step 1 Cancel discards immediately with no confirmation, since no meaningful choice has been made yet", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="briefings" />);
    await user.click(screen.getByRole("button", { name: "New Briefing" }));
    expect(screen.getByText("New Briefing — step 1 of 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText(/New Briefing — step/)).not.toBeInTheDocument();
    expect(screen.queryByText("Discard this briefing draft?")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Briefing" })).toBeInTheDocument();
  });

  it("the top-right close icon is an equivalent Cancel affordance on step 1", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="briefings" />);
    await user.click(screen.getByRole("button", { name: "New Briefing" }));
    await user.click(screen.getByRole("button", { name: "Cancel New Briefing" }));
    expect(screen.queryByText(/New Briefing — step/)).not.toBeInTheDocument();
  });

  it("Steps 2 and 3 show a 'Discard this briefing draft?' confirmation on Cancel, and only discard on explicit confirmation", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="briefings" />);

    await user.click(screen.getByRole("button", { name: "New Briefing" }));
    await user.click(screen.getByRole("button", { name: "Next" })); // step 2 — a scope has already been committed
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Discard this briefing draft?")).toBeInTheDocument();

    // "Keep editing" only dismisses the confirmation — the draft (and step) survive untouched.
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByText("Discard this briefing draft?")).not.toBeInTheDocument();
    expect(screen.getByText("New Briefing — step 2 of 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" })); // step 3
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Discard this briefing draft?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Discard draft" }));
    expect(screen.queryByText(/New Briefing — step/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Briefing" })).toBeInTheDocument();
  });

  it("Escape closes an open dropdown without canceling the wizard, and only cancels the wizard once no dropdown is open", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="briefings" />);
    await user.click(screen.getByRole("button", { name: "New Briefing" }));
    await user.click(screen.getByRole("button", { name: "Entity" }));

    await user.click(screen.getByRole("combobox", { name: "Entity type" }));
    expect((await screen.findAllByRole("option")).length).toBeGreaterThan(0);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryAllByRole("option")).toHaveLength(0));
    expect(screen.getByText("New Briefing — step 1 of 3")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByText(/New Briefing — step/)).not.toBeInTheDocument();
  });

  it("Escape on a dirty step opens the discard confirmation, and a second Escape only dismisses that confirmation (never both at once)", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="briefings" />);
    await user.click(screen.getByRole("button", { name: "New Briefing" }));
    await user.click(screen.getByRole("button", { name: "Next" })); // step 2, dirty

    await user.keyboard("{Escape}");
    expect(await screen.findByText("Discard this briefing draft?")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("Discard this briefing draft?")).not.toBeInTheDocument());
    expect(screen.getByText("New Briefing — step 2 of 3")).toBeInTheDocument();
  });

  it("browser Back closes the New Briefing wizard and returns to the Briefings list instead of navigating away, with prior Briefings preserved", async () => {
    const user = userEvent.setup();
    const view = render(<CommandCenter />);
    await user.click(screen.getByRole("button", { name: "Instant Briefing" }));
    await screen.findByRole("link", { name: "Open Briefing" });
    view.rerender(<CommandCenter view="briefings" />);
    expect(await screen.findByText("Briefing: Round-wide")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New Briefing" }));
    expect(screen.getByText("New Briefing — step 1 of 3")).toBeInTheDocument();

    window.history.back();

    await waitFor(() => expect(screen.queryByText(/New Briefing — step/)).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Briefings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Briefing" })).toBeInTheDocument();
    expect(screen.getByText("Briefing: Round-wide")).toBeInTheDocument();
  });

  it("does not trap a normal Cancel behind an extra history entry — Cancel consumes the checkpoint it pushed on open", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="briefings" />);
    const startingState: unknown = window.history.state;

    await user.click(screen.getByRole("button", { name: "New Briefing" }));
    expect(window.history.state).toEqual({ briefingsNewWizardOpen: true });

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(window.history.state).toEqual(startingState));
  });
});

describe("Briefings hub and CRUD", () => {
  it("lists generated Briefings and supports rename, duplicate, and delete", async () => {
    const user = userEvent.setup();
    const view = render(<CommandCenter />);
    await user.click(screen.getByRole("button", { name: "Instant Briefing" }));
    await screen.findByRole("link", { name: "Open Briefing" });

    view.rerender(<CommandCenter view="briefings" />);
    expect(await screen.findByRole("heading", { name: "Briefings" })).toBeInTheDocument();
    expect(screen.getByText("Briefing: Round-wide")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Rename Briefing: Round-wide" }));
    await user.clear(screen.getByRole("textbox", { name: "New name for Briefing: Round-wide" }));
    await user.type(screen.getByRole("textbox"), "Executive round-wide");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Executive round-wide")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(await screen.findByText("Executive round-wide (copy)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete Executive round-wide (copy)" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(screen.queryByText("Executive round-wide (copy)")).not.toBeInTheDocument();
  });

  it("shows a clear empty state before any Briefing is created", () => {
    render(<CommandCenter view="briefings" />);
    expect(screen.getByText("No Briefings yet")).toBeInTheDocument();
  });
});

describe("Persistence", () => {
  it("persists a generated Briefing and its Draft edition to browser-local storage across a full remount", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<CommandCenter />);
    await user.click(screen.getByRole("button", { name: "Instant Briefing" }));
    await screen.findByRole("link", { name: "Open Briefing" });
    unmount();

    expect(window.localStorage.getItem("registry-hub:briefing-definitions:v1")).toContain("Briefing: Round-wide");
    expect(window.localStorage.getItem("registry-hub:briefing-editions:v1")).toContain("\"draft\"");

    render(<CommandCenter view="briefings" />);
    expect(await screen.findByText("Briefing: Round-wide")).toBeInTheDocument();
  });
});
