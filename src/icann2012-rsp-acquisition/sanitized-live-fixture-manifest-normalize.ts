import { basename } from "node:path";
import {
  SANITIZED_LIVE_FIXTURE_MANIFEST_VERSION,
  type SanitizedLiveFixtureManifest,
  type SanitizedLiveFixturePageKind,
  type SanitizedLiveFixturePagePin,
} from "./sanitized-live-fixture-types";

type OperatorExportPagePin = {
  sanitizedHtmlRelativePath: string;
  sanitizedHtmlSha256: string;
  sourceHtmlSha256: string;
  sourceFetchSha256?: string;
  sanitizedFetchMetadataRelativePath?: string;
  sanitizedFetchMetadataSha256?: string;
};

function pageOrdinalFromManifestKey(key: string): number {
  const match = /^page-(\d+)$/.exec(key);
  if (!match) {
    throw new Error(`Unsupported sanitized-live fixture page key: ${key}`);
  }
  return Number.parseInt(match[1]!, 10);
}

function defaultPageKind(pageOrdinal: number): SanitizedLiveFixturePageKind {
  return pageOrdinal === 2 ? "ICANN_ERROR_PAGE" : "VIEWSTATUS_GRID";
}

function normalizeManifest3Pages(raw: Record<string, unknown>): SanitizedLiveFixturePagePin[] {
  const pages = raw.pages;
  if (!Array.isArray(pages)) {
    throw new Error("sanitized-live fixture manifest/3.0.0 missing pages array");
  }
  return pages as SanitizedLiveFixturePagePin[];
}

function normalizeOperatorExportPages(raw: Record<string, unknown>): SanitizedLiveFixturePagePin[] {
  const pagesRecord = raw.pages;
  if (pagesRecord == null || typeof pagesRecord !== "object" || Array.isArray(pagesRecord)) {
    throw new Error("sanitized-live operator export manifest missing pages object");
  }

  return Object.entries(pagesRecord as Record<string, OperatorExportPagePin>)
    .map(([key, pin]) => {
      const pageOrdinal = pageOrdinalFromManifestKey(key);
      const relativePath = pin.sanitizedHtmlRelativePath;
      return {
        pageOrdinal,
        sanitizedHtmlRelativePath: relativePath.includes("/") ? basename(relativePath) : relativePath,
        sanitizedHtmlSha256: pin.sanitizedHtmlSha256,
        sourceHtmlSha256: pin.sourceHtmlSha256,
        sourceFetchSha256: pin.sourceFetchSha256,
        sanitizedFetchMetadataRelativePath: pin.sanitizedFetchMetadataRelativePath,
        sanitizedFetchMetadataSha256: pin.sanitizedFetchMetadataSha256,
        pageKind: defaultPageKind(pageOrdinal),
      };
    })
    .sort((a, b) => a.pageOrdinal - b.pageOrdinal);
}

/** Accept manifest/3.0.0 JSON or committed operator-export bundle JSON (same file-body pin). */
export function normalizeSanitizedLiveFixtureManifest(
  raw: Record<string, unknown>,
): SanitizedLiveFixtureManifest {
  if (raw.manifestVersion === SANITIZED_LIVE_FIXTURE_MANIFEST_VERSION) {
    return {
      manifestVersion: SANITIZED_LIVE_FIXTURE_MANIFEST_VERSION,
      runId: String(raw.runId ?? ""),
      fixturePurpose: typeof raw.fixturePurpose === "string" ? raw.fixturePurpose : undefined,
      fixtureSourceGitCommit:
        typeof raw.fixtureSourceGitCommit === "string" ? raw.fixtureSourceGitCommit : undefined,
      manifestSha256: String(raw.manifestSha256 ?? ""),
      pages: normalizeManifest3Pages(raw),
    };
  }

  if (typeof raw.bundleVersion === "string") {
    return {
      manifestVersion: SANITIZED_LIVE_FIXTURE_MANIFEST_VERSION,
      runId: typeof raw.sourceRunId === "string" ? raw.sourceRunId : "mapping-20260922-vps-01",
      fixturePurpose: typeof raw.purpose === "string" ? raw.purpose : undefined,
      fixtureSourceGitCommit:
        typeof raw.operatorCommitSha === "string" ? raw.operatorCommitSha : undefined,
      manifestSha256: String(raw.manifestSha256 ?? ""),
      pages: normalizeOperatorExportPages(raw),
    };
  }

  throw new Error(
    `Unsupported sanitized-live fixture manifest shape (manifestVersion=${String(raw.manifestVersion)}, bundleVersion=${String(raw.bundleVersion)})`,
  );
}
