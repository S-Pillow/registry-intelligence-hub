export const SANITIZED_LIVE_PROVENANCE_MANIFEST_VERSION =
  "icann2012-rsp-sanitized-live-provenance/1.0.0" as const;

export type SanitizedLiveProvenancePagePin = {
  pageOrdinal: number;
  relativePath: string;
  contentSha256: string;
  pageKind: "VIEWSTATUS_GRID" | "ICANN_ERROR_PAGE";
};

export type SanitizedLiveProvenanceManifest = {
  manifestVersion: typeof SANITIZED_LIVE_PROVENANCE_MANIFEST_VERSION;
  runId: string;
  /** Git commit that first committed these RESTRICTED_RAW_SOURCE bytes (P0.3D). */
  fixtureSourceGitCommit: string;
  pages: SanitizedLiveProvenancePagePin[];
  manifestSha256: string;
};
