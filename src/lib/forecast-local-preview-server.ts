/**
 * Server-only loader for the local forecast preview JSON.
 * Fixed path only — never accept query-controlled paths.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  FORECAST_LOCAL_PREVIEW_EXPECTED_SHA256,
  FORECAST_LOCAL_PREVIEW_EXPECTED_SOURCE_AGGREGATE_SHA256,
  FORECAST_LOCAL_PREVIEW_RELATIVE_PATH,
  isForecastLocalPreviewEnabled,
  projectForecastLocalPreviewViewModel,
  type ForecastLocalPreviewViewModel,
} from "@/lib/forecast-local-preview";
import type { ForecastPreviewDocument } from "@/registration-forecast-preview/types";

export type LoadForecastLocalPreviewResult =
  | { status: "ok"; view: ForecastLocalPreviewViewModel }
  | { status: "disabled" }
  | { status: "error"; reason: string };

export function sha256Hex(bytes: Buffer | Uint8Array | string): string {
  const buf = typeof bytes === "string" ? Buffer.from(bytes, "utf8") : Buffer.from(bytes);
  return createHash("sha256").update(buf).digest("hex");
}

export function validateForecastPreviewDocument(
  value: unknown,
  options: {
    expectedPreviewSha256: string;
    expectedSourceAggregateSha256: string;
    rawBytes: Buffer | Uint8Array;
  },
): ForecastPreviewDocument {
  const actualSha = sha256Hex(options.rawBytes);
  if (actualSha !== options.expectedPreviewSha256.toLowerCase()) {
    throw new Error(
      `Forecast preview SHA-256 mismatch: expected ${options.expectedPreviewSha256}, got ${actualSha}`,
    );
  }
  if (!value || typeof value !== "object") {
    throw new Error("Forecast preview must be a JSON object");
  }
  const doc = value as ForecastPreviewDocument;
  if (doc.schemaVersion !== 1) {
    throw new Error(`Unexpected forecast preview schemaVersion: ${String(doc.schemaVersion)}`);
  }
  if (doc.kind !== "experimental-registration-forecast-preview") {
    throw new Error(`Unexpected forecast preview kind: ${String(doc.kind)}`);
  }
  if (doc.status !== "complete") {
    throw new Error(`Forecast preview status must be complete, got ${String(doc.status)}`);
  }
  if (!Array.isArray(doc.strings) || doc.strings.length === 0) {
    throw new Error("Forecast preview strings[] must be non-empty");
  }
  if (!doc.sourceAggregate || typeof doc.sourceAggregate !== "object") {
    throw new Error("Forecast preview sourceAggregate is required");
  }
  if (doc.sourceAggregate.sha256 !== options.expectedSourceAggregateSha256.toLowerCase()) {
    throw new Error(
      `Source aggregate SHA pin mismatch: expected ${options.expectedSourceAggregateSha256}, got ${doc.sourceAggregate.sha256}`,
    );
  }
  const { summary } = doc;
  if (
    !summary ||
    summary.measuredStringCount !== doc.strings.length ||
    summary.estimatedStringCount + summary.conversionNotRecommendedCount !==
      summary.measuredStringCount
  ) {
    throw new Error("Forecast preview summary invariants failed");
  }
  return doc;
}

/**
 * Load and project the accepted local preview when the development gate is open.
 * Does not expose absolute host paths in the returned view model.
 */
export async function loadForecastLocalPreviewView(options?: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** Test-only relative path under cwd; production path is fixed. */
  relativePathForTests?: string;
  expectedPreviewSha256?: string;
  expectedSourceAggregateSha256?: string;
}): Promise<LoadForecastLocalPreviewResult> {
  const env = options?.env ?? process.env;
  if (!isForecastLocalPreviewEnabled(env)) {
    return { status: "disabled" };
  }

  const cwd = options?.cwd ?? process.cwd();
  const relativePath = options?.relativePathForTests ?? FORECAST_LOCAL_PREVIEW_RELATIVE_PATH;
  // Hard-reject absolute or traversal inputs even in tests.
  if (path.isAbsolute(relativePath) || relativePath.includes("..")) {
    return { status: "error", reason: "Invalid preview path" };
  }
  const absolutePath = path.resolve(cwd, relativePath);
  const dataRoot = path.resolve(cwd, ".data");
  if (!absolutePath.startsWith(`${dataRoot}${path.sep}`) && !options?.relativePathForTests) {
    return { status: "error", reason: "Preview path must remain under .data/" };
  }

  let raw: Buffer;
  try {
    raw = await readFile(absolutePath);
  } catch {
    return {
      status: "error",
      reason: "Local forecast preview file is missing or unreadable",
    };
  }

  try {
    const parsed = JSON.parse(raw.toString("utf8")) as unknown;
    const doc = validateForecastPreviewDocument(parsed, {
      expectedPreviewSha256:
        options?.expectedPreviewSha256 ?? FORECAST_LOCAL_PREVIEW_EXPECTED_SHA256,
      expectedSourceAggregateSha256:
        options?.expectedSourceAggregateSha256 ??
        FORECAST_LOCAL_PREVIEW_EXPECTED_SOURCE_AGGREGATE_SHA256,
      rawBytes: raw,
    });
    const view = projectForecastLocalPreviewViewModel(doc, sha256Hex(raw));
    return { status: "ok", view };
  } catch (err) {
    return {
      status: "error",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
