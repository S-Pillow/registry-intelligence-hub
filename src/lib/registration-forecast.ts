/**
 * RIH-FCAST-01 — Experimental registration forecast foundation.
 *
 * Toyroom-inspired year-four range using suffix-demand × conversion factors.
 * Numeric forecasts are emitted only when legitimate domain-name-level demand
 * evidence is supplied. ICANN MRR TLD totals are not suffix-demand and must not
 * be silently substituted.
 */

import type { BrowserApplicationV2, RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import { resolveSelectedStringStatus } from "@/lib/application-string-status";

/** Public experimental conversion band inspired by Toyroom's published .web IQR/center. */
export const FORECAST_CONVERSION_FACTORS = {
  conservative: 0.8,
  expected: 1.9,
  optimistic: 3.2,
} as const;

export const FORECAST_HORIZON_LABEL = "approximately four years after launch";

export const FORECAST_ESTIMATE_DISCLAIMER =
  "These figures are experimental estimates, not facts. They do not predict contention outcomes, auction winners, pricing, or official awards.";

export type ForecastScenarioRange = {
  conservative: number;
  expected: number;
  optimistic: number;
};

export type SuffixDemandEvidence =
  | {
      status: "available";
      domainCount: number;
      sourceId: string;
      sourceLabel: string;
      coverageNote: string;
    }
  | {
      status: "unavailable";
      domainCount: null;
      sourceId: null;
      sourceLabel: string;
      coverageNote: string;
      blocker: string;
      simplestAlternative: string;
    };

export type ForecastUnit = {
  stringLabel: string;
  unicodeLabel: string | null;
  applicantCount: number;
  applicantLegalNames: string[];
  applicationIds: string[];
  brandApplicationCount: number;
  contested: boolean;
  officialContentionSetIds: string[];
  /** True when the label is an ASCII compound/word-like token suitable for the experimental band. */
  compoundWordCandidate: boolean;
};

export type ForecastRowStatus =
  | "ready"
  | "demand_unavailable"
  | "excluded_brand"
  | "conversion_not_recommended";

export type ForecastRow = {
  stringLabel: string;
  unicodeLabel: string | null;
  status: ForecastRowStatus;
  contested: boolean;
  officialContentionSetIds: string[];
  applicantCount: number;
  applicantLegalNames: string[];
  compoundWordCandidate: boolean;
  suffixDemandCount: number | null;
  range: ForecastScenarioRange | null;
  statusNote: string;
};

/**
 * Curated representative strings for the v1 example surface.
 * Chosen to span contested vs uncontested and word-like tokens present in the
 * portable SCD cohort / live publication when available.
 */
export const FORECAST_V1_EXAMPLE_STRINGS = [
  "master", // selected replacement, uncontested in SCD capture
  "force", // contested
  "hub",
  "api",
  "wealth",
  "connect",
  "therapy",
  "flow",
  "stack",
  "fresh", // uncontested example
  "bold",
  "buddy",
] as const;

export function isCompoundWordCandidate(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  if (!normalized) return false;
  // Experimental band is intended for word-like / compound tokens, not 1–2 char stubs.
  if (normalized.length < 3) return false;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(normalized)) return false;
  return true;
}

/**
 * Apply transparent experimental conversions to a measured suffix-demand count.
 * Returns integer registrations (rounded). Does not invent demand.
 */
export function estimateRegistrationsFromSuffixDemand(domainCount: number): ForecastScenarioRange {
  if (!Number.isFinite(domainCount) || domainCount < 0) {
    throw new Error("suffix-demand domainCount must be a finite number >= 0");
  }
  return {
    conservative: Math.round(domainCount * FORECAST_CONVERSION_FACTORS.conservative),
    expected: Math.round(domainCount * FORECAST_CONVERSION_FACTORS.expected),
    optimistic: Math.round(domainCount * FORECAST_CONVERSION_FACTORS.optimistic),
  };
}

export function defaultUnavailableSuffixDemandEvidence(): SuffixDemandEvidence {
  return {
    status: "unavailable",
    domainCount: null,
    sourceId: null,
    sourceLabel: "Domain-name-level suffix-demand evidence",
    coverageNote:
      "ICANN Monthly Registry Reports provide TLD-level registration totals only. They do not contain individual domain names and cannot measure suffix demand.",
    blocker:
      "No approved domain-name-level dataset (bounded zone-file panel or licensed domain index) is currently accessible in this environment. CZDS/zone-file access is credentialed and not configured.",
    simplestAlternative:
      "Authorize a bounded, redistributable domain-name sample or approved CZDS/zone-file panel for a fixed reference set of existing open gTLDs, then compute suffix-demand counts for applied-for strings against that panel.",
  };
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

/**
 * Build one forecast unit per unique selected/current string.
 * Brand-only strings are retained for explicit exclusion messaging when requested,
 * but `buildForecastRows` excludes confirmed brand use cases from numeric output.
 */
export function buildForecastUnits(
  document: RegistryApplicationsDocumentV2,
): ForecastUnit[] {
  const byString = new Map<
    string,
    {
      unicodeLabel: string | null;
      applicants: Set<string>;
      applicationIds: string[];
      brandApplicationCount: number;
      contested: boolean;
      setIds: Set<string>;
    }
  >();

  for (const app of document.applications) {
    const selected = resolveSelectedStringStatus(app);
    if (selected.selectionMode === "unresolved") continue;
    if (selected.currentApplicationStatus === "Withdrawn") continue;
    const label = selected.selectedCurrentString.trim().toLowerCase();
    if (!label) continue;

    const entry = byString.get(label) ?? {
      unicodeLabel: app.appliedString?.unicodeLabel ?? app.replacementString?.unicodeLabel ?? null,
      applicants: new Set<string>(),
      applicationIds: [],
      brandApplicationCount: 0,
      contested: false,
      setIds: new Set<string>(),
    };
    entry.applicants.add(app.applicant);
    entry.applicationIds.push(app.applicationId);
    if (app.designations.brand) entry.brandApplicationCount += 1;
    const oc = app.officialContention;
    if (oc?.membershipPresent) {
      entry.contested = true;
      for (const id of oc.officialContentionSetIds) entry.setIds.add(id);
    }
    byString.set(label, entry);
  }

  return [...byString.entries()]
    .map(([stringLabel, entry]) => ({
      stringLabel,
      unicodeLabel: entry.unicodeLabel,
      applicantCount: entry.applicants.size,
      applicantLegalNames: [...entry.applicants].sort((a, b) => a.localeCompare(b)),
      applicationIds: [...entry.applicationIds].sort(),
      brandApplicationCount: entry.brandApplicationCount,
      contested: entry.contested,
      officialContentionSetIds: [...entry.setIds].sort(),
      compoundWordCandidate: isCompoundWordCandidate(stringLabel),
    }))
    .sort((a, b) => a.stringLabel.localeCompare(b.stringLabel));
}

/** Confirmed closed-brand use: every Application for the string is Brand-designated. */
export function isConfirmedClosedBrandUnit(unit: ForecastUnit): boolean {
  return unit.brandApplicationCount > 0 && unit.brandApplicationCount === unit.applicationIds.length;
}

export function buildForecastRow(
  unit: ForecastUnit,
  demand: SuffixDemandEvidence,
): ForecastRow {
  if (isConfirmedClosedBrandUnit(unit)) {
    return {
      stringLabel: unit.stringLabel,
      unicodeLabel: unit.unicodeLabel,
      status: "excluded_brand",
      contested: unit.contested,
      officialContentionSetIds: unit.officialContentionSetIds,
      applicantCount: unit.applicantCount,
      applicantLegalNames: unit.applicantLegalNames,
      compoundWordCandidate: unit.compoundWordCandidate,
      suffixDemandCount: null,
      range: null,
      statusNote: "Excluded: confirmed closed-brand use case (all Applications for this string are Brand-designated).",
    };
  }

  if (demand.status !== "available") {
    return {
      stringLabel: unit.stringLabel,
      unicodeLabel: unit.unicodeLabel,
      status: "demand_unavailable",
      contested: unit.contested,
      officialContentionSetIds: unit.officialContentionSetIds,
      applicantCount: unit.applicantCount,
      applicantLegalNames: unit.applicantLegalNames,
      compoundWordCandidate: unit.compoundWordCandidate,
      suffixDemandCount: null,
      range: null,
      statusNote: demand.blocker,
    };
  }

  if (!unit.compoundWordCandidate) {
    return {
      stringLabel: unit.stringLabel,
      unicodeLabel: unit.unicodeLabel,
      status: "conversion_not_recommended",
      contested: unit.contested,
      officialContentionSetIds: unit.officialContentionSetIds,
      applicantCount: unit.applicantCount,
      applicantLegalNames: unit.applicantLegalNames,
      compoundWordCandidate: false,
      suffixDemandCount: demand.domainCount,
      range: null,
      statusNote:
        "Suffix-demand was measured, but the experimental 0.8 / 1.9 / 3.2 conversion band is reserved for word-like / compound strings (length ≥ 3).",
    };
  }

  return {
    stringLabel: unit.stringLabel,
    unicodeLabel: unit.unicodeLabel,
    status: "ready",
    contested: unit.contested,
    officialContentionSetIds: unit.officialContentionSetIds,
    applicantCount: unit.applicantCount,
    applicantLegalNames: unit.applicantLegalNames,
    compoundWordCandidate: true,
    suffixDemandCount: demand.domainCount,
    range: estimateRegistrationsFromSuffixDemand(demand.domainCount),
    statusNote: `Experimental estimate from suffix-demand × conversion (${FORECAST_CONVERSION_FACTORS.conservative} / ${FORECAST_CONVERSION_FACTORS.expected} / ${FORECAST_CONVERSION_FACTORS.optimistic}). Horizon: ${FORECAST_HORIZON_LABEL}.`,
  };
}

export function selectExampleForecastUnits(
  units: ReadonlyArray<ForecastUnit>,
  exampleLabels: ReadonlyArray<string> = FORECAST_V1_EXAMPLE_STRINGS,
): ForecastUnit[] {
  const byLabel = new Map(units.map((u) => [u.stringLabel, u]));
  const selected: ForecastUnit[] = [];
  for (const label of exampleLabels) {
    const unit = byLabel.get(label.toLowerCase());
    if (unit) selected.push(unit);
  }
  return selected;
}

export function buildExampleForecastRows(
  document: RegistryApplicationsDocumentV2,
  demandByString: ReadonlyMap<string, SuffixDemandEvidence> | null,
  fallbackDemand: SuffixDemandEvidence = defaultUnavailableSuffixDemandEvidence(),
): ForecastRow[] {
  const units = selectExampleForecastUnits(buildForecastUnits(document));
  return units.map((unit) => {
    const demand = demandByString?.get(unit.stringLabel) ?? fallbackDemand;
    return buildForecastRow(unit, demand);
  });
}

/** Helper for tests: synthetic available demand evidence. */
export function syntheticAvailableDemand(
  domainCount: number,
  sourceId = "synthetic-suffix-demand-fixture",
): SuffixDemandEvidence {
  return {
    status: "available",
    domainCount,
    sourceId,
    sourceLabel: "Synthetic suffix-demand fixture",
    coverageNote: "Test-only domain-name counts. Not production evidence.",
  };
}

export function summarizeForecastCoverage(rows: ReadonlyArray<ForecastRow>): {
  exampleCount: number;
  readyCount: number;
  demandUnavailableCount: number;
  excludedBrandCount: number;
  contestedExampleCount: number;
} {
  return {
    exampleCount: rows.length,
    readyCount: rows.filter((r) => r.status === "ready").length,
    demandUnavailableCount: rows.filter((r) => r.status === "demand_unavailable").length,
    excludedBrandCount: rows.filter((r) => r.status === "excluded_brand").length,
    contestedExampleCount: rows.filter((r) => r.contested).length,
  };
}

export function listUniqueStrings(units: ReadonlyArray<ForecastUnit>): string[] {
  return uniqueSorted(units.map((u) => u.stringLabel));
}

/** Exported for focused eligibility tests that need Application grain fixtures. */
export type { BrowserApplicationV2 };
