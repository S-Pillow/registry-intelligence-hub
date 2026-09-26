import type { ManifestEntry } from "../pipeline/types";
import type { Registry2026ApplicationRow } from "./types";
import {
  INTAKE_ADAPTER_VERSION,
  INTAKE_WIRE_SCHEMA_VERSION,
  NORMALIZER_VERSION,
  PARSER_VERSION,
  PUBLICATION_SCHEMA_VERSION_V11,
} from "./types";

export { INTAKE_ADAPTER_VERSION, INTAKE_WIRE_SCHEMA_VERSION };

export type IntakeWireRow = {
  application_id: string;
  string_label: string;
  a_label?: string;
  applicant: string;
  organization: string;
  country: string;
  region: string;
  category: string;
  type: string;
  returning: boolean;
  idn: boolean;
};

const ALLOWED_WIRE_KEYS = [
  "application_id",
  "string_label",
  "a_label",
  "applicant",
  "organization",
  "country",
  "region",
  "category",
  "type",
  "returning",
  "idn",
] as const;

export type ParseWireResult = {
  applications: Registry2026ApplicationRow[];
  wireSchemaVersion: string;
  intakeAdapterVersion: string;
};

/** Parser a later Reveal Day adapter can implement. Only registered media types are accepted. */
export interface CapturedArtifactParser {
  readonly id: string;
  readonly version: string;
  readonly mediaType: string;
  parse(bytes: Uint8Array): ParseWireResult;
}

export const NDJSON_WIRE_MEDIA_TYPE = "application/x-ndjson";

function requiredWireString(record: Record<string, unknown>, key: string, lineNumber: number): string {
  if (!Object.hasOwn(record, key)) {
    throw new Error(`intake wire line ${lineNumber}: missing ${key}`);
  }
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`intake wire line ${lineNumber}: ${key} must be a string`);
  }
  return value;
}

export function parseRevealDayNdjsonWire(bytes: Uint8Array): ParseWireResult {
  const text = new TextDecoder("utf8", { fatal: true }).decode(bytes);
  const lines = text.split(/\n/).filter((line) => line.trim().length > 0);
  const applications: Registry2026ApplicationRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new Error(`intake wire line ${lineNumber}: invalid JSON`);
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`intake wire line ${lineNumber}: row must be an object`);
    }
    const record = parsed as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!(ALLOWED_WIRE_KEYS as readonly string[]).includes(key)) {
        throw new Error(
          `intake wire line ${lineNumber}: unexpected field "${key}" — bump ${INTAKE_WIRE_SCHEMA_VERSION} instead of relaxing`,
        );
      }
    }
    if (!Object.hasOwn(record, "returning") || !Object.hasOwn(record, "idn")) {
      throw new Error(`intake wire line ${lineNumber}: missing returning or idn`);
    }
    if (typeof record.returning !== "boolean" || typeof record.idn !== "boolean") {
      throw new Error(`intake wire line ${lineNumber}: returning and idn must be booleans`);
    }
    if (Object.hasOwn(record, "a_label") && typeof record.a_label !== "string") {
      throw new Error(`intake wire line ${lineNumber}: a_label must be a string`);
    }

    const row: Registry2026ApplicationRow = {
      id: requiredWireString(record, "application_id", lineNumber),
      string: requiredWireString(record, "string_label", lineNumber),
      applicant: requiredWireString(record, "applicant", lineNumber),
      organization: requiredWireString(record, "organization", lineNumber),
      country: requiredWireString(record, "country", lineNumber),
      region: requiredWireString(record, "region", lineNumber),
      category: requiredWireString(record, "category", lineNumber),
      type: requiredWireString(record, "type", lineNumber),
      returning: record.returning,
      idn: record.idn,
      replacement: null,
      contentionSet: null,
      confidence: 1,
    };
    if (typeof record.a_label === "string") row.aLabel = record.a_label;
    applications.push(row);
  }

  return {
    applications,
    wireSchemaVersion: INTAKE_WIRE_SCHEMA_VERSION,
    intakeAdapterVersion: INTAKE_ADAPTER_VERSION,
  };
}

export const ndjsonWireCapturedArtifactParser: CapturedArtifactParser = {
  id: "registry-2026-intake-adapter",
  version: INTAKE_ADAPTER_VERSION,
  mediaType: NDJSON_WIRE_MEDIA_TYPE,
  parse: parseRevealDayNdjsonWire,
};

export const CAPTURED_ARTIFACT_PARSERS: readonly CapturedArtifactParser[] = [ndjsonWireCapturedArtifactParser];

export function capturedArtifactParserForMediaType(mediaType: string): CapturedArtifactParser | undefined {
  return CAPTURED_ARTIFACT_PARSERS.find((parser) => parser.mediaType === mediaType);
}

export type PublicationLineageInput = {
  rawSha256: string;
  pipelineSourceId: string;
  pipelineSourceVersion: number;
  manifestAttemptId: string;
  fetchUrl: string;
  retrievedAt: string;
  httpStatus: number;
  adapterId: string;
  adapterSchemaVersion: string;
  redirectChain: string[];
  responseHeaders: Record<string, string> | null;
};

export function buildLineageFromManifest(
  manifest: ManifestEntry,
  rawSha256: string,
  redirectChain: string[] = [],
): PublicationLineageInput {
  return {
    rawSha256,
    pipelineSourceId: manifest.sourceId,
    pipelineSourceVersion: manifest.sourceVersion,
    manifestAttemptId: manifest.attemptId,
    fetchUrl: manifest.url,
    retrievedAt: manifest.retrievedAt ?? manifest.attemptedAt,
    httpStatus: manifest.httpStatus ?? 200,
    adapterId: manifest.adapterId,
    adapterSchemaVersion: manifest.adapterSchemaVersion,
    redirectChain,
    responseHeaders: manifest.responseHeaders,
  };
}

export const PUBLICATION_SCHEMA_FOR_INTAKE = PUBLICATION_SCHEMA_VERSION_V11;
export const PARSER_VERSION_FOR_INTAKE = PARSER_VERSION;
export const NORMALIZER_VERSION_FOR_INTAKE = NORMALIZER_VERSION;
