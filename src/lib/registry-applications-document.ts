import type { Application, HistoricalContext } from "@/lib/registry-data";

export type RegistryApplicationsDocument = {
  payloadVersion: string;
  payloadMode?: "rehearsal" | "promoted-2026" | "historical-2012";
  fixtureId?: string;
  snapshotId: string;
  snapshotContentHash?: string;
  publicationSchemaVersion?: string;
  baselineAt: string;
  retrievedAt: string;
  checkedAt: string;
  changedAt: string;
  parserVersion: string;
  methodVersion: string;
  sourceHealth: {
    status: string;
    recordsCovered: number;
    recordsTotal: number;
    requiredFieldsCovered: number;
    requiredFieldsTotal: number;
    gaps: {
      status: string;
      source: string;
      detail: string;
      affected: string;
    }[];
  };
  historicalContext: HistoricalContext;
  source: { name: string; url: string; evidenceClass: string };
  limitations: string[];
  applications: Application[];
};
