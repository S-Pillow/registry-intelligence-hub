import fixture from "@/data/fixtures/registry-applications.json";
import { hubPath } from "@/lib/hub-paths";
import { buildCommandCenterRoundPulse } from "@/comparison/historical-2012-ui-adapter";
import {
  DEFAULT_CLAIM_ACTUALITY_STATE,
  type ClaimActualityState,
} from "@/lib/hub-metric-eligibility";

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

export function exploreResearchHref(query: string) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  const suffix = params.size ? `?${params}` : "";
  return `${hubPath("/explore")}${suffix}`;
}

/** Rehearsal 2026 cohort rows for Round Pulse drill-down — never mixed into approved 2012 aggregate cards. */
export function recordsForRoundPulseFilter(filter: string, applications: Application[] = fixture.applications) {
  if (filter === "idn") return applications.filter((item) => item.idn);
  if (filter === "contention") return applications.filter((item) => item.contentionSet);
  return applications;
}

export const ENTITY_LEVEL_HISTORICAL_2012_UNAVAILABLE =
  "Entity-level historical records not yet loaded — this card is an approved 2012 aggregate fact only.";

/** Round Pulse supporting records: empty for historical aggregate facts; rehearsal fixture otherwise. */
export function roundPulseSupportingRecords(
  metric: { filter: string; historicalFact?: unknown },
  applications: Application[] = fixture.applications,
) {
  if (metric.historicalFact) return [];
  return recordsForRoundPulseFilter(metric.filter, applications);
}

/** Command Center Round Pulse → Explore drill-down with composable URL state. */
export function exploreDrillDownHref(metricFilter: string) {
  const params = new URLSearchParams();
  switch (metricFilter) {
    case "strings":
      params.set("entity", "strings");
      break;
    case "organizations":
      params.set("entity", "organizations");
      break;
    case "idn":
      params.set("idn", "idn");
      break;
    case "contention":
      params.set("contention", "in");
      break;
    default:
      break;
  }
  const qs = params.toString();
  return `${hubPath("/explore")}${qs ? `?${qs}` : ""}`;
}

export type ExploreDatasetQuery = "2026-rehearsal" | "2012-historical";

/** General Command Center → Explore handoff for the 2012 application corpus (D2.0). */
export function exploreHistorical2012ApplicationsHref(options?: { entityApplications?: boolean }) {
  const params = new URLSearchParams();
  params.set("dataset", "2012-historical");
  if (options?.entityApplications) params.set("entity", "applications");
  return `${hubPath("/explore")}?${params}`;
}

/**
 * Round Pulse per-card Explore handoff for approved 2012 metrics when payload is loaded.
 * Unique strings and IDN stay aggregate-only — no href implying application-row evidence.
 */
export function roundPulseHistoricalCardExploreHref(
  metricId: string,
  historicalPayloadLoaded: boolean,
): string | null {
  if (!historicalPayloadLoaded) return null;
  if (metricId === "applications" || metricId === "application-count") {
    return exploreHistorical2012ApplicationsHref({ entityApplications: true });
  }
  return null;
}

function withExploreDataset(href: string, dataset?: ExploreDatasetQuery) {
  if (dataset !== "2012-historical") return href;
  const url = new URL(href, "http://local");
  url.searchParams.set("dataset", "2012-historical");
  return `${url.pathname}${url.search}`;
}

/** Supporting-chart and drawer “View full” destinations into Explore. */
export function exploreEntityResearchHref(
  entity: "organizations" | "categories" | "applications",
  key: string,
  options?: { dataset?: ExploreDatasetQuery },
) {
  const params = new URLSearchParams();
  params.set("entity", entity);
  if (entity === "applications") params.set("ids", key);
  else params.set("q", key);
  if (options?.dataset === "2012-historical") params.set("dataset", "2012-historical");
  return `${hubPath("/explore")}?${params}`;
}

/** Intelligence drawer “View full” — entity browse, explicit ids, or saved override. */
export function exploreFullHrefForInvestigation(item: {
  entityType?: EntityType;
  entityKey?: string;
  records: readonly Application[];
  exploreFullHref?: string;
  exploreDataset?: ExploreDatasetQuery;
}) {
  if (item.exploreFullHref) return withExploreDataset(item.exploreFullHref, item.exploreDataset);
  if (item.entityType && item.entityKey) {
    return exploreEntityResearchHref(item.entityType, item.entityKey, { dataset: item.exploreDataset });
  }
  if (item.records.length === 1) {
    return exploreEntityResearchHref("applications", item.records[0].id, { dataset: item.exploreDataset });
  }
  if (item.records.length > 1) {
    const params = new URLSearchParams();
    params.set("entity", "applications");
    params.set("ids", item.records.map((record) => record.id).join(","));
    if (item.exploreDataset === "2012-historical") params.set("dataset", "2012-historical");
    return `${hubPath("/explore")}?${params}`;
  }
  return withExploreDataset(hubPath("/explore"), item.exploreDataset);
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

/** Short line under View buttons in the dark panel — explains the active lens before scroll. */
export const lensViewPanelLine: Record<Lens, string> = {
  all: "All Intelligence: Surfaces portfolios, IDN representation, and contention clusters together for a balanced rehearsal read.",
  commercial: "Commercial: Focuses on applicant portfolios, organizations, and contention.",
  strategy: "Product & Strategy: Focuses on composition, IDN participation, and contention.",
  marketing:
    "Marketing: Focuses on geographic reach, IDN participation, and themes that may shape external narratives.",
};

/** Round Pulse eyebrow + subtitle (metric values unchanged). */
export const lensRoundPulseFraming: Record<Lens, { eyebrow: string; subtitle: string }> = {
  all: {
    eyebrow: "ROUND PULSE · ALL INTELLIGENCE",
    subtitle: "Round intelligence at a glance",
  },
  commercial: {
    eyebrow: "ROUND PULSE · COMMERCIAL VIEW",
    subtitle: "Applicant portfolios, organizations, and contention signals at a glance",
  },
  strategy: {
    eyebrow: "ROUND PULSE · PRODUCT & STRATEGY VIEW",
    subtitle: "Composition, IDN participation, and contention signals at a glance",
  },
  marketing: {
    eyebrow: "ROUND PULSE · MARKETING VIEW",
    subtitle: "Geographic reach and IDN signals at a glance",
  },
};

/** Round Pulse section — explicit split between 2026 rehearsal drill-down and approved 2012 aggregates. */
export const roundPulseDatasetSplitLine =
  "2026 rehearsal signals with approved 2012 historical baselines.";

/** Visible footer on Round Pulse / entity cards whose Explore handoff targets the default 2026 rehearsal dataset. */
export const rehearsalExploreFooterLabel = "Open 2026 rehearsal Explore";

/** One-sentence Why this matters above Round Pulse (full `lensInterpretations` stays downstream). */
export const lensWhyMattersCondensed: Record<Lens, string> = {
  all: "This view balances portfolios, IDN representation, and contention clusters for a coordinated rehearsal read.",
  commercial: "This view emphasizes applicant portfolios, organizations, and contention for efficient account research.",
  strategy: "This view emphasizes how the round is structured and where participation patterns differ.",
  marketing: "This view emphasizes cross-region and language patterns that may shape market narratives.",
};

export function lensWhyMattersCondensedLabel(lens: Lens) {
  const name =
    lens === "all"
      ? "All Intelligence"
      : lens === "strategy"
        ? "Product & Strategy"
        : lens === "commercial"
          ? "Commercial"
          : "Marketing";
  return `Why this matters for ${name}`;
}

/** The record set a saved/briefed Explore view or Compare configuration resolves to right now — shared by Saved's change-since-visit count and Briefings' generator/drift disclosure. */
export function recordsForParams(
  kind: "explore-view" | "compare-config",
  params: Record<string, string>,
  applications: Application[] = fixture.applications,
): Application[] {
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
    return filterApplicationsByExplore(applications, filters);
  }
  const type = (params.type as EntityType) ?? "organizations";
  const ids = (params.ids ?? "").split(",").filter(Boolean);
  return ids.flatMap((id) => recordsForEntity(type, id, applications));
}

export function describeCompareSelection(entityType: EntityType, labels: string[]) {
  const singular = entityType === "categories" ? "category" : entityType.slice(0, -1);
  return `Compare ${labels.length} ${labels.length === 1 ? singular : entityType}: ${labels.join(", ")}`;
}

export type SavedComparePromotion = {
  eligible: boolean;
  href: string;
  disabledReason: string;
};

const COMPARE_CAPABLE_ENTITY_TYPES: EntityType[] = ["organizations", "applications", "categories"];

function compareHrefFromSelection(type: EntityType, ids: string[], origin: string, extraParams: Record<string, string> = {}) {
  const params = new URLSearchParams({ type, ids: ids.join(","), origin });
  for (const [key, value] of Object.entries(extraParams)) {
    if (value && !["type", "ids"].includes(key)) params.set(key, value);
  }
  return `${hubPath("/compare")}?${params.toString()}`;
}

/** Validates a saved or derived Compare selection (2–4 like entities that resolve in the fixture). */
export function savedComparePromotionFromParams(
  params: Record<string, string>,
  originLabel: string,
  applications: Application[] = fixture.applications,
): SavedComparePromotion {
  const type = params.type as EntityType;
  if (!COMPARE_CAPABLE_ENTITY_TYPES.includes(type)) {
    return { eligible: false, href: "", disabledReason: "Saved comparison is missing a comparable entity type (organizations, applications, or categories)." };
  }
  const ids = [...new Set((params.ids ?? "").split(",").map((part) => part.trim()).filter(Boolean))];
  if (ids.length < 2) {
    return { eligible: false, href: "", disabledReason: "Compare selected needs at least two like entities." };
  }
  if (ids.length > 4) {
    return { eligible: false, href: "", disabledReason: "Compare supports up to four like entities — narrow this selection." };
  }
  const resolved = ids.filter((id) => recordsForEntity(type, id, applications).length > 0);
  if (resolved.length < 2) {
    return { eligible: false, href: "", disabledReason: "Fewer than two saved entities still resolve in this fixture." };
  }
  return {
    eligible: true,
    href: compareHrefFromSelection(type, resolved.slice(0, 4), originLabel, params),
    disabledReason: "",
  };
}

/** Derives a Compare promotion from a saved Explore cohort when browse mode is entity-comparable. */
export function savedExploreComparePromotion(
  params: Record<string, string>,
  originLabel: string,
  applications: Application[] = fixture.applications,
): SavedComparePromotion {
  const browse = params.entity ?? "applications";
  if (browse === "strings") {
    return { eligible: false, href: "", disabledReason: "Compare is unavailable in Strings browse — reopen in organizations, applications, or categories." };
  }
  const type = browse as EntityType;
  if (!COMPARE_CAPABLE_ENTITY_TYPES.includes(type)) {
    return { eligible: false, href: "", disabledReason: "This saved view is not in a comparable browse mode." };
  }
  const apps = recordsForParams("explore-view", params, applications);
  const keys = type === "applications"
    ? [...new Set(apps.map((record) => record.id))]
    : type === "organizations"
      ? [...new Set(apps.map((record) => record.organization))]
      : [...new Set(apps.map((record) => record.category))];
  if (keys.length < 2) {
    return { eligible: false, href: "", disabledReason: "This cohort has fewer than two comparable entities." };
  }
  if (keys.length > 4) {
    return { eligible: false, href: "", disabledReason: `This cohort matches ${keys.length} entities — narrow filters to four or fewer before comparing.` };
  }
  return { eligible: true, href: compareHrefFromSelection(type, keys, originLabel), disabledReason: "" };
}

export function savedResearchComparePromotion(
  entry: { kind: "explore-view" | "compare-config"; name: string; params: Record<string, string> },
  applications: Application[] = fixture.applications,
): SavedComparePromotion {
  const origin = `Saved Research: ${entry.name}`;
  return entry.kind === "compare-config"
    ? savedComparePromotionFromParams(entry.params, origin, applications)
    : savedExploreComparePromotion(entry.params, origin, applications);
}

export function savedResearchBriefingEligible(
  entry: { kind: "explore-view" | "compare-config"; params: Record<string, string> },
  applications: Application[] = fixture.applications,
): { eligible: boolean; disabledReason: string } {
  if (entry.kind === "compare-config") {
    const promotion = savedComparePromotionFromParams(entry.params, "", applications);
    return promotion.eligible
      ? { eligible: true, disabledReason: "" }
      : { eligible: false, disabledReason: promotion.disabledReason || "Create briefing needs a valid 2–4 entity comparison." };
  }
  if (recordsForParams("explore-view", entry.params, applications).length === 0) {
    return { eligible: false, disabledReason: "No records match this saved cohort — nothing to brief." };
  }
  return { eligible: true, disabledReason: "" };
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

export function buildRoundPulse(
  applications: Application[],
  claimActualityState: ClaimActualityState = DEFAULT_CLAIM_ACTUALITY_STATE,
) {
  return buildCommandCenterRoundPulse(applications, claimActualityState).map((metric) => ({
    id: metric.id,
    label: metric.label,
    value: metric.value,
    delta: metric.deltaLabel ?? "",
    filter: metric.filter,
    methodReadiness: metric.methodReadiness,
    claimReadiness2012: metric.claimReadiness2012,
    claimReadiness2026: metric.claimReadiness2026,
    comparisonAllowed: metric.comparisonAllowed,
    displayTier: metric.displayTier,
    source: metric.source,
    method: metric.method,
    metricId: metric.metricId,
    historicalFact: metric.historicalFact,
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
  strategy: ["contention-concentration", "idn-shift"],
  marketing: ["idn-shift", "portfolio-concentration"],
};

export function standoutInsightsForLens(lens: Lens) {
  const ids = standoutInsightIdsByLens[lens];
  return ids
    .map((id) => standoutInsights.find((insight) => insight.id === id))
    .filter((insight): insight is (typeof standoutInsights)[number] => insight !== undefined);
}

/** Short subtitle under “What You Should Know” — changes with the active View. */
export const lensIntelligenceSubtitles: Record<Lens, string> = {
  all: "All Intelligence view · ranked by materiality and evidence coverage",
  commercial: "Commercial view · portfolio depth and contention exposure surfaced first",
  strategy: "Product & Strategy view · category movement, IDN share, and contention structure first",
  marketing: "Marketing view · cross-region IDN participation and portfolio themes first",
};

/** Per-insight View callout shown on insight cards (same facts, lens-specific emphasis). */
export const lensInsightEmphasis: Record<Lens, Partial<Record<(typeof standoutInsights)[number]["id"], string>>> = {
  all: {},
  commercial: {
    "portfolio-concentration": "Account research priority",
    "contention-concentration": "Contention timing watch",
  },
  strategy: {
    "contention-concentration": "Round-structure signal",
    "idn-shift": "Composition shift",
  },
  marketing: {
    "idn-shift": "Cross-region narrative",
    "portfolio-concentration": "Multi-category brand story",
  },
};

export function insightEmphasisForLens(lens: Lens, insightId: string) {
  const emphasis = lensInsightEmphasis[lens] as Record<string, string | undefined>;
  return emphasis[insightId];
}

/** Round Pulse metric `filter` keys emphasized for the active View (border/tint + VIEW FOCUS marker; values unchanged). */
export const roundPulseEmphasisByLens: Record<Lens, string[]> = {
  all: [],
  commercial: ["organizations", "contention"],
  strategy: ["regions", "idn", "contention"],
  marketing: ["idn", "regions"],
};

/** Semantic VIEW FOCUS label per emphasized Round Pulse card (filter key → marker text). */
export const roundPulseViewFocusByLens: Record<Lens, Partial<Record<string, string>>> = {
  all: {},
  commercial: {
    organizations: "Portfolio depth signal",
    contention: "Contention timing watch",
  },
  strategy: {
    regions: "Composition geography",
    idn: "Composition shift",
    contention: "Round-structure signal",
  },
  marketing: {
    idn: "Cross-region narrative",
    regions: "Geographic reach signal",
  },
};

export function roundPulseViewFocusForLens(lens: Lens, filter: string) {
  return roundPulseViewFocusByLens[lens][filter];
}

const investigationOrganizationOrderByLens: Record<Lens, string[]> = {
  all: ["Atlas Digital", "Northstar Group", "Kizuna Registry"],
  commercial: ["Atlas Digital", "Northstar Group", "Kizuna Registry"],
  strategy: ["Kizuna Registry", "Atlas Digital", "Northstar Group"],
  marketing: ["Kizuna Registry", "Atlas Digital", "Northstar Group"],
};

/** Investigation queue ordering — same three organizations, lens-prioritized ranking. */
export function applicantsInvestigationQueueForLens(lens: Lens, applications: Application[] = fixture.applications) {
  const order = investigationOrganizationOrderByLens[lens];
  const watchlist = buildApplicantsToWatch(applications);
  return [...watchlist].sort((a, b) => {
    const ai = order.indexOf(a.organization);
    const bi = order.indexOf(b.organization);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

export const investigationQueueLensNote: Record<Lens, string> = {
  all: "portfolio size, category breadth, contention exposure, IDN participation, and returning status are transparent fixture rules.",
  commercial:
    "this View ranks by portfolio depth and contention exposure first — efficient account-research starting points, not sales recommendations.",
  strategy:
    "this View ranks by category span, IDN participation, and contention patterns that shape round composition versus the 2012 fixture cohort.",
  marketing:
    "this View ranks by cross-region IDN participation and multi-category organizations — evidence-backed themes only, not demand forecasts.",
};

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
export function computeWatchlistIntelligence(
  items: { entityType: EntityType; entityKey: string; recordCountAtAdd: number }[],
  applications: Application[] = fixture.applications,
) {
  let changed = 0;
  const records = items.flatMap((item) => {
    const current = recordsForEntity(item.entityType, item.entityKey, applications);
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
