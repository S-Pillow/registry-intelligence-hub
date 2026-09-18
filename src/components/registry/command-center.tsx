"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Database,
  ExternalLink,
  FileClock,
  Info,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  categoryMix,
  portfolioRanking,
  registryFixture,
  roundPulse,
  standoutInsights,
  type Application,
} from "@/lib/registry-data";

type ViewState = "ready" | "loading" | "empty" | "error";

const navItems = ["Command Center", "Explore", "Compare", "Saved", "Briefings", "Data Health"];

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
                  <div key={item} className={`flex items-center justify-between rounded-lg px-3 py-3 text-sm ${index === 0 ? "bg-emerald-50 font-semibold text-[#006a56]" : "text-slate-400"}`}>
                    {item}{index !== 0 && <Badge variant="secondary">Planned</Badge>}
                  </div>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function HubNav() {
  return (
    <div className="border-b bg-white">
      <div className="mx-auto flex max-w-[1480px] items-center gap-1 overflow-x-auto px-4 sm:px-6">
        {navItems.map((item, index) => (
          <button
            key={item}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium ${index === 0 ? "border-[#007d65] text-[#006a56]" : "cursor-not-allowed border-transparent text-slate-400 opacity-70"}`}
            disabled={index !== 0}
            title={index === 0 ? undefined : "Planned for a later slice"}
          >
            {item}{index !== 0 && <span className="ml-1 text-[10px] font-normal uppercase tracking-wide">(planned)</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProvenanceSheet({ label, records }: { label: string; records?: readonly Application[] }) {
  return (
    <Sheet>
      <SheetTrigger
        className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]"
        aria-label={`View evidence for ${label}`}
      >
        <Info className="size-4" />
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto bg-white sm:max-w-lg">
        <SheetHeader className="border-b px-6 py-5">
          <Badge variant="outline" className="mb-2 border-emerald-200 text-[#006a56]">EVIDENCE & METHOD</Badge>
          <SheetTitle className="text-xl">{label}</SheetTitle>
          <SheetDescription>Trace this claim to its fixture records and deterministic method.</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-6 pb-8">
          <section>
            <h3 className="mb-3 text-xs font-bold tracking-wider text-slate-500">SOURCE SNAPSHOT</h3>
            <dl className="grid grid-cols-[110px_1fr] gap-y-3 text-sm">
              <dt className="text-slate-500">Evidence class</dt><dd className="font-medium">Authoritative fact (rehearsal copy)</dd>
              <dt className="text-slate-500">Source</dt><dd><a className="inline-flex items-center gap-1 text-[#006a56] underline" href={registryFixture.source.url} target="_blank" rel="noreferrer">{registryFixture.source.name}<ExternalLink className="size-3" /></a></dd>
              <dt className="text-slate-500">Snapshot ID</dt><dd className="break-all font-mono text-xs">{registryFixture.snapshotId}</dd>
              <dt className="text-slate-500">Retrieved</dt><dd>{new Date(registryFixture.retrievedAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC</dd>
              <dt className="text-slate-500">Parser</dt><dd className="font-mono text-xs">{registryFixture.parserVersion}</dd>
            </dl>
          </section>
          <section className="rounded-xl border bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><BarChart3 className="size-4 text-[#007d65]" />Transformation</div>
            <p className="text-sm leading-6 text-slate-600">Records are grouped and counted by deterministic TypeScript functions. Unknown values are never substituted with zero.</p>
            <code className="mt-3 block rounded bg-slate-900 p-3 text-xs text-emerald-200">{registryFixture.methodVersion}</code>
          </section>
          {records && (
            <section>
              <h3 className="mb-3 text-xs font-bold tracking-wider text-slate-500">SUPPORTING RECORDS · {records.length}</h3>
              <div className="space-y-2">
                {records.map((record) => (
                  <div key={record.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between"><span className="font-mono font-semibold">.{record.string}</span><Badge variant="secondary">{record.id}</Badge></div>
                    <p className="mt-1 text-slate-500">{record.organization} · {record.category}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <p>{registryFixture.limitations[0]}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MetricCards() {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-slate-200 shadow-sm md:grid-cols-3 xl:grid-cols-6">
      {roundPulse.map((metric) => (
        <button key={metric.id} className="group bg-white p-4 text-left transition hover:bg-emerald-50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]">
          <span className="flex items-center justify-between text-xs font-semibold text-slate-500">
            {metric.label}<ChevronRight className="size-4 opacity-0 transition group-hover:opacity-100" />
          </span>
          <span className="mt-3 block text-3xl font-semibold tracking-tight text-slate-950">{metric.value}</span>
          <span className="mt-1 block text-xs text-slate-500">{metric.delta}</span>
        </button>
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
        <p className="mt-2 text-sm leading-6 text-slate-500">{empty ? "The publication gate has not promoted a dataset. Existing tools remain unaffected." : "The rehearsal fixture could not be loaded. Try again or inspect Data Health."}</p>
        <Button className="mt-6 bg-[#007d65] hover:bg-[#006a56]" onClick={() => router.push("/tools/registry-intelligence-hub")}>{empty ? "View rehearsal fixture" : "Try again"}</Button>
      </CardContent>
    </Card>
  );
}

export function CommandCenter({ state = "ready" }: { state?: ViewState }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => registryFixture.applications.filter((item) =>
    [item.string, item.applicant, item.organization, item.category].some((value) => value.toLowerCase().includes(query.toLowerCase()))
  ), [query]);

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-slate-950">
      <ShellHeader />
      <HubNav />
      <main className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:py-8">
        <div className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-100 text-[#006a56]"><CheckCircle2 /> REHEARSAL READY</Badge>
              <span className="text-xs text-slate-500">Baseline {new Date(registryFixture.baselineAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</span>
              <ProvenanceSheet label="Dataset state" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Registry Intelligence Hub</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">A source-backed command center for understanding application portfolios, contention, categories, and cross-round signals.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block">
              <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search fixture records…" className="h-9 w-full rounded-lg border bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#007d65] sm:w-72" />
            </label>
            <Button variant="outline"><FileClock /> Reveal Day baseline</Button>
          </div>
        </div>

        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-700" />
          <div className="flex-1"><strong>Rehearsal data only.</strong> This curated fixture proves the experience and calculation contract; it is not an official 2026 publication.</div>
          <ProvenanceSheet label="Fixture limitations" />
        </div>

        {state === "ready" && query && (
          <section aria-live="polite" className="mb-6 rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Fixture search results</h2><Badge variant="secondary">{filtered.length} records</Badge></div>
            {filtered.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((item) => <div className="rounded-lg border p-3 text-sm" key={item.id}><strong>.{item.string}</strong><p className="mt-1 text-slate-500">{item.organization} · {item.category}</p></div>)}</div> : <p className="py-5 text-center text-sm text-slate-500">No fixture records match “{query}”. Try an organization, string, or category.</p>}
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

            <Tabs defaultValue="all" className="mt-8">
              <div className="flex flex-col justify-between gap-3 border-b pb-3 sm:flex-row sm:items-center">
                <div><p className="text-xs font-bold tracking-[0.14em] text-[#007d65]">CURATED LENS</p><h2 className="mt-1 text-xl font-semibold">All Intelligence</h2></div>
                <TabsList variant="default" className="max-w-full overflow-x-auto">
                  <TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="commercial">Commercial</TabsTrigger><TabsTrigger value="strategy">Product & Strategy</TabsTrigger><TabsTrigger value="marketing">Marketing</TabsTrigger>
                </TabsList>
              </div>
              {["all", "commercial", "strategy", "marketing"].map((lens) => (
                <TabsContent key={lens} value={lens} className="pt-6">
                  <div className="grid gap-6 lg:grid-cols-5">
                    <Card className="lg:col-span-3">
                      <CardHeader className="flex-row items-start justify-between">
                        <div><p className="text-xs font-bold tracking-wider text-slate-500">LARGEST PORTFOLIOS</p><CardTitle className="mt-1 text-lg">Application concentration</CardTitle></div>
                        <ProvenanceSheet label="Largest portfolios" records={registryFixture.applications} />
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {portfolioRanking.slice(0, 5).map((item, index) => (
                          <div key={item.organization} className="grid grid-cols-[28px_1fr_auto] items-center gap-3">
                            <span className="font-mono text-xs text-slate-400">0{index + 1}</span>
                            <div>
                              <div className="flex items-center justify-between gap-4"><span className="text-sm font-semibold">{item.organization}</span><span className="text-sm font-semibold">{item.count}</span></div>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#007d65]" style={{ width: `${(item.count / portfolioRanking[0].count) * 100}%` }} /></div>
                            </div>
                            <Badge variant="outline" className="hidden sm:inline-flex">{item.returning ? "Returning" : "New"}</Badge>
                          </div>
                        ))}
                        <button className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#006a56]">Explore organizations <ArrowRight className="size-4" /></button>
                      </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                      <CardHeader className="flex-row items-start justify-between">
                        <div><p className="text-xs font-bold tracking-wider text-slate-500">APPLICATION MIX</p><CardTitle className="mt-1 text-lg">Interest by category</CardTitle></div>
                        <ProvenanceSheet label="Application category mix" records={registryFixture.applications} />
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {categoryMix.map((item, index) => (
                          <div key={item.category} className="grid grid-cols-[90px_1fr_38px] items-center gap-3 text-sm">
                            <span className="truncate">{item.category}</span>
                            <div className="h-2 rounded-full bg-slate-100"><div className={`h-full rounded-full ${index === 0 ? "bg-[#007d65]" : "bg-slate-400"}`} style={{ width: `${Math.max(item.percent, 12)}%` }} /></div>
                            <span className="text-right font-mono text-xs">{item.count}</span>
                          </div>
                        ))}
                        <p className="pt-2 text-xs leading-5 text-slate-500">Market demand is <strong>not available</strong> pending source-rights review; no proxy is substituted.</p>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            <section className="mt-8">
              <div className="mb-4 flex items-end justify-between">
                <div><p className="flex items-center gap-1 text-xs font-bold tracking-[0.14em] text-[#007d65]"><Sparkles className="size-3.5" /> WHAT STANDS OUT</p><h2 className="mt-1 text-xl font-semibold">Signals worth investigating</h2></div>
                <span className="hidden text-xs text-slate-500 sm:block">Deterministic · 100% fixture coverage</span>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                {standoutInsights.map((insight) => (
                  <Card key={insight.id} className="group transition hover:-translate-y-0.5 hover:shadow-md">
                    <CardContent className="pt-6">
                      <div className="mb-4 flex items-start justify-between"><Badge variant="outline" className="text-[#006a56]">{insight.eyebrow}</Badge><ProvenanceSheet label={insight.title} records={insight.records} /></div>
                      <h3 className="text-lg font-semibold leading-6">{insight.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{insight.body}</p>
                      <div className="mt-5 flex items-center justify-between border-t pt-4 text-xs text-slate-500">
                        <span>{insight.confidence} confidence</span><button className="flex items-center gap-1 font-semibold text-[#006a56]">Inspect records <ChevronRight className="size-3" /></button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <footer className="mt-10 flex flex-col gap-4 border-t py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>Snapshot {registryFixture.snapshotId} · Method {registryFixture.methodVersion}</span>
              <span className="flex items-center gap-1"><BookOpen className="size-3.5" /> Catalog integration flag: <strong className="text-slate-700">disabled</strong></span>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
