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

export function parseRevealDayNdjsonWire(bytes: Uint8Array): ParseWireResult {
  const text = new TextDecoder("utf8", { fatal: true }).decode(bytes);
  const lines = text.split(/\n/).filter((line) => line.trim().length > 0);
  const applications: Registry2026ApplicationRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new Error(`intake wire line ${i + 1}: invalid JSON`);
    }
    if (parsed === null || typeof parsed !== "object") {
      throw new Error(`intake wire line ${i + 1}: row must be an object`);
    }
    const record = parsed as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!(ALLOWED_WIRE_KEYS as readonly string[]).includes(key)) {
        throw new Error(
          `intake wire line ${i + 1}: unexpected field "${key}" — bump ${INTAKE_WIRE_SCHEMA_VERSION} instead of relaxing`,
        );
      }
    }
    const wire = record as IntakeWireRow;
    applications.push({
      id: wire.application_id,
      string: wire.string_label,
      aLabel: wire.a_label,
      applicant: wire.applicant,
      organization: wire.organization,
      country: wire.country,
      region: wire.region,
      category: wire.category,
      type: wire.type,
      returning: wire.returning === true,
      idn: wire.idn === true,
      replacement: null,
      contentionSet: null,
      confidence: 1,
    });
  }

  return {
    applications,
    wireSchemaVersion: INTAKE_WIRE_SCHEMA_VERSION,
    intakeAdapterVersion: INTAKE_ADAPTER_VERSION,
  };
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
