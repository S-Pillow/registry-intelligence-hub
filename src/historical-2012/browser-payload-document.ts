import type { Application } from "@/lib/registry-data";

export type Registry2012BrowserProvenance = {
  normalizationBundleId: string;
  normalizationBundleVersion: number;
  inputContentHash: string;
  csvSnapshotId: string;
  csvContentSha256: string;
  roundProgramYear: 2012;
  applicationIdStrategy: "icann-application-id";
};

export type Registry2012ApplicationsDocument = {
  payloadVersion: string;
  payloadMode: "historical-2012";
  roundProgramYear: 2012;
  fixtureId: string;
  snapshotId: string;
  corpusContentHash: string;
  provenance: Registry2012BrowserProvenance;
  baselineAt: string;
  retrievedAt: string;
  checkedAt: string;
  changedAt: string;
  parserVersion: string;
  methodVersion: string;
  source: { name: string; url: string; evidenceClass: string };
  limitations: string[];
  applications: Application[];
};
