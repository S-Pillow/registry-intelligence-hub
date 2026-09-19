"use client";

import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookmarkPlus,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Database,
  Eye,
  ExternalLink,
  FileClock,
  GitCompareArrows,
  Info,
  Layers3,
  Menu,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  applicantsToWatch,
  biggestChanges,
  categoryMix,
  cellDiffersFromBaseline,
  COMPARE_DIMENSIONS_VERSION,
  COMPARE_TIME_BASIS,
  describeCompareSelection,
  describeExploreFilters,
  filterApplicationsByExplore,
  groupCompareRowsBySection,
  listEntityOptions,
  nonDefaultExploreFilterParams,
  numericCellDelta,
  portfolioRanking,
  registryFixture,
  rowHasDifference,
  roundPulse,
  standoutInsightsForLens,
  summarizeCompareDifferences,
  type Application,
  type CompareSectionId,
  type Lens,
} from "@/lib/registry-data";
import { useSavedWork } from "@/lib/use-saved-work";
import { SavedContent, type SavedParams } from "@/components/registry/saved-content";
import { BriefingsContent, BriefThisButton } from "@/components/registry/briefing-content";

export type { SavedParams };
import {
  InvestigationContext,
  useInvestigation,
  type CompareEntityType,
  type InvestigationContextValue,
  type InvestigationItem,
  type InvestigationKind,
} from "@/components/registry/investigation-context";

type ViewState = "ready" | "loading" | "empty" | "error";
export type { CompareEntityType };

const navItems = ["Command Center", "Explore", "Compare", "Saved", "Briefings", "Data Health"];
const lensInterpretations: Record<string, string> = {
  all: "The rehearsal fixture points to concentrated portfolios, increased IDN representation, and two initial contention clusters worth coordinated review.",
  commercial: "Portfolio concentration and contention expose where account research may be most efficient; they are investigation priorities, not sales recommendations.",
  strategy: "Category movement, IDN participation, and initial contention show where round composition differs from the normalized 2012 fixture cohort.",
  marketing: "Cross-region IDN participation and multi-category organizations offer evidence-backed themes without implying market demand or future success.",
};

function ShellHeader() {
  return (
    <header className="border-b border-white/10 bg-[#101923] text-white">
      <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-mono text-sm font-semibold tracking-[0.2em]">
            FORGE<span className="text-[#72dfb4]">/</span>FORWARD
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <Link href="/" className="hover:text-white">Home</Link>
            <a href="https://forgeforward.app/tools" className="border-b border-[#72dfb4] py-5 text-white">Tools</a>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="hidden bg-white/10 text-slate-200 sm:inline-flex" variant="outline">PUBLIC FIXTURE</Badge>
          <Sheet>
            <SheetTrigger className="inline-flex size-8 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72dfb4] md:hidden" aria-label="Open navigation">
              <Menu />
            </SheetTrigger>
            <SheetContent side="right" className="w-[85%] bg-white">
              <SheetHeader className="border-b">
                <SheetTitle>ForgeForward</SheetTitle>
                <SheetDescription>Navigation and Hub sections</SheetDescription>
              </SheetHeader>
              <nav aria-label="Mobile navigation" className="space-y-1 px-4">
                <Link href="/" className="block rounded-lg px-3 py-3 text-sm font-medium hover:bg-slate-100">Home</Link>
                <a href="https://forgeforward.app/tools" className="block rounded-lg px-3 py-3 text-sm font-medium hover:bg-slate-100">Tools</a>
                <div className="my-3 border-t" />
                {navItems.map((item, index) => (
                  index < 5 ? <Link key={item} href={index === 0 ? "/tools/registry-intelligence-hub" : `/tools/registry-intelligence-hub/${item.toLowerCase()}`} className="flex items-center justify-between rounded-lg px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-[#006a56]">{item}</Link> :
                  <div key={item} className="flex items-center justify-between rounded-lg px-3 py-3 text-sm text-slate-400">{item}<Badge variant="secondary">Planned</Badge></div>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function HubNav({ active = "Command Center" }: { active?: string }) {
  return (
    <div className="border-b bg-white">
      <div className="mx-auto flex max-w-[1480px] items-center gap-1 overflow-x-auto px-4 sm:px-6">
        {navItems.map((item, index) => (
          index < 5 ? (
            <Link
              key={item}
              href={index === 0 ? "/tools/registry-intelligence-hub" : `/tools/registry-intelligence-hub/${item.toLowerCase()}`}
              className={`shrink-0 border-b-2 px-3 py-3 text-sm font-semibold ${active === item ? "border-[#007d65] text-[#006a56]" : "border-transparent text-slate-600 hover:text-slate-950"}`}
            >
              {item}
            </Link>
          ) : (
            <button key={item} className="shrink-0 cursor-not-allowed border-b-2 border-transparent px-3 py-3 text-sm font-medium text-slate-400 opacity-70" disabled title="Planned for a later slice">
              {item}<span className="ml-1 text-[10px] font-normal uppercase tracking-wide">(planned)</span>
            </button>
          )
        ))}
      </div>
    </div>
  );
}

function ProvenanceSheet({
  label,
  records,
  trigger,
  triggerClassName,
  kind = "dataset",
  id,
  entityType,
  entityKey,
}: {
  label: string;
  records?: readonly Application[];
  trigger?: ReactNode;
  triggerClassName?: string;
  kind?: InvestigationKind;
  id?: string;
  entityType?: CompareEntityType;
  entityKey?: string;
}) {
  const { investigate } = useInvestigation();
  const item = {
    id: id ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    label,
    kind,
    records: records ?? registryFixture.applications,
    entityType,
    entityKey,
  };

  return (
    <button
      type="button"
      className={triggerClassName ?? "inline-flex size-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]"}
      aria-label={`View intelligence for ${label}`}
      onClick={() => investigate(item)}
    >
      {trigger ?? <Info className="size-4" />}
    </button>
  );
}

function QuickCompareButton({ item, className = "" }: { item: InvestigationItem; className?: string }) {
  const { addCompare, compareItems } = useInvestigation();
  if (!item.entityType || !item.entityKey) return null;
  const selected = compareItems.some((entry) => entry.id === item.id);
  const incompatible = compareItems.length > 0 && compareItems[0].entityType !== item.entityType;
  return (
    <button type="button" disabled={selected || incompatible || compareItems.length >= 4} onClick={() => addCompare(item)} className={`inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-[#006a56] hover:border-[#007d65] hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} aria-label={`${selected ? "Added to compare" : incompatible ? "Incompatible comparison type" : "Add to compare"} ${item.label}`}>
      <GitCompareArrows className="size-3.5" />{selected ? "Added" : "+ Compare"}
    </button>
  );
}

function QuickWatchButton({ item, className = "" }: { item: InvestigationItem; className?: string }) {
  const { savedWork } = useInvestigation();
  const { entityType, entityKey } = item;
  if (!entityType || !entityKey) return null;
  const watching = savedWork.isEntityWatched(entityType, entityKey);
  return (
    <button
      type="button"
      onClick={() => savedWork.toggleEntityWatch(entityType, entityKey, item.label, item.records.length)}
      className={`inline-flex h-8 items-center justify-center gap-1 rounded-lg border px-2.5 text-xs font-bold hover:bg-amber-50 ${watching ? "border-amber-400 bg-amber-50 text-amber-800" : "border-slate-300 bg-white text-slate-700 hover:border-amber-400"} ${className}`}
      aria-label={`${watching ? "Watching" : "Watch"} ${item.label}`}
      title={watching ? "In your Quick Watchlist — click to remove" : "Adds to your Quick Watchlist automatically. Choose a different list from the Saved hub instead."}
    >
      <Star className={`size-3.5 ${watching ? "fill-amber-500" : ""}`} />{watching ? "Watching" : "Watch"}
    </button>
  );
}

function SaveResearchButton({
  kind,
  defaultName,
  summary,
  recordCount,
  buildParams,
  disabled,
}: {
  kind: "explore-view" | "compare-config";
  defaultName: string;
  summary: string;
  recordCount: number;
  buildParams: () => Record<string, string>;
  disabled?: boolean;
}) {
  const { savedWork } = useInvestigation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  if (confirmation) {
    return (
      <p role="status" className="flex items-center gap-2 text-xs font-semibold text-[#005c49]">
        Saved “{confirmation}” to Saved Research. <Link href="/tools/registry-intelligence-hub/saved?tab=research" className="underline">View in Saved</Link>
        <button type="button" className="text-slate-500 underline" onClick={() => setConfirmation(null)}>Dismiss</button>
      </p>
    );
  }

  if (!open) {
    return (
      <Button variant="outline" disabled={disabled} onClick={() => { setName(defaultName); setOpen(true); }}>
        <BookmarkPlus />{kind === "explore-view" ? "Save this view" : "Save this comparison"}
      </Button>
    );
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const created = savedWork.createSavedResearch({ kind, name, summary, params: buildParams(), recordCountAtSave: recordCount });
        setConfirmation(created.name);
        setOpen(false);
      }}
    >
      <label className="sr-only" htmlFor={`save-research-name-${kind}`}>Saved research name</label>
      <input
        id={`save-research-name-${kind}`}
        value={name}
        onChange={(event) => setName(event.target.value)}
        aria-label="Saved research name"
        autoFocus
        className="h-9 w-56 rounded-lg border border-slate-400 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#007d65]"
      />
      <Button type="submit" className="bg-[#007d65] hover:bg-[#006a56]">Save</Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
    </form>
  );
}

function IntelligenceDrawer({
  item,
  onClose,
}: {
  item: InvestigationItem | null;
  onClose: () => void;
}) {
  const [showFull, setShowFull] = useState(false);
  const { addCompare, toggleWatch, watchedIds, compareItems, savedWork } = useInvestigation();
  const isDerived = item?.kind === "signal";
  const canAct = item && !["coverage", "dataset"].includes(item.kind);
  const canCompare = item?.entityType && item.entityKey;
  const incompatible = canCompare && compareItems.length > 0 && compareItems[0].entityType !== item.entityType;
  const isWatching = item ? (item.entityType && item.entityKey ? savedWork.isEntityWatched(item.entityType, item.entityKey) : watchedIds.has(item.id)) : false;
  const onToggleWatch = () => {
    if (!item) return;
    if (item.entityType && item.entityKey) savedWork.toggleEntityWatch(item.entityType, item.entityKey, item.label, item.records.length);
    else toggleWatch(item);
  };
  const displayedRecords = showFull ? item?.records : item?.records.slice(0, 4);
  const fullHref = item ? `/tools/registry-intelligence-hub/explore?entity=applications&ids=${encodeURIComponent(item.records.map((record) => record.id).join(","))}` : "#";

  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => { if (!open) { setShowFull(false); onClose(); } }}>
      <SheetContent className="w-full overflow-y-auto bg-white sm:max-w-xl">
        {item && (
          <>
            <SheetHeader className="border-b border-slate-200 px-6 py-5">
              <Badge variant="outline" className="mb-2 border-emerald-300 text-[#005c49]">INTELLIGENCE DRAWER · {item.kind.toUpperCase()}</Badge>
              <SheetTitle className="pr-8 text-xl">{item.label}</SheetTitle>
              <SheetDescription className="text-slate-600">Investigate without leaving the Command Center or losing your selected View.</SheetDescription>
            </SheetHeader>
            <div className="space-y-6 px-6 pb-8">
              {canAct && (
                <div className={`grid gap-2 ${canCompare ? "grid-cols-3" : "grid-cols-2"}`}>
                  <Link href={fullHref} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-medium hover:bg-slate-100"><Eye className="size-4" />View full</Link>
                  {canCompare && <Button variant="outline" disabled={Boolean(incompatible) || compareItems.some((entry) => entry.id === item.id) || compareItems.length >= 4} onClick={() => addCompare(item)}><GitCompareArrows />+ Compare</Button>}
                  <Button variant={isWatching ? "secondary" : "outline"} onClick={onToggleWatch}><Star />{isWatching ? "Watching" : "Watch"}</Button>
                </div>
              )}

              {canCompare && item.entityKey && (
                <BriefThisButton
                  scope={{ kind: "entity", entityType: item.entityType!, entityKey: item.entityKey, label: item.label }}
                  label="Brief this"
                  defaultName={`Briefing: ${item.label}`}
                  entryPath="current-view"
                  className="w-full"
                />
              )}

              {canCompare && isWatching && (
                <p className="text-xs font-semibold text-amber-800">Added to your Quick Watchlist. <Link href="/tools/registry-intelligence-hub/saved?tab=watchlists" className="underline">View in Saved</Link></p>
              )}

              {item.kind === "coverage" && (
                <section>
                  <h3 className="mb-3 text-xs font-bold tracking-wider text-slate-600">COVERAGE EXCEPTIONS</h3>
                  <div className="space-y-3">
                    {registryFixture.sourceHealth.gaps.map((gap) => (
                      <div key={gap.source} className="rounded-xl border border-slate-300 p-4">
                        <div className="flex items-center justify-between gap-3"><strong className="text-sm">{gap.source}</strong><Badge variant={gap.status === "missing" ? "destructive" : "secondary"}>{gap.status.replaceAll("-", " ")}</Badge></div>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{gap.detail}</p>
                        <p className="mt-2 text-xs font-semibold text-slate-600">Affected: {gap.affected}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#006a56]">Evidence completeness</p>
                  <p className="mt-2 text-lg font-bold text-[#004c3d]">{item.kind === "coverage" ? `${registryFixture.sourceHealth.requiredFieldsCovered}/${registryFixture.sourceHealth.requiredFieldsTotal} fields` : `${item.records.length}/${item.records.length} records`}</p>
                  <p className="mt-1 text-xs text-slate-700">Coverage of evidence used for this view</p>
                </div>
                <div className="rounded-xl border border-slate-300 bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Classification</p>
                  <p className="mt-2 text-sm font-bold text-slate-900">{isDerived ? "Calculated insight" : "Deterministic source-backed fact"}</p>
                  <p className="mt-1 text-xs text-slate-700">{isDerived ? "Confidence: High · versioned rule" : "Confidence: not applicable to deterministic facts"}</p>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-bold tracking-wider text-slate-600">SOURCE & METHOD</h3>
                <dl className="grid grid-cols-[105px_1fr] gap-y-3 text-sm">
                  <dt className="text-slate-600">Source</dt><dd><a className="inline-flex items-center gap-1 font-semibold text-[#006a56] underline" href={registryFixture.source.url} target="_blank" rel="noreferrer">{registryFixture.source.name}<ExternalLink className="size-3" /></a></dd>
                  <dt className="text-slate-600">Snapshot</dt><dd className="break-all font-mono text-xs">{registryFixture.snapshotId}</dd>
                  <dt className="text-slate-600">Retrieved</dt><dd>{new Date(registryFixture.retrievedAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC</dd>
                  <dt className="text-slate-600">Method</dt><dd className="font-mono text-xs">{registryFixture.methodVersion}</dd>
                </dl>
              </section>

              {item.kind !== "coverage" && (
                <section>
                  <h3 className="mb-3 text-xs font-bold tracking-wider text-slate-600">SUPPORTING RECORDS · {item.records.length}</h3>
                  <div className="space-y-2">
                    {displayedRecords?.map((record) => (
                      <div key={record.id} className="rounded-lg border border-slate-300 p-3 text-sm">
                        <div className="flex items-center justify-between"><span className="font-mono font-bold">.{record.string}</span><Badge variant="secondary">{record.id}</Badge></div>
                        <p className="mt-1 text-slate-700">{record.organization} · {record.category}</p>
                      </div>
                    ))}
                  </div>
                  {!showFull && item.records.length > 4 && <Button variant="ghost" className="mt-2 text-[#006a56]" onClick={() => setShowFull(true)}>Show all {item.records.length} records</Button>}
                </section>
              )}

              <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <CircleAlert className="mt-0.5 size-4 shrink-0" /><p>{registryFixture.limitations[0]}</p>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ComparisonTray() {
  const { compareItems, removeCompare } = useInvestigation();
  if (!compareItems.length) return null;

  const entityType = compareItems[0].entityType;
  const compatible = Boolean(entityType) && compareItems.every((item) => item.entityType === entityType && item.entityKey);
  const compareHref = compatible ? `/tools/registry-intelligence-hub/compare?type=${entityType}&ids=${encodeURIComponent(compareItems.map((item) => item.entityKey).join(","))}&origin=${encodeURIComponent("Investigation tray selection")}` : "#";

  return (
    <aside aria-label="Comparison selection tray" className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-4xl rounded-2xl border border-slate-700 bg-[#101923] p-3 text-white shadow-2xl">
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-2 text-xs font-bold uppercase tracking-wider text-[#72dfb4]">Compare</span>
        {compareItems.map((item) => <span key={item.id} className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold">{item.label}<button onClick={() => removeCompare(item.id)} aria-label={`Remove ${item.label} from comparison`} className="rounded p-0.5 hover:bg-white/15"><X className="size-3.5" /></button></span>)}
        {compareItems.length < 2 && <span className="text-xs text-slate-300">Choose one more {entityType?.slice(0, -1) ?? "like entity"}</span>}
        {compareItems.length < 4 && compareItems.length >= 2 && <span className="text-xs text-slate-300">Up to 4</span>}
        {compatible && compareItems.length >= 2 ? <Link href={compareHref} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#72dfb4] px-3 text-sm font-bold text-[#0b3129] hover:bg-[#93e8c9]"><GitCompareArrows className="size-4" />Compare {compareItems.length}</Link> : <Button className="ml-auto bg-[#72dfb4] text-[#0b3129]" disabled><GitCompareArrows />Compare {compareItems.length}</Button>}
      </div>
    </aside>
  );
}

function MetricCards() {
  const recordsFor = (filter: string) => {
    if (filter === "idn") return registryFixture.applications.filter((item) => item.idn);
    if (filter === "contention") return registryFixture.applications.filter((item) => item.contentionSet);
    return registryFixture.applications;
  };

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {roundPulse.map((metric) => (
        <ProvenanceSheet
          key={metric.id}
          id={`metric-${metric.id}`}
          kind="metric"
          label={`${metric.label}: ${metric.value}`}
          records={recordsFor(metric.filter)}
          triggerClassName="group min-h-32 rounded-xl border border-slate-300 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#007d65] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]"
          trigger={
            <>
              <span className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-600">
                {metric.label}<ChevronRight className="size-4 text-[#007d65] transition group-hover:translate-x-0.5" />
              </span>
              <span className="mt-3 block text-3xl font-bold tracking-tight text-slate-950">{metric.value}</span>
              <span className="mt-2 block text-xs font-medium text-[#006a56]">{metric.delta}</span>
              <span className="mt-3 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Investigate records</span>
            </>
          }
        />
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div aria-live="polite" aria-label="Loading Command Center" className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      <div className="grid gap-6 lg:grid-cols-5"><Skeleton className="h-96 lg:col-span-3" /><Skeleton className="h-96 lg:col-span-2" /></div>
    </div>
  );
}

function MessageState({ kind }: { kind: "empty" | "error" }) {
  const router = useRouter();
  const empty = kind === "empty";
  return (
    <Card className="border-dashed py-16 text-center">
      <CardContent className="mx-auto max-w-md">
        <div className={`mx-auto mb-5 flex size-12 items-center justify-center rounded-full ${empty ? "bg-slate-100" : "bg-red-50 text-red-700"}`}>
          {empty ? <Database /> : <CircleAlert />}
        </div>
        <h2 className="text-xl font-semibold">{empty ? "No approved baseline yet" : "Command Center unavailable"}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{empty ? "The publication gate has not promoted a dataset. Existing tools remain unaffected." : "The rehearsal fixture could not be loaded. Try again or inspect Data Health."}</p>
        <Button className="mt-6 bg-[#007d65] hover:bg-[#006a56]" onClick={() => router.push("/tools/registry-intelligence-hub")}>{empty ? "View rehearsal fixture" : "Try again"}</Button>
      </CardContent>
    </Card>
  );
}

export type ExploreParams = {
  q?: string;
  entity?: string;
  category?: string;
  region?: string;
  status?: string;
  contention?: string;
  idn?: string;
  sort?: string;
  ids?: string;
};

function ExploreContent({ state, initial }: { state: ViewState; initial: ExploreParams }) {
  const [filters, setFilters] = useState({
    q: initial.q ?? "",
    entity: initial.entity ?? "applications",
    category: initial.category ?? "all",
    region: initial.region ?? "all",
    status: initial.status ?? "all",
    contention: initial.contention ?? "all",
    idn: initial.idn ?? "all",
    sort: initial.sort ?? "applications-desc",
    ids: initial.ids ?? "",
  });
  const searchRef = useRef<HTMLInputElement>(null);
  const categories = useMemo(() => [...new Set(registryFixture.applications.map((item) => item.category))].sort(), []);
  const regions = useMemo(() => [...new Set(registryFixture.applications.map((item) => item.region))].sort(), []);

  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && !["all", "applications", "applications-desc"].includes(value)) params.set(key, value);
    });
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
  }, [filters]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key === "/" || event.code === "Slash" || ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === "k" || event.code === "KeyK"))) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", focusSearch, true);
    return () => document.removeEventListener("keydown", focusSearch, true);
  }, []);

  const applications = useMemo(() => filterApplicationsByExplore(registryFixture.applications, filters), [filters]);

  const rows = useMemo(() => {
    type ExploreRow = { id: string; name: string; detail: string; records: Application[] };
    let built: ExploreRow[];
    if (filters.entity === "applications") {
      built = applications.map((item) => ({ id: item.id, name: `.${item.string}`, detail: `${item.id} · ${item.applicant}`, records: [item] }));
    } else {
      const keyFor = (item: Application) => filters.entity === "organizations" ? item.organization : filters.entity === "strings" ? item.string : item.category;
      const grouped = new Map<string, Application[]>();
      applications.forEach((item) => grouped.set(keyFor(item), [...(grouped.get(keyFor(item)) ?? []), item]));
      built = [...grouped.entries()].map(([name, records]) => ({ id: `${filters.entity}-${name}`, name: filters.entity === "strings" ? `.${name}` : name, detail: `${records.length} supporting application${records.length === 1 ? "" : "s"}`, records }));
    }
    return built.sort((a, b) => {
      if (filters.sort === "name-asc") return a.name.localeCompare(b.name);
      if (filters.sort === "contention-desc") return b.records.filter((item) => item.contentionSet).length - a.records.filter((item) => item.contentionSet).length || a.name.localeCompare(b.name);
      return b.records.length - a.records.length || a.name.localeCompare(b.name);
    });
  }, [applications, filters.entity, filters.sort]);

  const update = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]: value, ...(key !== "ids" ? { ids: "" } : {}) }));
  const clear = () => setFilters({ q: "", entity: "applications", category: "all", region: "all", status: "all", contention: "all", idn: "all", sort: "applications-desc", ids: "" });
  const selectClass = "h-9 w-full rounded-lg border border-slate-400 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#007d65]";

  return (
    <main className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">Research backbone</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Explore registry intelligence</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">Search and compose evidence-backed filters across applications, organizations, strings, categories, regions, participation, contention, and IDNs.</p></div>
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950"><ShieldCheck className="size-4" />Rehearsal fixture only</div>
      </div>

      <div className="mb-5 rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
        <label className="relative block">
          <Search className="absolute left-3 top-3 size-4 text-slate-600" />
          <input ref={searchRef} value={filters.q} onChange={(event) => update("q", event.target.value)} aria-label="Search all registry records" aria-keyshortcuts="/ Control+K Meta+K" placeholder="Search applications, organizations, strings, categories, regions…" className="h-10 w-full rounded-lg border border-slate-400 pl-9 pr-20 text-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-[#007d65]" />
          <kbd className="pointer-events-none absolute right-2 top-2.5 rounded border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">/ · ⌘K</kbd>
        </label>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <label className="text-xs font-bold text-slate-700">Browse by<select aria-label="Browse by" value={filters.entity} onChange={(event) => update("entity", event.target.value)} className={`${selectClass} mt-1`}><option value="applications">Applications</option><option value="organizations">Organizations</option><option value="strings">Strings</option><option value="categories">Categories</option></select></label>
          <label className="text-xs font-bold text-slate-700">Category<select aria-label="Filter by category" value={filters.category} onChange={(event) => update("category", event.target.value)} className={`${selectClass} mt-1`}><option value="all">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-700">Region<select aria-label="Filter by region" value={filters.region} onChange={(event) => update("region", event.target.value)} className={`${selectClass} mt-1`}><option value="all">All regions</option>{regions.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-700">Participation<select aria-label="Filter by participation" value={filters.status} onChange={(event) => update("status", event.target.value)} className={`${selectClass} mt-1`}><option value="all">New + returning</option><option value="new">New</option><option value="returning">Returning</option></select></label>
          <label className="text-xs font-bold text-slate-700">Contention<select aria-label="Filter by contention" value={filters.contention} onChange={(event) => update("contention", event.target.value)} className={`${selectClass} mt-1`}><option value="all">All states</option><option value="in">In initial contention</option><option value="out">Not in contention</option></select></label>
          <label className="text-xs font-bold text-slate-700">IDN<select aria-label="Filter by IDN" value={filters.idn} onChange={(event) => update("idn", event.target.value)} className={`${selectClass} mt-1`}><option value="all">IDN + non-IDN</option><option value="idn">IDN only</option><option value="non-idn">Non-IDN</option></select></label>
          <label className="text-xs font-bold text-slate-700">Sort<select aria-label="Sort records" value={filters.sort} onChange={(event) => update("sort", event.target.value)} className={`${selectClass} mt-1`}><option value="applications-desc">Applications, high to low</option><option value="name-asc">Name, A–Z</option><option value="contention-desc">Contention first</option></select></label>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm font-bold text-slate-900">{rows.length} {filters.entity} result{rows.length === 1 ? "" : "s"} · {applications.length} application{applications.length === 1 ? "" : "s"}</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-slate-600">URL state updates automatically</span>
          <SaveResearchButton
            kind="explore-view"
            defaultName={`Explore: ${describeExploreFilters(filters)}`.slice(0, 80)}
            summary={describeExploreFilters(filters)}
            recordCount={applications.length}
            disabled={applications.length === 0}
            buildParams={() => nonDefaultExploreFilterParams(filters)}
          />
          <BriefThisButton
            scope={{ kind: "explore-view", params: nonDefaultExploreFilterParams(filters) }}
            label="Brief this view"
            defaultName={`Briefing: Explore — ${describeExploreFilters(filters)}`.slice(0, 80)}
            disabled={applications.length === 0}
            entryPath="current-view"
          />
          <Button variant="outline" onClick={clear}>Clear filters</Button>
        </div>
      </div>

      {state === "loading" ? <LoadingState /> : state === "error" ? (
        <Card className="border-red-200 py-14 text-center"><CardContent><CircleAlert className="mx-auto mb-4 size-9 text-red-700" /><h2 className="text-lg font-bold">Explore is temporarily unavailable</h2><p className="mt-2 text-sm text-slate-700">The isolated research view failed safely; Command Center context and fixture evidence remain unchanged.</p><Link href="/tools/registry-intelligence-hub/explore" className="mt-5 inline-flex h-9 items-center rounded-lg bg-[#007d65] px-4 text-sm font-semibold text-white">Try again</Link></CardContent></Card>
      ) : state === "empty" || !rows.length ? (
        <Card className="border-dashed py-14 text-center"><CardContent><Database className="mx-auto mb-4 size-9 text-slate-500" /><h2 className="text-lg font-bold">No records match this research view</h2><p className="mt-2 text-sm text-slate-700">Clear or broaden one filter. Unknown values were not converted to zero.</p><Button className="mt-5 bg-[#007d65]" onClick={clear}>Clear filters</Button></CardContent></Card>
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] text-sm">
              <thead><tr className="border-b bg-slate-100 text-left text-xs uppercase tracking-wider text-slate-700"><th className="p-3">Record</th><th className="p-3">Applications</th><th className="p-3">Regions</th><th className="p-3">Participation</th><th className="p-3">Initial contention</th><th className="p-3">IDN</th><th className="p-3">Trust</th><th className="p-3">Actions</th></tr></thead>
              <tbody>{rows.map((row) => {
                const returning = row.records.filter((item) => item.returning).length;
                const contention = row.records.filter((item) => item.contentionSet).length;
                const idn = row.records.filter((item) => item.idn).length;
                const kind = filters.entity === "categories" ? "category" : filters.entity === "organizations" ? "applicant" : filters.entity === "applications" ? "application" : "metric";
                const entityType = filters.entity === "strings" ? undefined : filters.entity as CompareEntityType;
                const investigationItem: InvestigationItem = { id: `explore-${row.id}`, kind, label: row.name, records: row.records, entityType, entityKey: filters.entity === "applications" ? row.records[0].id : entityType ? row.name : undefined };
                return <tr key={row.id} className="border-b last:border-0 hover:bg-emerald-50/50"><td className="p-3"><ProvenanceSheet {...investigationItem} triggerClassName="group block w-full rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]" trigger={<><strong className="flex items-center gap-1 text-slate-950">{row.name}<ChevronRight className="size-4 text-[#007d65]" /></strong><span className="mt-1 block text-xs text-slate-600">{row.detail}</span></>} /></td><td className="p-3 font-mono font-bold">{row.records.length}</td><td className="p-3 text-slate-700">{[...new Set(row.records.map((item) => item.region))].join(", ")}</td><td className="p-3 text-slate-700">{returning ? `${returning} returning` : "New only"}</td><td className="p-3">{contention || "—"}</td><td className="p-3">{idn || "—"}</td><td className="p-3"><Badge variant="outline" className="border-emerald-300 text-[#005c49]">Source-backed</Badge></td><td className="p-3"><div className="flex gap-2"><ProvenanceSheet {...investigationItem} triggerClassName="inline-flex h-8 items-center rounded-lg bg-[#007d65] px-2.5 text-xs font-bold text-white hover:bg-[#006a56] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]" trigger="Investigate" /><QuickCompareButton item={investigationItem} /><QuickWatchButton item={investigationItem} /></div></td></tr>;
              })}</tbody>
            </table>
          </div>
          <div className="divide-y md:hidden">{rows.map((row) => {
            const kind = filters.entity === "categories" ? "category" : filters.entity === "organizations" ? "applicant" : filters.entity === "applications" ? "application" : "metric";
            const entityType = filters.entity === "strings" ? undefined : filters.entity as CompareEntityType;
            const investigationItem: InvestigationItem = { id: `explore-mobile-${row.id}`, kind, label: row.name, records: row.records, entityType, entityKey: filters.entity === "applications" ? row.records[0].id : entityType ? row.name : undefined };
            return <div key={row.id} className="p-4"><ProvenanceSheet {...investigationItem} triggerClassName="group block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]" trigger={<><span className="flex items-center justify-between"><strong>{row.name}</strong><ChevronRight className="size-4 text-[#007d65]" /></span><span className="mt-1 block text-xs text-slate-600">{row.detail}</span><span className="mt-3 flex gap-2 text-xs text-slate-700"><Badge variant="secondary">{row.records.length} applications</Badge><Badge variant="outline">{row.records.filter((item) => item.contentionSet).length} contested</Badge></span></>} /><div className="mt-3 flex flex-wrap gap-2"><ProvenanceSheet {...investigationItem} triggerClassName="inline-flex h-8 flex-1 items-center justify-center rounded-lg bg-[#007d65] px-3 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]" trigger="Investigate" /><QuickCompareButton item={investigationItem} className="flex-1" /><QuickWatchButton item={investigationItem} className="flex-1" /></div></div>;
          })}</div>
        </section>
      )}

      <footer className="mt-8 flex flex-col gap-2 border-t py-5 text-xs font-medium text-slate-600 sm:flex-row sm:justify-between"><span>Snapshot {registryFixture.snapshotId}</span><span>Field-level provenance · fixture coverage disclosed · no unavailable value shown as zero</span></footer>
    </main>
  );
}

export type CompareParams = {
  type?: string;
  ids?: string;
  origin?: string;
};

/**
 * Compare v1 — fully frozen (semantic cleanup complete, no more v1 work
 * planned). Sections, dimensions, diff/reference model, and persisted
 * comparison metadata are stable. New Compare capabilities (set-difference
 * UI, cohort comparison, set-as-reference interaction, new sections, etc.)
 * belong in a v2 proposal, not incremental edits to this component.
 */
function CompareContent({ state, initial }: { state: ViewState; initial: CompareParams }) {
  const initialType = (["organizations", "applications", "categories"].includes(initial.type ?? "") ? initial.type : "organizations") as CompareEntityType;
  const [type, setType] = useState<CompareEntityType>(initialType);
  const [selected, setSelected] = useState(() => {
    const valid = new Set(listEntityOptions(initialType).map((item) => item.key));
    return (initial.ids ?? "").split(",").filter((id) => valid.has(id)).slice(0, 4);
  });
  const [pending, setPending] = useState("");
  const [compactAdd, setCompactAdd] = useState("");
  const [diffMode, setDiffMode] = useState<"all" | "differences">("all");
  const [selectorExpanded, setSelectorExpanded] = useState(true);
  const [showAllDifferences, setShowAllDifferences] = useState(false);
  const [lastDifferencesSelectionKey, setLastDifferencesSelectionKey] = useState("");
  const [originContext] = useState(() => initial.origin || "Direct entity selection in Compare");
  const options = useMemo(() => listEntityOptions(type), [type]);
  const singular = type === "categories" ? "category" : type.slice(0, -1);
  const entities = selected.map((key) => options.find((item) => item.key === key)).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const available = options.filter((item) => !selected.includes(item.key));

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("type", type);
    if (selected.length) params.set("ids", selected.join(","));
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }, [selected, type]);

  const chooseType = (next: CompareEntityType) => {
    setType(next);
    setSelected([]);
    setPending("");
    setCompactAdd("");
    setSelectorExpanded(true);
  };
  const addPending = () => {
    if (pending && selected.length < 4) {
      setSelected((current) => [...current, pending]);
      setPending("");
    }
  };
  const addFromCompactBar = (key: string) => {
    if (key && selected.length < 4) setSelected((current) => [...current, key]);
    setCompactAdd("");
  };
  const removeSelection = (key: string) => setSelected((current) => current.filter((item) => item !== key));
  const replace = (index: number, key: string) => setSelected((current) => current.map((item, itemIndex) => itemIndex === index ? key : item));
  const move = (index: number, direction: -1 | 1) => setSelected((current) => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  type CompareCell = { value: ReactNode; state?: "unavailable" | "not-comparable"; entityLabel?: string };
  type CompareRow = { label: string; definition: string; section: CompareSectionId; cells: CompareCell[] };
  const rows: CompareRow[] = useMemo(() => {
    const cell = (value: ReactNode, state?: CompareCell["state"]): CompareCell => ({ value, state });
    const historical = registryFixture.historicalContext.categoryCounts as Record<string, number>;
    const baseRows: CompareRow[] = type === "organizations" ? [
        { label: "2026 applications", definition: "Count of fixture applications resolved to this organization.", section: "round-activity", cells: entities.map((entity) => cell(entity.records.length)) },
        { label: "Initial contention exposure", definition: "Applications in initial identical-string contention; not final contention.", section: "round-activity", cells: entities.map((entity) => cell(entity.records.filter((record) => record.contentionSet).length)) },
        { label: "Regions", definition: "Distinct applicant regions in the fixture.", section: "round-activity", cells: entities.map((entity) => cell([...new Set(entity.records.map((record) => record.region))].join(", "))) },
        { label: "IDN applications", definition: "Applications with a preserved Unicode/A-label representation.", section: "round-activity", cells: entities.map((entity) => cell(entity.records.filter((record) => record.idn).length)) },
        { label: "Participation status", definition: "Returning when any supporting applicant participated in the normalized 2012 cohort.", section: "historical-participation", cells: entities.map((entity) => cell(entity.records.some((record) => record.returning) ? "Returning" : "New")) },
        { label: "Categories", definition: "Distinct versioned fixture categories represented.", section: "existing-portfolio", cells: entities.map((entity) => cell([...new Set(entity.records.map((record) => record.category))].join(", "))) },
        { label: "Application mix", definition: "Published application-type labels; not a ranking of any kind.", section: "existing-portfolio", cells: entities.map((entity) => cell([...new Set(entity.records.map((record) => record.type))].join(", "))) },
        { label: "Historical market demand", definition: "Approved comparable market measure for the same reporting period.", section: "market-context", cells: entities.map(() => cell("Not available — source not approved", "unavailable")) },
      ] : type === "applications" ? [
        { label: "Applicant", definition: "Legal applying entity as represented in the source fixture.", section: "round-activity", cells: entities.map((entity) => cell(entity.records[0].applicant)) },
        { label: "Applied string", definition: "Requested primary string, distinct from a delegated TLD.", section: "round-activity", cells: entities.map((entity) => cell(`.${entity.records[0].string}`)) },
        { label: "Replacement string", definition: "Published optional replacement; absence is not represented as zero.", section: "round-activity", cells: entities.map((entity) => entity.records[0].replacement ? cell(`.${entity.records[0].replacement}`) : cell("Not available — not published", "unavailable")) },
        { label: "Region", definition: "Applicant region derived from published country.", section: "round-activity", cells: entities.map((entity) => cell(entity.records[0].region)) },
        { label: "Initial contention", definition: "Initial identical-string set at fixture baseline; not final contention.", section: "round-activity", cells: entities.map((entity) => cell(entity.records[0].contentionSet ?? "Not applicable")) },
        { label: "Participation status", definition: "Normalized relationship to the 2012 rehearsal cohort.", section: "historical-participation", cells: entities.map((entity) => cell(entity.records[0].returning ? "Returning" : "New")) },
        { label: "Resolved organization", definition: "Illustrative organization relationship; not steward-approved.", section: "existing-portfolio", cells: entities.map((entity) => cell(entity.records[0].organization)) },
        { label: "Category / type", definition: "Versioned category and published application-type label.", section: "existing-portfolio", cells: entities.map((entity) => cell(`${entity.records[0].category} · ${entity.records[0].type}`)) },
        { label: "Comparable market demand", definition: "Like-for-like public demand measure with aligned reporting periods.", section: "market-context", cells: entities.map(() => cell("Not comparable — source unavailable", "not-comparable")) },
      ] : [
      { label: "2026 applications", definition: "Applications assigned to the versioned fixture category.", section: "round-activity", cells: entities.map((entity) => cell(entity.records.length)) },
      { label: "Initial contention exposure", definition: "Applications in initial identical-string sets.", section: "round-activity", cells: entities.map((entity) => cell(entity.records.filter((record) => record.contentionSet).length)) },
      { label: "Regions", definition: "Distinct applicant regions represented.", section: "round-activity", cells: entities.map((entity) => cell([...new Set(entity.records.map((record) => record.region))].join(", "))) },
      { label: "IDN applications", definition: "Applications preserving Unicode and A-label values.", section: "round-activity", cells: entities.map((entity) => cell(entity.records.filter((record) => record.idn).length)) },
      { label: "New / returning mix", definition: "Application count by normalized participation status.", section: "historical-participation", cells: entities.map((entity) => cell(`${entity.records.filter((record) => !record.returning).length} new · ${entity.records.filter((record) => record.returning).length} returning`)) },
      { label: "2012 cohort applications", definition: "Compatible normalized rehearsal cohort count; not an official total.", section: "historical-participation", cells: entities.map((entity) => cell(historical[entity.key] ?? "Not available", historical[entity.key] === undefined ? "unavailable" : undefined)) },
      { label: "Organizations", definition: "Distinct resolved organizations represented.", section: "existing-portfolio", cells: entities.map((entity) => cell(new Set(entity.records.map((record) => record.organization)).size)) },
      { label: "Market demand", definition: "Approved public/licensed demand measure with a comparable period.", section: "market-context", cells: entities.map(() => cell("Not comparable — reporting source unavailable", "not-comparable")) },
    ];
    return baseRows.map((row) => ({ ...row, cells: row.cells.map((entry, index) => ({ ...entry, entityLabel: entities[index]?.label })) }));
  }, [entities, type]);
  const referenceLabel = entities[0]?.label;

  const visibleRows = useMemo(() => diffMode === "differences" ? rows.filter(rowHasDifference) : rows, [rows, diffMode]);
  const sections = useMemo(() => groupCompareRowsBySection(visibleRows, type), [visibleRows, type]);
  const differenceSummary = useMemo(() => summarizeCompareDifferences(rows), [rows]);
  // Collapse "View all differences" back down whenever the selection changes, so a new
  // comparison always starts with the concise ranked findings, not a stale expanded list.
  const differencesSelectionKey = `${type}:${selected.join(",")}`;
  if (differencesSelectionKey !== lastDifferencesSelectionKey) {
    setLastDifferencesSelectionKey(differencesSelectionKey);
    setShowAllDifferences(false);
  }
  const exploreHref = `/tools/registry-intelligence-hub/explore?entity=${type}`;

  return (
    <main className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">Like-for-like research</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Compare registry intelligence</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">Review two to four like entities side by side with stable definitions, evidence context, and explicit unavailable states.</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">Context: {originContext}</p>
        </div>
        <Link href={exploreHref} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-400 bg-white px-3 text-sm font-bold text-[#006a56] hover:bg-emerald-50"><ArrowLeft className="size-4" />Back to Explore</Link>
      </div>

      {selectorExpanded ? (
        <>
          <section className="mb-5 rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">Entity type boundary</p><div className="flex flex-wrap gap-2">{(["organizations", "applications", "categories"] as CompareEntityType[]).map((item) => <button key={item} aria-pressed={type === item} onClick={() => chooseType(item)} className={`rounded-lg px-3 py-2 text-sm font-bold capitalize ${type === item ? "bg-[#007d65] text-white" : "border border-slate-300 bg-white text-slate-700"}`}>{item}</button>)}</div></div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="text-xs font-bold text-slate-700">Add {singular}<select aria-label={`Add ${singular}`} value={pending} onChange={(event) => setPending(event.target.value)} className="mt-1 block h-9 min-w-64 rounded-lg border border-slate-400 bg-white px-3 text-sm"><option value="">Choose one…</option>{available.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
                <Button disabled={!pending || selected.length >= 4} onClick={addPending} className="bg-[#007d65]"><Plus />Add</Button>
                {entities.length >= 2 && <Button variant="outline" onClick={() => setSelectorExpanded(false)}>Collapse selector</Button>}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700"><ShieldCheck className="size-4 text-[#007d65]" />Only {type} can be combined in this view. Changing type clears selection.</div>
          </section>

          <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Selected comparison entities">
            {entities.map((entity, index) => {
              const kind = type === "organizations" ? "applicant" : type === "applications" ? "application" : "category";
              const investigationItem: InvestigationItem = { id: `compare-select-${type}-${entity.key}`, kind, label: entity.label, records: entity.records, entityType: type, entityKey: entity.key };
              return <Card key={entity.key} className="border-slate-300"><CardContent className="pt-5"><div className="flex items-start justify-between gap-2"><div>{index === 0 ? <Badge variant="outline" className="border-sky-300 text-[10px] font-bold uppercase tracking-wider text-sky-800">Reference</Badge> : <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Selection {index + 1}</span>}<ProvenanceSheet id={`compare-${type}-${entity.key}`} kind={kind} entityType={type} entityKey={entity.key} label={entity.label} records={entity.records} triggerClassName="mt-1 block text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]" trigger={<strong className="flex items-center gap-1 text-base">{entity.label}<Info className="size-3.5 text-[#007d65]" /></strong>} /></div><button aria-label={`Remove ${entity.label}`} onClick={() => removeSelection(entity.key)} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="size-4" /></button></div><p className="mt-2 text-xs text-slate-600">{entity.records.length} supporting record{entity.records.length === 1 ? "" : "s"} · source-backed fixture</p><div className="mt-4 flex items-center gap-1"><Button size="icon-xs" variant="outline" aria-label={`Move ${entity.label} left`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowLeft /></Button><Button size="icon-xs" variant="outline" aria-label={`Move ${entity.label} right`} disabled={index === entities.length - 1} onClick={() => move(index, 1)}><ArrowRight /></Button><select aria-label={`Replace ${entity.label}`} value={entity.key} onChange={(event) => replace(index, event.target.value)} className="ml-auto h-7 max-w-36 rounded border border-slate-300 px-2 text-xs">{options.filter((item) => item.key === entity.key || !selected.includes(item.key)).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></div><div className="mt-2"><QuickWatchButton item={investigationItem} className="w-full" /></div></CardContent></Card>;
            })}
            {Array.from({ length: Math.max(0, 2 - entities.length) }).map((_, index) => <div key={`empty-${index}`} className="grid min-h-40 place-items-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center"><div><Plus className="mx-auto mb-2 size-5 text-slate-500" /><p className="text-sm font-bold text-slate-700">Add {singular} {entities.length + index + 1}</p><p className="mt-1 text-xs text-slate-600">Two selections required</p></div></div>)}
          </section>
        </>
      ) : (
        <section aria-label="Compact comparison selection" className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 shadow-sm">
          <Badge variant="outline" className="capitalize">{type}</Badge>
          {entities.map((entity, index) => (
            <span key={entity.key} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-800">
              {index === 0 && <Badge variant="outline" className="border-sky-300 text-[10px] font-bold uppercase tracking-wider text-sky-800">Reference</Badge>}
              <span>{entity.label}</span>
              <button type="button" aria-label={`Remove ${entity.label}`} onClick={() => removeSelection(entity.key)} className="rounded p-0.5 hover:bg-slate-200"><X className="size-3" /></button>
            </span>
          ))}
          {available.length > 0 && selected.length < 4 && (
            <select aria-label={`Add ${singular}`} value={compactAdd} onChange={(event) => addFromCompactBar(event.target.value)} className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs">
              <option value="">+ Add {singular}…</option>
              {available.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          )}
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setSelectorExpanded(true)}><Pencil />Edit selection</Button>
        </section>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-950"><span><strong>Rehearsal comparison.</strong> As of {new Date(registryFixture.baselineAt).toLocaleDateString("en-US", { timeZone: "UTC" })}; effective dates follow the fixture baseline.</span><span>Snapshot {registryFixture.snapshotId} · Dimensions {COMPARE_DIMENSIONS_VERSION}</span></div>

      <div className="mb-5 flex flex-wrap justify-end gap-2">
        <SaveResearchButton
          kind="compare-config"
          defaultName={`Compare: ${entities.map((entity) => entity.label).join(", ")}`.slice(0, 80)}
          summary={describeCompareSelection(type, entities.map((entity) => entity.label))}
          recordCount={entities.reduce((sum, entity) => sum + entity.records.length, 0)}
          disabled={entities.length < 2}
          buildParams={() => ({
            type,
            ids: selected.join(","),
            snapshotId: registryFixture.snapshotId,
            timeBasis: COMPARE_TIME_BASIS,
            dimensionsVersion: COMPARE_DIMENSIONS_VERSION,
            origin: originContext,
          })}
        />
        <BriefThisButton
          scope={{ kind: "compare-config", params: { type, ids: selected.join(",") } }}
          label="Brief this comparison"
          defaultName={`Briefing: ${entities.map((entity) => entity.label).join(", ")}`.slice(0, 80)}
          disabled={entities.length < 2}
          entryPath="current-view"
        />
      </div>

      {state === "loading" ? <LoadingState /> : state === "error" ? <Card className="border-red-200 py-14 text-center"><CardContent><CircleAlert className="mx-auto mb-4 size-9 text-red-700" /><h2 className="text-lg font-bold">Comparison unavailable</h2><p className="mt-2 text-sm text-slate-700">The fixture comparison could not be calculated. Selections remain encoded in the URL.</p></CardContent></Card> : state === "empty" || entities.length < 2 ? <Card className="border-dashed py-14 text-center"><CardContent><GitCompareArrows className="mx-auto mb-4 size-9 text-slate-500" /><h2 className="text-lg font-bold">Choose at least two {type}</h2><p className="mt-2 text-sm text-slate-700">Use the selector above or add like entities from Explore. Up to four can be compared.</p><Link href={exploreHref} className="mt-5 inline-flex h-9 items-center rounded-lg bg-[#007d65] px-4 text-sm font-bold text-white">Find in Explore</Link></CardContent></Card> : (
        <>
          <section className="mb-4 flex flex-col justify-between gap-3 rounded-xl border border-slate-300 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
            <div aria-live="polite" className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Key differences</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{differenceSummary.headline}</p>
              {differenceSummary.topFacts.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-slate-700">
                  {(showAllDifferences ? [...differenceSummary.topFacts, ...differenceSummary.remainingFacts] : differenceSummary.topFacts).map((fact) => <li key={fact}>{fact}</li>)}
                </ul>
              )}
              {differenceSummary.remainingFacts.length > 0 && (
                <button type="button" onClick={() => setShowAllDifferences((current) => !current)} className="mt-2 text-xs font-bold text-[#006a56] hover:underline">
                  {showAllDifferences ? "Show fewer differences" : `View all ${differenceSummary.differingLabels.length} differences`}
                </button>
              )}
              {differenceSummary.matchingSentence && <p className="mt-2 text-xs leading-5 text-slate-600">{differenceSummary.matchingSentence}</p>}
            </div>
            <div className="inline-flex shrink-0 rounded-lg border border-slate-300 bg-slate-50 p-1" role="group" aria-label="Dimension filter">
              <button type="button" aria-pressed={diffMode === "all"} onClick={() => setDiffMode("all")} className={`rounded-md px-3 py-1.5 text-xs font-bold ${diffMode === "all" ? "bg-[#007d65] text-white" : "text-slate-600 hover:text-slate-900"}`}>All dimensions</button>
              <button type="button" aria-pressed={diffMode === "differences"} onClick={() => setDiffMode("differences")} className={`rounded-md px-3 py-1.5 text-xs font-bold ${diffMode === "differences" ? "bg-[#007d65] text-white" : "text-slate-600 hover:text-slate-900"}`}>Differences only</button>
            </div>
          </section>

          <section className="hidden overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm md:block">
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b bg-slate-100 text-left text-xs uppercase tracking-wider text-slate-700">
                    <th className="sticky top-0 left-0 z-30 w-64 bg-slate-100 p-4 text-left">Stable dimension</th>
                    {entities.map((entity, index) => (
                      <th key={entity.key} className="sticky top-0 z-20 min-w-52 bg-slate-100 p-4 text-left normal-case tracking-normal text-slate-950">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span>{entity.label}</span>
                          {index === 0 && <Badge variant="outline" className="border-sky-300 text-[10px] font-semibold normal-case tracking-normal text-sky-800">Reference</Badge>}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sections.map((group) => (
                    <Fragment key={group.section}>
                      <tr className="bg-slate-50">
                        <th colSpan={entities.length + 1} className="sticky left-0 bg-slate-50 px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">{group.label}</th>
                      </tr>
                      {group.rows.map((row) => (
                        <tr key={row.label} className="border-b last:border-0">
                          <th className="sticky left-0 z-10 bg-white p-4 text-left align-top"><span className="block font-bold text-slate-900">{row.label}</span><span className="mt-1 block text-xs font-normal leading-5 text-slate-600">{row.definition}</span></th>
                          {row.cells.map((entry, index) => {
                            const differs = cellDiffersFromBaseline(row.cells, index);
                            const delta = numericCellDelta(row.cells, index);
                            return (
                              <td key={entities[index].key} className={`p-4 align-top ${differs ? "bg-sky-50/70" : ""}`}>
                                {entry.state ? (
                                  <span>
                                    <Badge variant={entry.state === "unavailable" ? "secondary" : "outline"}>{entry.state === "unavailable" ? "Unavailable" : "Not comparable"}</Badge>
                                    <span className="mt-2 block text-xs leading-5 text-slate-700">{entry.value}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                                    {differs && <span aria-hidden="true" className="inline-block size-1.5 shrink-0 rounded-full bg-sky-500" />}
                                    {entry.value}
                                    {delta !== null && <span className="text-xs font-medium text-slate-500">({delta > 0 ? "+" : ""}{delta} vs {referenceLabel})</span>}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4 md:hidden">
            {entities.map((entity, entityIndex) => (
              <Card key={entity.key} className="border-slate-300">
                <CardHeader><CardTitle className="flex flex-wrap items-center gap-1.5"><span>{entity.label}</span>{entityIndex === 0 && <Badge variant="outline" className="border-sky-300 text-[10px] font-semibold text-sky-800">Reference</Badge>}</CardTitle><p className="text-xs text-slate-600">As of fixture baseline · {entity.records.length} records</p></CardHeader>
                <CardContent className="space-y-4">
                  {sections.map((group) => (
                    <div key={group.section}>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">{group.label}</p>
                      <div className="divide-y">
                        {group.rows.map((row) => {
                          const entry = row.cells[entityIndex];
                          const differs = cellDiffersFromBaseline(row.cells, entityIndex);
                          const delta = numericCellDelta(row.cells, entityIndex);
                          return (
                            <div key={row.label} className={`py-3 ${differs ? "-mx-2 rounded-lg bg-sky-50/70 px-2" : ""}`}>
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-600">{row.label}</p>
                              {entry.state ? (
                                <p className="mt-1 text-sm text-slate-700"><Badge variant="secondary">{entry.state === "unavailable" ? "Unavailable" : "Not comparable"}</Badge><span className="mt-1 block">{entry.value}</span></p>
                              ) : (
                                <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                                  {differs && <span aria-hidden="true" className="inline-block size-1.5 shrink-0 rounded-full bg-sky-500" />}
                                  {entry.value}
                                  {delta !== null && <span className="text-xs font-medium text-slate-500">({delta > 0 ? "+" : ""}{delta} vs {referenceLabel})</span>}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </section>
        </>
      )}

      <footer className="mt-8 flex flex-col gap-2 border-t py-5 text-xs font-medium text-slate-600 sm:flex-row sm:justify-between"><span>Source: {registryFixture.source.name} · Retrieved {new Date(registryFixture.retrievedAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC</span><span>Method {registryFixture.methodVersion} · Dimensions {COMPARE_DIMENSIONS_VERSION} · URL state updates automatically</span></footer>
    </main>
  );
}

export function CommandCenter({ state = "ready", view = "command", exploreParams = {}, compareParams = {}, savedParams = {}, briefingId }: { state?: ViewState; view?: "command" | "explore" | "compare" | "saved" | "briefings"; exploreParams?: ExploreParams; compareParams?: CompareParams; savedParams?: SavedParams; briefingId?: string }) {
  const [query, setQuery] = useState("");
  const [lens, setLens] = useState("all");
  const [investigation, setInvestigation] = useState<InvestigationItem | null>(null);
  const [compareItems, setCompareItems] = useState<InvestigationItem[]>([]);
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
  const savedWork = useSavedWork();
  const searchRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => registryFixture.applications.filter((item) =>
    [item.string, item.applicant, item.organization, item.category].some((value) => value.toLowerCase().includes(query.toLowerCase()))
  ), [query]);
  const visibleInsights = useMemo(() => standoutInsightsForLens(lens as Lens), [lens]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key === "/" || event.code === "Slash" || ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === "k" || event.code === "KeyK"))) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", focusSearch, true);
    return () => document.removeEventListener("keydown", focusSearch, true);
  }, []);

  const controls: InvestigationContextValue = {
    investigate: setInvestigation,
    addCompare: (item) => setCompareItems((current) => current.some((entry) => entry.id === item.id) || current.length >= 4 || !item.entityType || !item.entityKey || (current.length > 0 && current[0].entityType !== item.entityType) ? current : [...current, item]),
    removeCompare: (id) => setCompareItems((current) => current.filter((item) => item.id !== id)),
    toggleWatch: (item) => setWatchedIds((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
      return next;
    }),
    compareItems,
    watchedIds,
    savedWork,
  };

  return (
    <InvestigationContext.Provider value={controls}>
    <div className="min-h-screen bg-[#f4f6f8] pb-28 text-slate-950">
      <ShellHeader />
      <HubNav active={view === "explore" ? "Explore" : view === "compare" ? "Compare" : view === "saved" ? "Saved" : view === "briefings" ? "Briefings" : "Command Center"} />
      {view === "explore" ? <ExploreContent state={state} initial={exploreParams} /> : view === "compare" ? <CompareContent state={state} initial={compareParams} /> : view === "saved" ? <SavedContent state={state} initial={savedParams} /> : view === "briefings" ? <BriefingsContent state={state} briefingId={briefingId} /> : (
      <main className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:py-8">
        <div className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-100 text-[#006a56]"><CheckCircle2 /> REHEARSAL READY</Badge>
              <span className="text-xs font-medium text-slate-600">Baseline {new Date(registryFixture.baselineAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</span>
              <ProvenanceSheet label="Dataset state" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Registry Intelligence Hub</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">A source-backed command center for understanding application portfolios, contention, categories, and cross-round signals.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative block">
              <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
              <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search fixture records…" aria-label="Search fixture records" aria-keyshortcuts="/ Control+K Meta+K" className="h-9 w-full rounded-lg border border-slate-400 bg-white pl-9 pr-20 text-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-[#007d65] sm:w-80" />
              <kbd className="pointer-events-none absolute right-2 top-2 rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">/ · ⌘K</kbd>
            </label>
            <BriefThisButton
              scope={{ kind: "round-wide" }}
              label="Instant Briefing"
              defaultName="Briefing: Round-wide"
              entryPath="instant"
              variant="default"
              className="bg-[#007d65] text-white hover:bg-[#006a56]"
            />
          </div>
        </div>

        <section className="mb-5 grid gap-4 rounded-2xl border border-slate-700 bg-[#152331] p-4 text-white shadow-lg lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#72dfb4]">View</p>
            <div className="flex flex-wrap gap-2" aria-label="Intelligence lens">
              {[
                ["all", "All Intelligence"],
                ["commercial", "Commercial"],
                ["strategy", "Product & Strategy"],
                ["marketing", "Marketing"],
              ].map(([value, label]) => (
                <button key={value} onClick={() => setLens(value)} aria-pressed={lens === value} className={`rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72dfb4] ${lens === value ? "bg-[#72dfb4] text-[#0b3129]" : "bg-white/8 text-slate-200 hover:bg-white/15"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Time basis</p>
            <div className="inline-flex rounded-lg border border-white/15 bg-[#0d1720] p-1" aria-label="Time basis">
              <button aria-pressed="true" className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-950"><FileClock className="mr-1.5 inline size-4" />Reveal Day</button>
              <button disabled className="cursor-not-allowed rounded-md px-3 py-2 text-sm text-slate-500">Current</button>
              <button disabled className="cursor-not-allowed rounded-md px-3 py-2 text-sm text-slate-500"><GitCompareArrows className="mr-1 inline size-4" />Compare</button>
            </div>
          </div>
        </section>

        <section aria-label="Dataset health" className="mb-5 grid gap-px overflow-hidden rounded-xl border border-slate-300 bg-slate-300 sm:grid-cols-4">
          <div className="bg-white px-4 py-3"><span className="block text-[10px] font-bold uppercase tracking-wider text-slate-600">Snapshot</span><span className="mt-1 flex items-center gap-2 text-sm font-semibold"><Database className="size-4 text-[#007d65]" />{registryFixture.snapshotId.replace("snap-rehearsal-", "")}</span></div>
          <div className="bg-white px-4 py-3"><span className="block text-[10px] font-bold uppercase tracking-wider text-slate-600">Last checked</span><span className="mt-1 flex items-center gap-2 text-sm font-semibold"><Clock3 className="size-4 text-[#007d65]" />{new Date(registryFixture.checkedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })} UTC</span></div>
          <div className="bg-white px-4 py-3"><span className="block text-[10px] font-bold uppercase tracking-wider text-slate-600">Last changed</span><span className="mt-1 flex items-center gap-2 text-sm font-semibold"><Layers3 className="size-4 text-[#007d65]" />{new Date(registryFixture.changedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })} UTC</span></div>
          <ProvenanceSheet
            id="source-coverage"
            kind="coverage"
            label="Source coverage"
            records={registryFixture.applications}
            triggerClassName="group bg-emerald-50 px-4 py-3 text-left hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#007d65]"
            trigger={<><span className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#006a56]">Source coverage<ChevronRight className="size-4 transition group-hover:translate-x-0.5" /></span><span className="mt-1 flex items-center gap-2 text-sm font-bold text-[#004c3d]"><CheckCircle2 className="size-4" />{registryFixture.sourceHealth.recordsCovered}/{registryFixture.sourceHealth.recordsTotal} records · {((registryFixture.sourceHealth.requiredFieldsCovered / registryFixture.sourceHealth.requiredFieldsTotal) * 100).toFixed(1)}% fields</span></>}
          />
        </section>

        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-700" />
          <div className="flex-1"><strong>Rehearsal data only.</strong> This curated fixture proves the experience and calculation contract; it is not an official 2026 publication.</div>
          <ProvenanceSheet label="Fixture limitations" />
        </div>

        {state === "ready" && query && (
          <section aria-live="polite" className="mb-6 rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Fixture search results</h2><Badge variant="secondary">{filtered.length} records</Badge></div>
            {filtered.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((item) => <ProvenanceSheet key={item.id} id={`search-${item.id}`} kind="application" entityType="applications" entityKey={item.id} label={`.${item.string} · ${item.organization}`} records={[item]} triggerClassName="group rounded-lg border border-slate-300 p-3 text-left text-sm hover:border-[#007d65] hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]" trigger={<><span className="flex items-center justify-between"><strong>.{item.string}</strong><ChevronRight className="size-4 text-[#007d65]" /></span><span className="mt-1 block text-slate-700">{item.organization} · {item.category}</span></>} />)}</div> : <p className="py-5 text-center text-sm text-slate-700">No fixture records match “{query}”. Try an organization, string, or category.</p>}
          </section>
        )}

        {state === "loading" ? <LoadingState /> : state === "empty" || state === "error" ? <MessageState kind={state} /> : (
          <>
            <section aria-labelledby="round-pulse-heading">
              <div className="mb-3 flex items-center justify-between">
                <div><p className="text-xs font-bold tracking-[0.14em] text-[#007d65]">ROUND PULSE</p><h2 id="round-pulse-heading" className="mt-1 text-lg font-semibold">The rehearsal round at a glance</h2></div>
                <ProvenanceSheet label="Round Pulse metrics" records={registryFixture.applications} />
              </div>
              <MetricCards />
            </section>

            <section className="mt-5 rounded-xl border border-slate-300 bg-white p-4 shadow-sm" aria-labelledby="glance-heading">
              <div className="mb-3 flex items-center justify-between">
                <div><p className="text-xs font-bold tracking-[0.14em] text-[#006a56]">REVEAL DAY AT A GLANCE</p><h2 id="glance-heading" className="mt-1 text-lg font-bold">Rehearsal vs normalized 2012 cohort</h2></div>
                <ProvenanceSheet kind="metric" id="at-a-glance" label="Reveal Day at a Glance versus 2012" records={registryFixture.applications} />
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  ["Applications", registryFixture.applications.length, registryFixture.historicalContext.applications],
                  ["Unique strings", new Set(registryFixture.applications.map((item) => item.string)).size, registryFixture.historicalContext.uniqueStrings],
                  ["Organizations", new Set(registryFixture.applications.map((item) => item.organization)).size, registryFixture.historicalContext.organizations],
                  ["IDN applications", registryFixture.applications.filter((item) => item.idn).length, registryFixture.historicalContext.idnApplications],
                ].map(([label, current, previous]) => (
                  <div key={label} className="rounded-lg bg-slate-100 p-3">
                    <p className="text-xs font-bold text-slate-700">{label}</p>
                    <p className="mt-2 flex items-baseline gap-2"><strong className="text-2xl text-slate-950">{current}</strong><span className="text-xs font-semibold text-slate-600">vs {previous} in 2012</span></p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-10" aria-labelledby="intelligence-heading">
              <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                <div>
                  <p className="flex items-center gap-1 text-xs font-bold tracking-[0.14em] text-[#007d65]"><Sparkles className="size-3.5" /> WHAT YOU SHOULD KNOW</p>
                  <h2 id="intelligence-heading" className="mt-1 text-2xl font-bold tracking-tight">Reveal Day Intelligence</h2>
                  <p className="mt-1 text-sm text-slate-600">{lens === "all" ? "All Intelligence" : lens === "strategy" ? "Product & Strategy" : lens.charAt(0).toUpperCase() + lens.slice(1)} view · ranked by materiality and evidence coverage</p>
                </div>
                <span className="text-xs font-medium text-slate-600">Deterministic · {registryFixture.sourceHealth.recordsCovered}/{registryFixture.sourceHealth.recordsTotal} records covered</span>
              </div>
              <div className="mb-5 rounded-xl border border-[#007d65]/30 bg-emerald-50 px-4 py-3 text-sm leading-6 text-slate-800">
                <strong className="text-[#005c49]">Why this matters for this View:</strong> {lensInterpretations[lens]}
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                {visibleInsights.map((insight) => (
                  <ProvenanceSheet
                    key={insight.id}
                    id={`signal-${insight.id}`}
                    kind="signal"
                    label={insight.title}
                    records={insight.records}
                    triggerClassName="group rounded-xl border border-slate-300 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#007d65] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]"
                    trigger={
                      <>
                        <div className="mb-4 flex items-center justify-between"><Badge variant="outline" className="border-emerald-300 text-[#005c49]">{insight.eyebrow}</Badge><ChevronRight className="size-5 text-[#007d65] transition group-hover:translate-x-1" /></div>
                        <h3 className="text-lg font-bold leading-6 text-slate-950">{insight.title}</h3>
                        <p className="mt-3 text-sm leading-6 text-slate-700">{insight.body}</p>
                        <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 text-xs"><span className="font-medium text-slate-600">{insight.confidence} confidence</span><span className="font-bold text-[#006a56]">Investigate evidence</span></div>
                      </>
                    }
                  />
                ))}
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <Card className="border-slate-300 shadow-sm">
                  <CardHeader className="flex-row items-start justify-between">
                    <div><p className="text-xs font-bold tracking-wider text-[#006a56]">BIGGEST CHANGES VS 2012</p><CardTitle className="mt-1 text-xl">Where the mix moved</CardTitle><p className="mt-1 text-sm text-slate-600">{registryFixture.historicalContext.comparisonLabel}</p></div>
                    <ProvenanceSheet kind="metric" label="Biggest changes versus 2012" records={registryFixture.applications} />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {biggestChanges.slice(0, 4).map((item) => (
                      <ProvenanceSheet
                        key={item.category}
                        id={`category-change-${item.category}`}
                        kind="category"
                        entityType="categories"
                        entityKey={item.category}
                        label={`${item.category}: ${item.previous} in 2012 to ${item.current} in rehearsal`}
                        records={registryFixture.applications.filter((record) => record.category === item.category)}
                        triggerClassName="group grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg border border-transparent px-3 py-3 text-left hover:border-emerald-200 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]"
                        trigger={<><span><strong className="block text-sm">{item.category}</strong><span className="text-xs text-slate-600">{item.previous} → {item.current} applications</span></span><Badge className={item.change > 0 ? "bg-emerald-100 text-[#005c49]" : "bg-rose-100 text-rose-800"}>{item.change > 0 ? "+" : ""}{item.change}</Badge><ChevronRight className="size-4 text-[#007d65]" /></>}
                      />
                    ))}
                    <p className="rounded-lg bg-slate-100 p-3 text-xs leading-5 text-slate-700"><strong>Why this stands out:</strong> Identity rose from one to three applications, Technology doubled, and Consumer and Community each declined in this normalized rehearsal cohort. These are fixture comparisons, not official round trends.</p>
                  </CardContent>
                </Card>

                <Card className="border-slate-300 shadow-sm">
                  <CardHeader className="flex-row items-start justify-between">
                    <div><p className="text-xs font-bold tracking-wider text-[#006a56]">APPLICANTS WORTH INVESTIGATING</p><CardTitle className="mt-1 text-xl">Evidence-led investigation queue</CardTitle><p className="mt-1 text-sm text-slate-600">Ranked signals, not lead scores or recommendations</p></div>
                    <ProvenanceSheet kind="metric" label="Applicants Worth Investigating method" records={registryFixture.applications} />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {applicantsToWatch.map((item, index) => (
                      <ProvenanceSheet
                        key={item.organization}
                        id={`applicant-watch-${item.organization}`}
                        kind="applicant"
                        entityType="organizations"
                        entityKey={item.organization}
                        label={`${item.organization} investigation profile`}
                        records={item.records}
                        triggerClassName="group grid w-full grid-cols-[32px_1fr_auto] items-center gap-3 rounded-lg border border-transparent px-3 py-3 text-left hover:border-emerald-200 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]"
                        trigger={<><span className="font-mono text-xs font-bold text-slate-400">0{index + 1}</span><span><strong className="block text-sm">{item.organization}</strong><span className="mt-1 block text-xs text-slate-600">{item.reasons.join(" · ")}</span></span><ChevronRight className="size-4 text-[#007d65]" /></>}
                      />
                    ))}
                    <p className="rounded-lg bg-slate-100 p-3 text-xs leading-5 text-slate-700"><strong>Why these stand out:</strong> portfolio size, category breadth, contention exposure, IDN participation, and returning status are transparent fixture rules.</p>
                  </CardContent>
                </Card>
              </div>
            </section>

            <section className="mt-10 border-t border-slate-300 pt-8" aria-labelledby="supporting-heading">
              <div className="mb-5"><p className="text-xs font-bold tracking-[0.14em] text-slate-600">SUPPORTING CHARTS</p><h2 id="supporting-heading" className="mt-1 text-2xl font-bold">Explore the shape behind the signals</h2></div>
              <div className="grid gap-6 lg:grid-cols-5">
                <Card className="border-slate-300 lg:col-span-3">
                  <CardHeader><p className="text-xs font-bold tracking-wider text-slate-500">LARGEST PORTFOLIOS</p><CardTitle className="text-lg">Application concentration</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {portfolioRanking.slice(0, 5).map((item, index) => {
                      const records = registryFixture.applications.filter((record) => record.organization === item.organization);
                      return <ProvenanceSheet key={item.organization} id={`organization-${item.organization}`} kind="applicant" entityType="organizations" entityKey={item.organization} label={`${item.organization} portfolio`} records={records} triggerClassName="group grid w-full grid-cols-[28px_1fr_auto] items-center gap-3 rounded-lg p-2 text-left hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]" trigger={<><span className="font-mono text-xs text-slate-600">0{index + 1}</span><span><span className="flex items-center justify-between gap-4"><strong className="text-sm">{item.organization}</strong><strong className="text-sm">{item.count}</strong></span><span className="mt-2 block h-2 overflow-hidden rounded-full bg-slate-200"><span className="block h-full rounded-full bg-[#007d65]" style={{ width: `${(item.count / portfolioRanking[0].count) * 100}%` }} /></span></span><ChevronRight className="size-4 text-[#007d65]" /></>} />;
                    })}
                  </CardContent>
                </Card>

                <Card className="border-slate-300 lg:col-span-2">
                  <CardHeader><p className="text-xs font-bold tracking-wider text-slate-500">APPLICATION MIX</p><CardTitle className="text-lg">Interest by category</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    {categoryMix.map((item, index) => (
                      <ProvenanceSheet key={item.category} id={`category-${item.category}`} kind="category" entityType="categories" entityKey={item.category} label={`${item.category}: ${item.count} applications`} records={registryFixture.applications.filter((record) => record.category === item.category)} triggerClassName="group grid w-full grid-cols-[90px_1fr_38px] items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]" trigger={<><strong className="truncate text-sm">{item.category}</strong><span className="h-2.5 rounded-full bg-slate-200"><span className={`block h-full rounded-full ${index === 0 ? "bg-[#007d65]" : "bg-slate-600"}`} style={{ width: `${Math.max(item.percent, 12)}%` }} /></span><span className="flex items-center justify-end gap-1 font-mono text-xs font-bold">{item.count}<ChevronRight className="size-3 text-[#007d65]" /></span></>} />
                    ))}
                    <p className="pt-3 text-xs leading-5 text-slate-600">Market demand is <strong>not available</strong> pending source-rights review; no proxy is substituted.</p>
                  </CardContent>
                </Card>
              </div>
            </section>

            <footer className="mt-10 flex flex-col gap-4 border-t py-6 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <span>Snapshot {registryFixture.snapshotId} · Method {registryFixture.methodVersion}</span>
              <span className="flex items-center gap-1"><BookOpen className="size-3.5" /> Catalog integration flag: <strong className="text-slate-700">disabled</strong></span>
            </footer>
          </>
        )}
      </main>
      )}
      <IntelligenceDrawer item={investigation} onClose={() => setInvestigation(null)} />
      <ComparisonTray />
    </div>
    </InvestigationContext.Provider>
  );
}
