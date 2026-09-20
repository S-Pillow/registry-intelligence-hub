"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Copy,
  Database,
  Eye,
  FolderOpen,
  GitCompareArrows,
  History,
  Pencil,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  COMPARE_TIME_BASIS,
  computeWatchlistIntelligence,
  listEntityOptions,
  recordsForEntity,
  recordsForParams,
  savedResearchBriefingEligible,
  savedResearchComparePromotion,
  type EntityType,
} from "@/lib/registry-data";
import { summarizeChangeSinceVisit, type ChangeSinceVisitSummary } from "@/lib/saved-change-summary";
import type { SavedResearch, Watchlist, WatchlistItem } from "@/lib/saved-storage";
import { useInvestigation } from "@/components/registry/investigation-context";
import { useHubRegistryDocument } from "@/components/registry/hub-registry-data-provider";
import { BriefThisButton } from "@/components/registry/briefing-content";

type ViewState = "ready" | "loading" | "empty" | "error";

export type SavedParams = {
  tab?: string;
  open?: string;
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });

function formatDateTime(iso: string) {
  return `${dateTimeFormatter.format(new Date(iso))} UTC`;
}

function buildExploreHrefForEntity(entityType: EntityType, entityKey: string) {
  const params = new URLSearchParams({ entity: entityType });
  if (entityType === "applications") params.set("ids", entityKey);
  else if (entityType === "categories") params.set("category", entityKey);
  else params.set("q", entityKey);
  return `/tools/registry-intelligence-hub/explore?${params.toString()}`;
}

function buildCompareHref(entityType: EntityType, keys: string[], origin: string) {
  const params = new URLSearchParams({ type: entityType, ids: keys.join(","), origin });
  return `/tools/registry-intelligence-hub/compare?${params.toString()}`;
}

function recordedCountForWatchlist(items: WatchlistItem[]) {
  return items.reduce((sum, item) => sum + item.recordCountAtAdd, 0);
}

function currentCountForWatchlist(items: WatchlistItem[], applications: ReturnType<typeof useHubRegistryDocument>["applications"]) {
  return items.reduce((sum, item) => sum + recordsForEntity(item.entityType, item.entityKey, applications).length, 0);
}

function currentCountForSavedResearch(entry: SavedResearch, applications: ReturnType<typeof useHubRegistryDocument>["applications"]) {
  return recordsForParams(entry.kind, entry.params, applications).length;
}

function openHrefForSavedResearch(entry: SavedResearch) {
  const base = entry.kind === "explore-view" ? "/tools/registry-intelligence-hub/explore" : "/tools/registry-intelligence-hub/compare";
  const search = new URLSearchParams(entry.params).toString();
  return search ? `${base}?${search}` : base;
}

function RenameControl({ name, entityLabel, onRename }: { name: string; entityLabel: string; onRename: (next: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  if (editing) {
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onRename(value);
          setEditing(false);
        }}
      >
        <label className="sr-only" htmlFor={`rename-${entityLabel}`}>New name</label>
        <input id={`rename-${entityLabel}`} autoFocus value={value} onChange={(event) => setValue(event.target.value)} aria-label={`New name for ${name}`} className="h-8 w-40 rounded-lg border border-slate-400 px-2 text-sm outline-none focus:ring-2 focus:ring-[#007d65]" />
        <Button type="submit" size="sm" className="bg-[#007d65] hover:bg-[#006a56]">Save</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => { setValue(name); setEditing(false); }}>Cancel</Button>
      </form>
    );
  }

  return (
    <Button size="sm" variant="ghost" onClick={() => { setValue(name); setEditing(true); }} aria-label={`Rename ${name}`}>
      <Pencil />Rename
    </Button>
  );
}

function DeleteControl({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1">
        <span className="text-xs font-semibold text-red-800">Delete “{name}”?</span>
        <Button size="sm" variant="destructive" onClick={onConfirm}>Confirm delete</Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
      </span>
    );
  }

  return (
    <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} aria-label={`Delete ${name}`}>
      <Trash2 />Delete
    </Button>
  );
}

/**
 * The card's central state: `Last material change` is always shown first and
 * most prominently, backed by the fixture's own `changedAt` — the single
 * honest source of "change" this prototype can attest to. `review` is an
 * optional, bounded (fixed-size, no pagination) disclosure that only renders
 * a toggle when there is a material change to look at.
 */
function MaterialChangeStatus({ change, review }: { change: ChangeSinceVisitSummary; review?: ReactNode }) {
  const [reviewing, setReviewing] = useState(false);

  return (
    <div className={`rounded-lg border px-3 py-2.5 text-xs ${change.hasChanged ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
      <p className={`flex flex-wrap items-center gap-2 font-bold ${change.hasChanged ? "text-amber-900" : "text-slate-800"}`}>
        <History className="size-3.5 shrink-0" />
        <span>Last material change: {formatDateTime(change.lastMaterialChangeAt)}</span>
        {change.hasChanged && <Badge variant="outline" className="border-amber-400 bg-white text-amber-900">New since last visit</Badge>}
      </p>
      <p className={`mt-1 ${change.hasChanged ? "text-amber-900" : "text-slate-700"}`}>{change.headline}. {change.detail}</p>
      {change.hasChanged && review && (
        <>
          <button
            type="button"
            onClick={() => setReviewing((value) => !value)}
            aria-expanded={reviewing}
            className="mt-2 font-bold text-amber-900 underline underline-offset-2 hover:text-amber-950"
          >
            {reviewing ? "Hide review" : "Review changes"}
          </button>
          {reviewing && <div className="mt-2 space-y-1.5 rounded-lg border border-amber-200 bg-white p-2.5 text-slate-800">{review}</div>}
        </>
      )}
    </div>
  );
}

function WatchlistReviewPanel({ list, change }: { list: Watchlist; change: ChangeSinceVisitSummary }) {
  const changedItems = useMemo(
    () =>
      list.items
        .map((item) => ({ item, current: recordsForEntity(item.entityType, item.entityKey).length }))
        .filter(({ item, current }) => current !== item.recordCountAtAdd),
    [list.items]
  );

  return (
    <>
      {change.hasFixtureUpdate && (
        <p>Fixture snapshot updated {formatDateTime(change.lastMaterialChangeAt)} — after your last visit on {formatDateTime(list.lastOpenedAt)}.</p>
      )}
      {list.items.length === 0 ? (
        <p className="text-slate-600">No entities in this watchlist yet — nothing to review.</p>
      ) : changedItems.length > 0 ? (
        <ul className="list-disc space-y-1 pl-4">
          {changedItems.map(({ item, current }) => (
            <li key={`${item.entityType}-${item.entityKey}`}>{item.label}: {item.recordCountAtAdd} → {current} supporting records</li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-600">No individual entity’s supporting-record count has moved since it was added — this review reflects only the fixture’s own update timestamp above.</p>
      )}
      <p className="text-slate-500">Bounded to the {list.items.length} entit{list.items.length === 1 ? "y" : "ies"} currently in this watchlist. Compares recorded fixture state only — not live monitoring.</p>
    </>
  );
}

/**
 * Watchlists v1 — frozen after Steven's Saved feedback pass (count semantics
 * fixed so supporting-record sums can never read as an entity count,
 * accessible Expand/Collapse chevron semantics, explicit Quick Watchlist
 * default communication, entity-level "Investigate" language, `Last
 * material change` as the central card state with a bounded Review changes
 * flow, and deterministic watchlist-level intelligence). No further v1 UX
 * changes are planned; management controls remain limited to
 * Duplicate/Rename/Delete.
 */
function WatchlistCard({ list, expanded, onToggleExpand }: { list: Watchlist; expanded: boolean; onToggleExpand: () => void }) {
  const { savedWork, investigate } = useInvestigation();
  const registryFixture = useHubRegistryDocument();
  const applications = registryFixture.applications;
  const [addType, setAddType] = useState<EntityType>("organizations");
  const [addKey, setAddKey] = useState("");

  const change = useMemo(() => summarizeChangeSinceVisit({
    lastOpenedAt: list.lastOpenedAt,
    recordedCount: recordedCountForWatchlist(list.items),
    currentCount: currentCountForWatchlist(list.items, applications),
    fixtureChangedAt: savedWork.fixtureChangedAt,
    subject: "supporting-record",
  }), [list, savedWork.fixtureChangedAt, applications]);

  const intelligence = useMemo(() => computeWatchlistIntelligence(list.items, applications), [list.items, applications]);

  const addOptions = useMemo(
    () => listEntityOptions(addType, applications).filter((option) => !list.items.some((item) => item.entityType === addType && item.entityKey === option.key)),
    [addType, list.items, applications],
  );

  const groupedByType = useMemo(() => {
    const groups = new Map<EntityType, string[]>();
    list.items.forEach((item) => groups.set(item.entityType, [...(groups.get(item.entityType) ?? []), item.entityKey]));
    return [...groups.entries()].filter(([, keys]) => keys.length >= 2);
  }, [list.items]);

  const panelId = `watchlist-panel-${list.id}`;

  return (
    <Card className="border-slate-300">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">{list.name}</CardTitle>
            {list.isQuickWatch && <Badge variant="outline" className="border-amber-300 text-amber-800">Quick Watchlist</Badge>}
          </div>
          {list.isQuickWatch && (
            <p className="mt-1 max-w-md text-xs text-amber-800">Automatic default for the star “Watch” action in Explore, Compare, and investigation drawers. Use “Add entity” below on another list to choose deliberately instead.</p>
          )}
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-semibold text-slate-700">
            <span>{intelligence.entities} entit{intelligence.entities === 1 ? "y" : "ies"}</span>
            <span>{intelligence.changed} changed</span>
            <span>{intelligence.contention} contested record{intelligence.contention === 1 ? "" : "s"}</span>
            <span>{intelligence.returning} returning record{intelligence.returning === 1 ? "" : "s"}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">Last opened {formatDateTime(list.lastOpenedAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => { savedWork.markWatchlistOpened(list.id); onToggleExpand(); }} aria-expanded={expanded} aria-controls={panelId}>
            {expanded ? <ChevronUp /> : <ChevronDown />}{expanded ? "Collapse" : "Expand"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => savedWork.duplicateWatchlist(list.id)}><Copy />Duplicate</Button>
          <RenameControl name={list.name} entityLabel={list.id} onRename={(next) => savedWork.renameWatchlist(list.id, next)} />
          <DeleteControl name={list.name} onConfirm={() => savedWork.deleteWatchlist(list.id)} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <MaterialChangeStatus change={change} review={<WatchlistReviewPanel list={list} change={change} />} />
        <BriefThisButton
          scope={{ kind: "watchlist", watchlistId: list.id, watchlistName: list.name }}
          label="Brief this watchlist"
          defaultName={`Briefing: ${list.name}`}
          disabled={list.items.length === 0}
          disabledTitle="Add at least one entity to this watchlist before briefing it."
          entryPath="current-view"
        />

        {expanded && (
          <div id={panelId} className="space-y-3">
            {list.items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">No entities yet. Add one below, or use the star “Watch” action from Explore, Compare, or an investigation drawer — that always adds to your Quick Watchlist by default; add straight to this list with “Add entity” instead.</p>
            ) : (
              <ul className="space-y-2">
                {list.items.map((item) => {
                  const current = recordsForEntity(item.entityType, item.entityKey).length;
                  const records = recordsForEntity(item.entityType, item.entityKey);
                  const investigationKind = item.entityType === "applications" ? "application" : item.entityType === "categories" ? "category" : "applicant";
                  return (
                    <li key={`${item.entityType}-${item.entityKey}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{item.label}</p>
                        <p className="text-xs capitalize text-slate-600">{item.entityType.slice(0, -1)} · added {formatDateTime(item.addedAt)} · {current} supporting record{current === 1 ? "" : "s"}{current !== item.recordCountAtAdd ? ` (was ${item.recordCountAtAdd})` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => investigate({
                            id: `saved-watch-${item.entityType}-${item.entityKey}`,
                            kind: investigationKind,
                            label: item.label,
                            records,
                            entityType: item.entityType,
                            entityKey: item.entityKey,
                            exploreFullHref: buildExploreHrefForEntity(item.entityType, item.entityKey),
                          })}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-[#006a56] hover:bg-emerald-50"
                        >
                          <Eye className="size-3.5" />Investigate
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${item.label} from ${list.name}`}
                          onClick={() => savedWork.removeItemFromWatchlist(list.id, item.entityType, item.entityKey)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-red-700 hover:bg-red-50"
                        >
                          <X className="size-3.5" />Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {groupedByType.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {groupedByType.map(([entityType, keys]) => (
                  <Link key={entityType} href={buildCompareHref(entityType, keys.slice(0, 4), `Watchlist: ${list.name}`)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#007d65] px-3 text-sm font-bold text-white hover:bg-[#006a56]">
                    <GitCompareArrows className="size-4" />Compare {Math.min(keys.length, 4)} {entityType}
                  </Link>
                ))}
              </div>
            )}

            <form
              className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
              onSubmit={(event) => {
                event.preventDefault();
                const option = addOptions.find((entry) => entry.key === addKey);
                if (!option) return;
                savedWork.addItemToWatchlist(list.id, { entityType: addType, entityKey: option.key, label: option.label, recordCountAtAdd: option.records.length });
                setAddKey("");
              }}
            >
              <label className="text-xs font-bold text-slate-700">Type
                <select aria-label="Entity type to add" value={addType} onChange={(event) => { setAddType(event.target.value as EntityType); setAddKey(""); }} className="mt-1 block h-9 rounded-lg border border-slate-400 bg-white px-2 text-sm">
                  <option value="organizations">Organizations</option>
                  <option value="applications">Applications</option>
                  <option value="categories">Categories</option>
                </select>
              </label>
              <label className="text-xs font-bold text-slate-700">Add entity
                <select aria-label="Add entity" value={addKey} onChange={(event) => setAddKey(event.target.value)} className="mt-1 block h-9 min-w-56 rounded-lg border border-slate-400 bg-white px-2 text-sm">
                  <option value="">Choose one…</option>
                  {addOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                </select>
              </label>
              <Button type="submit" disabled={!addKey} className="bg-[#007d65] hover:bg-[#006a56]"><Plus />Add</Button>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WatchlistsTab({ initialOpenId }: { initialOpenId?: string }) {
  const { savedWork } = useInvestigation();
  const [expandedId, setExpandedId] = useState<string | null>(initialOpenId ?? null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  if (!savedWork.hydrated) {
    return <div className="space-y-3">{Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-700">Watchlists hold <strong>entities</strong> — organizations, applications, and categories you want to keep an eye on.</p>
        {creating ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              savedWork.createWatchlist(name);
              setName("");
              setCreating(false);
            }}
          >
            <label className="sr-only" htmlFor="new-watchlist-name">Watchlist name</label>
            <input id="new-watchlist-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} aria-label="Watchlist name" placeholder="Watchlist name" className="h-9 w-52 rounded-lg border border-slate-400 px-3 text-sm outline-none focus:ring-2 focus:ring-[#007d65]" />
            <Button type="submit" className="bg-[#007d65] hover:bg-[#006a56]">Create</Button>
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
          </form>
        ) : (
          <Button className="bg-[#007d65] hover:bg-[#006a56]" onClick={() => { setName(""); setCreating(true); }}><Plus />New watchlist</Button>
        )}
      </div>

      {savedWork.watchlists.length === 0 ? (
        <Card className="border-dashed py-12 text-center">
          <CardContent>
            <Star className="mx-auto mb-4 size-9 text-slate-500" />
            <h3 className="text-lg font-bold">No watchlists yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-700">Create one above, or use the star “Watch” action on any organization, application, or category in <Link href="/tools/registry-intelligence-hub/explore" className="font-semibold text-[#006a56] underline">Explore</Link> or <Link href="/tools/registry-intelligence-hub/compare" className="font-semibold text-[#006a56] underline">Compare</Link>. That one-click action always creates and adds to a <strong>Quick Watchlist</strong> automatically — create a named list above first if you want to choose a different destination deliberately.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {savedWork.watchlists.map((list) => (
            <WatchlistCard key={list.id} list={list} expanded={expandedId === list.id} onToggleExpand={() => setExpandedId((current) => current === list.id ? null : list.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Surfaces the pinned reproducibility facts captured when a comparison was
 * saved: entity type/selection live in `entry.params` already; this adds the
 * snapshot, time basis, and dimensions-version pinning so reopening later
 * (including once a "Current" time basis ships) can disclose drift instead
 * of silently recomputing against a different fixture state. Falls back
 * gracefully for comparisons saved before this metadata existed.
 */
function compareReproducibilityLine(entry: SavedResearch, snapshotId: string): string {
  const snapshot = entry.params.snapshotId ?? snapshotId;
  const timeBasisRaw = entry.params.timeBasis ?? COMPARE_TIME_BASIS;
  const timeBasisLabel = timeBasisRaw === COMPARE_TIME_BASIS ? "Reveal Day (pinned)" : timeBasisRaw;
  const dimensions = entry.params.dimensionsVersion ?? "pre-1.1.0 (legacy)";
  const origin = entry.params.origin ?? "Origin not recorded";
  return `Snapshot ${snapshot} · Time basis: ${timeBasisLabel} · Dimensions ${dimensions} · ${origin}`;
}

function SavedResearchPromotionActions({ entry }: { entry: SavedResearch }) {
  const applications = useHubRegistryDocument().applications;
  const comparePromotion = useMemo(() => savedResearchComparePromotion(entry, applications), [entry, applications]);
  const briefingEligible = useMemo(() => savedResearchBriefingEligible(entry, applications), [entry, applications]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {comparePromotion.eligible ? (
        <Link
          href={comparePromotion.href}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-[#006a56] hover:bg-emerald-50"
        >
          <GitCompareArrows className="size-3.5" />Compare selected
        </Link>
      ) : (
        <button
          type="button"
          disabled
          title={comparePromotion.disabledReason}
          className="inline-flex h-8 cursor-not-allowed items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold text-slate-400"
        >
          <GitCompareArrows className="size-3.5" />Compare selected
        </button>
      )}
      <BriefThisButton
        scope={{ kind: "saved-research", savedResearchId: entry.id, savedResearchName: entry.name }}
        label="Create briefing"
        defaultName={`Briefing: ${entry.name}`}
        disabled={!briefingEligible.eligible}
        disabledTitle={briefingEligible.disabledReason}
        entryPath="current-view"
      />
    </div>
  );
}

/**
 * Saved Research's changing-answer model: unlike a Watchlist's fixed entity
 * set, a saved cohort/filter definition or comparison is re-evaluated
 * against the current fixture every time it's viewed, so its result count
 * and material-change status can genuinely move even though the underlying
 * definition never silently changes.
 */
function SavedResearchCard({ entry }: { entry: SavedResearch }) {
  const { savedWork } = useInvestigation();
  const registryFixture = useHubRegistryDocument();
  const applications = registryFixture.applications;
  const currentCount = useMemo(() => currentCountForSavedResearch(entry, applications), [entry, applications]);

  const change = useMemo(() => summarizeChangeSinceVisit({
    lastOpenedAt: entry.lastOpenedAt,
    recordedCount: entry.recordCountAtSave,
    currentCount,
    fixtureChangedAt: savedWork.fixtureChangedAt,
  }), [entry, currentCount, savedWork.fixtureChangedAt]);

  return (
    <Card className="border-slate-300">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">{entry.name}</CardTitle>
            <Badge variant="outline" className={entry.kind === "explore-view" ? "border-emerald-300 text-[#005c49]" : "border-sky-300 text-sky-800"}>
              {entry.kind === "explore-view" ? "Explore view" : "Compare configuration"}
            </Badge>
          </div>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Cohort / filter definition</p>
          <p className="max-w-xl text-xs text-slate-700">{entry.summary}</p>
          <p className="mt-1.5 text-xs text-slate-600">Result count: <strong className="font-bold text-slate-900">{currentCount}</strong>{currentCount !== entry.recordCountAtSave ? ` (was ${entry.recordCountAtSave} at save)` : " (unchanged since save)"}</p>
          <p className="mt-1 text-xs text-slate-500">Saved {formatDateTime(entry.createdAt)} · Last opened {formatDateTime(entry.lastOpenedAt)} · Updated {formatDateTime(entry.updatedAt)}</p>
          {entry.kind === "compare-config" && <p className="mt-1 text-xs text-slate-500">{compareReproducibilityLine(entry, registryFixture.snapshotId)}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Link href={openHrefForSavedResearch(entry)} onClick={() => savedWork.markSavedResearchOpened(entry.id)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#007d65] px-2.5 text-xs font-bold text-white hover:bg-[#006a56]">
            <FolderOpen className="size-3.5" />Open research
          </Link>
          <Button size="sm" variant="ghost" onClick={() => savedWork.duplicateSavedResearch(entry.id)}><Copy />Duplicate</Button>
          <RenameControl name={entry.name} entityLabel={entry.id} onRename={(next) => savedWork.renameSavedResearch(entry.id, next)} />
          <DeleteControl name={entry.name} onConfirm={() => savedWork.deleteSavedResearch(entry.id)} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <MaterialChangeStatus change={change} />
        <SavedResearchPromotionActions entry={entry} />
      </CardContent>
    </Card>
  );
}

function SavedResearchTab() {
  const { savedWork } = useInvestigation();

  if (!savedWork.hydrated) {
    return <div className="space-y-3">{Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-slate-700">Saved Research holds <strong>questions, cohorts, and filter states</strong> — Explore filters/search/sort and Compare configurations you want to revisit.</p>
      {savedWork.savedResearch.length === 0 ? (
        <Card className="border-dashed py-12 text-center">
          <CardContent>
            <Database className="mx-auto mb-4 size-9 text-slate-500" />
            <h3 className="text-lg font-bold">No saved research yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-700">Compose filters in <Link href="/tools/registry-intelligence-hub/explore" className="font-semibold text-[#006a56] underline">Explore</Link> or a comparison in <Link href="/tools/registry-intelligence-hub/compare" className="font-semibold text-[#006a56] underline">Compare</Link>, then use “Save this view” or “Save this comparison.”</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">{savedWork.savedResearch.map((entry) => <SavedResearchCard key={entry.id} entry={entry} />)}</div>
      )}
    </div>
  );
}

export function SavedContent({ state, initial }: { state: ViewState; initial: SavedParams }) {
  const registryFixture = useHubRegistryDocument();
  const [tab, setTab] = useState(initial.tab === "research" ? "research" : "watchlists");

  useEffect(() => {
    const params = new URLSearchParams();
    if (tab !== "watchlists") params.set("tab", tab);
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
  }, [tab]);

  return (
    <main className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">Saved hub</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Saved Research and Watchlists</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">Watchlists track entities. Saved Research tracks questions, cohorts, and filter states. Both reopen straight into Explore or Compare.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950"><ShieldCheck className="size-4" />Rehearsal fixture · local browser storage only</div>
      </div>

      {state === "loading" ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-xl" />)}</div>
      ) : state === "error" ? (
        <Card className="border-red-200 py-14 text-center"><CardContent><CircleAlert className="mx-auto mb-4 size-9 text-red-700" /><h2 className="text-lg font-bold">Saved is temporarily unavailable</h2><p className="mt-2 text-sm text-slate-700">Locally stored watchlists and saved research were not affected.</p><Link href="/tools/registry-intelligence-hub/saved" className="mt-5 inline-flex h-9 items-center rounded-lg bg-[#007d65] px-4 text-sm font-semibold text-white">Try again</Link></CardContent></Card>
      ) : (
        <Tabs value={tab} onValueChange={(value) => setTab(typeof value === "string" ? value : "watchlists")}>
          <TabsList aria-label="Saved sections">
            <TabsTrigger value="watchlists">Watchlists</TabsTrigger>
            <TabsTrigger value="research">Saved Research</TabsTrigger>
          </TabsList>
          <TabsContent value="watchlists"><WatchlistsTab initialOpenId={initial.open} /></TabsContent>
          <TabsContent value="research"><SavedResearchTab /></TabsContent>
        </Tabs>
      )}

      <footer className="mt-8 flex flex-col gap-2 border-t py-5 text-xs font-medium text-slate-600 sm:flex-row sm:justify-between">
        <span>Fixture snapshot {registryFixture.snapshotId} · fixture last changed {formatDateTime(registryFixture.changedAt)}</span>
        <span>Storage: browser-local fixture prototype · not yet identity-backed</span>
      </footer>
    </main>
  );
}
