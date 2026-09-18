"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
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
  portfolioRanking,
  registryFixture,
  roundPulse,
  standoutInsights,
  type Application,
} from "@/lib/registry-data";

type ViewState = "ready" | "loading" | "empty" | "error";

const navItems = ["Command Center", "Explore", "Compare", "Saved", "Briefings", "Data Health"];
const lensInterpretations: Record<string, string> = {
  all: "The rehearsal fixture points to concentrated portfolios, increased IDN representation, and two initial contention clusters worth coordinated review.",
  commercial: "Portfolio concentration and contention expose where account research may be most efficient; they are investigation priorities, not sales recommendations.",
  strategy: "Category movement, IDN participation, and initial contention show where round composition differs from the normalized 2012 fixture cohort.",
  marketing: "Cross-region IDN participation and multi-category organizations offer evidence-backed themes without implying market demand or future success.",
};

type InvestigationKind = "applicant" | "category" | "signal" | "metric" | "coverage" | "dataset";
type InvestigationItem = {
  id: string;
  label: string;
  kind: InvestigationKind;
  records: readonly Application[];
};

type InvestigationContextValue = {
  investigate: (item: InvestigationItem) => void;
  addCompare: (item: InvestigationItem) => void;
  removeCompare: (id: string) => void;
  toggleWatch: (item: InvestigationItem) => void;
  compareItems: InvestigationItem[];
  watchedIds: Set<string>;
};

const InvestigationContext = createContext<InvestigationContextValue | null>(null);

function useInvestigation() {
  const value = useContext(InvestigationContext);
  if (!value) throw new Error("Investigation controls require CommandCenter context");
  return value;
}

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
                  index < 2 ? <Link key={item} href={index === 0 ? "/tools/registry-intelligence-hub" : "/tools/registry-intelligence-hub/explore"} className="flex items-center justify-between rounded-lg px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-[#006a56]">{item}</Link> :
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
          index < 2 ? (
            <Link
              key={item}
              href={index === 0 ? "/tools/registry-intelligence-hub" : "/tools/registry-intelligence-hub/explore"}
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
}: {
  label: string;
  records?: readonly Application[];
  trigger?: ReactNode;
  triggerClassName?: string;
  kind?: InvestigationKind;
  id?: string;
}) {
  const { investigate } = useInvestigation();
  const item = {
    id: id ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    label,
    kind,
    records: records ?? registryFixture.applications,
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

function IntelligenceDrawer({
  item,
  onClose,
}: {
  item: InvestigationItem | null;
  onClose: () => void;
}) {
  const [showFull, setShowFull] = useState(false);
  const { addCompare, toggleWatch, watchedIds, compareItems } = useInvestigation();
  const isDerived = item?.kind === "signal";
  const canAct = item && !["coverage", "dataset"].includes(item.kind);
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
                <div className="grid grid-cols-3 gap-2">
                  <Link href={fullHref} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-medium hover:bg-slate-100"><Eye className="size-4" />View full</Link>
                  <Button variant="outline" disabled={compareItems.some((entry) => entry.id === item.id) || compareItems.length >= 2} onClick={() => addCompare(item)}><GitCompareArrows />+ Compare</Button>
                  <Button variant={watchedIds.has(item.id) ? "secondary" : "outline"} onClick={() => toggleWatch(item)}><Star />{watchedIds.has(item.id) ? "Watching" : "Watch"}</Button>
                </div>
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
  const [expanded, setExpanded] = useState(false);
  if (!compareItems.length) return null;

  const dimensions = (item: InvestigationItem) => ({
    records: item.records.length,
    organizations: new Set(item.records.map((record) => record.organization)).size,
    categories: new Set(item.records.map((record) => record.category)).size,
    contention: item.records.filter((record) => record.contentionSet).length,
  });

  return (
    <aside aria-label="Comparison selection tray" className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-4xl rounded-2xl border border-slate-700 bg-[#101923] p-3 text-white shadow-2xl">
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-2 text-xs font-bold uppercase tracking-wider text-[#72dfb4]">Compare</span>
        {compareItems.map((item) => <span key={item.id} className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold">{item.label}<button onClick={() => removeCompare(item.id)} aria-label={`Remove ${item.label} from comparison`} className="rounded p-0.5 hover:bg-white/15"><X className="size-3.5" /></button></span>)}
        {compareItems.length < 2 && <span className="text-xs text-slate-300">Choose one more investigation</span>}
        <Button className="ml-auto bg-[#72dfb4] text-[#0b3129] hover:bg-[#93e8c9]" disabled={compareItems.length < 2} onClick={() => setExpanded((value) => !value)}><GitCompareArrows />{expanded ? "Hide comparison" : `Compare ${compareItems.length}`}</Button>
      </div>
      {expanded && compareItems.length === 2 && (
        <div className="mt-3 overflow-x-auto rounded-xl bg-white text-slate-950">
          <table className="w-full min-w-[520px] text-sm">
            <thead><tr className="border-b bg-slate-100"><th className="p-3 text-left text-xs uppercase tracking-wider text-slate-600">Dimension</th>{compareItems.map((item) => <th key={item.id} className="p-3 text-left">{item.label}</th>)}</tr></thead>
            <tbody>
              {[
                ["Supporting records", "records"],
                ["Organizations represented", "organizations"],
                ["Categories represented", "categories"],
                ["Applications in initial contention", "contention"],
              ].map(([label, key]) => <tr key={key} className="border-b last:border-0"><th className="p-3 text-left font-medium text-slate-700">{label}</th>{compareItems.map((item) => <td key={item.id} className="p-3 font-mono font-bold">{dimensions(item)[key as keyof ReturnType<typeof dimensions>]}</td>)}</tr>)}
              <tr><th className="p-3 text-left font-medium text-slate-700">Evidence state</th>{compareItems.map((item) => <td key={item.id} className="p-3 font-semibold text-[#006a56]">Complete for fixture</td>)}</tr>
            </tbody>
          </table>
        </div>
      )}
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
      if (event.key === "/" || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k")) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const applications = useMemo(() => {
    const selectedIds = new Set(filters.ids.split(",").filter(Boolean));
    return registryFixture.applications.filter((item) => {
      const matchesQuery = [item.id, item.string, item.applicant, item.organization, item.category, item.region, item.country].some((value) => value.toLowerCase().includes(filters.q.toLowerCase()));
      return matchesQuery
        && (!selectedIds.size || selectedIds.has(item.id))
        && (filters.category === "all" || item.category === filters.category)
        && (filters.region === "all" || item.region === filters.region)
        && (filters.status === "all" || (filters.status === "returning" ? item.returning : !item.returning))
        && (filters.contention === "all" || (filters.contention === "in" ? Boolean(item.contentionSet) : !item.contentionSet))
        && (filters.idn === "all" || (filters.idn === "idn" ? item.idn : !item.idn));
    });
  }, [filters]);

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
        <div className="flex items-center gap-3"><span className="text-xs font-semibold text-slate-600">URL state updates automatically</span><Button variant="outline" onClick={clear}>Clear filters</Button></div>
      </div>

      {state === "loading" ? <LoadingState /> : state === "error" ? (
        <Card className="border-red-200 py-14 text-center"><CardContent><CircleAlert className="mx-auto mb-4 size-9 text-red-700" /><h2 className="text-lg font-bold">Explore is temporarily unavailable</h2><p className="mt-2 text-sm text-slate-700">The isolated research view failed safely; Command Center context and fixture evidence remain unchanged.</p><Link href="/tools/registry-intelligence-hub/explore" className="mt-5 inline-flex h-9 items-center rounded-lg bg-[#007d65] px-4 text-sm font-semibold text-white">Try again</Link></CardContent></Card>
      ) : state === "empty" || !rows.length ? (
        <Card className="border-dashed py-14 text-center"><CardContent><Database className="mx-auto mb-4 size-9 text-slate-500" /><h2 className="text-lg font-bold">No records match this research view</h2><p className="mt-2 text-sm text-slate-700">Clear or broaden one filter. Unknown values were not converted to zero.</p><Button className="mt-5 bg-[#007d65]" onClick={clear}>Clear filters</Button></CardContent></Card>
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] text-sm">
              <thead><tr className="border-b bg-slate-100 text-left text-xs uppercase tracking-wider text-slate-700"><th className="p-3">Record</th><th className="p-3">Applications</th><th className="p-3">Regions</th><th className="p-3">Participation</th><th className="p-3">Initial contention</th><th className="p-3">IDN</th><th className="p-3">Trust</th></tr></thead>
              <tbody>{rows.map((row) => {
                const returning = row.records.filter((item) => item.returning).length;
                const contention = row.records.filter((item) => item.contentionSet).length;
                const idn = row.records.filter((item) => item.idn).length;
                return <tr key={row.id} className="border-b last:border-0 hover:bg-emerald-50/50"><td className="p-3"><ProvenanceSheet id={`explore-${row.id}`} kind={filters.entity === "categories" ? "category" : filters.entity === "organizations" ? "applicant" : "metric"} label={row.name} records={row.records} triggerClassName="group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]" trigger={<><strong className="flex items-center gap-1 text-slate-950">{row.name}<ChevronRight className="size-4 text-[#007d65]" /></strong><span className="mt-1 block text-xs text-slate-600">{row.detail}</span></>} /></td><td className="p-3 font-mono font-bold">{row.records.length}</td><td className="p-3 text-slate-700">{[...new Set(row.records.map((item) => item.region))].join(", ")}</td><td className="p-3 text-slate-700">{returning ? `${returning} returning` : "New only"}</td><td className="p-3">{contention || "—"}</td><td className="p-3">{idn || "—"}</td><td className="p-3"><Badge variant="outline" className="border-emerald-300 text-[#005c49]">Source-backed</Badge></td></tr>;
              })}</tbody>
            </table>
          </div>
          <div className="divide-y md:hidden">{rows.map((row) => <ProvenanceSheet key={row.id} id={`explore-mobile-${row.id}`} kind={filters.entity === "categories" ? "category" : filters.entity === "organizations" ? "applicant" : "metric"} label={row.name} records={row.records} triggerClassName="group block w-full p-4 text-left hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#007d65]" trigger={<><span className="flex items-center justify-between"><strong>{row.name}</strong><ChevronRight className="size-4 text-[#007d65]" /></span><span className="mt-1 block text-xs text-slate-600">{row.detail}</span><span className="mt-3 flex gap-2 text-xs text-slate-700"><Badge variant="secondary">{row.records.length} applications</Badge><Badge variant="outline">{row.records.filter((item) => item.contentionSet).length} contested</Badge></span></>} />)}</div>
        </section>
      )}

      <footer className="mt-8 flex flex-col gap-2 border-t py-5 text-xs font-medium text-slate-600 sm:flex-row sm:justify-between"><span>Snapshot {registryFixture.snapshotId}</span><span>Field-level provenance · fixture coverage disclosed · no unavailable value shown as zero</span></footer>
    </main>
  );
}

export function CommandCenter({ state = "ready", view = "command", exploreParams = {} }: { state?: ViewState; view?: "command" | "explore"; exploreParams?: ExploreParams }) {
  const [query, setQuery] = useState("");
  const [lens, setLens] = useState("all");
  const [investigation, setInvestigation] = useState<InvestigationItem | null>(null);
  const [compareItems, setCompareItems] = useState<InvestigationItem[]>([]);
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => registryFixture.applications.filter((item) =>
    [item.string, item.applicant, item.organization, item.category].some((value) => value.toLowerCase().includes(query.toLowerCase()))
  ), [query]);
  const visibleInsights = useMemo(() => {
    const idsByLens: Record<string, string[]> = {
      all: standoutInsights.map((insight) => insight.id),
      commercial: ["portfolio-concentration", "contention-concentration"],
      strategy: ["contention-concentration", "idn-shift", "portfolio-concentration"],
      marketing: ["idn-shift", "portfolio-concentration"],
    };
    return standoutInsights.filter((insight) => idsByLens[lens].includes(insight.id));
  }, [lens]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key === "/" || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k")) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const controls: InvestigationContextValue = {
    investigate: setInvestigation,
    addCompare: (item) => setCompareItems((current) => current.some((entry) => entry.id === item.id) || current.length >= 2 ? current : [...current, item]),
    removeCompare: (id) => setCompareItems((current) => current.filter((item) => item.id !== id)),
    toggleWatch: (item) => setWatchedIds((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
      return next;
    }),
    compareItems,
    watchedIds,
  };

  return (
    <InvestigationContext.Provider value={controls}>
    <div className="min-h-screen bg-[#f4f6f8] pb-28 text-slate-950">
      <ShellHeader />
      <HubNav active={view === "explore" ? "Explore" : "Command Center"} />
      {view === "explore" ? <ExploreContent state={state} initial={exploreParams} /> : (
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
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block">
              <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
              <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search fixture records…" aria-label="Search fixture records" aria-keyshortcuts="/ Control+K Meta+K" className="h-9 w-full rounded-lg border border-slate-400 bg-white pl-9 pr-20 text-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-[#007d65] sm:w-80" />
              <kbd className="pointer-events-none absolute right-2 top-2 rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">/ · ⌘K</kbd>
            </label>
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
            {filtered.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((item) => <ProvenanceSheet key={item.id} id={`search-${item.id}`} kind="applicant" label={`.${item.string} · ${item.organization}`} records={[item]} triggerClassName="group rounded-lg border border-slate-300 p-3 text-left text-sm hover:border-[#007d65] hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]" trigger={<><span className="flex items-center justify-between"><strong>.{item.string}</strong><ChevronRight className="size-4 text-[#007d65]" /></span><span className="mt-1 block text-slate-700">{item.organization} · {item.category}</span></>} />)}</div> : <p className="py-5 text-center text-sm text-slate-700">No fixture records match “{query}”. Try an organization, string, or category.</p>}
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
                      return <ProvenanceSheet key={item.organization} id={`organization-${item.organization}`} kind="applicant" label={`${item.organization} portfolio`} records={records} triggerClassName="group grid w-full grid-cols-[28px_1fr_auto] items-center gap-3 rounded-lg p-2 text-left hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]" trigger={<><span className="font-mono text-xs text-slate-600">0{index + 1}</span><span><span className="flex items-center justify-between gap-4"><strong className="text-sm">{item.organization}</strong><strong className="text-sm">{item.count}</strong></span><span className="mt-2 block h-2 overflow-hidden rounded-full bg-slate-200"><span className="block h-full rounded-full bg-[#007d65]" style={{ width: `${(item.count / portfolioRanking[0].count) * 100}%` }} /></span></span><ChevronRight className="size-4 text-[#007d65]" /></>} />;
                    })}
                  </CardContent>
                </Card>

                <Card className="border-slate-300 lg:col-span-2">
                  <CardHeader><p className="text-xs font-bold tracking-wider text-slate-500">APPLICATION MIX</p><CardTitle className="text-lg">Interest by category</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    {categoryMix.map((item, index) => (
                      <ProvenanceSheet key={item.category} id={`category-${item.category}`} kind="category" label={`${item.category}: ${item.count} applications`} records={registryFixture.applications.filter((record) => record.category === item.category)} triggerClassName="group grid w-full grid-cols-[90px_1fr_38px] items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]" trigger={<><strong className="truncate text-sm">{item.category}</strong><span className="h-2.5 rounded-full bg-slate-200"><span className={`block h-full rounded-full ${index === 0 ? "bg-[#007d65]" : "bg-slate-600"}`} style={{ width: `${Math.max(item.percent, 12)}%` }} /></span><span className="flex items-center justify-end gap-1 font-mono text-xs font-bold">{item.count}<ChevronRight className="size-3 text-[#007d65]" /></span></>} />
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
