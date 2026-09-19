import fixture from "@/data/fixtures/registry-applications.json";
import { buildCommandCenterRoundPulse } from "@/comparison/historical-2012-ui-adapter";

export type Application = (typeof fixture.applications)[number];
export type HistoricalContext = typeof fixture.historicalContext;
export type EvidenceKind = "authoritative" | "calculated";
export type EntityType = "organizations" | "applications" | "categories";
/** Command Center's lens vocabulary, reused verbatim as Briefings' "emphasis" — see briefings-design.md §6. */
export type Lens = "all" | "commercial" | "strategy" | "marketing";

export const registryFixture = fixture;

export function listEntityOptions(entityType: EntityType, applications: Application[] = fixture.applications) {
  if (entityType === "applications") {
    return applications.map((record) => ({ key: record.id, label: `.${record.string} · ${record.id}`, records: [record] }));
  }
  const values = entityType === "organizations"
    ? [...new Set(applications.map((record) => record.organization))]
    : [...new Set(applications.map((record) => record.category))];
  return values.sort().map((value) => ({
    key: value,
    label: value,
    records: applications.filter((record) => entityType === "organizations" ? record.organization === value : record.category === value),
  }));
}

export function recordsForEntity(entityType: EntityType, entityKey: string, applications: Application[] = fixture.applications) {
  if (entityType === "applications") return applications.filter((record) => record.id === entityKey);
  if (entityType === "organizations") return applications.filter((record) => record.organization === entityKey);
  return applications.filter((record) => record.category === entityKey);
}

export type ExploreFilterState = {
  q: string;
  category: string;
  region: string;
  status: string;
  contention: string;
  idn: string;
  ids: string;
};

export function filterApplicationsByExplore(applications: Application[], filters: ExploreFilterState) {
  const selectedIds = new Set(filters.ids.split(",").filter(Boolean));
  return applications.filter((item) => {
    const matchesQuery = [item.id, item.string, item.applicant, item.organization, item.category, item.region, item.country].some((value) => value.toLowerCase().includes(filters.q.toLowerCase()));
    return matchesQuery
      && (!selectedIds.size || selectedIds.has(item.id))
      && (filters.category === "all" || item.category === filters.category)
      && (filters.region === "all" || item.region === filters.region)
      && (filters.status === "all" || (filters.status === "returning" ? item.returning : !item.returning))
      && (filters.contention === "all" || (filters.contention === "in" ? Boolean(item.contentionSet) : !item.contentionSet))
      && (filters.idn === "all" || (filters.idn === "idn" ? item.idn : !item.idn));
  });
}

const exploreFilterDefaults: Record<string, string> = {
  entity: "applications",
  category: "all",
  region: "all",
  status: "all",
  contention: "all",
  idn: "all",
  sort: "applications-desc",
};

const exploreFilterLabels: Record<string, (value: string) => string> = {
  entity: (value) => `Browse by ${value}`,
  category: (value) => `${value} category`,
  region: (value) => `${value} region`,
  status: (value) => value === "returning" ? "Returning only" : "New only",
  contention: (value) => value === "in" ? "In initial contention" : "Not in contention",
  idn: (value) => value === "idn" ? "IDN only" : "Non-IDN only",
  sort: (value) => value === "name-asc" ? "Sorted A–Z" : value === "contention-desc" ? "Sorted by contention" : "Sorted by applications",
};

export function describeExploreFilters(filters: Record<string, string>) {
  const parts: string[] = [];
  if (filters.q) parts.push(`Search “${filters.q}”`);
  if (filters.ids) parts.push("Explicit record selection");
  for (const [key, defaultValue] of Object.entries(exploreFilterDefaults)) {
    const value = filters[key];
    if (value && value !== defaultValue) parts.push(exploreFilterLabels[key](value));
  }
  return parts.length ? parts.join(" · ") : "All applications, no filters applied";
}

export function nonDefaultExploreFilterParams(filters: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(filters).filter(([key, value]) => {
      if (!value) return false;
      if (key === "q" || key === "ids") return true;
      return exploreFilterDefaults[key] !== undefined && value !== exploreFilterDefaults[key];
    })
  );
}

/**
 * Command Center's lens-to-interpretation copy, promoted here so a
 * round-wide Briefing's opening `narrativeFrame` (briefings-design.md §4)
 * can reuse the identical text rather than a parallel copy of it.
 */
export const lensInterpretations: Record<Lens, string> = {
  all: "The rehearsal fixture points to concentrated portfolios, increased IDN representation, and two initial contention clusters worth coordinated review.",
  commercial: "Portfolio concentration and contention expose where account research may be most efficient; they are investigation priorities, not sales recommendations.",
  strategy: "Category movement, IDN participation, and initial contention show where round composition differs from the normalized 2012 fixture cohort.",
  marketing: "Cross-region IDN participation and multi-category organizations offer evidence-backed themes without implying market demand or future success.",
};

/** The record set a saved/briefed Explore view or Compare configuration resolves to right now — shared by Saved's change-since-visit count and Briefings' generator/drift disclosure. */
export function recordsForParams(kind: "explore-view" | "compare-config", params: Record<string, string>): Application[] {
  if (kind === "explore-view") {
    const filters: ExploreFilterState = {
      q: params.q ?? "",
      category: params.category ?? "all",
      region: params.region ?? "all",
      status: params.status ?? "all",
      contention: params.contention ?? "all",
      idn: params.idn ?? "all",
      ids: params.ids ?? "",
    };
    return filterApplicationsByExplore(fixture.applications, filters);
  }
  const type = (params.type as EntityType) ?? "organizations";
  const ids = (params.ids ?? "").split(",").filter(Boolean);
  return ids.flatMap((id) => recordsForEntity(type, id));
}

export function describeCompareSelection(entityType: EntityType, labels: string[]) {
  const singular = entityType === "categories" ? "category" : entityType.slice(0, -1);
  return `Compare ${labels.length} ${labels.length === 1 ? singular : entityType}: ${labels.join(", ")}`;
}

/**
 * Bumped whenever the set or definition of Compare dimensions changes, so a
 * saved comparison can record which method version produced its rows —
 * matching the fixture's existing snapshot/method pinning discipline.
 */
export const COMPARE_DIMENSIONS_VERSION = "compare-dimensions/1.1.0";

export const COMPARE_TIME_BASIS = "reveal-day-baseline" as const;

export type CompareSectionId = "round-activity" | "historical-participation" | "existing-portfolio" | "market-context";

export const compareSectionOrder: CompareSectionId[] = [
  "round-activity",
  "historical-participation",
  "existing-portfolio",
  "market-context",
];

/**
 * Section labels are entity-type-aware even though every entity type shares
 * the same section ids, row-to-section assignment, and comparison engine —
 * only the display label changes to match what the rows in that section
 * actually mean for the entity type being compared (e.g. a single
 * application doesn't have a "portfolio", but it does have "details").
 */
export const compareSectionLabelsByEntityType: Record<EntityType, Record<CompareSectionId, string>> = {
  organizations: {
    "round-activity": "Round Activity",
    "historical-participation": "Historical Participation",
    "existing-portfolio": "Existing Portfolio",
    "market-context": "Market Context",
  },
  applications: {
    "round-activity": "Application Details",
    "historical-participation": "Historical Participation",
    "existing-portfolio": "Application Context",
    "market-context": "Market Context",
  },
  categories: {
    "round-activity": "Round Composition",
    "historical-participation": "Historical Participation",
    "existing-portfolio": "Category Footprint",
    "market-context": "Market Context",
  },
};

export function compareSectionLabel(entityType: EntityType, section: CompareSectionId): string {
  return compareSectionLabelsByEntityType[entityType][section];
}

export type CompareCellLike = { value: unknown; state?: "unavailable" | "not-comparable"; entityLabel?: string };
export type CompareRowLike = { label: string; section: CompareSectionId; cells: CompareCellLike[] };

function compareCellSignature(cell: CompareCellLike): string {
  return `${cell.state ?? ""}|${String(cell.value)}`;
}

/** A row "differs" when at least one cell's state+value diverges from the first (baseline) cell. */
export function rowHasDifference(row: CompareRowLike): boolean {
  if (row.cells.length < 2) return false;
  const baseline = compareCellSignature(row.cells[0]);
  return row.cells.some((cell) => compareCellSignature(cell) !== baseline);
}

/** Whether a single cell differs from the row's first (baseline) selection. Index 0 is never "different" from itself. */
export function cellDiffersFromBaseline(cells: CompareCellLike[], index: number): boolean {
  if (index <= 0 || cells.length < 2) return false;
  return compareCellSignature(cells[index]) !== compareCellSignature(cells[0]);
}

/** Deterministic numeric delta versus the first (baseline) selection; null when not meaningful (non-numeric or unchanged). */
export function numericCellDelta(cells: CompareCellLike[], index: number): number | null {
  if (index <= 0) return null;
  const baseline = cells[0]?.value;
  const value = cells[index]?.value;
  if (typeof baseline !== "number" || typeof value !== "number" || baseline === value) return null;
  return value - baseline;
}

export function groupCompareRowsBySection<T extends CompareRowLike>(rows: T[], entityType: EntityType) {
  return compareSectionOrder
    .map((section) => ({ section, label: compareSectionLabel(entityType, section), rows: rows.filter((row) => row.section === section) }))
    .filter((group) => group.rows.length > 0);
}

export type CompareDifferenceSummary = {
  headline: string;
  /** Up to KEY_FINDING_LIMIT deterministic, evidence-neutral facts, ranked by meaningfulness. */
  topFacts: string[];
  /** The remaining differing-dimension facts, in table order, revealed via "View all N differences". */
  remainingFacts: string[];
  /** A concise sentence naming meaningful dimensions every selection shares, or "" when there is none to state. */
  matchingSentence: string;
  differingLabels: string[];
  matchingLabels: string[];
};

/** Cap on findings shown before requiring "View all N differences" to reveal the rest. */
const KEY_FINDING_LIMIT = 4;

export function formatCompareCellForSummary(cell: CompareCellLike): string {
  if (cell.state === "unavailable") return "unavailable";
  if (cell.state === "not-comparable") return "not comparable";
  return String(cell.value);
}

/** One factual, evidence-neutral sentence naming the actual value each entity holds — never which is "better". */
export function describeDifferingRowFacts(row: CompareRowLike): string {
  const facts = row.cells.map((cell) => `${cell.entityLabel ?? "a selection"} ${formatCompareCellForSummary(cell)}`);
  return `${row.label} — ${facts.join(", ")}`;
}

function joinWithRemainder(labels: string[], cap: number): string {
  const shown = labels.slice(0, cap);
  const remainder = labels.length - shown.length;
  return remainder > 0 ? `${shown.join(", ")}, and ${remainder} more` : shown.join(", ");
}

/**
 * Ranks a differing row by how meaningful/concrete its fact is: a real
 * numeric comparison is the most immediately meaningful, a categorical
 * (string) difference is next, and a difference driven by one side simply
 * lacking data (an "unavailable"/"not-comparable" state) is least meaningful
 * — it's a data-coverage note, not a like-for-like value comparison.
 */
function rowMeaningfulnessRank(row: CompareRowLike): 0 | 1 | 2 {
  if (row.cells.some((cell) => cell.state)) return 2;
  return row.cells.every((cell) => typeof cell.value === "number") ? 0 : 1;
}

/** For numeric rows, the spread between the smallest and largest value — a rough, deterministic proxy for how notable the difference is. */
function rowNumericSpread(row: CompareRowLike): number {
  const values = row.cells.map((cell) => cell.value).filter((value): value is number => typeof value === "number");
  return values.length ? Math.max(...values) - Math.min(...values) : 0;
}

/**
 * Deterministic, evidence-neutral summary: selects a concise, ranked set of
 * findings that state the actual directional facts for dimensions that
 * differ (which entity holds which value), with the rest revealed on demand
 * rather than crammed into the initial view. Also names meaningful
 * dimensions every selection shares — "meaningful" meaning the shared value
 * is a known fact, not merely a shared absence of data (e.g. two entities
 * both lacking a market-demand figure is not reported as a match). Never
 * ranks, scores, or declares a "better"/"winning" entity, and never infers
 * beyond what the rows state — that judgment is out of scope for this
 * product.
 */
export function summarizeCompareDifferences(rows: CompareRowLike[]): CompareDifferenceSummary {
  if (!rows.length) {
    return { headline: "No dimensions to compare yet", topFacts: [], remainingFacts: [], matchingSentence: "Select at least two entities to see key differences.", differingLabels: [], matchingLabels: [] };
  }

  const differing = rows.filter(rowHasDifference);
  const matching = rows.filter((row) => !rowHasDifference(row));
  const meaningfulMatching = matching.filter((row) => row.cells.every((cell) => !cell.state));
  const matchingLabels = meaningfulMatching.map((row) => row.label);

  if (!differing.length) {
    return {
      headline: `All ${rows.length} dimensions match across selections`,
      topFacts: [],
      remainingFacts: [],
      matchingSentence: matchingLabels.length
        ? `Every selection matches on all ${rows.length} shown dimensions, including ${joinWithRemainder(matchingLabels, 4)}.`
        : `Every selection matches on all ${rows.length} shown dimensions.`,
      differingLabels: [],
      matchingLabels,
    };
  }

  const ranked = differing
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const rankDiff = rowMeaningfulnessRank(a.row) - rowMeaningfulnessRank(b.row);
      if (rankDiff !== 0) return rankDiff;
      const spreadDiff = rowNumericSpread(b.row) - rowNumericSpread(a.row);
      if (spreadDiff !== 0) return spreadDiff;
      return a.index - b.index; // stable, deterministic tie-break matching table order
    })
    .map((entry) => entry.row);

  return {
    headline: `${differing.length} of ${rows.length} dimensions differ across selections`,
    topFacts: ranked.slice(0, KEY_FINDING_LIMIT).map(describeDifferingRowFacts),
    remainingFacts: ranked.slice(KEY_FINDING_LIMIT).map(describeDifferingRowFacts),
    matchingSentence: matchingLabels.length ? `Selections match on ${joinWithRemainder(matchingLabels, 4)}.` : "",
    differingLabels: differing.map((row) => row.label),
    matchingLabels,
  };
}

export function uniqueCount<T>(values: T[]) {
  return new Set(values).size;
}

export function buildRoundPulse(applications: Application[]) {
  return buildCommandCenterRoundPulse(applications).map((metric) => ({
    id: metric.id,
    label: metric.label,
    value: metric.value,
    delta: metric.deltaLabel ?? "",
    filter: metric.filter,
    readiness: metric.readiness,
    displayTier: metric.displayTier,
    source: metric.source,
    method: metric.method,
    metricId: metric.metricId,
  }));
}

export function buildPortfolioRanking(applications: Application[]) {
  const grouped = new Map<string, { count: number; returning: boolean; confidence: number }>();
  for (const item of applications) {
    const current = grouped.get(item.organization) ?? { count: 0, returning: false, confidence: item.confidence };
    grouped.set(item.organization, {
      count: current.count + 1,
      returning: current.returning || item.returning,
      confidence: Math.min(current.confidence, item.confidence)
    });
  }
  return [...grouped.entries()]
    .map(([organization, values]) => ({ organization, ...values }))
    .sort((a, b) => b.count - a.count || a.organization.localeCompare(b.organization));
}

export function buildCategoryMix(applications: Application[]) {
  const counts = new Map<string, number>();
  applications.forEach((item) => counts.set(item.category, (counts.get(item.category) ?? 0) + 1));
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count, percent: Math.round((count / applications.length) * 100) }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

export function buildBiggestChanges(applications: Application[], historical: HistoricalContext = fixture.historicalContext) {
  const current = Object.fromEntries(buildCategoryMix(applications).map((item) => [item.category, item.count]));
  return Object.entries(historical.categoryCounts)
    .map(([category, previous]) => ({
      category,
      previous,
      current: current[category] ?? 0,
      change: (current[category] ?? 0) - previous,
    }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change) || a.category.localeCompare(b.category));
}

export function buildApplicantsToWatch(applications: Application[]) {
  return buildPortfolioRanking(applications).slice(0, 3).map((organization) => {
    const records = applications.filter((item) => item.organization === organization.organization);
    const categories = uniqueCount(records.map((item) => item.category));
    const contention = records.filter((item) => item.contentionSet).length;
    const idn = records.filter((item) => item.idn).length;
    const reasons = [
      organization.count > 1 ? `${organization.count}-application portfolio` : null,
      categories > 1 ? `${categories} categories` : null,
      contention ? `${contention} application${contention > 1 ? "s" : ""} in initial contention` : null,
      idn ? `${idn} IDN application${idn > 1 ? "s" : ""}` : null,
      organization.returning ? "returning participant" : "new participant",
    ].filter((reason): reason is string => Boolean(reason));
    return { ...organization, records, reasons };
  });
}

export const roundPulse = buildRoundPulse(fixture.applications);
export const portfolioRanking = buildPortfolioRanking(fixture.applications);
export const categoryMix = buildCategoryMix(fixture.applications);
export const biggestChanges = buildBiggestChanges(fixture.applications);
export const applicantsToWatch = buildApplicantsToWatch(fixture.applications);

export const standoutInsights = [
  {
    id: "portfolio-concentration",
    eyebrow: "PORTFOLIO CONCENTRATION",
    title: "Atlas Digital holds the rehearsal fixture’s largest portfolio",
    body: "Three applications span technology and media, making it the only organization represented in more than one category.",
    confidence: "High",
    coverage: "12 of 12 applications",
    method: "portfolio-ranking/1.0.0",
    records: fixture.applications.filter((item) => item.organization === "Atlas Digital")
  },
  {
    id: "idn-shift",
    eyebrow: "LANGUAGE & SCRIPT",
    title: "IDN interest reaches two regions and two scripts",
    body: "Arabic and Japanese rehearsal records account for 17% of applications. This is an observation, not a forecast.",
    confidence: "High",
    coverage: "12 of 12 applications",
    method: "idn-share/1.0.0",
    records: fixture.applications.filter((item) => item.idn)
  },
  {
    id: "contention-concentration",
    eyebrow: "INITIAL CONTENTION",
    title: "Identity and technology each contain an identical-string set",
    body: "Four applications are grouped into two initial identical-string contention sets; later contention may differ.",
    confidence: "High",
    coverage: "12 of 12 applications",
    method: "initial-contention/1.0.0",
    records: fixture.applications.filter((item) => item.contentionSet)
  }
] as const;

/**
 * The exact lens-to-insight mapping Command Center's lens switcher already
 * uses to filter `standoutInsights`, promoted here so a round-wide Briefing's
 * "what stands out" section (briefings-design.md §6/§12) can reuse the
 * identical deterministic selection rather than a parallel one.
 */
const standoutInsightIdsByLens: Record<Lens, string[]> = {
  all: standoutInsights.map((insight) => insight.id),
  commercial: ["portfolio-concentration", "contention-concentration"],
  strategy: ["contention-concentration", "idn-shift", "portfolio-concentration"],
  marketing: ["idn-shift", "portfolio-concentration"],
};

export function standoutInsightsForLens(lens: Lens) {
  return standoutInsights.filter((insight) => standoutInsightIdsByLens[lens].includes(insight.id));
}

/**
 * Concise, deterministic watchlist-level intelligence computed purely from
 * fixture data already on the page — no live tracking. `changed` counts
 * entities whose current supporting-record count no longer matches the
 * count recorded when they were added; `contention`/`returning` reuse the
 * same `contentionSet`/`returning` flags Explore's table already surfaces,
 * so the vocabulary matches across the app. All four numbers are supported
 * for every entity type, since every entity type resolves to the same
 * underlying `Application[]` via `recordsForEntity`. Shared by `WatchlistCard`
 * and a `watchlist`-scoped Briefing (briefings-design.md §12) so both read
 * the same numbers from one implementation.
 */
export function computeWatchlistIntelligence(items: { entityType: EntityType; entityKey: string; recordCountAtAdd: number }[]) {
  let changed = 0;
  const records = items.flatMap((item) => {
    const current = recordsForEntity(item.entityType, item.entityKey);
    if (current.length !== item.recordCountAtAdd) changed += 1;
    return current;
  });
  return {
    entities: items.length,
    changed,
    contention: records.filter((record) => record.contentionSet).length,
    returning: records.filter((record) => record.returning).length,
  };
}
