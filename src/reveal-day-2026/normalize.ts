import type { Normalized2026Observation, Registry2026ApplicationRow } from "./types";

export type NormalizationResult = {
  observations: Normalized2026Observation[];
  unresolvedFields: string[];
};

export function normalizeApplications(rows: Registry2026ApplicationRow[]): NormalizationResult {
  const unresolvedFields: string[] = [];
  const observations: Normalized2026Observation[] = [];

  for (const row of rows) {
    if (row.replacement !== null && row.replacement !== undefined && row.replacement === "") {
      unresolvedFields.push(`${row.id}:replacement-empty-string`);
    }
    if (row.confidence < 0 || row.confidence > 1) {
      unresolvedFields.push(`${row.id}:confidence-out-of-range`);
    }

    observations.push({
      applicationId: row.id,
      stringUlabel: row.string,
      aLabel: row.idn ? (row.aLabel ?? null) : null,
      isIdn: row.idn,
      applicantLegalName: row.applicant.trim(),
      organizationLabel: row.organization.trim(),
      jurisdiction: row.country.trim(),
      region: row.region.trim(),
      contentionSetId: row.contentionSet,
    });
  }

  return {
    observations,
    unresolvedFields: [...new Set(unresolvedFields)].sort(),
  };
}

export function summarizeNormalization(observations: Normalized2026Observation[]) {
  return {
    observationCount: observations.length,
    uniqueStrings: new Set(observations.map((o) => o.stringUlabel)).size,
    idnApplications: observations.filter((o) => o.isIdn).length,
    distinctOrganizations: new Set(observations.map((o) => o.organizationLabel)).size,
  };
}
