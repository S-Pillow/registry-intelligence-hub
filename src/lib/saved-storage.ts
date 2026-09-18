import type { EntityType } from "@/lib/registry-data";

export type WatchlistItem = {
  entityType: EntityType;
  entityKey: string;
  label: string;
  addedAt: string;
  recordCountAtAdd: number;
};

export type Watchlist = {
  id: string;
  name: string;
  isQuickWatch: boolean;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  items: WatchlistItem[];
};

export type SavedResearchKind = "explore-view" | "compare-config";

export type SavedResearch = {
  id: string;
  name: string;
  kind: SavedResearchKind;
  summary: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  params: Record<string, string>;
  recordCountAtSave: number;
};

const WATCHLISTS_KEY = "registry-hub:watchlists:v1";
const SAVED_RESEARCH_KEY = "registry-hub:saved-research:v1";

export interface SavedWorkStorage {
  readonly backend: "local" | "memory";
  loadWatchlists(): Watchlist[];
  persistWatchlists(watchlists: Watchlist[]): void;
  loadSavedResearch(): SavedResearch[];
  persistSavedResearch(entries: SavedResearch[]): void;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

class LocalSavedWorkStorage implements SavedWorkStorage {
  readonly backend = "local" as const;

  loadWatchlists(): Watchlist[] {
    return safeParse<Watchlist[]>(window.localStorage.getItem(WATCHLISTS_KEY), []);
  }

  persistWatchlists(watchlists: Watchlist[]): void {
    window.localStorage.setItem(WATCHLISTS_KEY, JSON.stringify(watchlists));
  }

  loadSavedResearch(): SavedResearch[] {
    return safeParse<SavedResearch[]>(window.localStorage.getItem(SAVED_RESEARCH_KEY), []);
  }

  persistSavedResearch(entries: SavedResearch[]): void {
    window.localStorage.setItem(SAVED_RESEARCH_KEY, JSON.stringify(entries));
  }
}

class MemorySavedWorkStorage implements SavedWorkStorage {
  readonly backend = "memory" as const;
  private watchlists: Watchlist[] = [];
  private savedResearch: SavedResearch[] = [];

  loadWatchlists(): Watchlist[] {
    return this.watchlists;
  }

  persistWatchlists(watchlists: Watchlist[]): void {
    this.watchlists = watchlists;
  }

  loadSavedResearch(): SavedResearch[] {
    return this.savedResearch;
  }

  persistSavedResearch(entries: SavedResearch[]): void {
    this.savedResearch = entries;
  }
}

function localStorageIsUsable(): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    const probeKey = "registry-hub:storage-probe";
    window.localStorage.setItem(probeKey, "1");
    window.localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fixture/local-only persistence today. A later identity-backed implementation
 * (e.g. an API-backed `SavedWorkStorage`) can be swapped in without touching
 * any calling code, since every consumer depends only on this interface.
 */
export function createSavedWorkStorage(): SavedWorkStorage {
  return localStorageIsUsable() ? new LocalSavedWorkStorage() : new MemorySavedWorkStorage();
}

export function generateSavedId(prefix: string): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}
