"use client";

import { useCallback, useEffect, useState } from "react";
import { useHubClaimActualityState } from "@/components/registry/hub-claim-actuality-provider";
import { useHubRegistryData } from "@/components/registry/hub-registry-data-provider";
import { rehearsalRegistryApplicationsDocument } from "@/lib/registry-application-payload-shared";
import { type EntityType, type Lens } from "@/lib/registry-data";
import {
  currentScopeRecordCount,
  defaultDetailLevelForAudience,
  defaultEmphasisForAudience,
  generateEditionContent,
  type AudienceId,
  type BriefingClaim,
  type BriefingDefinition,
  type BriefingEdition,
  type BriefingScope,
  type BriefingSectionId,
  type DetailLevel,
  type EntryPath,
  type GenerationContext,
} from "@/lib/briefing-data";
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
  const claimActualityState = useHubClaimActualityState();
  // Promoted ActiveV2 leaves resolution.document null; fall back so historical Explore
  // can mount the V1 shell without throwing (briefings remain disabled on 2012).
  const registryDocument =
    useHubRegistryData().document ?? rehearsalRegistryApplicationsDocument();
  const [storage] = useState<SavedWorkStorage>(() => createSavedWorkStorage());
  const [hydrated, setHydrated] = useState(false);
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [savedResearch, setSavedResearch] = useState<SavedResearch[]>([]);
  const [briefingDefinitions, setBriefingDefinitions] = useState<BriefingDefinition[]>([]);
  const [briefingEditions, setBriefingEditions] = useState<BriefingEdition[]>([]);

  useEffect(() => {
    // One-time hydration from browser-only storage after mount: browser storage
    // is unavailable during SSR, so state starts empty and is filled in here
    // rather than read directly during render.
    /* eslint-disable react-hooks/set-state-in-effect */
    setWatchlists(storage.loadWatchlists());
    setSavedResearch(storage.loadSavedResearch());
    setBriefingDefinitions(storage.loadBriefingDefinitions());
    setBriefingEditions(storage.loadBriefingEditions());
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

  /**
   * Builds the live watchlist/saved-research data a `watchlist`/`saved-research`
   * scoped Briefing needs to (re)generate, from this hook's own already-loaded
   * state — so the generator never has to reach into storage a second time.
   * Defensive: a since-deleted source resolves to an empty context rather
   * than throwing (briefings-design.md §10's drift-disclosure discipline).
   */
  const scopeGenerationContext = useCallback((scope: BriefingScope): GenerationContext => {
    if (scope.kind === "watchlist") {
      const list = watchlists.find((entry) => entry.id === scope.watchlistId);
      return {
        registryDocument,
        watchlist: { items: list ? list.items.map((item) => ({ entityType: item.entityType, entityKey: item.entityKey, label: item.label, recordCountAtAdd: item.recordCountAtAdd })) : [] },
      };
    }
    if (scope.kind === "saved-research") {
      const entry = savedResearch.find((research) => research.id === scope.savedResearchId);
      return {
        registryDocument,
        savedResearch: entry ? { kind: entry.kind, summary: entry.summary, recordCountAtSave: entry.recordCountAtSave, params: entry.params } : undefined,
      };
    }
    return { registryDocument };
  }, [watchlists, savedResearch, registryDocument]);

  const currentBriefingScopeCount = useCallback((scope: BriefingScope) => currentScopeRecordCount(scope, scopeGenerationContext(scope)), [scopeGenerationContext]);

  /**
   * Creates a Briefing Definition and its first Draft Edition together —
   * the only way a Definition is ever created (briefings-design.md §2). The
   * Definition's recipe fields (scope, audience, detail level, sections
   * wanted) are fixed here and never mutated afterward; only `name` and
   * `lastOpenedAt` change post-creation.
   */
  const createBriefing = useCallback((input: { name: string; entryPath: EntryPath; audience: AudienceId; emphasis?: Lens; detailLevel?: DetailLevel; sectionsWanted: BriefingSectionId[]; scope: BriefingScope }) => {
    const now = new Date().toISOString();
    const emphasis = input.emphasis ?? defaultEmphasisForAudience(input.audience);
    const detailLevel = input.detailLevel ?? defaultDetailLevelForAudience(input.audience);
    const generated = generateEditionContent({
      scope: input.scope,
      emphasis,
      detailLevel,
      sectionsWanted: input.sectionsWanted,
      context: scopeGenerationContext(input.scope),
      claimActualityState,
      registryDocument,
    });
    const definitionId = generateSavedId("briefing");
    const editionId = generateSavedId("edition");
    const definition: BriefingDefinition = {
      id: definitionId,
      name: input.name.trim() || "Untitled briefing",
      entryPath: input.entryPath,
      audience: input.audience,
      emphasis,
      detailLevel,
      sectionsWanted: input.sectionsWanted,
      scope: input.scope,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      currentEditionId: editionId,
    };
    const edition: BriefingEdition = { id: editionId, definitionId, status: "draft", ...generated };
    setBriefingDefinitions((current) => {
      const next = [...current, definition];
      storage.persistBriefingDefinitions(next);
      return next;
    });
    setBriefingEditions((current) => {
      const next = [...current, edition];
      storage.persistBriefingEditions(next);
      return next;
    });
    return { definition, edition };
  }, [storage, scopeGenerationContext, claimActualityState, registryDocument]);

  const renameBriefing = useCallback((id: string, name: string) => {
    setBriefingDefinitions((current) => {
      const next = current.map((definition) => definition.id === id ? { ...definition, name: name.trim() || definition.name, updatedAt: new Date().toISOString() } : definition);
      storage.persistBriefingDefinitions(next);
      return next;
    });
  }, [storage]);

  const deleteBriefing = useCallback((id: string) => {
    setBriefingDefinitions((current) => {
      const next = current.filter((definition) => definition.id !== id);
      storage.persistBriefingDefinitions(next);
      return next;
    });
    setBriefingEditions((current) => {
      const next = current.filter((edition) => edition.definitionId !== id);
      storage.persistBriefingEditions(next);
      return next;
    });
  }, [storage]);

  const markBriefingOpened = useCallback((id: string) => {
    setBriefingDefinitions((current) => {
      const next = current.map((definition) => definition.id === id ? { ...definition, lastOpenedAt: new Date().toISOString() } : definition);
      storage.persistBriefingDefinitions(next);
      return next;
    });
  }, [storage]);

  /** New Definition, new first Edition — never a copy of another Definition's edition history (briefings-design.md §10). */
  const duplicateBriefing = useCallback((id: string) => {
    const source = briefingDefinitions.find((definition) => definition.id === id);
    if (!source) return undefined;
    return createBriefing({ name: `${source.name} (copy)`, entryPath: source.entryPath, audience: source.audience, emphasis: source.emphasis, detailLevel: source.detailLevel, sectionsWanted: source.sectionsWanted, scope: source.scope });
  }, [briefingDefinitions, createBriefing]);

  /**
   * "Update to current" always creates a new Edition and marks the prior
   * current Edition `superseded` — it never mutates an existing Edition's
   * stored content (briefings-design.md §10). The Definition's scope,
   * audience, emphasis, detail level, and wanted sections are unchanged.
   */
  const updateBriefingToCurrent = useCallback((definitionId: string) => {
    const definition = briefingDefinitions.find((entry) => entry.id === definitionId);
    if (!definition) return;
    const generated = generateEditionContent({
      scope: definition.scope,
      emphasis: definition.emphasis,
      detailLevel: definition.detailLevel,
      sectionsWanted: definition.sectionsWanted,
      context: scopeGenerationContext(definition.scope),
      claimActualityState,
      registryDocument,
    });
    const newEditionId = generateSavedId("edition");
    const now = new Date().toISOString();

    setBriefingEditions((current) => {
      const next = current.map((edition) => edition.id === definition.currentEditionId
        ? { ...edition, status: "superseded" as const, supersededAt: now, supersededByEditionId: newEditionId }
        : edition);
      const withNew = [...next, { id: newEditionId, definitionId, status: "draft" as const, ...generated }];
      storage.persistBriefingEditions(withNew);
      return withNew;
    });
    setBriefingDefinitions((current) => {
      const next = current.map((entry) => entry.id === definitionId ? { ...entry, currentEditionId: newEditionId, updatedAt: now } : entry);
      storage.persistBriefingDefinitions(next);
      return next;
    });
  }, [briefingDefinitions, storage, scopeGenerationContext, claimActualityState, registryDocument]);

  /**
   * Adjusts a Definition's default detail level for its *next* regeneration
   * ("Update to current") — it does not retroactively re-cap an
   * already-generated Draft's claims, since a Draft's claim set is itself
   * part of what "immutable Edition" means once frozen at generation time.
   */
  const setBriefingDetailLevel = useCallback((definitionId: string, detailLevel: DetailLevel) => {
    setBriefingDefinitions((current) => {
      const next = current.map((definition) => definition.id === definitionId ? { ...definition, detailLevel, updatedAt: new Date().toISOString() } : definition);
      storage.persistBriefingDefinitions(next);
      return next;
    });
  }, [storage]);

  /** Locks an Edition against further edits — the operational meaning of "immutable Edition" (briefings-design.md §10). No-op on a non-draft Edition. */
  const finalizeBriefingEdition = useCallback((editionId: string) => {
    setBriefingEditions((current) => {
      const next = current.map((edition) => edition.id === editionId && edition.status === "draft" ? { ...edition, status: "finalized" as const, finalizedAt: new Date().toISOString() } : edition);
      storage.persistBriefingEditions(next);
      return next;
    });
  }, [storage]);

  /**
   * Structurally enforced editability (briefings-design.md §8): only
   * `text`/`editedByUser` ever change here — `evidence`/`limitationRefs`/
   * `generatedText` are untouched by this function's signature, and a
   * non-draft Edition is a silent no-op, not merely a UI-hidden control.
   */
  const editBriefingClaimText = useCallback((editionId: string, sectionId: BriefingSectionId, claimId: string, text: string) => {
    if (sectionId === "limitations") return;
    setBriefingEditions((current) => {
      const next = current.map((edition) => {
        if (edition.id !== editionId || edition.status !== "draft") return edition;
        return { ...edition, sections: edition.sections.map((section) => section.id !== sectionId ? section : { ...section, claims: section.claims.map((claim) => claim.id !== claimId ? claim : { ...claim, text, editedByUser: true }) }) };
      });
      storage.persistBriefingEditions(next);
      return next;
    });
  }, [storage]);

  /** No limitation is ever removable — not by section-toggle (briefings-design.md §8) — so this is structurally a no-op for the `limitations` section, not just a UI restriction. */
  const toggleBriefingSectionIncluded = useCallback((editionId: string, sectionId: BriefingSectionId) => {
    if (sectionId === "limitations") return;
    setBriefingEditions((current) => {
      const next = current.map((edition) => {
        if (edition.id !== editionId || edition.status !== "draft") return edition;
        return { ...edition, sections: edition.sections.map((section) => section.id === sectionId ? { ...section, included: !section.included } : section) };
      });
      storage.persistBriefingEditions(next);
      return next;
    });
  }, [storage]);

  /**
   * A manually-added claim always carries `userAdded: true` and empty
   * evidence/limitationRefs — the Preview workspace renders it with the
   * distinct "Unsupported — user-added" badge regardless of `truthClass`,
   * which is otherwise not meaningful for a claim with no evidence
   * (briefings-design.md §8).
   */
  const addBriefingUserClaim = useCallback((editionId: string, sectionId: BriefingSectionId, text: string) => {
    if (sectionId === "limitations") return;
    setBriefingEditions((current) => {
      const next = current.map((edition) => {
        if (edition.id !== editionId || edition.status !== "draft" || !text.trim()) return edition;
        const newClaim: BriefingClaim = { id: generateSavedId("claim"), text: text.trim(), generatedText: text.trim(), truthClass: "authoritative-fact", evidence: [], limitationRefs: [], editedByUser: false, userAdded: true };
        return { ...edition, sections: edition.sections.map((section) => section.id === sectionId ? { ...section, claims: [...section.claims, newClaim] } : section) };
      });
      storage.persistBriefingEditions(next);
      return next;
    });
  }, [storage]);

  /** No limitation is ever removable — not by claim-deletion (briefings-design.md §8) — so this is structurally a no-op for the `limitations` section. */
  const removeBriefingClaim = useCallback((editionId: string, sectionId: BriefingSectionId, claimId: string) => {
    if (sectionId === "limitations") return;
    setBriefingEditions((current) => {
      const next = current.map((edition) => {
        if (edition.id !== editionId || edition.status !== "draft") return edition;
        return { ...edition, sections: edition.sections.map((section) => section.id === sectionId ? { ...section, claims: section.claims.filter((claim) => claim.id !== claimId) } : section) };
      });
      storage.persistBriefingEditions(next);
      return next;
    });
  }, [storage]);

  return {
    hydrated,
    backend: storage.backend,
    fixtureChangedAt: registryDocument.changedAt,
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
    briefingDefinitions,
    briefingEditions,
    currentBriefingScopeCount,
    createBriefing,
    renameBriefing,
    deleteBriefing,
    duplicateBriefing,
    markBriefingOpened,
    setBriefingDetailLevel,
    updateBriefingToCurrent,
    finalizeBriefingEdition,
    editBriefingClaimText,
    toggleBriefingSectionIncluded,
    addBriefingUserClaim,
    removeBriefingClaim,
  };
}

export type SavedWork = ReturnType<typeof useSavedWork>;
