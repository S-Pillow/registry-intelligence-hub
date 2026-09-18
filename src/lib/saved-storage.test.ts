import { describe, expect, it } from "vitest";
import { createSavedWorkStorage, generateSavedId } from "./saved-storage";

describe("saved work storage (no browser storage available)", () => {
  it("falls back to an in-memory backend when window is unavailable", () => {
    const storage = createSavedWorkStorage();

    expect(storage.backend).toBe("memory");
    expect(storage.loadWatchlists()).toEqual([]);
    expect(storage.loadSavedResearch()).toEqual([]);
  });

  it("round-trips watchlists and saved research through the in-memory backend", () => {
    const storage = createSavedWorkStorage();
    const now = new Date().toISOString();

    storage.persistWatchlists([{ id: "w1", name: "Test", isQuickWatch: false, createdAt: now, updatedAt: now, lastOpenedAt: now, items: [] }]);
    storage.persistSavedResearch([{ id: "s1", name: "Test view", kind: "explore-view", summary: "All applications", createdAt: now, updatedAt: now, lastOpenedAt: now, params: {}, recordCountAtSave: 12 }]);

    expect(storage.loadWatchlists()).toHaveLength(1);
    expect(storage.loadWatchlists()[0].name).toBe("Test");
    expect(storage.loadSavedResearch()).toHaveLength(1);
    expect(storage.loadSavedResearch()[0].name).toBe("Test view");
  });

  it("keeps independent instances isolated from each other", () => {
    const first = createSavedWorkStorage();
    const second = createSavedWorkStorage();
    const now = new Date().toISOString();

    first.persistWatchlists([{ id: "w1", name: "Only in first", isQuickWatch: false, createdAt: now, updatedAt: now, lastOpenedAt: now, items: [] }]);

    expect(second.loadWatchlists()).toEqual([]);
  });
});

describe("generateSavedId", () => {
  it("produces unique ids with the requested prefix", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateSavedId("watchlist")));

    expect(ids.size).toBe(50);
    for (const id of ids) expect(id.startsWith("watchlist-")).toBe(true);
  });
});
