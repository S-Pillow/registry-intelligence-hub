export const SANITIZED_LIVE_FIXTURE_MANIFEST_VERSION =
  "icann2012-rsp-sanitized-live-fixture-manifest/1.0.0" as const;

export type SanitizedLiveFixturePagePin = {
  pageOrdinal: number;
  relativePath: string;
  /** SHA-256 of sanitized HTML bytes on disk. */
  contentSha256: string;
  /** Present for page 0001 — RESTRICTED_RAW_SOURCE capture provenance (never compared to sanitized bytes). */
  rawSourceSha256?: string;
  pageKind: "VIEWSTATUS_GRID" | "ICANN_ERROR_PAGE";
};

export type SanitizedLiveFixtureManifest = {
  manifestVersion: typeof SANITIZED_LIVE_FIXTURE_MANIFEST_VERSION;
  runId: string;
  /** Git commit that first committed these fixture bytes (P0.3D). */
  fixtureSourceGitCommit: string;
  manifestDeclaredSha256: string;
  pages: SanitizedLiveFixturePagePin[];
};
