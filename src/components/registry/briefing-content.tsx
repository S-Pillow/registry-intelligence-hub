"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CircleAlert,
  Copy,
  FileClock,
  History,
  Info,
  Pencil,
  Plus,
  Printer,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AUDIENCES,
  audienceLabel,
  availableSectionsForScope,
  BRIEFING_SECTION_ORDER,
  defaultDetailLevelForAudience,
  defaultEmphasisForAudience,
  defaultSectionsForScope,
  describeBriefingScope,
  type AudienceId,
  type BriefingClaim,
  type BriefingDefinition,
  type BriefingEdition,
  type BriefingScope,
  type BriefingSection,
  type BriefingSectionId,
  type DetailLevel,
  type EntryPath,
  type EvidenceRef,
  type TruthClass,
} from "@/lib/briefing-data";
import { listEntityOptions, type EntityType, type Lens } from "@/lib/registry-data";
import type { RegistryApplicationsDocument } from "@/lib/registry-applications-document";
import { useHubRegistryDocument } from "@/components/registry/hub-registry-data-provider";
import { summarizeChangeSinceVisit } from "@/lib/saved-change-summary";
import { useInvestigation } from "@/components/registry/investigation-context";
import { isHttpSourceUrl, withRehearsalPresentation, withholdSyntheticPresentation, type ProductPresentation } from "@/lib/presentation-mode";

type ViewState = "ready" | "loading" | "empty" | "error";

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });

function formatDateTime(iso: string) {
  return `${dateTimeFormatter.format(new Date(iso))} UTC`;
}

const STATUS_LABEL: Record<BriefingEdition["status"], string> = { draft: "Draft", finalized: "Finalized", superseded: "Superseded" };
const STATUS_BADGE_CLASS: Record<BriefingEdition["status"], string> = {
  draft: "border-sky-300 text-sky-800",
  finalized: "border-emerald-300 text-[#005c49]",
  superseded: "border-slate-300 text-slate-600",
};

const TRUTH_CLASS_LABEL: Record<TruthClass, string> = {
  "authoritative-fact": "Authoritative fact",
  "calculated-metric": "Calculated metric",
  "public-enrichment": "Public enrichment",
  "ai-assisted-inference": "AI-assisted inference",
  "human-reviewed-assertion": "Human-reviewed assertion",
};

const TRUTH_CLASS_LEGEND: { id: TruthClass; text: string }[] = [
  { id: "authoritative-fact", text: "Directly published by ICANN/IANA or another primary source." },
  { id: "calculated-metric", text: "Deterministic calculation over source-backed records — never AI." },
  { id: "public-enrichment", text: "Fact from a non-primary public source. Reserved — not used in this fixture." },
  { id: "ai-assisted-inference", text: "Classification/summary produced with AI assistance. Reserved for a future feature — nothing in this Briefing is AI-generated today." },
  { id: "human-reviewed-assertion", text: "Mapping reviewed by an authorized steward. Reserved — no review workflow exists yet." },
];

function RenameControl({ name, entityLabel, onRename }: { name: string; entityLabel: string; onRename: (next: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  if (editing) {
    return (
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onRename(value);
          setEditing(false);
        }}
      >
        <label className="sr-only" htmlFor={`briefing-rename-${entityLabel}`}>New name</label>
        <input id={`briefing-rename-${entityLabel}`} autoFocus value={value} onChange={(event) => setValue(event.target.value)} aria-label={`New name for ${name}`} className="h-8 w-48 rounded-lg border border-slate-400 px-2 text-sm outline-none focus:ring-2 focus:ring-[#007d65]" />
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
 * Opens the exact same, single `IntelligenceDrawer` every other provenance
 * trigger in the product opens (mounted once in `CommandCenter`, driven by
 * `useInvestigation().investigate`) — briefings-design.md §9's "one
 * provenance implementation across the whole product."
 */
function EvidenceButton({ evidence }: { evidence: EvidenceRef }) {
  const { investigate } = useInvestigation();
  const applications = useHubRegistryDocument().applications;
  const records = useMemo(() => applications.filter((record) => evidence.recordIds.includes(record.id)), [evidence, applications]);
  return (
    <button
      type="button"
      aria-label={`View intelligence for ${evidence.label}`}
      onClick={() => investigate({ id: evidence.investigationItemId, label: evidence.label, kind: "metric", records, entityType: evidence.entityType, entityKey: evidence.entityKey })}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]"
    >
      <Info className="size-3.5" />
    </button>
  );
}

/**
 * Every non-limitation section-provided claim renders its truth class /
 * confidence / method (level 1 of the three-level provenance model, §9) and
 * any structurally attached limitations (§8). Editing is only possible on a
 * Draft edition; `editable` is the single switch that governs every mutable
 * control here.
 */
function ClaimView({ claim, sectionId, edition, editable }: { claim: BriefingClaim; sectionId: BriefingSectionId; edition: BriefingEdition; editable: boolean }) {
  const { savedWork } = useInvestigation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(claim.text);
  const [showGenerated, setShowGenerated] = useState(false);
  const truncated = claim.text.length > 40 ? `${claim.text.slice(0, 40)}…` : claim.text;
  const linkedLimitations = claim.limitationRefs.map((id) => edition.limitations.find((limitation) => limitation.id === id)).filter((limitation): limitation is NonNullable<typeof limitation> => Boolean(limitation));

  if (editing) {
    return (
      <li className="rounded-lg border border-slate-300 bg-slate-50 p-3">
        <label className="sr-only" htmlFor={`claim-edit-${claim.id}`}>{`Edit claim: ${truncated}`}</label>
        <textarea
          id={`claim-edit-${claim.id}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          autoFocus
          className="w-full rounded-lg border border-slate-400 bg-white p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]"
        />
        <div className="mt-2 flex gap-2">
          <Button size="sm" className="bg-[#007d65] hover:bg-[#006a56]" onClick={() => { savedWork.editBriefingClaimText(edition.id, sectionId, claim.id, draft); setEditing(false); }}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => { setDraft(claim.text); setEditing(false); }}>Cancel</Button>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-slate-200 p-3 text-sm text-slate-800">
      <div className="flex items-start justify-between gap-2">
        <p className="flex-1 leading-6">{claim.text}</p>
        <div className="flex shrink-0 items-center gap-0.5">
          {claim.evidence.map((ref) => <EvidenceButton key={ref.investigationItemId} evidence={ref} />)}
          {editable && (
            <button type="button" aria-label={`Edit claim: ${truncated}`} onClick={() => { setDraft(claim.text); setEditing(true); }} className="inline-flex size-6 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]">
              <Pencil className="size-3.5" />
            </button>
          )}
          {editable && (
            <button type="button" aria-label={`Remove claim: ${truncated}`} onClick={() => savedWork.removeBriefingClaim(edition.id, sectionId, claim.id)} className="inline-flex size-6 items-center justify-center rounded-md text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]">
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide">
        {claim.userAdded ? (
          <Badge variant="outline" className="border-slate-400 text-slate-600">Unsupported — user-added, not evidence-backed</Badge>
        ) : (
          <>
            <Badge variant="outline" className="border-emerald-300 text-[#005c49]">{TRUTH_CLASS_LABEL[claim.truthClass]}</Badge>
            {claim.confidence && <Badge variant="outline" className="border-sky-300 text-sky-800">{claim.confidence} confidence</Badge>}
            {claim.method && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] normal-case text-slate-500">{claim.method}</span>}
          </>
        )}
        {claim.editedByUser && (
          <button type="button" className="normal-case font-semibold text-slate-500 underline" onClick={() => setShowGenerated((value) => !value)} aria-expanded={showGenerated}>
            {showGenerated ? "Hide generated version" : "View generated version"}
          </button>
        )}
      </div>
      {showGenerated && claim.editedByUser && <p className="mt-1.5 rounded bg-slate-50 p-2 text-xs italic text-slate-600">Originally generated: “{claim.generatedText}”</p>}
      {linkedLimitations.length > 0 && <p className="mt-1.5 text-xs text-slate-500">Depends on: {linkedLimitations.map((limitation) => limitation.text).join(" ")}</p>}
    </li>
  );
}

function SectionView({ section, edition, editable }: { section: BriefingSection; edition: BriefingEdition; editable: boolean }) {
  const { savedWork } = useInvestigation();
  const [expanded, setExpanded] = useState(false);
  const [addingClaim, setAddingClaim] = useState(false);
  const [newClaimText, setNewClaimText] = useState("");
  const visibleCount = section.claims.length - section.overflowCount;
  const visibleClaims = expanded ? section.claims : section.claims.slice(0, Math.max(visibleCount, 0));
  // No limitation is ever removable in this prototype — not by claim-deletion,
  // not by manual addition beside it, not by section-toggle (briefings-design.md §8).
  const isLimitationsSection = section.id === "limitations";
  const claimsEditable = editable && !isLimitationsSection;

  if (!section.included) return null;

  return (
    <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold text-slate-900">{section.title}</h2>
      {section.narrativeFrame && <p className="mt-2 rounded-lg bg-emerald-50 p-3 text-sm text-[#005c49]"><strong>Why this matters for this Briefing:</strong> {section.narrativeFrame}</p>}
      {section.claims.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">No applicable claims for this scope at this detail level — this reflects the underlying data, not a generation error.</p>
      ) : (
        <ul className="mt-3 space-y-2">{visibleClaims.map((claim) => <ClaimView key={claim.id} claim={claim} sectionId={section.id} edition={edition} editable={claimsEditable} />)}</ul>
      )}
      {section.overflowCount > 0 && !expanded && (
        <button type="button" className="mt-2 text-xs font-bold text-[#006a56] underline underline-offset-2" onClick={() => setExpanded(true)}>Show {section.overflowCount} more</button>
      )}
      {claimsEditable && (
        addingClaim ? (
          <form
            className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!newClaimText.trim()) return;
              savedWork.addBriefingUserClaim(edition.id, section.id, newClaimText);
              setNewClaimText("");
              setAddingClaim(false);
            }}
          >
            <label className="sr-only" htmlFor={`add-claim-${section.id}`}>New claim text for {section.title}</label>
            <input id={`add-claim-${section.id}`} value={newClaimText} onChange={(event) => setNewClaimText(event.target.value)} placeholder="Add a manual note (marked unsupported)" className="h-9 min-w-64 flex-1 rounded-lg border border-slate-400 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#007d65]" />
            <Button type="submit" size="sm" className="bg-[#007d65] hover:bg-[#006a56]">Add</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAddingClaim(false)}>Cancel</Button>
          </form>
        ) : (
          <Button size="sm" variant="ghost" className="mt-3" onClick={() => setAddingClaim(true)}><Plus />Add manual claim</Button>
        )
      )}
      <p className="mt-3 text-[11px] font-medium text-slate-500">{section.asOfNote}</p>
    </section>
  );
}

/** Drift disclosure reusing Saved's exact machinery (briefings-design.md §10) — computed live, never stored on the Edition. */
function BriefingDriftBanner({ definition, edition }: { definition: BriefingDefinition; edition: BriefingEdition }) {
  const { savedWork } = useInvestigation();
  const currentCount = savedWork.currentBriefingScopeCount(definition.scope);
  const change = summarizeChangeSinceVisit({
    lastOpenedAt: edition.generatedAt,
    recordedCount: edition.recordedScopeCount,
    currentCount,
    fixtureChangedAt: savedWork.fixtureChangedAt,
    subject: "supporting-record",
  });

  return (
    <div className={`rounded-lg border px-3 py-2.5 text-xs ${change.hasChanged ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
      <p className={`flex flex-wrap items-center gap-2 font-bold ${change.hasChanged ? "text-amber-900" : "text-slate-800"}`}>
        <History className="size-3.5 shrink-0" />
        <span>Last material change: {formatDateTime(change.lastMaterialChangeAt)}</span>
        {change.hasChanged && <Badge variant="outline" className="border-amber-400 bg-white text-amber-900">Source has changed since generation</Badge>}
      </p>
      <p className={`mt-1 ${change.hasChanged ? "text-amber-900" : "text-slate-700"}`}>{change.headline}. {change.detail}</p>
      {change.hasChanged && edition.status === "draft" && (
        <Button size="sm" variant="outline" className="mt-2 border-amber-400 bg-white text-amber-900 hover:bg-amber-100" onClick={() => savedWork.updateBriefingToCurrent(definition.id)}>
          Update to current
        </Button>
      )}
    </div>
  );
}

function buildPlainTextCopy(definition: BriefingDefinition, edition: BriefingEdition, registry?: RegistryApplicationsDocument): string {
  const lines: string[] = [];
  if (registry?.source.evidenceClass === "synthetic-rehearsal") {
    lines.push(
      "DEMO / REHEARSAL — synthetic data, not an ICANN publication",
      `Source: ${registry.source.name}`,
      "Evidence class: synthetic / rehearsal",
      "",
    );
  }
  lines.push(
    definition.name,
    `Scope: ${describeBriefingScope(definition.scope, registry)}`,
    `Audience: ${audienceLabel(definition.audience)} · Emphasis: ${definition.emphasis} · Detail: ${definition.detailLevel}`,
    `Generated ${formatDateTime(edition.generatedAt)} · Data as of ${formatDateTime(edition.dataAsOfTime)} · Snapshot ${edition.snapshotId} · Method ${edition.methodVersion}`,
    "",
  );
  for (const section of edition.sections) {
    if (!section.included) continue;
    lines.push(section.title.toUpperCase());
    if (section.narrativeFrame) lines.push(section.narrativeFrame);
    for (const claim of section.claims) lines.push(`- ${claim.text}`);
    lines.push("");
  }
  return lines.join("\n");
}

function BriefingWorkspace({ id, presentation }: { id: string; presentation: ProductPresentation }) {
  const registryFixture = useHubRegistryDocument();
  const { savedWork } = useInvestigation();
  const definition = savedWork.briefingDefinitions.find((entry) => entry.id === id);
  const edition = definition ? savedWork.briefingEditions.find((entry) => entry.id === definition.currentEditionId) : undefined;
  const [deleted, setDeleted] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const openedRef = useRef<string | null>(null);

  useEffect(() => {
    if (definition && openedRef.current !== definition.id) {
      openedRef.current = definition.id;
      savedWork.markBriefingOpened(definition.id);
    }
  }, [definition, savedWork]);

  if (deleted) {
    return (
      <main className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:py-8">
        <Card className="border-dashed py-14 text-center">
          <CardContent>
            <FileClock className="mx-auto mb-4 size-9 text-slate-500" />
            <h2 className="text-lg font-bold">Briefing deleted</h2>
            <Link href={withRehearsalPresentation("/briefings", presentation)} className="mt-5 inline-flex h-9 items-center rounded-lg bg-[#007d65] px-4 text-sm font-semibold text-white">Back to Briefings</Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!definition || !edition) {
    return (
      <main className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:py-8">
        <Card className="border-dashed py-14 text-center">
          <CardContent>
            <CircleAlert className="mx-auto mb-4 size-9 text-slate-500" />
            <h2 className="text-lg font-bold">Briefing not found</h2>
            <p className="mt-2 text-sm text-slate-700">It may have been deleted, or the link is out of date.</p>
            <Link href={withRehearsalPresentation("/briefings", presentation)} className="mt-5 inline-flex h-9 items-center rounded-lg bg-[#007d65] px-4 text-sm font-semibold text-white">Back to Briefings</Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const editable = edition.status === "draft";
  const orderedSections = [...edition.sections].sort((a, b) => BRIEFING_SECTION_ORDER.indexOf(a.id) - BRIEFING_SECTION_ORDER.indexOf(b.id));

  return (
    <main className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:py-8">
      <Link href={withRehearsalPresentation("/briefings", presentation)} className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#006a56] hover:underline"><ArrowLeft className="size-3.5" />Back to Briefings</Link>

      <Card className="mb-5 border-slate-300">
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl">{definition.name}</CardTitle>
              <Badge variant="outline" className={STATUS_BADGE_CLASS[edition.status]}>{STATUS_LABEL[edition.status]}</Badge>
            </div>
            <p className="mt-2 text-sm text-slate-700">{describeBriefingScope(definition.scope, registryFixture)}</p>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-semibold text-slate-600">
              <span>{audienceLabel(definition.audience)}</span>
              <span>Emphasis: {definition.emphasis}</span>
              <span>Detail: {definition.detailLevel}</span>
            </p>
            <p className="mt-2 text-xs text-slate-500">Generated {formatDateTime(edition.generatedAt)} · Data as of {formatDateTime(edition.dataAsOfTime)}</p>
            <p className="text-xs text-slate-500">Snapshot {edition.snapshotId} · Method {edition.methodVersion}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div data-testid="briefing-rehearsal-banner" className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950"><ShieldCheck className="size-4 shrink-0" />{registryFixture.source.evidenceClass === "synthetic-rehearsal" ? "Demo / Rehearsal — synthetic data, not an ICANN publication. Copied text keeps this identification." : `Promoted snapshot ${registryFixture.snapshotId}.`}</div>
          <BriefingDriftBanner definition={definition} edition={edition} />
          {edition.status === "superseded" && edition.supersededByEditionId && (
            <p className="text-xs font-semibold text-slate-600">
              Superseded by a newer edition — this is a read-only historical record.{" "}
              <Link href={withRehearsalPresentation(`/briefings/${definition.id}`, presentation)} className="underline">Open the current edition</Link>.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          {orderedSections.map((section) => <SectionView key={section.id} section={section} edition={edition} editable={editable} />)}
        </div>

        <aside className="space-y-4">
          <Card className="border-slate-300">
            <CardContent className="space-y-3 pt-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Sections</h3>
              <ul className="space-y-1.5">
                {edition.sections.map((section) => {
                  const isLimitations = section.id === "limitations";
                  return (
                    <li key={section.id}>
                      <label className="flex items-center gap-2 text-sm text-slate-800">
                        <input
                          type="checkbox"
                          checked={isLimitations ? true : section.included}
                          disabled={!editable || isLimitations}
                          onChange={() => savedWork.toggleBriefingSectionIncluded(edition.id, section.id)}
                          className="size-4 rounded border-slate-400"
                        />
                        {section.title}{isLimitations && <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">(always included)</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>

              <h3 className="pt-2 text-xs font-bold uppercase tracking-wider text-slate-600">Next regeneration&apos;s detail level</h3>
              <select
                aria-label="Detail level for next regeneration"
                value={definition.detailLevel}
                onChange={(event) => savedWork.setBriefingDetailLevel(definition.id, event.target.value as DetailLevel)}
                className="h-9 w-full rounded-lg border border-slate-400 bg-white px-2 text-sm"
              >
                <option value="brief">Brief</option>
                <option value="standard">Standard</option>
                <option value="deep">Deep</option>
              </select>
              <p className="text-[11px] text-slate-500">Takes effect on the next “Update to current” — this Draft&apos;s already-generated claims are unaffected.</p>

              <div className="space-y-2 pt-2">
                <Button className="w-full bg-[#007d65] hover:bg-[#006a56]" onClick={() => savedWork.updateBriefingToCurrent(definition.id)}><History />Update to current</Button>
                {editable && <Button variant="outline" className="w-full" onClick={() => savedWork.finalizeBriefingEdition(edition.id)}>Finalize</Button>}
                {!editable && <p className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">{edition.status === "finalized" ? "Finalized — locked against further edits." : "Superseded — read-only historical record."} Use “Update to current” for an editable Draft.</p>}
              </div>

              <div className="flex flex-wrap items-center gap-1 pt-2">
                <Button size="sm" variant="ghost" onClick={() => savedWork.duplicateBriefing(definition.id)}><Copy />Duplicate</Button>
                <RenameControl name={definition.name} entityLabel={definition.id} onRename={(next) => savedWork.renameBriefing(definition.id, next)} />
                <DeleteControl name={definition.name} onConfirm={() => { savedWork.deleteBriefing(definition.id); setDeleted(true); }} />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => window.print()}><Printer />Print</Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const text = buildPlainTextCopy(definition, edition, registryFixture);
                    try {
                      await navigator.clipboard?.writeText(text);
                      setCopyStatus("Copied as plain text.");
                    } catch {
                      setCopyStatus("Could not access the clipboard.");
                    }
                  }}
                >
                  <Copy />Copy as plain text
                </Button>
              </div>
              {copyStatus && <p role="status" className="text-xs font-semibold text-[#005c49]">{copyStatus}</p>}
            </CardContent>
          </Card>

          <Card className="border-slate-300">
            <CardContent className="space-y-2 pt-5 text-xs text-slate-700">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Sources &amp; Methodology</h3>
              {isHttpSourceUrl(registryFixture.source.url) ? (
                <p>{registryFixture.source.name} — <a href={registryFixture.source.url} className="underline" target="_blank" rel="noreferrer">{registryFixture.source.url}</a></p>
              ) : (
                <p data-testid="briefing-source-name">Source: {registryFixture.source.name}</p>
              )}
              {registryFixture.source.evidenceClass === "synthetic-rehearsal" ? (
                <p data-testid="briefing-evidence-class">Evidence class: synthetic / rehearsal</p>
              ) : null}
              <p>Retrieved {formatDateTime(registryFixture.retrievedAt)} · Snapshot {edition.snapshotId} · Method {edition.methodVersion}</p>
              <ul className="space-y-1 pt-1">
                {TRUTH_CLASS_LEGEND.map((entry) => (
                  <li key={entry.id}><strong className="text-slate-800">{TRUTH_CLASS_LABEL[entry.id]}:</strong> {entry.text}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}

type ScopeChoice = "round-wide" | "entity" | "watchlist" | "saved-research" | "compare-selection";

const EMPHASIS_LABEL: Record<Lens, string> = { all: "All", commercial: "Commercial", strategy: "Strategy", marketing: "Marketing" };
const DETAIL_LEVEL_LABEL: Record<DetailLevel, string> = { brief: "Brief", standard: "Standard", deep: "Deep" };
const ENTITY_TYPE_LABEL: Record<EntityType, string> = { organizations: "Organizations", applications: "Applications", categories: "Categories" };

/**
 * Every wizard step of "New Briefing" is a full, real cancel point
 * (briefings-design.md addendum: contained UX correction). Step 1 has made
 * no meaningful commitment yet, so Cancel and Esc discard immediately.
 * Steps 2–3 have already committed to a scope, so Cancel and Esc show a
 * lightweight confirmation instead of silently discarding a real choice.
 */
function GuidedBriefingForm({ onGenerated, onCancel }: { onGenerated: (definitionId: string) => void; onCancel: () => void }) {
  const { savedWork, compareItems } = useInvestigation();
  const registryDocument = useHubRegistryDocument();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [scopeChoice, setScopeChoice] = useState<ScopeChoice>("round-wide");
  const [entityType, setEntityType] = useState<EntityType>("organizations");
  const [entityKey, setEntityKey] = useState("");
  const [watchlistId, setWatchlistId] = useState("");
  const [savedResearchId, setSavedResearchId] = useState("");
  const [audience, setAudience] = useState<AudienceId>("executive");
  const [emphasis, setEmphasis] = useState<Lens>("all");
  const [detailLevel, setDetailLevel] = useState<DetailLevel>("brief");
  const [sections, setSections] = useState<Set<BriefingSectionId>>(new Set(defaultSectionsForScope("round-wide")));
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [openMenuCount, setOpenMenuCount] = useState(0);

  const entityOptions = useMemo(
    () => listEntityOptions(entityType, registryDocument.applications),
    [entityType, registryDocument.applications],
  );
  const compareSelectionAvailable = compareItems.length >= 2 && Boolean(compareItems[0].entityType);

  const requestCancel = useCallback(() => {
    if (step > 1) {
      setConfirmDiscardOpen(true);
    } else {
      onCancel();
    }
  }, [step, onCancel]);

  // Esc must behave exactly like Cancel — but never while a Select popup or
  // the discard-confirmation dialog is open; those overlays own Esc via
  // their own standard close behavior (closing just the overlay, not the
  // wizard). The listener is only attached at all while nothing else is
  // open, so it can never race a popup's own Escape handling.
  useEffect(() => {
    if (openMenuCount > 0 || confirmDiscardOpen) return undefined;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      requestCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [openMenuCount, confirmDiscardOpen, requestCancel]);

  const onMenuOpenChange = useCallback((open: boolean) => setOpenMenuCount((count) => count + (open ? 1 : -1)), []);

  const scopeForChoice = (): BriefingScope | null => {
    if (scopeChoice === "round-wide") return { kind: "round-wide" };
    if (scopeChoice === "entity") {
      const option = entityOptions.find((entry) => entry.key === entityKey);
      return option ? { kind: "entity", entityType, entityKey, label: option.label } : null;
    }
    if (scopeChoice === "watchlist") {
      const list = savedWork.watchlists.find((entry) => entry.id === watchlistId);
      return list ? { kind: "watchlist", watchlistId: list.id, watchlistName: list.name } : null;
    }
    if (scopeChoice === "saved-research") {
      const entry = savedWork.savedResearch.find((research) => research.id === savedResearchId);
      return entry ? { kind: "saved-research", savedResearchId: entry.id, savedResearchName: entry.name } : null;
    }
    if (scopeChoice === "compare-selection" && compareSelectionAvailable) {
      const type = compareItems[0].entityType!;
      return { kind: "compare-config", params: { type, ids: compareItems.map((item) => item.entityKey ?? "").filter(Boolean).join(",") } };
    }
    return null;
  };

  const scopeKindForChoice: BriefingScope["kind"] = scopeChoice === "compare-selection" ? "compare-config" : scopeChoice;
  const availableSections = useMemo(() => [...availableSectionsForScope(scopeKindForChoice)].sort((a, b) => BRIEFING_SECTION_ORDER.indexOf(a) - BRIEFING_SECTION_ORDER.indexOf(b)), [scopeKindForChoice]);

  const scope = scopeForChoice();
  const canGenerate = Boolean(scope) && sections.size > 0;

  const sectionTitle: Record<BriefingSectionId, string> = {
    "headline-metrics": "Headline metrics",
    "what-stands-out": "What stands out",
    "comparison-table": "Comparison",
    "watchlist-summary": "Watchlist summary",
    "saved-research-summary": "Saved research summary",
    limitations: "Limitations (always included)",
  };

  return (
    <Card className="border-slate-300">
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">New Briefing — step {step} of 3</p>
          <button type="button" aria-label="Cancel New Briefing" onClick={requestCancel} className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]">
            <X className="size-4" />
          </button>
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">1. Scope</h3>
            <div className="flex flex-wrap gap-2">
              {(["round-wide", "entity", "watchlist", "saved-research", "compare-selection"] as ScopeChoice[]).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  disabled={choice === "compare-selection" && !compareSelectionAvailable}
                  aria-pressed={scopeChoice === choice}
                  onClick={() => { setScopeChoice(choice); setSections(new Set(defaultSectionsForScope(choice === "compare-selection" ? "compare-config" : choice))); }}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${scopeChoice === choice ? "border-[#007d65] bg-[#007d65] text-white" : "border-slate-300 bg-white text-slate-700"}`}
                >
                  {choice === "round-wide" ? "Round-wide" : choice === "entity" ? "Entity" : choice === "watchlist" ? "Watchlist" : choice === "saved-research" ? "Saved Research" : "Current Compare selection"}
                </button>
              ))}
            </div>

            {scopeChoice === "entity" && (
              <div className="flex flex-wrap gap-2">
                <Select value={entityType} onValueChange={(value) => { setEntityType(value as EntityType); setEntityKey(""); }} onOpenChange={onMenuOpenChange}>
                  <SelectTrigger aria-label="Entity type" className="h-9 bg-white">
                    <SelectValue>{(value: EntityType | null) => (value ? ENTITY_TYPE_LABEL[value] : "Choose one…")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="organizations">Organizations</SelectItem>
                    <SelectItem value="applications">Applications</SelectItem>
                    <SelectItem value="categories">Categories</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={entityKey || null} onValueChange={(value) => setEntityKey(value ?? "")} onOpenChange={onMenuOpenChange}>
                  <SelectTrigger aria-label="Entity" className="h-9 min-w-56 bg-white">
                    <SelectValue placeholder="Choose one…">{(value: string | null) => entityOptions.find((option) => option.key === value)?.label ?? "Choose one…"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {entityOptions.map((option) => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scopeChoice === "watchlist" && (
              savedWork.watchlists.length === 0 ? <p className="text-sm text-slate-600">No watchlists yet.</p> : (
                <Select value={watchlistId || null} onValueChange={(value) => setWatchlistId(value ?? "")} onOpenChange={onMenuOpenChange}>
                  <SelectTrigger aria-label="Watchlist" className="h-9 min-w-56 bg-white">
                    <SelectValue placeholder="Choose one…">{(value: string | null) => savedWork.watchlists.find((list) => list.id === value)?.name ?? "Choose one…"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {savedWork.watchlists.map((list) => <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )
            )}

            {scopeChoice === "saved-research" && (
              savedWork.savedResearch.length === 0 ? <p className="text-sm text-slate-600">No saved research yet.</p> : (
                <Select value={savedResearchId || null} onValueChange={(value) => setSavedResearchId(value ?? "")} onOpenChange={onMenuOpenChange}>
                  <SelectTrigger aria-label="Saved research" className="h-9 min-w-56 bg-white">
                    <SelectValue placeholder="Choose one…">{(value: string | null) => savedWork.savedResearch.find((entry) => entry.id === value)?.name ?? "Choose one…"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {savedWork.savedResearch.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )
            )}

            {scopeChoice === "compare-selection" && !compareSelectionAvailable && <p className="text-sm text-slate-600">Select at least two like entities in Compare first.</p>}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={onCancel}>Cancel</Button>
              <Button disabled={!scope} onClick={() => setStep(2)}>Next</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">2. Audience, emphasis, and detail level</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-bold text-slate-700">Audience
                <Select
                  value={audience}
                  onValueChange={(value) => { const nextAudience = value as AudienceId; setAudience(nextAudience); setEmphasis(defaultEmphasisForAudience(nextAudience)); setDetailLevel(defaultDetailLevelForAudience(nextAudience)); }}
                  onOpenChange={onMenuOpenChange}
                >
                  <SelectTrigger aria-label="Audience" className="mt-1 block h-9 w-full bg-white">
                    <SelectValue>{(value: AudienceId) => audienceLabel(value)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIENCES.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
              <label className="text-xs font-bold text-slate-700">Emphasis
                <Select value={emphasis} onValueChange={(value) => setEmphasis(value as Lens)} onOpenChange={onMenuOpenChange}>
                  <SelectTrigger aria-label="Emphasis" className="mt-1 block h-9 w-full bg-white">
                    <SelectValue>{(value: Lens) => EMPHASIS_LABEL[value]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="strategy">Strategy</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="text-xs font-bold text-slate-700">Detail level
                <Select value={detailLevel} onValueChange={(value) => setDetailLevel(value as DetailLevel)} onOpenChange={onMenuOpenChange}>
                  <SelectTrigger aria-label="Detail level" className="mt-1 block h-9 w-full bg-white">
                    <SelectValue>{(value: DetailLevel) => DETAIL_LEVEL_LABEL[value]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brief">Brief</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="deep">Deep</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </div>
            <div className="flex justify-between">
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                <Button variant="ghost" onClick={requestCancel}>Cancel</Button>
              </div>
              <Button onClick={() => setStep(3)}>Next</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">3. Sections</h3>
            <ul className="space-y-1.5">
              {availableSections.map((sectionId) => (
                <li key={sectionId}>
                  <label className="flex items-center gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      checked={sections.has(sectionId)}
                      disabled={sectionId === "limitations"}
                      onChange={() => setSections((current) => { const next = new Set(current); if (next.has(sectionId)) next.delete(sectionId); else next.add(sectionId); return next; })}
                      className="size-4 rounded border-slate-400"
                    />
                    {sectionTitle[sectionId]}
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex justify-between">
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
                <Button variant="ghost" onClick={requestCancel}>Cancel</Button>
              </div>
              <Button
                disabled={!canGenerate}
                className="bg-[#007d65] hover:bg-[#006a56]"
                onClick={() => {
                  if (!scope) return;
                  const created = savedWork.createBriefing({
                    name: `Briefing: ${describeBriefingScope(scope, registryDocument)}`.slice(0, 80),
                    entryPath: "guided",
                    audience,
                    emphasis,
                    detailLevel,
                    sectionsWanted: [...sections],
                    scope,
                  });
                  onGenerated(created.definition.id);
                }}
              >
                Generate
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this briefing draft?</AlertDialogTitle>
            <AlertDialogDescription>Your scope, audience, emphasis, and section choices for this New Briefing will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { setConfirmDiscardOpen(false); onCancel(); }}>Discard draft</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function BriefingCard({ definition, presentation }: { definition: BriefingDefinition; presentation: ProductPresentation }) {
  const { savedWork } = useInvestigation();
  const registryDocument = useHubRegistryDocument();
  const edition = savedWork.briefingEditions.find((entry) => entry.id === definition.currentEditionId);
  if (!edition) return null;

  return (
    <Card className="border-slate-300">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">{definition.name}</CardTitle>
            <Badge variant="outline" className={STATUS_BADGE_CLASS[edition.status]}>{STATUS_LABEL[edition.status]}</Badge>
            <Badge variant="outline" className="border-slate-300 text-slate-600">{audienceLabel(definition.audience)}</Badge>
          </div>
          <p className="mt-1.5 text-xs text-slate-700">{describeBriefingScope(definition.scope, registryDocument)}</p>
          <p className="mt-1 text-xs text-slate-500">Last opened {formatDateTime(definition.lastOpenedAt)} · Generated {formatDateTime(edition.generatedAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Link href={withRehearsalPresentation(`/briefings/${definition.id}`, presentation)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#007d65] px-2.5 text-xs font-bold text-white hover:bg-[#006a56]"><FileClock className="size-3.5" />Open</Link>
          <Button size="sm" variant="ghost" onClick={() => savedWork.duplicateBriefing(definition.id)}><Copy />Duplicate</Button>
          <RenameControl name={definition.name} entityLabel={definition.id} onRename={(next) => savedWork.renameBriefing(definition.id, next)} />
          <DeleteControl name={definition.name} onConfirm={() => savedWork.deleteBriefing(definition.id)} />
        </div>
      </CardHeader>
      <CardContent>
        <BriefingDriftBanner definition={definition} edition={edition} />
      </CardContent>
    </Card>
  );
}

/**
 * Opening "New Briefing" pushes one history checkpoint so browser Back
 * closes the wizard and lands back on this same Briefings list (with its
 * scroll position naturally intact, since the list stays mounted underneath
 * the wizard the whole time) instead of navigating away from Briefings
 * entirely. Closing the wizard any other way (Cancel, Esc, Generate) calls
 * `history.back()` itself to consume that checkpoint, so a normal Cancel
 * never leaves a dangling entry that would otherwise require two Back
 * presses to leave the page.
 */
function BriefingsHub({ presentation }: { presentation: ProductPresentation }) {
  const { savedWork } = useInvestigation();
  const [creating, setCreating] = useState(false);
  const wizardHistoryPushedRef = useRef(false);

  const openWizard = useCallback(() => {
    window.history.pushState({ briefingsNewWizardOpen: true }, "", window.location.href);
    wizardHistoryPushedRef.current = true;
    setCreating(true);
  }, []);

  const closeWizard = useCallback(() => {
    setCreating(false);
    if (wizardHistoryPushedRef.current) {
      wizardHistoryPushedRef.current = false;
      window.history.back();
    }
  }, []);

  useEffect(() => {
    function handlePopState() {
      wizardHistoryPushedRef.current = false;
      setCreating(false);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  if (!savedWork.hydrated) {
    return <div className="space-y-3">{Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-700">Briefings turn an existing scope — round-wide, an entity, a Watchlist, Saved Research, or a Compare selection — into a concise, editable, source-backed presentation. Nothing here is computed that isn&apos;t already visible elsewhere in the product.</p>
        {!creating && <Button className="bg-[#007d65] hover:bg-[#006a56]" onClick={openWizard}><Plus />New Briefing</Button>}
      </div>

      {creating && <GuidedBriefingForm onGenerated={closeWizard} onCancel={closeWizard} />}

      {savedWork.briefingDefinitions.length === 0 ? (
        <Card className="border-dashed py-12 text-center">
          <CardContent>
            <FileClock className="mx-auto mb-4 size-9 text-slate-500" />
            <h3 className="text-lg font-bold">No Briefings yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-700">Try <strong>Instant Briefing</strong> from Command Center, <strong>Brief this view</strong> from Explore or Compare, or <strong>New Briefing</strong> above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">{savedWork.briefingDefinitions.map((definition) => <BriefingCard key={definition.id} definition={definition} presentation={presentation} />)}</div>
      )}
    </div>
  );
}

export function BriefingsContent({ state, briefingId, presentation = "pre-reveal" }: { state: ViewState; briefingId?: string; presentation?: ProductPresentation }) {
  const { savedWork } = useInvestigation();
  const registryFixture = useHubRegistryDocument();
  const withhold = withholdSyntheticPresentation(presentation, registryFixture.payloadMode);

  return (
    <main className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:py-8">
      {!briefingId && (
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">Communication layer</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Briefings</h1>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950"><ShieldCheck className="size-4 shrink-0" />{registryFixture.payloadMode === "promoted-2026" ? `Promoted snapshot ${registryFixture.snapshotId} · local browser storage only` : presentation === "rehearsal" ? "Demo / Rehearsal — synthetic data, not an ICANN publication" : "Pre-Reveal — 2026 public application data has not been promoted"}</div>
        </div>
      )}

      {state === "loading" ? (
        <div className="space-y-3">{Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-xl" />)}</div>
      ) : state === "error" ? (
        <Card className="border-red-200 py-14 text-center"><CardContent><CircleAlert className="mx-auto mb-4 size-9 text-red-700" /><h2 className="text-lg font-bold">Briefings is temporarily unavailable</h2><p className="mt-2 text-sm text-slate-700">Your Watchlist, Saved Research, and other Briefings are unaffected.</p><Link href={withRehearsalPresentation("/briefings", presentation)} className="mt-5 inline-flex h-9 items-center rounded-lg bg-[#007d65] px-4 text-sm font-semibold text-white">Try again</Link></CardContent></Card>
      ) : withhold ? (
        <BriefingsPreRevealState hydrated={savedWork.hydrated} storedCount={savedWork.briefingDefinitions.length} opened={Boolean(briefingId)} />
      ) : briefingId ? (
        <BriefingWorkspace id={briefingId} presentation={presentation} />
      ) : (
        <BriefingsHub presentation={presentation} />
      )}

      {!briefingId && (
        <footer className="mt-8 flex flex-col gap-2 border-t py-5 text-xs font-medium text-slate-600 sm:flex-row sm:justify-between">
          <span>{withhold ? "No 2026 snapshot promoted" : registryFixture.payloadMode === "promoted-2026" ? `Promoted snapshot ${registryFixture.snapshotId}` : `Demo / Rehearsal snapshot ${registryFixture.snapshotId}`} · {withhold ? "stored briefings withheld" : `${savedWork.briefingDefinitions.length} briefing${savedWork.briefingDefinitions.length === 1 ? "" : "s"}`}</span>
          <span>Storage: browser-local only · not yet identity-backed</span>
        </footer>
      )}
    </main>
  );
}

/**
 * The one shared entry-point control for all three paths (briefings-design.md
 * §3): Instant (round-wide/entity, zero configuration), Brief Current View
 * (contextual, on Explore/Compare/Saved Research). Generates immediately and
 * shows an inline confirmation with a link into the Preview workspace —
 * the exact interaction convention `SaveResearchButton` already established.
 */
function BriefingsPreRevealState({ hydrated, storedCount, opened }: { hydrated: boolean; storedCount: number; opened: boolean }) {
  return (
    <div className="space-y-4">
      <Card className="border-slate-300 bg-white shadow-sm" data-testid="pre-reveal-waiting">
        <CardContent className="py-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#006a56]">Pre-Reveal</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">{opened ? "This briefing is withheld" : "2026 briefings are waiting for publication"}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">Briefings are not generated from synthetic 2026 entities in the default product. Copied text cannot leave this page with rehearsal names. This is not an error. Demo / Rehearsal can still generate briefings, and that mode stays labeled.</p>
        </CardContent>
      </Card>
      {hydrated && storedCount > 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950" data-testid="briefing-rehearsal-quarantine">
          {storedCount} browser-local briefing{storedCount === 1 ? "" : "s"} from Demo / Rehearsal {storedCount === 1 ? "is" : "are"} withheld. Their text is not shown or copied here.
        </p>
      ) : null}
    </div>
  );
}

export function BriefThisButton({
  scope,
  label,
  defaultName,
  disabled,
  disabledTitle,
  entryPath,
  emphasis,
  audience,
  icon,
  variant = "outline",
  className,
}: {
  scope: BriefingScope;
  label: string;
  defaultName: string;
  disabled?: boolean;
  disabledTitle?: string;
  entryPath: EntryPath;
  /** When set (e.g. from Command Center lens), briefing content matches the active View. */
  emphasis?: Lens;
  audience?: AudienceId;
  icon?: ReactNode;
  variant?: "outline" | "default" | "ghost";
  className?: string;
}) {
  const { savedWork, presentation } = useInvestigation();
  const registryFixture = useHubRegistryDocument();
  const [createdId, setCreatedId] = useState<string | null>(null);
  const withholdGeneration = withholdSyntheticPresentation(presentation, registryFixture.payloadMode);

  if (createdId) {
    return (
      <p role="status" className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#005c49]">
        Briefing generated. <Link href={withRehearsalPresentation(`/briefings/${createdId}`, presentation)} className="underline">Open Briefing</Link>
        <button type="button" className="text-slate-500 underline" onClick={() => setCreatedId(null)}>Dismiss</button>
      </p>
    );
  }

  if (withholdGeneration) {
    return (
      <Button variant={variant} disabled title="Briefings from 2026 applications are unavailable until Reveal Day data is promoted." className={className}>
        {icon ?? <FileClock />}{label}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      disabled={disabled}
      title={disabled && disabledTitle ? disabledTitle : undefined}
      className={className}
      onClick={() => {
        const created = savedWork.createBriefing({
          name: defaultName,
          entryPath,
          audience: audience ?? "executive",
          emphasis,
          sectionsWanted: defaultSectionsForScope(scope.kind),
          scope,
        });
        setCreatedId(created.definition.id);
      }}
    >
      {icon ?? <FileClock />}{label}
    </Button>
  );
}
