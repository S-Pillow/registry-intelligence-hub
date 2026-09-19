/**
 * Deterministic reconciliation between PDF-extracted contention-set entities and
 * ICANN's cited 232-set count. Membership (754 applications) is preserved separately.
 */

export const ICANN_CITED_CONTENTION_SET_COUNT = 232;
export const OFFICIAL_CONTENTION_MEMBERSHIP_COUNT = 754;

export interface ContentionSetRecord {
  setId: string;
  matchKind: "exact" | "similarity" | string;
  applicationIds: string[];
  sourceSetNumber?: string | null;
}

export interface ContentionAdjustment {
  kind: "pdf_number_row_artifact" | "csv_string_label_boundary";
  setIds: string[];
  entityCountDelta: number;
  explanation: string;
}

export interface ContentionReconciliationReport {
  reportVersion: "contention-reconciliation/1.0.0";
  extractorSetEntityCount: number;
  icannCitedSetEntityCount: number;
  officialMembershipApplicationCount: number;
  uniqueMembershipApplicationIds: number;
  membershipMatchesOfficial: boolean;
  reconciledSetEntityCount: number;
  setEntityGap: number;
  /** Extractor entities after dissolving numbered-row artifacts (before label-group reconciliation). */
  extractorEntityCountAfterArtifactDissolve: number;
  /** Remaining entity gap explained by per-string fragmentation across multiple extracted set ids. */
  stringFragmentationEntityDelta: number;
  adjustments: ContentionAdjustment[];
  productionSetCountIntelligence: "blocked";
  notes: string[];
}

/** PDF text used the same label for both applications in this pair. */
const PDF_STRING_LABEL_ALIASES: Record<string, string> = {
  dotafrica: "africa",
};

export function contentionStringKey(csvString: string): string {
  const lower = csvString.toLowerCase();
  return PDF_STRING_LABEL_ALIASES[lower] ?? lower;
}

export function buildStringByApplicationId(
  rows: Array<{ applicationId: string; stringUlabel: string }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.applicationId, row.stringUlabel);
  }
  return map;
}

function distinctCsvStringsInSet(set: ContentionSetRecord, stringByApp: Map<string, string>): string[] {
  const labels = new Set<string>();
  for (const appId of set.applicationIds) {
    const label = stringByApp.get(appId);
    if (label) labels.add(label.toLowerCase());
  }
  return [...labels].sort();
}

function detectPdfNumberRowArtifacts(
  sets: ContentionSetRecord[],
  stringByApp: Map<string, string>,
): ContentionAdjustment[] {
  const artifacts: ContentionAdjustment[] = [];
  for (const set of sets) {
    if (set.matchKind !== "exact" || !set.sourceSetNumber) continue;
    const strings = distinctCsvStringsInSet(set, stringByApp);
    if (strings.length <= 1) continue;
    artifacts.push({
      kind: "pdf_number_row_artifact",
      setIds: [set.setId],
      entityCountDelta: -1,
      explanation:
        `PDF row prefix set number ${set.sourceSetNumber} was parsed as one entity but spans ${strings.length} distinct Reveal Day strings ` +
        `(${strings.slice(0, 4).join(", ")}${strings.length > 4 ? ", …" : ""}); remaining members appear in separate extracted entities.`,
    });
  }
  return artifacts;
}

function detectStringLabelBoundaryAdjustments(
  sets: ContentionSetRecord[],
  stringByApp: Map<string, string>,
): ContentionAdjustment[] {
  const adjustments: ContentionAdjustment[] = [];
  for (const set of sets) {
    const strings = distinctCsvStringsInSet(set, stringByApp);
    if (strings.length <= 1) continue;
    const keys = new Set(strings.map((s) => contentionStringKey(s)));
    if (keys.size === 1) {
      adjustments.push({
        kind: "csv_string_label_boundary",
        setIds: [set.setId],
        entityCountDelta: 0,
        explanation:
          `Set ${set.setId} lists CSV strings ${strings.join(" / ")} but ICANN PDF string-similarity tables used one label (${[...keys][0]}); ` +
          "counts as one official set — no entity delta, documents CSV↔PDF label boundary.",
      });
    }
  }
  return adjustments;
}

/**
 * ICANN-aligned set count: 2 similarity sets plus one entity per contested Reveal Day
 * string label (PDF label key), unioning membership across all extracted entities.
 */
export function countReconciledSetEntities(sets: ContentionSetRecord[], stringByApp: Map<string, string>): number {
  const similarity = sets.filter((s) => s.matchKind === "similarity").length;
  const similarityApps = new Set<string>();
  for (const set of sets) {
    if (set.matchKind === "similarity") {
      for (const appId of set.applicationIds) similarityApps.add(appId);
    }
  }

  const appsByLabelKey = new Map<string, Set<string>>();
  for (const set of sets) {
    if (set.matchKind === "similarity") continue;
    for (const appId of set.applicationIds) {
      if (similarityApps.has(appId)) continue;
      const csv = stringByApp.get(appId);
      if (!csv) continue;
      const key = contentionStringKey(csv);
      const bucket = appsByLabelKey.get(key) ?? new Set<string>();
      bucket.add(appId);
      appsByLabelKey.set(key, bucket);
    }
  }

  let exactGroups = 0;
  for (const members of appsByLabelKey.values()) {
    if (members.size > 1) exactGroups += 1;
  }
  return similarity + exactGroups;
}

export function reconcileContentionSets(
  sets: ContentionSetRecord[],
  stringByApp: Map<string, string>,
  membershipCounts: { applicationMembershipCount: number; uniqueApplicationIds: number },
): ContentionReconciliationReport {
  const artifactAdjustments = detectPdfNumberRowArtifacts(sets, stringByApp);
  const boundaryAdjustments = detectStringLabelBoundaryAdjustments(sets, stringByApp);
  const extractorSetEntityCount = sets.length;
  const reconciledSetEntityCount = countReconciledSetEntities(sets, stringByApp);
  const entityDeltaFromArtifacts = artifactAdjustments.reduce((sum, a) => sum + a.entityCountDelta, 0);
  const extractorEntityCountAfterArtifactDissolve = extractorSetEntityCount + entityDeltaFromArtifacts;

  const notes = [
    "Official membership (754 applications) is authoritative for per-application contention exposure; extracted set-entity ids remain usable for lineage.",
    "Set-entity totals are not approved for Command Center / Explore / Compare / Briefings until this reconciliation report passes gates in 2012-comparison-baseline-contract.md.",
  ];

  if (reconciledSetEntityCount !== ICANN_CITED_CONTENTION_SET_COUNT) {
    notes.push(
      `Reconciled set-entity count ${reconciledSetEntityCount} does not match ICANN cited ${ICANN_CITED_CONTENTION_SET_COUNT} — review extractor grouping.`,
    );
  }

  if (extractorEntityCountAfterArtifactDissolve !== reconciledSetEntityCount) {
    notes.push(
      `Extractor entities ${extractorSetEntityCount} + artifact delta ${entityDeltaFromArtifacts} = ${extractorEntityCountAfterArtifactDissolve}; ` +
        `ICANN-aligned label groups = ${reconciledSetEntityCount} (remaining gap is per-string fragmentation in extracted entities, not membership).`,
    );
  }

  return {
    reportVersion: "contention-reconciliation/1.0.0",
    extractorSetEntityCount,
    icannCitedSetEntityCount: ICANN_CITED_CONTENTION_SET_COUNT,
    officialMembershipApplicationCount: OFFICIAL_CONTENTION_MEMBERSHIP_COUNT,
    uniqueMembershipApplicationIds: membershipCounts.uniqueApplicationIds,
    membershipMatchesOfficial:
      membershipCounts.uniqueApplicationIds === OFFICIAL_CONTENTION_MEMBERSHIP_COUNT &&
      membershipCounts.applicationMembershipCount === OFFICIAL_CONTENTION_MEMBERSHIP_COUNT,
    reconciledSetEntityCount,
    setEntityGap: extractorSetEntityCount - ICANN_CITED_CONTENTION_SET_COUNT,
    extractorEntityCountAfterArtifactDissolve,
    stringFragmentationEntityDelta: extractorEntityCountAfterArtifactDissolve - reconciledSetEntityCount,
    adjustments: [...artifactAdjustments, ...boundaryAdjustments],
    productionSetCountIntelligence: "blocked",
    notes,
  };
}
