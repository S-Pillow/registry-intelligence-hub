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

  it("falls back to defaults instead of throwing on corrupt stored JSON", () => {
    window.localStorage.setItem("registry-hub:watchlists:v1", "{not valid json");
    window.localStorage.setItem("registry-hub:saved-research:v1", "{also not valid");

    const storage = createSavedWorkStorage();

    expect(storage.loadWatchlists()).toEqual([]);
    expect(storage.loadSavedResearch()).toEqual([]);
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
