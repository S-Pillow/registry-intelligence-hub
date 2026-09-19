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

describe("Saved hub — empty states", () => {
  it("shows guidance to Explore/Compare when there are no watchlists yet", async () => {
    render(<CommandCenter view="saved" />);

    expect(await screen.findByText("No watchlists yet")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Explore" }).length).toBeGreaterThan(0);
  });

  it("shows guidance to save research when there is none yet", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="saved" />);

    await user.click(await screen.findByRole("tab", { name: "Saved Research" }));

    expect(await screen.findByText("No saved research yet")).toBeInTheDocument();
  });
});

describe("Saved hub — Watchlist CRUD", () => {
  it("creates, renames, duplicates, and deletes a watchlist with a two-step delete confirmation", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="saved" />);

    await screen.findByText("No watchlists yet");
    await user.click(screen.getByRole("button", { name: "New watchlist" }));
    await user.type(screen.getByRole("textbox", { name: "Watchlist name" }), "Priority Applicants");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Priority Applicants")).toBeInTheDocument();
    expect(screen.queryByText("No watchlists yet")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Rename Priority Applicants" }));
    const renameInput = screen.getByRole("textbox", { name: "New name for Priority Applicants" });
    await user.clear(renameInput);
    await user.type(renameInput, "Renamed Watchlist");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Renamed Watchlist")).toBeInTheDocument();
    expect(screen.queryByText("Priority Applicants")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(await screen.findByText("Renamed Watchlist (copy)")).toBeInTheDocument();

    const copyCard = screen.getByText("Renamed Watchlist (copy)").closest(".border-slate-300") as HTMLElement;
    await user.click(within(copyCard).getByRole("button", { name: "Delete Renamed Watchlist (copy)" }));
    expect(within(copyCard).getByText(/Delete “Renamed Watchlist \(copy\)”\?/)).toBeInTheDocument();

    await user.click(within(copyCard).getByRole("button", { name: "Confirm delete" }));
    await waitFor(() => expect(screen.queryByText("Renamed Watchlist (copy)")).not.toBeInTheDocument());
    expect(screen.getByText("Renamed Watchlist")).toBeInTheDocument();
  });

  it("adds and removes entities from a watchlist and links back into Investigate via an accessible Expand/Collapse toggle", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="saved" />);

    await user.click(await screen.findByRole("button", { name: "New watchlist" }));
    await user.type(screen.getByRole("textbox", { name: "Watchlist name" }), "My List");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await screen.findByText("My List");

    const toggle = screen.getByRole("button", { name: "Expand" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(screen.getByRole("button", { name: "Collapse" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/No entities yet/)).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Add entity" }), "Atlas Digital");
    await user.click(screen.getByRole("button", { name: "Add" }));

    const itemRow = (await screen.findByText("Atlas Digital")).closest("li") as HTMLElement;
    await user.click(within(itemRow).getByRole("button", { name: "Investigate" }));
    expect(await screen.findByText(/INTELLIGENCE DRAWER · APPLICANT/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View full" })).toHaveAttribute("href", expect.stringContaining("/explore?entity=organizations"));
    await user.click(screen.getByRole("button", { name: "Close" }));

    await user.click(screen.getByRole("button", { name: "Remove Atlas Digital from My List" }));
    expect(await screen.findByText(/No entities yet/)).toBeInTheDocument();
  });

  it("shows deterministic watchlist-level intelligence and communicates the Quick Watchlist default", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="explore" exploreParams={{ entity: "organizations" }} />);

    await user.click(screen.getAllByRole("button", { name: "Watch Atlas Digital" })[0]);

    cleanup();
    render(<CommandCenter view="saved" />);

    expect(await screen.findAllByText("Quick Watchlist")).toHaveLength(2);
    expect(screen.getByText(/Automatic default for the star .Watch. action/)).toBeInTheDocument();
    expect(screen.getByText("1 entity")).toBeInTheDocument();
    expect(screen.getByText("0 changed")).toBeInTheDocument();
    expect(screen.getByText(/contested record/)).toBeInTheDocument();
    expect(screen.getByText(/returning record/)).toBeInTheDocument();
  });
});

describe("Saved hub — persistence across mounts", () => {
  it("persists a watchlist created in one mount to a freshly mounted Saved view", async () => {
    const user = userEvent.setup();
    const first = render(<CommandCenter view="saved" />);

    await user.click(await screen.findByRole("button", { name: "New watchlist" }));
    await user.type(screen.getByRole("textbox", { name: "Watchlist name" }), "Durable List");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await screen.findByText("Durable List");
    first.unmount();

    render(<CommandCenter view="saved" />);
    expect(await screen.findByText("Durable List")).toBeInTheDocument();
  });
});

describe("Saved hub — Saved Research", () => {
  it("saves an Explore view, reopens it with restored filters, and supports duplicate/rename/delete", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="explore" exploreParams={{ idn: "idn" }} />);

    await user.click(screen.getByRole("button", { name: "Save this view" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/Saved “/)).toBeInTheDocument();
    const viewInSaved = screen.getByRole("link", { name: "View in Saved" });
    expect(viewInSaved).toHaveAttribute("href", "/tools/registry-intelligence-hub/saved?tab=research");
  });

  it("manages a saved Compare configuration end-to-end from the Saved hub", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="compare" compareParams={{ type: "organizations", ids: "Atlas Digital,Northstar Group" }} />);

    await user.click(screen.getByRole("button", { name: "Save this comparison" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText(/Saved “/);

    cleanup();
    const user2 = userEvent.setup();
    render(<CommandCenter view="saved" savedParams={{ tab: "research" }} />);

    expect(await screen.findByText("Compare configuration")).toBeInTheDocument();
    expect(screen.getByText(/Compare 2 organizations: Atlas Digital, Northstar Group/)).toBeInTheDocument();

    const reopenLink = screen.getByRole("link", { name: "Open research" });
    expect(reopenLink).toHaveAttribute("href", expect.stringContaining("/compare?type=organizations&ids=Atlas"));

    await user2.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(await screen.findAllByText(/\(copy\)$/)).toHaveLength(1);

    const originalCard = screen.getByText("Compare: Atlas Digital, Northstar Group").closest(".border-slate-300") as HTMLElement;
    await user2.click(within(originalCard).getByRole("button", { name: /^Rename/ }));
    const renameField = screen.getByLabelText(/New name for/);
    await user2.clear(renameField);
    await user2.type(renameField, "Renamed comparison");
    await user2.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Renamed comparison")).toBeInTheDocument();

    const copyHeading = screen.getByText(/\(copy\)$/).closest(".border-slate-300") as HTMLElement;
    await user2.click(within(copyHeading).getByRole("button", { name: /^Delete/ }));
    await user2.click(within(copyHeading).getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(screen.queryByText(/\(copy\)$/)).not.toBeInTheDocument());
    expect(screen.getByText("Renamed comparison")).toBeInTheDocument();
  });

  it("persists entity type, selection, snapshot, time basis, dimensions version, and originating context for a saved comparison", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="compare" compareParams={{ type: "organizations", ids: "Atlas Digital,Northstar Group", origin: "Watchlist: Quick Watchlist" }} />);

    await user.click(screen.getByRole("button", { name: "Save this comparison" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText(/Saved “/);

    cleanup();
    render(<CommandCenter view="saved" savedParams={{ tab: "research" }} />);

    expect(await screen.findByText("Compare configuration")).toBeInTheDocument();
    expect(screen.getByText(/Snapshot snap-rehearsal-2026-09-16/)).toBeInTheDocument();
    expect(screen.getByText(/Time basis: Reveal Day \(pinned\)/)).toBeInTheDocument();
    expect(screen.getByText(/Dimensions compare-dimensions\/1\.1\.0/)).toBeInTheDocument();
    expect(screen.getByText(/Watchlist: Quick Watchlist/)).toBeInTheDocument();
  });

  it("falls back gracefully to the current fixture snapshot and a legacy dimensions label for a comparison saved before this metadata existed", async () => {
    const now = new Date().toISOString();
    window.localStorage.setItem(
      "registry-hub:saved-research:v1",
      JSON.stringify([
        {
          id: "legacy-compare-1",
          name: "Pre-metadata comparison",
          kind: "compare-config",
          summary: "Compare 2 organizations: Atlas Digital, Northstar Group",
          createdAt: now,
          updatedAt: now,
          lastOpenedAt: now,
          // Intentionally omits snapshotId, timeBasis, dimensionsVersion, and origin —
          // the shape saved before this metadata was introduced.
          params: { type: "organizations", ids: "Atlas Digital,Northstar Group" },
          recordCountAtSave: 4,
        },
      ]),
    );

    render(<CommandCenter view="saved" savedParams={{ tab: "research" }} />);

    expect(await screen.findByText("Pre-metadata comparison")).toBeInTheDocument();
    expect(screen.getByText(/Snapshot snap-rehearsal-2026-09-16/)).toBeInTheDocument();
    expect(screen.getByText(/Time basis: Reveal Day \(pinned\)/)).toBeInTheDocument();
    expect(screen.getByText(/Dimensions pre-1\.1\.0 \(legacy\)/)).toBeInTheDocument();
    expect(screen.getByText(/Origin not recorded/)).toBeInTheDocument();
  });
});

describe("Saved hub — changes since last visit", () => {
  it("discloses that the comparison is against the recorded fixture snapshot, not live monitoring", async () => {
    const user = userEvent.setup();
    render(<CommandCenter view="saved" />);

    await user.click(await screen.findByRole("button", { name: "New watchlist" }));
    await user.type(screen.getByRole("textbox", { name: "Watchlist name" }), "Tracked");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText(/No material change since your last visit/)).toBeInTheDocument();
    expect(screen.getByText(/Fixture snapshot unchanged since your last visit/)).toBeInTheDocument();
  });

  it("makes Last material change the central watchlist card state, phrases counts as supporting records (never an entity count), and exposes a bounded Review changes flow", async () => {
    window.localStorage.setItem(
      "registry-hub:watchlists:v1",
      JSON.stringify([
        {
          id: "watchlist-material-change",
          name: "Pre-update visit",
          isQuickWatch: false,
          createdAt: "2026-09-01T00:00:00Z",
          // Last opened before the fixture's changedAt (2026-09-16T14:07:32Z) so a material change is pending.
          updatedAt: "2026-09-01T00:00:00Z",
          lastOpenedAt: "2026-09-01T00:00:00Z",
          items: [
            // Deliberately implausible recorded counts guarantee a real supporting-record
            // drift regardless of the fixture's actual per-entity record counts.
            { entityType: "organizations", entityKey: "Atlas Digital", label: "Atlas Digital", addedAt: "2026-09-01T00:00:00Z", recordCountAtAdd: 999 },
            { entityType: "organizations", entityKey: "Northstar Group", label: "Northstar Group", addedAt: "2026-09-01T00:00:00Z", recordCountAtAdd: 999 },
          ],
        },
      ]),
    );

    const user = userEvent.setup();
    render(<CommandCenter view="saved" />);

    expect(await screen.findByText(/Last material change: Sep 16, 2026/)).toBeInTheDocument();
    expect(screen.getByText("New since last visit")).toBeInTheDocument();
    expect(screen.getByText(/Fixture snapshot updated/)).toBeInTheDocument();
    expect(screen.getByText(/Supporting records/)).toBeInTheDocument();
    expect(screen.queryByText(/Result count/)).not.toBeInTheDocument();

    expect(screen.queryByText(/Atlas Digital: 999 →/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review changes" }));
    expect(screen.getByText(/Bounded to the 2 entities currently in this watchlist/)).toBeInTheDocument();
  });
});
