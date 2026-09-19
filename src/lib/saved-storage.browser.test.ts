// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSavedWorkStorage } from "./saved-storage";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("saved work storage (browser storage available)", () => {
  it("uses the local backend and persists watchlists across instances", () => {
    const now = new Date().toISOString();
    const storage = createSavedWorkStorage();

    expect(storage.backend).toBe("local");
    storage.persistWatchlists([{ id: "w1", name: "Persisted", isQuickWatch: true, createdAt: now, updatedAt: now, lastOpenedAt: now, items: [] }]);

    const reopened = createSavedWorkStorage();
    expect(reopened.loadWatchlists()).toHaveLength(1);
    expect(reopened.loadWatchlists()[0].name).toBe("Persisted");
  });

  it("persists briefing definitions and editions across instances via the local backend", () => {
    const now = new Date().toISOString();
    const storage = createSavedWorkStorage();

    storage.persistBriefingDefinitions([{
      id: "b1", name: "Test briefing", entryPath: "guided", audience: "marketing", emphasis: "marketing", detailLevel: "standard",
      sectionsWanted: ["headline-metrics", "limitations"], scope: { kind: "round-wide" },
      createdAt: now, updatedAt: now, lastOpenedAt: now, currentEditionId: "e1",
    }]);
    storage.persistBriefingEditions([{
      id: "e1", definitionId: "b1", status: "finalized", generatedAt: now, dataAsOfTime: now, snapshotId: "snap-1", methodVersion: "v1",
      sections: [], limitations: [], recordedScopeCount: 5, finalizedAt: now,
    }]);

    const reopened = createSavedWorkStorage();
    expect(reopened.loadBriefingDefinitions()).toHaveLength(1);
    expect(reopened.loadBriefingDefinitions()[0].name).toBe("Test briefing");
    expect(reopened.loadBriefingEditions()[0].status).toBe("finalized");
  });

  it("falls back to defaults instead of throwing on corrupt stored JSON", () => {
    window.localStorage.setItem("registry-hub:watchlists:v1", "{not valid json");
    window.localStorage.setItem("registry-hub:saved-research:v1", "{also not valid");
    window.localStorage.setItem("registry-hub:briefing-definitions:v1", "{still not valid");
    window.localStorage.setItem("registry-hub:briefing-editions:v1", "{still not valid either");

    const storage = createSavedWorkStorage();

    expect(storage.loadWatchlists()).toEqual([]);
    expect(storage.loadSavedResearch()).toEqual([]);
    expect(storage.loadBriefingDefinitions()).toEqual([]);
    expect(storage.loadBriefingEditions()).toEqual([]);
  });

  it("falls back to defaults when stored JSON is not an array", () => {
    window.localStorage.setItem("registry-hub:watchlists:v1", JSON.stringify({ not: "an array" }));

    const storage = createSavedWorkStorage();

    expect(storage.loadWatchlists()).toEqual([]);
  });

  it("falls back to the in-memory backend when localStorage throws (e.g. private browsing quota)", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    const storage = createSavedWorkStorage();

    expect(storage.backend).toBe("memory");
  });
});
