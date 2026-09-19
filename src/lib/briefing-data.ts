import { participationStatusCellForApplication } from "@/comparison/compare-dimensions";
import {
  applicantsToWatch,
  compareSectionLabel,
  compareSectionOrder,
  describeCompareSelection,
  describeExploreFilters,
  formatCompareCellForSummary,
  groupCompareRowsBySection,
  lensInterpretations,
  listEntityOptions,
  recordsForEntity,
  recordsForParams,
  registryFixture,
  roundPulse,
  standoutInsightsForLens,
  summarizeCompareDifferences,
  type Application,
  type CompareCellLike,
  type CompareRowLike,
  type EntityType,
  type Lens,
} from "@/lib/registry-data";
import { generateSavedId } from "@/lib/saved-storage";

/**
 * Briefings' four audiences, mapped 1:1 onto Command Center's existing lens
 * vocabulary (briefings-design.md §4) rather than inventing a parallel
 * taxonomy. "Executive" is the one audience without a dedicated lens — it
 * reads the cross-lens ("all") summary, terse by default.
 */
export type AudienceId = "executive" | "commercial" | "product-strategy" | "marketing";
export type DetailLevel = "brief" | "standard" | "deep";
export type EntryPath = "instant" | "guided" | "current-view";
export type EditionStatus = "draft" | "finalized" | "superseded";

export type BriefingSectionId =
  | "headline-metrics"
  | "what-stands-out"
  | "comparison-table"
  | "watchlist-summary"
  | "saved-research-summary"
  | "limitations";

/** Canonical, fixed rendering order — sections are not user-reorderable in v1 (briefings-design.md §8). */
export const BRIEFING_SECTION_ORDER: BriefingSectionId[] = [
  "headline-metrics",
  "what-stands-out",
  "comparison-table",
  "watchlist-summary",
  "saved-research-summary",
  "limitations",
];

const BRIEFING_SECTION_TITLES: Record<BriefingSectionId, string> = {
  "headline-metrics": "Headline metrics",
  "what-stands-out": "What stands out",
  "comparison-table": "Comparison",
  "watchlist-summary": "Watchlist summary",
  "saved-research-summary": "Saved research summary",
  limitations: "Limitations",
};

export type BriefingScope =
  | { kind: "round-wide" }
  | { kind: "entity"; entityType: EntityType; entityKey: string; label: string }
  | { kind: "explore-view"; params: Record<string, string> }
  | { kind: "compare-config"; params: Record<string, string> }
  | { kind: "watchlist"; watchlistId: string; watchlistName: string }
  | { kind: "saved-research"; savedResearchId: string; savedResearchName: string };

/**
 * PRD §10.1's evidence-class taxonomy, renamed "truth class" per Steven's
 * model (briefings-design.md §9). Only `authoritative-fact` and
 * `calculated-metric` are ever emitted by this deterministic v1 generator —
 * the other three are reserved schema slots for later, genuinely different
 * features (public enrichment sources, real AI assistance, human review).
 * `ai-assisted-inference` in particular is an explicit *future* boundary:
 * nothing in this file may ever emit it, because nothing in this file is AI.
 */
export type TruthClass =
  | "authoritative-fact"
  | "calculated-metric"
  | "public-enrichment"
  | "ai-assisted-inference"
  | "human-reviewed-assertion";

export type EvidenceRef = {
  investigationItemId: string;
  label: string;
  recordIds: string[];
  entityType?: EntityType;
  entityKey?: string;
};

export type BriefingClaim = {
  id: string;
  text: string;
  generatedText: string;
  truthClass: TruthClass;
  confidence?: "High" | "Medium" | "Low";
  method?: string;
  evidence: EvidenceRef[];
  limitationRefs: string[];
  editedByUser: boolean;
  userAdded: boolean;
};

export type BriefingSection = {
  id: BriefingSectionId;
  title: string;
  included: boolean;
  narrativeFrame?: string;
  asOfNote: string;
  claims: BriefingClaim[];
  overflowCount: number;
};

export type BriefingLimitation = { id: string; text: string; nonRemovable: true };

export type BriefingDefinition = {
  id: string;
  name: string;
  entryPath: EntryPath;
  audience: AudienceId;
  emphasis: Lens;
  detailLevel: DetailLevel;
  sectionsWanted: BriefingSectionId[];
  scope: BriefingScope;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  currentEditionId: string;
};

export type BriefingEdition = {
  id: string;
  definitionId: string;
  status: EditionStatus;
  generatedAt: string;
  dataAsOfTime: string;
  snapshotId: string;
  methodVersion: string;
  sections: BriefingSection[];
  limitations: BriefingLimitation[];
  recordedScopeCount: number;
  finalizedAt?: string;
  supersededAt?: string;
  supersededByEditionId?: string;
};

export const AUDIENCES: { id: AudienceId; label: string; defaultEmphasis: Lens; defaultDetailLevel: DetailLevel }[] = [
  { id: "executive", label: "Executive", defaultEmphasis: "all", defaultDetailLevel: "brief" },
  { id: "commercial", label: "Commercial", defaultEmphasis: "commercial", defaultDetailLevel: "standard" },
  { id: "product-strategy", label: "Product & Strategy", defaultEmphasis: "strategy", defaultDetailLevel: "standard" },
  { id: "marketing", label: "Marketing", defaultEmphasis: "marketing", defaultDetailLevel: "standard" },
];

export function audienceLabel(audience: AudienceId): string {
  return AUDIENCES.find((entry) => entry.id === audience)?.label ?? audience;
}

export function defaultEmphasisForAudience(audience: AudienceId): Lens {
  return AUDIENCES.find((entry) => entry.id === audience)?.defaultEmphasis ?? "all";
}

export function defaultDetailLevelForAudience(audience: AudienceId): DetailLevel {
  return AUDIENCES.find((entry) => entry.id === audience)?.defaultDetailLevel ?? "standard";
}

/** Scope-kind defaults per briefings-design.md §12 — never offered for a mismatched scope kind. */
export function defaultSectionsForScope(scopeKind: BriefingScope["kind"]): BriefingSectionId[] {
  switch (scopeKind) {
    case "round-wide":
    case "entity":
      return ["headline-metrics", "what-stands-out", "limitations"];
    case "explore-view":
      return ["headline-metrics", "what-stands-out", "limitations"];
    case "compare-config":
      return ["headline-metrics", "comparison-table", "what-stands-out", "limitations"];
    case "watchlist":
      return ["headline-metrics", "watchlist-summary", "what-stands-out", "limitations"];
    case "saved-research":
      return ["headline-metrics", "saved-research-summary", "limitations"];
  }
}

/** Which sections a given scope kind can ever produce — used to silently omit a mismatched request rather than error (§6/§12), and to build the Guided wizard's section checklist. */
export function availableSectionsForScope(scopeKind: BriefingScope["kind"]): Set<BriefingSectionId> {
  const always: BriefingSectionId[] = ["headline-metrics", "what-stands-out", "limitations"];
  if (scopeKind === "compare-config") return new Set([...always, "comparison-table"]);
  if (scopeKind === "watchlist") return new Set([...always, "watchlist-summary"]);
  if (scopeKind === "saved-research") return new Set(["headline-metrics", "saved-research-summary", "limitations"]);
  return new Set(always);
}

const DETAIL_CAPS: Record<DetailLevel, number> = { brief: 2, standard: 5, deep: Number.POSITIVE_INFINITY };

export function detailLevelCap(detailLevel: DetailLevel): number {
  return DETAIL_CAPS[detailLevel];
}

/**
 * Deterministic editorial selection (briefings-design.md §7): claims are
 * already generated in a fixed, meaningful order (numeric/authoritative
 * facts first, matching `rowMeaningfulnessRank`'s discipline, then stable
 * generation order as the tie-break) by the section builders below.
 * Capping here never discards data — `BriefingSection.claims` always holds
 * every generated claim; `overflowCount` records how many sit beyond the
 * detail level's cap so the Preview workspace can render "Show N more"
 * (mirroring Compare's "View all N differences") without ever losing a
 * claim that was already generated and evidence-backed.
 */
function overflowCountFor(claims: BriefingClaim[], detailLevel: DetailLevel): number {
  const cap = DETAIL_CAPS[detailLevel];
  return Number.isFinite(cap) ? Math.max(0, claims.length - cap) : 0;
}

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "item";
}

function evidenceFor(label: string, records: readonly Application[], entityType?: EntityType, entityKey?: string): EvidenceRef {
  return {
    investigationItemId: `briefing-evidence-${slug(label)}-${generateSavedId("ev")}`,
    label,
    recordIds: records.map((record) => record.id),
    entityType,
    entityKey,
  };
}

function makeClaim(input: {
  text: string;
  truthClass: TruthClass;
  confidence?: "High" | "Medium" | "Low";
  method?: string;
  evidence: EvidenceRef[];
  limitationRefs?: string[];
}): BriefingClaim {
  return {
    id: generateSavedId("claim"),
    text: input.text,
    generatedText: input.text,
    truthClass: input.truthClass,
    confidence: input.confidence,
    method: input.method,
    evidence: input.evidence,
    limitationRefs: input.limitationRefs ?? [],
    editedByUser: false,
    userAdded: false,
  };
}

function baseLimitations(): BriefingLimitation[] {
  return [
    { id: "rehearsal-fixture", text: "Rehearsal fixture only — this Briefing proves the workflow and calculation contract; it is not an official 2026 publication.", nonRemovable: true },
    ...registryFixture.limitations.map((text, index) => ({ id: `fixture-limitation-${index}`, text, nonRemovable: true as const })),
  ];
}

export function describeBriefingScope(scope: BriefingScope): string {
  switch (scope.kind) {
    case "round-wide":
      return "Round-wide — the full rehearsal fixture";
    case "entity":
      return `Entity — ${scope.label}`;
    case "explore-view":
      return `Explore view — ${describeExploreFilters(scope.params)}`;
    case "compare-config": {
      const { type, entities } = compareEntitiesFromParams(scope.params);
      return describeCompareSelection(type, entities.map((entity) => entity.label));
    }
    case "watchlist":
      return `Watchlist — ${scope.watchlistName}`;
    case "saved-research":
      return `Saved Research — ${scope.savedResearchName}`;
  }
}

export function compareEntitiesFromParams(params: Record<string, string>): { type: EntityType; entities: { key: string; label: string; records: Application[] }[] } {
  const type = (params.type as EntityType) ?? "organizations";
  const ids = (params.ids ?? "").split(",").filter(Boolean);
  const options = listEntityOptions(type);
  const entities = ids.map((id) => options.find((option) => option.key === id) ?? { key: id, label: id, records: recordsForEntity(type, id) });
  return { type, entities: entities.map((entity) => ({ key: entity.key, label: entity.label, records: [...entity.records] })) };
}

/**
 * A small, curated row set reusing the exact deterministic comparison
 * engine (`groupCompareRowsBySection`/`summarizeCompareDifferences`)
 * Compare's own UI uses, rather than a parallel comparison algorithm — see
 * briefings-design.md §12. Not necessarily identical to every row
 * `CompareContent` renders; capped to what a Briefing needs.
 */
export function buildBriefingCompareRows(type: EntityType, entities: { key: string; label: string; records: Application[] }[]): CompareRowLike[] {
  const cell = (value: unknown, entityLabel: string, state?: CompareCellLike["state"]): CompareCellLike => ({ value, state, entityLabel });
  return [
    { label: "2026 applications", section: "round-activity" as const, cells: entities.map((entity) => cell(entity.records.length, entity.label)) },
    { label: "Initial contention exposure", section: "round-activity" as const, cells: entities.map((entity) => cell(entity.records.filter((record) => record.contentionSet).length, entity.label)) },
    { label: "IDN applications", section: "round-activity" as const, cells: entities.map((entity) => cell(entity.records.filter((record) => record.idn).length, entity.label)) },
    { label: "Regions", section: "round-activity" as const, cells: entities.map((entity) => cell([...new Set(entity.records.map((record) => record.region))].sort().join(", ") || "Not available", entity.label, entity.records.length ? undefined : "unavailable")) },
    {
      label: type === "applications" ? "Participation status" : "Returning participants",
      section: "historical-participation" as const,
      cells: entities.map((entity) => {
        if (type === "applications") {
          const eligibility = participationStatusCellForApplication(Boolean(entity.records[0]?.returning));
          return cell(eligibility.value, entity.label, eligibility.state);
        }
        return cell(entity.records.filter((record) => record.returning).length, entity.label);
      }),
    },
    { label: "Market demand", section: "market-context" as const, cells: entities.map((entity) => cell("Not comparable — source not approved", entity.label, "not-comparable")) },
  ];
}

function headlineMetricsRoundWide(emphasis: Lens): BriefingSection {
  const filterRecords: Record<string, Application[]> = {
    all: [...registryFixture.applications],
    strings: [...registryFixture.applications],
    organizations: [...registryFixture.applications],
    regions: [...registryFixture.applications],
    idn: registryFixture.applications.filter((record) => record.idn),
    contention: registryFixture.applications.filter((record) => record.contentionSet),
  };
  const claims = roundPulse.map((metric) =>
    makeClaim({
      text: `${metric.label}: ${metric.value} (${metric.delta}).`,
      truthClass: "calculated-metric",
      method: "round-pulse/1.0.0",
      evidence: [evidenceFor(metric.label, filterRecords[metric.filter] ?? registryFixture.applications)],
    })
  );
  return {
    id: "headline-metrics",
    title: BRIEFING_SECTION_TITLES["headline-metrics"],
    included: true,
    narrativeFrame: lensInterpretations[emphasis],
    asOfNote: `${registryFixture.applications.length} supporting records, as of snapshot ${registryFixture.snapshotId}.`,
    claims,
    overflowCount: 0,
  };
}

function headlineMetricsEntity(entityType: EntityType, entityKey: string, label: string): BriefingSection {
  const records = recordsForEntity(entityType, entityKey);
  const categories = new Set(records.map((record) => record.category)).size;
  const contention = records.filter((record) => record.contentionSet).length;
  const idn = records.filter((record) => record.idn).length;
  const returning = records.filter((record) => record.returning).length;
  const claims = [
    makeClaim({ text: `${label}: ${records.length} supporting record${records.length === 1 ? "" : "s"}.`, truthClass: "authoritative-fact", evidence: [evidenceFor(label, records, entityType, entityKey)] }),
    makeClaim({ text: `${categories} distinct categor${categories === 1 ? "y" : "ies"} represented.`, truthClass: "calculated-metric", evidence: [evidenceFor(label, records, entityType, entityKey)] }),
    makeClaim({ text: `${contention} of ${records.length} in initial identical-string contention.`, truthClass: "calculated-metric", evidence: [evidenceFor(`${label} — contention`, records.filter((record) => record.contentionSet), entityType, entityKey)] }),
    makeClaim({ text: `${idn} IDN application${idn === 1 ? "" : "s"}; ${returning} returning application${returning === 1 ? "" : "s"}.`, truthClass: "calculated-metric", evidence: [evidenceFor(`${label} — IDN/returning`, records, entityType, entityKey)] }),
  ];
  return {
    id: "headline-metrics",
    title: BRIEFING_SECTION_TITLES["headline-metrics"],
    included: true,
    asOfNote: `${records.length} supporting records, as of snapshot ${registryFixture.snapshotId}.`,
    claims,
    overflowCount: 0,
  };
}

function headlineMetricsExploreView(params: Record<string, string>): BriefingSection {
  const records = recordsForParams("explore-view", params);
  const description = describeExploreFilters(params);
  const claims = [
    makeClaim({ text: `Cohort / filter definition: ${description}.`, truthClass: "calculated-metric", evidence: [evidenceFor("Cohort definition", records)] }),
    makeClaim({ text: `${records.length} matching record${records.length === 1 ? "" : "s"}.`, truthClass: "calculated-metric", evidence: [evidenceFor("Result count", records)] }),
  ];
  return {
    id: "headline-metrics",
    title: BRIEFING_SECTION_TITLES["headline-metrics"],
    included: true,
    asOfNote: `${records.length} supporting records, as of snapshot ${registryFixture.snapshotId}.`,
    claims,
    overflowCount: 0,
  };
}

function headlineMetricsCompare(params: Record<string, string>): BriefingSection {
  const { type, entities } = compareEntitiesFromParams(params);
  const totalRecords = entities.reduce((sum, entity) => sum + entity.records.length, 0);
  const claims = [
    makeClaim({ text: describeCompareSelection(type, entities.map((entity) => entity.label)) + ".", truthClass: "authoritative-fact", evidence: entities.map((entity) => evidenceFor(entity.label, entity.records, type, entity.key)) }),
    makeClaim({ text: `${totalRecords} total supporting record${totalRecords === 1 ? "" : "s"} across ${entities.length} selection${entities.length === 1 ? "" : "s"}.`, truthClass: "calculated-metric", evidence: entities.map((entity) => evidenceFor(entity.label, entity.records, type, entity.key)) }),
  ];
  return {
    id: "headline-metrics",
    title: BRIEFING_SECTION_TITLES["headline-metrics"],
    included: true,
    asOfNote: `${totalRecords} supporting records, as of snapshot ${registryFixture.snapshotId}.`,
    claims,
    overflowCount: 0,
  };
}

export type WatchlistScopeContext = { items: { entityType: EntityType; entityKey: string; label: string; recordCountAtAdd: number }[] };
export type SavedResearchScopeContext = { kind: "explore-view" | "compare-config"; summary: string; recordCountAtSave: number; params: Record<string, string> };

function headlineMetricsWatchlist(context: WatchlistScopeContext): BriefingSection {
  const records = context.items.flatMap((item) => recordsForEntity(item.entityType, item.entityKey));
  const changed = context.items.filter((item) => recordsForEntity(item.entityType, item.entityKey).length !== item.recordCountAtAdd).length;
  const contention = records.filter((record) => record.contentionSet).length;
  const returning = records.filter((record) => record.returning).length;
  const claims = [
    makeClaim({ text: `${context.items.length} entit${context.items.length === 1 ? "y" : "ies"} watched.`, truthClass: "authoritative-fact", evidence: [evidenceFor("Watchlist entities", records)] }),
    makeClaim({ text: `${changed} entit${changed === 1 ? "y" : "ies"} with a supporting-record count that has moved since being added.`, truthClass: "calculated-metric", evidence: [evidenceFor("Changed entities", records)] }),
    makeClaim({ text: `${contention} contested record${contention === 1 ? "" : "s"} across the watchlist.`, truthClass: "calculated-metric", evidence: [evidenceFor("Contested records", records.filter((record) => record.contentionSet))] }),
    makeClaim({ text: `${returning} returning record${returning === 1 ? "" : "s"} across the watchlist.`, truthClass: "calculated-metric", evidence: [evidenceFor("Returning records", records.filter((record) => record.returning))] }),
  ];
  return {
    id: "headline-metrics",
    title: BRIEFING_SECTION_TITLES["headline-metrics"],
    included: true,
    asOfNote: `${records.length} supporting records across ${context.items.length} watched entities, as of snapshot ${registryFixture.snapshotId}.`,
    claims,
    overflowCount: 0,
  };
}

function headlineMetricsSavedResearch(context: SavedResearchScopeContext): BriefingSection {
  const currentCount = recordsForParams(context.kind, context.params).length;
  const claims = [
    makeClaim({ text: `Cohort / filter definition: ${context.summary}.`, truthClass: "calculated-metric", evidence: [evidenceFor("Cohort definition", recordsForParams(context.kind, context.params))] }),
    makeClaim({
      text: currentCount === context.recordCountAtSave
        ? `Result count: ${currentCount} (unchanged since save).`
        : `Result count: ${currentCount} (was ${context.recordCountAtSave} at save).`,
      truthClass: "calculated-metric",
      evidence: [evidenceFor("Result count", recordsForParams(context.kind, context.params))],
    }),
  ];
  return {
    id: "headline-metrics",
    title: BRIEFING_SECTION_TITLES["headline-metrics"],
    included: true,
    asOfNote: `${currentCount} supporting records, as of snapshot ${registryFixture.snapshotId}.`,
    claims,
    overflowCount: 0,
  };
}

function whatStandsOutRoundWide(emphasis: Lens, detailLevel: DetailLevel): BriefingSection {
  const insights = standoutInsightsForLens(emphasis);
  const claims = insights.map((insight) =>
    makeClaim({
      text: `${insight.title} ${insight.body}`,
      truthClass: "calculated-metric",
      confidence: insight.confidence as "High" | "Medium" | "Low",
      method: insight.method,
      evidence: [evidenceFor(insight.eyebrow, insight.records)],
    })
  );
  const overflowCount = overflowCountFor(claims, detailLevel);
  return { id: "what-stands-out", title: BRIEFING_SECTION_TITLES["what-stands-out"], included: true, asOfNote: `Derived from ${registryFixture.applications.length} supporting records, as of snapshot ${registryFixture.snapshotId}.`, claims, overflowCount };
}

function whatStandsOutEntity(entityType: EntityType, entityKey: string, label: string, detailLevel: DetailLevel): BriefingSection {
  const watched = entityType === "organizations" ? applicantsToWatch.find((entry) => entry.organization === entityKey) : undefined;
  const records = recordsForEntity(entityType, entityKey);
  let claims: BriefingClaim[];
  if (watched) {
    claims = watched.reasons.map((reason) => makeClaim({ text: `${label}: ${reason}.`, truthClass: "calculated-metric", method: "applicants-to-watch/1.0.0", evidence: [evidenceFor(label, watched.records, entityType, entityKey)] }));
  } else {
    const contention = records.filter((record) => record.contentionSet).length;
    const idn = records.filter((record) => record.idn).length;
    claims = [
      makeClaim({ text: `${label} has ${contention} record${contention === 1 ? "" : "s"} in initial identical-string contention.`, truthClass: "calculated-metric", evidence: [evidenceFor(label, records.filter((record) => record.contentionSet), entityType, entityKey)] }),
      makeClaim({ text: `${label} has ${idn} IDN record${idn === 1 ? "" : "s"}.`, truthClass: "calculated-metric", evidence: [evidenceFor(label, records.filter((record) => record.idn), entityType, entityKey)] }),
    ];
  }
  const overflowCount = overflowCountFor(claims, detailLevel);
  return { id: "what-stands-out", title: BRIEFING_SECTION_TITLES["what-stands-out"], included: true, asOfNote: `Derived from ${records.length} supporting records, as of snapshot ${registryFixture.snapshotId}.`, claims, overflowCount };
}

function whatStandsOutExploreView(params: Record<string, string>, detailLevel: DetailLevel): BriefingSection {
  const records = recordsForParams("explore-view", params);
  const contention = records.filter((record) => record.contentionSet).length;
  const idn = records.filter((record) => record.idn).length;
  const returning = records.filter((record) => record.returning).length;
  const claims = [
    makeClaim({ text: `${contention} of ${records.length} matching records are in initial identical-string contention.`, truthClass: "calculated-metric", evidence: [evidenceFor("Contention within cohort", records.filter((record) => record.contentionSet))] }),
    makeClaim({ text: `${idn} of ${records.length} matching records are IDN applications.`, truthClass: "calculated-metric", evidence: [evidenceFor("IDN within cohort", records.filter((record) => record.idn))] }),
    makeClaim({ text: `${returning} of ${records.length} matching records are returning participants.`, truthClass: "calculated-metric", evidence: [evidenceFor("Returning within cohort", records.filter((record) => record.returning))] }),
  ];
  const overflowCount = overflowCountFor(claims, detailLevel);
  return { id: "what-stands-out", title: BRIEFING_SECTION_TITLES["what-stands-out"], included: true, asOfNote: `Derived from ${records.length} supporting records, as of snapshot ${registryFixture.snapshotId}.`, claims, overflowCount };
}

function whatStandsOutWatchlist(context: WatchlistScopeContext, detailLevel: DetailLevel): BriefingSection {
  const changedItems = context.items
    .map((item) => ({ item, current: recordsForEntity(item.entityType, item.entityKey).length }))
    .filter(({ item, current }) => current !== item.recordCountAtAdd);
  const claims = changedItems.length
    ? changedItems.map(({ item, current }) => makeClaim({ text: `${item.label}: supporting records changed from ${item.recordCountAtAdd} to ${current}.`, truthClass: "calculated-metric", evidence: [evidenceFor(item.label, recordsForEntity(item.entityType, item.entityKey), item.entityType, item.entityKey)] }))
    : [makeClaim({ text: "No individual entity's supporting-record count has moved since it was added.", truthClass: "calculated-metric", evidence: [evidenceFor("Watchlist entities", context.items.flatMap((item) => recordsForEntity(item.entityType, item.entityKey)))] })];
  const overflowCount = overflowCountFor(claims, detailLevel);
  return { id: "what-stands-out", title: BRIEFING_SECTION_TITLES["what-stands-out"], included: true, asOfNote: `Derived from ${context.items.length} watched entities, as of snapshot ${registryFixture.snapshotId}.`, claims, overflowCount };
}

type CompareTableResult = { section: BriefingSection; standoutClaims: BriefingClaim[]; limitations: BriefingLimitation[] };

function comparisonTableAndStandout(params: Record<string, string>, detailLevel: DetailLevel): CompareTableResult {
  const { type, entities } = compareEntitiesFromParams(params);
  const rows = buildBriefingCompareRows(type, entities);
  const limitations: BriefingLimitation[] = [];
  const rowClaims = rows.map((row, rowIndex) => {
    const rowLimitationIds: string[] = [];
    row.cells.forEach((cellValue) => {
      if (cellValue.state) {
        const limitationId = `compare-cell-${rowIndex}-${slug(cellValue.entityLabel ?? "entity")}`;
        limitations.push({ id: limitationId, text: `${cellValue.entityLabel ?? "A selection"} — ${row.label}: ${formatCompareCellForSummary(cellValue)}.`, nonRemovable: true });
        rowLimitationIds.push(limitationId);
      }
    });
    const text = `${row.label}: ${row.cells.map((cellValue) => `${cellValue.entityLabel ?? "Selection"} ${formatCompareCellForSummary(cellValue)}`).join(" · ")}.`;
    return makeClaim({
      text,
      truthClass: "calculated-metric",
      method: "compare-rows/1.0.0",
      evidence: entities.map((entity) => evidenceFor(entity.label, entity.records, type, entity.key)),
      limitationRefs: rowLimitationIds,
    });
  });
  const grouped = groupCompareRowsBySection(rows, type);
  const asOfNote = `${grouped.map((group) => `${compareSectionLabel(type, group.section)} (${group.rows.length})`).join(", ")} — ${compareSectionOrder.length} dimension groups, as of snapshot ${registryFixture.snapshotId}.`;
  const overflowCount = overflowCountFor(rowClaims, detailLevel);

  const differenceSummary = summarizeCompareDifferences(rows);
  const standoutTexts = [differenceSummary.matchingSentence, ...differenceSummary.topFacts].filter(Boolean);
  const standoutClaims = standoutTexts.map((text) =>
    makeClaim({ text, truthClass: "calculated-metric", method: "compare-differences/1.0.0", evidence: entities.map((entity) => evidenceFor(entity.label, entity.records, type, entity.key)) })
  );

  return {
    section: { id: "comparison-table", title: BRIEFING_SECTION_TITLES["comparison-table"], included: true, asOfNote, claims: rowClaims, overflowCount },
    standoutClaims,
    limitations,
  };
}

function watchlistSummarySection(context: WatchlistScopeContext, detailLevel: DetailLevel): BriefingSection {
  const claims = context.items.map((item) => {
    const current = recordsForEntity(item.entityType, item.entityKey).length;
    return makeClaim({
      text: current === item.recordCountAtAdd
        ? `${item.label}: ${current} supporting records (unchanged since added).`
        : `${item.label}: ${current} supporting records (was ${item.recordCountAtAdd} at add).`,
      truthClass: "calculated-metric",
      evidence: [evidenceFor(item.label, recordsForEntity(item.entityType, item.entityKey), item.entityType, item.entityKey)],
    });
  });
  const overflowCount = overflowCountFor(claims, detailLevel);
  return { id: "watchlist-summary", title: BRIEFING_SECTION_TITLES["watchlist-summary"], included: true, asOfNote: `${context.items.length} watched entities, as of snapshot ${registryFixture.snapshotId}.`, claims, overflowCount };
}

function savedResearchSummarySection(context: SavedResearchScopeContext): BriefingSection {
  const records = recordsForParams(context.kind, context.params);
  const claims = [
    makeClaim({ text: `Source: ${context.kind === "explore-view" ? "Explore view" : "Compare configuration"}.`, truthClass: "authoritative-fact", evidence: [evidenceFor("Source kind", records)] }),
    makeClaim({ text: `Cohort / filter definition: ${context.summary}.`, truthClass: "calculated-metric", evidence: [evidenceFor("Cohort definition", records)] }),
  ];
  return { id: "saved-research-summary", title: BRIEFING_SECTION_TITLES["saved-research-summary"], included: true, asOfNote: `${records.length} supporting records, as of snapshot ${registryFixture.snapshotId}.`, claims, overflowCount: 0 };
}

export type GenerationContext = { watchlist?: WatchlistScopeContext; savedResearch?: SavedResearchScopeContext };

export type GenerateEditionInput = {
  scope: BriefingScope;
  emphasis: Lens;
  detailLevel: DetailLevel;
  sectionsWanted: BriefingSectionId[];
  context?: GenerationContext;
};

/**
 * The deterministic generator: pure given the current fixture, a scope, and
 * a fixed configuration — the same scope/config always yields the same
 * claim text, order, and count (record ids inside evidence are stable
 * arrays; only `id`/`investigationItemId` values are freshly minted per
 * call, exactly like every other saved-work entity's `id`).
 */
export function generateEditionContent(input: GenerateEditionInput): Omit<BriefingEdition, "id" | "definitionId" | "status" | "finalizedAt" | "supersededAt" | "supersededByEditionId"> {
  const wanted = new Set(input.sectionsWanted.filter((id) => availableSectionsForScope(input.scope.kind).has(id)));
  const sections: BriefingSection[] = [];
  let limitations = baseLimitations();
  let recordedScopeCount = 0;

  if (input.scope.kind === "round-wide") {
    recordedScopeCount = registryFixture.applications.length;
    if (wanted.has("headline-metrics")) sections.push(headlineMetricsRoundWide(input.emphasis));
    if (wanted.has("what-stands-out")) sections.push(whatStandsOutRoundWide(input.emphasis, input.detailLevel));
  } else if (input.scope.kind === "entity") {
    const records = recordsForEntity(input.scope.entityType, input.scope.entityKey);
    recordedScopeCount = records.length;
    if (wanted.has("headline-metrics")) sections.push(headlineMetricsEntity(input.scope.entityType, input.scope.entityKey, input.scope.label));
    if (wanted.has("what-stands-out")) sections.push(whatStandsOutEntity(input.scope.entityType, input.scope.entityKey, input.scope.label, input.detailLevel));
  } else if (input.scope.kind === "explore-view") {
    const records = recordsForParams("explore-view", input.scope.params);
    recordedScopeCount = records.length;
    if (records.length === 0) limitations = [...limitations, { id: "explore-empty", text: "No records matched this cohort's filters at generation time.", nonRemovable: true }];
    if (wanted.has("headline-metrics")) sections.push(headlineMetricsExploreView(input.scope.params));
    if (wanted.has("what-stands-out")) sections.push(whatStandsOutExploreView(input.scope.params, input.detailLevel));
  } else if (input.scope.kind === "compare-config") {
    const { entities } = compareEntitiesFromParams(input.scope.params);
    recordedScopeCount = entities.reduce((sum, entity) => sum + entity.records.length, 0);
    if (wanted.has("headline-metrics")) sections.push(headlineMetricsCompare(input.scope.params));
    let compareStandout: BriefingClaim[] = [];
    if (wanted.has("comparison-table")) {
      const result = comparisonTableAndStandout(input.scope.params, input.detailLevel);
      sections.push(result.section);
      compareStandout = result.standoutClaims;
      limitations = [...limitations, ...result.limitations];
    }
    if (wanted.has("what-stands-out")) {
      const overflowCount = overflowCountFor(compareStandout, input.detailLevel);
      sections.push({ id: "what-stands-out", title: BRIEFING_SECTION_TITLES["what-stands-out"], included: true, asOfNote: `Derived from the same comparison engine as Compare, as of snapshot ${registryFixture.snapshotId}.`, claims: compareStandout, overflowCount });
    }
  } else if (input.scope.kind === "watchlist") {
    const context = input.context?.watchlist ?? { items: [] };
    recordedScopeCount = context.items.reduce((sum, item) => sum + recordsForEntity(item.entityType, item.entityKey).length, 0);
    if (context.items.length === 0) limitations = [...limitations, { id: "watchlist-empty", text: "This watchlist had no entities at generation time — headline metrics and stand-out claims reflect an empty set.", nonRemovable: true }];
    if (wanted.has("headline-metrics")) sections.push(headlineMetricsWatchlist(context));
    if (wanted.has("watchlist-summary")) sections.push(watchlistSummarySection(context, input.detailLevel));
    if (wanted.has("what-stands-out")) sections.push(whatStandsOutWatchlist(context, input.detailLevel));
  } else if (input.scope.kind === "saved-research") {
    const context = input.context?.savedResearch;
    if (context) {
      recordedScopeCount = recordsForParams(context.kind, context.params).length;
      if (wanted.has("headline-metrics")) sections.push(headlineMetricsSavedResearch(context));
      if (wanted.has("saved-research-summary")) sections.push(savedResearchSummarySection(context));
    }
  }

  if (wanted.has("limitations")) {
    sections.push({ id: "limitations", title: BRIEFING_SECTION_TITLES.limitations, included: true, asOfNote: `${limitations.length} known limitation${limitations.length === 1 ? "" : "s"} attached to this edition.`, claims: limitations.map((limitation) => makeClaim({ text: limitation.text, truthClass: "authoritative-fact", evidence: [] })), overflowCount: 0 });
  }

  const now = new Date().toISOString();
  return {
    generatedAt: now,
    dataAsOfTime: registryFixture.baselineAt,
    snapshotId: registryFixture.snapshotId,
    methodVersion: registryFixture.methodVersion,
    sections: sections.sort((a, b) => BRIEFING_SECTION_ORDER.indexOf(a.id) - BRIEFING_SECTION_ORDER.indexOf(b.id)),
    limitations,
    recordedScopeCount,
  };
}

/** Live recount of a Definition's scope, for drift disclosure (briefings-design.md §10) — defensive against a since-deleted watchlist/saved-research source. */
export function currentScopeRecordCount(scope: BriefingScope, context?: GenerationContext): number {
  switch (scope.kind) {
    case "round-wide":
      return registryFixture.applications.length;
    case "entity":
      return recordsForEntity(scope.entityType, scope.entityKey).length;
    case "explore-view":
      return recordsForParams("explore-view", scope.params).length;
    case "compare-config": {
      const { entities } = compareEntitiesFromParams(scope.params);
      return entities.reduce((sum, entity) => sum + entity.records.length, 0);
    }
    case "watchlist":
      return context?.watchlist ? context.watchlist.items.reduce((sum, item) => sum + recordsForEntity(item.entityType, item.entityKey).length, 0) : 0;
    case "saved-research":
      return context?.savedResearch ? recordsForParams(context.savedResearch.kind, context.savedResearch.params).length : 0;
  }
}
