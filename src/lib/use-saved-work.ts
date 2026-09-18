"use client";

import { useCallback, useEffect, useState } from "react";
import { registryFixture, type EntityType } from "@/lib/registry-data";
import {
  createSavedWorkStorage,
  generateSavedId,
  type SavedResearch,
  type SavedResearchKind,
  type SavedWorkStorage,
  type Watchlist,
  type WatchlistItem,
} from "@/lib/saved-storage";

const QUICK_WATCHLIST_NAME = "Quick Watchlist";

export function useSavedWork() {
  const [storage] = useState<SavedWorkStorage>(() => createSavedWorkStorage());
  const [hydrated, setHydrated] = useState(false);
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [savedResearch, setSavedResearch] = useState<SavedResearch[]>([]);

  useEffect(() => {
    // One-time hydration from browser-only storage after mount: browser storage
    // is unavailable during SSR, so state starts empty and is filled in here
    // rather than read directly during render.
    /* eslint-disable react-hooks/set-state-in-effect */
    setWatchlists(storage.loadWatchlists());
    setSavedResearch(storage.loadSavedResearch());
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [storage]);

  const createWatchlist = useCallback((name: string) => {
    const now = new Date().toISOString();
    const created: Watchlist = { id: generateSavedId("watchlist"), name: name.trim() || "Untitled watchlist", isQuickWatch: false, createdAt: now, updatedAt: now, lastOpenedAt: now, items: [] };
    setWatchlists((current) => {
      const next = [...current, created];
      storage.persistWatchlists(next);
      return next;
    });
    return created;
  }, [storage]);

  const renameWatchlist = useCallback((id: string, name: string) => {
    setWatchlists((current) => {
      const next = current.map((list) => list.id === id ? { ...list, name: name.trim() || list.name, updatedAt: new Date().toISOString() } : list);
      storage.persistWatchlists(next);
      return next;
    });
  }, [storage]);

  const deleteWatchlist = useCallback((id: string) => {
    setWatchlists((current) => {
      const next = current.filter((list) => list.id !== id);
      storage.persistWatchlists(next);
      return next;
    });
  }, [storage]);

  const duplicateWatchlist = useCallback((id: string) => {
    setWatchlists((current) => {
      const source = current.find((list) => list.id === id);
      if (!source) return current;
      const now = new Date().toISOString();
      const copy: Watchlist = { ...source, id: generateSavedId("watchlist"), name: `${source.name} (copy)`, isQuickWatch: false, createdAt: now, updatedAt: now, lastOpenedAt: now, items: source.items.map((item) => ({ ...item })) };
      const next = [...current, copy];
      storage.persistWatchlists(next);
      return next;
    });
  }, [storage]);

  const markWatchlistOpened = useCallback((id: string) => {
    setWatchlists((current) => {
      const next = current.map((list) => list.id === id ? { ...list, lastOpenedAt: new Date().toISOString() } : list);
      storage.persistWatchlists(next);
      return next;
    });
  }, [storage]);

  const addItemToWatchlist = useCallback((watchlistId: string, item: Omit<WatchlistItem, "addedAt">) => {
    setWatchlists((current) => {
      const next = current.map((list) => {
        if (list.id !== watchlistId) return list;
        if (list.items.some((existing) => existing.entityType === item.entityType && existing.entityKey === item.entityKey)) return list;
        return { ...list, items: [...list.items, { ...item, addedAt: new Date().toISOString() }], updatedAt: new Date().toISOString() };
      });
      storage.persistWatchlists(next);
      return next;
    });
  }, [storage]);

  const removeItemFromWatchlist = useCallback((watchlistId: string, entityType: EntityType, entityKey: string) => {
    setWatchlists((current) => {
      const next = current.map((list) => list.id === watchlistId
        ? { ...list, items: list.items.filter((item) => !(item.entityType === entityType && item.entityKey === entityKey)), updatedAt: new Date().toISOString() }
        : list);
      storage.persistWatchlists(next);
      return next;
    });
  }, [storage]);

  const quickWatchlist = watchlists.find((list) => list.isQuickWatch);

  const isEntityWatched = useCallback((entityType: EntityType, entityKey: string) => {
    return Boolean(quickWatchlist?.items.some((item) => item.entityType === entityType && item.entityKey === entityKey));
  }, [quickWatchlist]);

  const toggleEntityWatch = useCallback((entityType: EntityType, entityKey: string, label: string, recordCountAtAdd: number) => {
    setWatchlists((current) => {
      const existingQuick = current.find((list) => list.isQuickWatch);
      const now = new Date().toISOString();

      if (!existingQuick) {
        const created: Watchlist = {
          id: generateSavedId("watchlist"),
          name: QUICK_WATCHLIST_NAME,
          isQuickWatch: true,
          createdAt: now,
          updatedAt: now,
          lastOpenedAt: now,
          items: [{ entityType, entityKey, label, addedAt: now, recordCountAtAdd }],
        };
        const next = [...current, created];
        storage.persistWatchlists(next);
        return next;
      }

      const alreadyWatched = existingQuick.items.some((item) => item.entityType === entityType && item.entityKey === entityKey);
      const next = current.map((list) => {
        if (list.id !== existingQuick.id) return list;
        const items = alreadyWatched
          ? list.items.filter((item) => !(item.entityType === entityType && item.entityKey === entityKey))
          : [...list.items, { entityType, entityKey, label, addedAt: now, recordCountAtAdd }];
        return { ...list, items, updatedAt: now };
      });
      storage.persistWatchlists(next);
      return next;
    });
  }, [storage]);

  const createSavedResearch = useCallback((input: { kind: SavedResearchKind; name: string; summary: string; params: Record<string, string>; recordCountAtSave: number }) => {
    const now = new Date().toISOString();
    const created: SavedResearch = { id: generateSavedId("saved"), kind: input.kind, name: input.name.trim() || "Untitled saved research", summary: input.summary, params: input.params, recordCountAtSave: input.recordCountAtSave, createdAt: now, updatedAt: now, lastOpenedAt: now };
    setSavedResearch((current) => {
      const next = [...current, created];
      storage.persistSavedResearch(next);
      return next;
    });
    return created;
  }, [storage]);

  const renameSavedResearch = useCallback((id: string, name: string) => {
    setSavedResearch((current) => {
      const next = current.map((entry) => entry.id === id ? { ...entry, name: name.trim() || entry.name, updatedAt: new Date().toISOString() } : entry);
      storage.persistSavedResearch(next);
      return next;
    });
  }, [storage]);

  const deleteSavedResearch = useCallback((id: string) => {
    setSavedResearch((current) => {
      const next = current.filter((entry) => entry.id !== id);
      storage.persistSavedResearch(next);
      return next;
    });
  }, [storage]);

  const duplicateSavedResearch = useCallback((id: string) => {
    setSavedResearch((current) => {
      const source = current.find((entry) => entry.id === id);
      if (!source) return current;
      const now = new Date().toISOString();
      const copy: SavedResearch = { ...source, id: generateSavedId("saved"), name: `${source.name} (copy)`, createdAt: now, updatedAt: now, lastOpenedAt: now };
      const next = [...current, copy];
      storage.persistSavedResearch(next);
      return next;
    });
  }, [storage]);

  const markSavedResearchOpened = useCallback((id: string) => {
    setSavedResearch((current) => {
      const next = current.map((entry) => entry.id === id ? { ...entry, lastOpenedAt: new Date().toISOString() } : entry);
      storage.persistSavedResearch(next);
      return next;
    });
  }, [storage]);

  return {
    hydrated,
    backend: storage.backend,
    fixtureChangedAt: registryFixture.changedAt,
    watchlists,
    savedResearch,
    quickWatchlistId: quickWatchlist?.id,
    isEntityWatched,
    toggleEntityWatch,
    createWatchlist,
    renameWatchlist,
    deleteWatchlist,
    duplicateWatchlist,
    markWatchlistOpened,
    addItemToWatchlist,
    removeItemFromWatchlist,
    createSavedResearch,
    renameSavedResearch,
    deleteSavedResearch,
    duplicateSavedResearch,
    markSavedResearchOpened,
  };
}

export type SavedWork = ReturnType<typeof useSavedWork>;
