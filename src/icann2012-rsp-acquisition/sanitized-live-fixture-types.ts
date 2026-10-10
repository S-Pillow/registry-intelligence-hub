export const SANITIZED_LIVE_FIXTURE_MANIFEST_VERSION =
  "icann2012-rsp-sanitized-live-fixture-manifest/3.0.0" as const;

export type SanitizedLiveFixturePageKind = "VIEWSTATUS_GRID" | "ICANN_ERROR_PAGE";

export type SanitizedLiveFixturePagePin = {
  pageOrdinal: number;
  sanitizedHtmlRelativePath: string;
  sanitizedHtmlSha256: string;
  sourceHtmlSha256: string;
  sourceFetchSha256?: string;
  sanitizedFetchMetadataRelativePath?: string;
  sanitizedFetchMetadataSha256?: string;
  pageKind: SanitizedLiveFixturePageKind;
};

export type SanitizedLiveFixtureManifest = {
  manifestVersion: typeof SANITIZED_LIVE_FIXTURE_MANIFEST_VERSION;
  runId: string;
  fixturePurpose?: string;
  fixtureSourceGitCommit?: string;
  manifestSha256: string;
  pages: SanitizedLiveFixturePagePin[];
};
