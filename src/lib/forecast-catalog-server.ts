/**
 * Server-only forecast catalog loader (RIH-FCAST-06 / 06A / 07A).
 *
 * Access modes:
 * - Local preview: NODE_ENV=development + RIH_FORECAST_LOCAL_PREVIEW=1
 *   → unpublished candidate (SHA-pinned) or derive from accepted preview
 * - Production publication: RIH_FORECAST_PUBLICATION_ENABLED=1 (any NODE_ENV)
 *   → approved release artifact only (fail-closed; never falls back to local preview)
 *
 * Never exposes absolute host paths to the browser view model.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  FORECAST_LOCAL_PREVIEW_EXPECTED_SHA256,
  FORECAST_LOCAL_PREVIEW_EXPECTED_SOURCE_AGGREGATE_SHA256,
  FORECAST_LOCAL_PREVIEW_RELATIVE_PATH,
  isForecastLocalPreviewEnabled,
} from "@/lib/forecast-local-preview";
import { validateForecastPreviewDocument, sha256Hex } from "@/lib/forecast-local-preview-server";
import { isForecastPublicationEnabled } from "@/lib/forecast-publication-gate";
import {
  FORECAST_PUBLICATION_CANDIDATE_EXPECTED_SHA256,
  FORECAST_PUBLICATION_CANDIDATE_RELATIVE_PATH,
  buildForecastPublicationCandidate,
  projectForecastCatalogView,
  stableStringifyForecastCandidate,
  type ForecastCatalogView,
  type ForecastPublicationCandidate,
} from "@/lib/forecast-publication-candidate";
import {
  FORECAST_RELEASE_ARTIFACT_EXPECTED_SHA256,
  isForecastReleaseArtifact,
  projectForecastCatalogViewFromRelease,
  resolveForecastPublicationArtifactPath,
} from "@/lib/forecast-publication-release";

export type LoadForecastCatalogResult =
  | { status: "ok"; catalog: ForecastCatalogView; candidateSha256: string; mode: "local-preview" | "production-release" }
  | { status: "disabled" }
  | { status: "error"; reason: string };

function isPublicationCandidate(value: unknown): value is ForecastPublicationCandidate {
  if (!value || typeof value !== "object") return false;
  const doc = value as ForecastPublicationCandidate;
  return (
    doc.schemaVersion === 1 &&
    doc.kind === "experimental-registration-forecast-publication-candidate" &&
    doc.status === "unpublished-candidate" &&
    Array.isArray(doc.strings)
  );
}

function isMissingFileError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as NodeJS.ErrnoException).code === "ENOENT"
  );
}

async function loadAcceptedPreview(cwd: string): Promise<{
  raw: Buffer;
  doc: ReturnType<typeof validateForecastPreviewDocument>;
}> {
  const absolutePath = path.resolve(cwd, FORECAST_LOCAL_PREVIEW_RELATIVE_PATH);
  const raw = await readFile(absolutePath);
  const parsed = JSON.parse(raw.toString("utf8")) as unknown;
  const doc = validateForecastPreviewDocument(parsed, {
    expectedPreviewSha256: FORECAST_LOCAL_PREVIEW_EXPECTED_SHA256,
    expectedSourceAggregateSha256: FORECAST_LOCAL_PREVIEW_EXPECTED_SOURCE_AGGREGATE_SHA256,
    rawBytes: raw,
  });
  return { raw, doc };
}

export async function buildAndOptionallyWritePublicationCandidate(options?: {
  cwd?: string;
  write?: boolean;
}): Promise<{ candidate: ForecastPublicationCandidate; sha256: string; wrote: boolean }> {
  const cwd = options?.cwd ?? process.cwd();
  const { raw, doc } = await loadAcceptedPreview(cwd);
  const candidate = buildForecastPublicationCandidate({
    preview: doc,
    sourcePreviewSha256: sha256Hex(raw),
  });
  const serialized = stableStringifyForecastCandidate(candidate);
  const sha256 = createHash("sha256").update(serialized).digest("hex");
  let wrote = false;
  if (options?.write) {
    const outPath = path.resolve(cwd, FORECAST_PUBLICATION_CANDIDATE_RELATIVE_PATH);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, serialized, "utf8");
    wrote = true;
  }
  return { candidate, sha256, wrote };
}

function acceptCandidateBytes(rawCandidate: Buffer): LoadForecastCatalogResult {
  const fileSha = sha256Hex(rawCandidate);
  if (fileSha !== FORECAST_PUBLICATION_CANDIDATE_EXPECTED_SHA256) {
    return { status: "error", reason: "Publication candidate SHA-256 mismatch" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawCandidate.toString("utf8")) as unknown;
  } catch {
    return { status: "error", reason: "Publication candidate malformed" };
  }

  if (!isPublicationCandidate(parsed)) {
    return { status: "error", reason: "Publication candidate malformed" };
  }
  if (
    parsed.sourcePreviewSha256 !== FORECAST_LOCAL_PREVIEW_EXPECTED_SHA256 ||
    parsed.sourceAggregateSha256 !== FORECAST_LOCAL_PREVIEW_EXPECTED_SOURCE_AGGREGATE_SHA256
  ) {
    return { status: "error", reason: "Publication candidate source hash mismatch" };
  }

  return {
    status: "ok",
    catalog: projectForecastCatalogView(parsed),
    candidateSha256: fileSha,
    mode: "local-preview",
  };
}

function acceptReleaseBytes(rawRelease: Buffer): LoadForecastCatalogResult {
  const fileSha = sha256Hex(rawRelease);
  if (fileSha !== FORECAST_RELEASE_ARTIFACT_EXPECTED_SHA256) {
    return { status: "error", reason: "Forecast release artifact SHA-256 mismatch" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawRelease.toString("utf8")) as unknown;
  } catch {
    return { status: "error", reason: "Forecast release artifact malformed" };
  }

  if (!isForecastReleaseArtifact(parsed)) {
    return { status: "error", reason: "Forecast release artifact malformed" };
  }
  if (
    parsed.sourcePreviewSha256 !== FORECAST_LOCAL_PREVIEW_EXPECTED_SHA256 ||
    parsed.sourceAggregateSha256 !== FORECAST_LOCAL_PREVIEW_EXPECTED_SOURCE_AGGREGATE_SHA256 ||
    parsed.sourceCandidateSha256 !== FORECAST_PUBLICATION_CANDIDATE_EXPECTED_SHA256
  ) {
    return { status: "error", reason: "Forecast release artifact source hash mismatch" };
  }

  return {
    status: "ok",
    catalog: projectForecastCatalogViewFromRelease(parsed),
    candidateSha256: fileSha,
    mode: "production-release",
  };
}

async function loadLocalPreviewCatalog(cwd: string): Promise<LoadForecastCatalogResult> {
  const candidatePath = path.resolve(cwd, FORECAST_PUBLICATION_CANDIDATE_RELATIVE_PATH);

  let rawCandidate: Buffer | null = null;
  try {
    rawCandidate = await readFile(candidatePath);
  } catch (err) {
    if (!isMissingFileError(err)) {
      return {
        status: "error",
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }

  if (rawCandidate) {
    return acceptCandidateBytes(rawCandidate);
  }

  try {
    const built = await buildAndOptionallyWritePublicationCandidate({ cwd, write: false });
    if (built.sha256 !== FORECAST_PUBLICATION_CANDIDATE_EXPECTED_SHA256) {
      return {
        status: "error",
        reason: "Derived publication candidate SHA-256 mismatch",
      };
    }
    return {
      status: "ok",
      catalog: projectForecastCatalogView(built.candidate),
      candidateSha256: built.sha256,
      mode: "local-preview",
    };
  } catch (err) {
    return {
      status: "error",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

async function loadProductionReleaseCatalog(
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<LoadForecastCatalogResult> {
  const artifactPath = resolveForecastPublicationArtifactPath(cwd, env);
  let raw: Buffer;
  try {
    raw = await readFile(artifactPath);
  } catch (err) {
    if (isMissingFileError(err)) {
      return {
        status: "error",
        reason: "Forecast release artifact missing",
      };
    }
    return {
      status: "error",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
  return acceptReleaseBytes(raw);
}

export async function loadForecastCatalog(options?: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<LoadForecastCatalogResult> {
  const env = options?.env ?? process.env;
  const cwd = options?.cwd ?? process.cwd();

  // Local development preview takes precedence when both are set, so Builder
  // workflows keep using the unpublished candidate without requiring a release install.
  if (isForecastLocalPreviewEnabled(env)) {
    return loadLocalPreviewCatalog(cwd);
  }

  if (isForecastPublicationEnabled(env)) {
    return loadProductionReleaseCatalog(cwd, env);
  }

  return { status: "disabled" };
}
