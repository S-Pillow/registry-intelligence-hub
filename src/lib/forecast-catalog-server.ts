/**
 * Server-only forecast catalog loader (RIH-FCAST-06).
 * Prefer an existing publication candidate; otherwise project from the accepted preview.
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
import {
  FORECAST_PUBLICATION_CANDIDATE_RELATIVE_PATH,
  buildForecastPublicationCandidate,
  projectForecastCatalogView,
  stableStringifyForecastCandidate,
  type ForecastCatalogView,
  type ForecastPublicationCandidate,
} from "@/lib/forecast-publication-candidate";

export type LoadForecastCatalogResult =
  | { status: "ok"; catalog: ForecastCatalogView; candidateSha256: string }
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

export async function loadForecastCatalog(options?: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<LoadForecastCatalogResult> {
  const env = options?.env ?? process.env;
  if (!isForecastLocalPreviewEnabled(env)) {
    return { status: "disabled" };
  }

  const cwd = options?.cwd ?? process.cwd();
  try {
    const candidatePath = path.resolve(cwd, FORECAST_PUBLICATION_CANDIDATE_RELATIVE_PATH);
    try {
      const rawCandidate = await readFile(candidatePath);
      const parsed = JSON.parse(rawCandidate.toString("utf8")) as unknown;
      if (
        isPublicationCandidate(parsed) &&
        parsed.sourcePreviewSha256 === FORECAST_LOCAL_PREVIEW_EXPECTED_SHA256 &&
        parsed.sourceAggregateSha256 === FORECAST_LOCAL_PREVIEW_EXPECTED_SOURCE_AGGREGATE_SHA256
      ) {
        const catalog = projectForecastCatalogView(parsed);
        return {
          status: "ok",
          catalog,
          candidateSha256: sha256Hex(rawCandidate),
        };
      }
    } catch {
      // Fall through to project from accepted preview.
    }

    const built = await buildAndOptionallyWritePublicationCandidate({ cwd, write: false });
    return {
      status: "ok",
      catalog: projectForecastCatalogView(built.candidate),
      candidateSha256: built.sha256,
    };
  } catch (err) {
    return {
      status: "error",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
