import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { createContentStore } from "../pipeline/content-store";
import { createManifestStore } from "../pipeline/manifest-store";
import type { ManifestEntry, PublicationHandoffRecord } from "../pipeline/types";
import { listHandoff } from "../pipeline/pipeline";
import {
  buildLineageFromManifest,
  INTAKE_ADAPTER_VERSION,
  INTAKE_WIRE_SCHEMA_VERSION,
  NORMALIZER_VERSION_FOR_INTAKE,
  PARSER_VERSION_FOR_INTAKE,
  parseRevealDayNdjsonWire,
  PUBLICATION_SCHEMA_FOR_INTAKE,
} from "./intake-adapter";
import type { PublicationLineage, Registry2026PublicationSnapshot } from "./types";

export const DRILL_2026_SOURCE_ID = "icann-2026-reveal-day-drill-ndjson";

function headerDigest(headers: Record<string, string> | null): string | null {
  if (!headers) return null;
  const subset: Record<string, string> = {};
  for (const key of ["content-type", "last-modified", "etag", "location"]) {
    const value = headers[key];
    if (value) subset[key] = value;
  }
  if (Object.keys(subset).length === 0) return null;
  return createHash("sha256").update(JSON.stringify(subset)).digest("hex");
}

export function lineageFromInput(input: ReturnType<typeof buildLineageFromManifest>): PublicationLineage {
  return {
    intakeAdapterVersion: INTAKE_ADAPTER_VERSION,
    wireSchemaVersion: INTAKE_WIRE_SCHEMA_VERSION,
    rawSha256: input.rawSha256,
    pipelineSourceId: input.pipelineSourceId,
    pipelineSourceVersion: input.pipelineSourceVersion,
    manifestAttemptId: input.manifestAttemptId,
    fetchUrl: input.fetchUrl,
    retrievedAt: input.retrievedAt,
    httpStatus: input.httpStatus,
    adapterId: input.adapterId,
    adapterSchemaVersion: input.adapterSchemaVersion,
    redirectChain: input.redirectChain,
    responseHeaderDigest: headerDigest(input.responseHeaders),
  };
}

export async function resolveLatestManifestForHandoff(
  pipelineRoot: string,
  handoff: PublicationHandoffRecord,
): Promise<ManifestEntry> {
  const manifestStore = createManifestStore(pipelineRoot);
  const entries = await manifestStore.readAll(handoff.sourceId);
  const match = [...entries]
    .reverse()
    .find(
      (entry) =>
        (entry.outcome === "success" || entry.outcome === "duplicate-skip")
        && entry.sha256 === handoff.sha256
        && entry.storageKey === handoff.storageKey,
    );
  if (!match) {
    throw new Error(
      `No manifest entry matches handoff sha256 ${handoff.sha256} for source ${handoff.sourceId}`,
    );
  }
  return match;
}

export async function readRawBytesFromHandoff(
  pipelineRoot: string,
  handoff: PublicationHandoffRecord,
): Promise<Uint8Array> {
  const store = createContentStore(pipelineRoot);
  return store.read(handoff.storageKey);
}

export type BuildPublicationOptions = {
  publicationKind: "immutable-publication" | "rehearsal-for-pipeline-only";
  snapshotId: string;
  fixtureId?: string;
  publishedAt: string;
  sourceName: string;
  sourceUrl: string;
  evidenceClass: string;
  limitations: string[];
  redirectChain?: string[];
};

/**
 * Derives a canonical registry-2026-publication snapshot from immutable pipeline bytes.
 * Never accepts a pre-built JSON file without raw lineage.
 */
export async function buildCanonicalPublicationFromHandoff(
  pipelineRoot: string,
  handoff: PublicationHandoffRecord,
  manifest: ManifestEntry,
  options: BuildPublicationOptions,
): Promise<Registry2026PublicationSnapshot> {
  const bytes = await readRawBytesFromHandoff(pipelineRoot, handoff);
  if (handoff.sha256 !== manifest.sha256) {
    throw new Error("Handoff sha256 does not match manifest — refuse to derive publication");
  }
  const parsed = parseRevealDayNdjsonWire(bytes);
  const lineageInput = buildLineageFromManifest(manifest, handoff.sha256, options.redirectChain ?? []);
  const lineage = lineageFromInput(lineageInput);
  lineage.intakeAdapterVersion = parsed.intakeAdapterVersion;
  lineage.wireSchemaVersion = parsed.wireSchemaVersion;

  return {
    schemaVersion: PUBLICATION_SCHEMA_FOR_INTAKE,
    publicationKind: options.publicationKind,
    snapshotId: options.snapshotId,
    fixtureId: options.fixtureId,
    publishedAt: options.publishedAt,
    retrievedAt: handoff.retrievedAt,
    parserVersion: PARSER_VERSION_FOR_INTAKE,
    normalizerVersion: NORMALIZER_VERSION_FOR_INTAKE,
    source: {
      name: options.sourceName,
      url: options.sourceUrl,
      evidenceClass: options.evidenceClass,
    },
    limitations: options.limitations,
    lineage,
    applications: parsed.applications,
  };
}

export async function fetchDrillHandoff(pipelineRoot: string): Promise<PublicationHandoffRecord> {
  const records = await listHandoff(pipelineRoot, DRILL_2026_SOURCE_ID);
  const handoff = records[0];
  if (!handoff) {
    throw new Error(
      `No handoff for ${DRILL_2026_SOURCE_ID}. Run: npm run pipeline -- fetch ${DRILL_2026_SOURCE_ID} --mode fixture --root ${pipelineRoot}`,
    );
  }
  return handoff;
}

export async function writePublicationSnapshot(snapshotPath: string, snapshot: Registry2026PublicationSnapshot): Promise<void> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(dirname(snapshotPath), { recursive: true });
  await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

export async function loadJsonPublicationForbidden(snapshotPath: string): Promise<void> {
  const text = await readFile(snapshotPath, "utf8");
  const raw = JSON.parse(text) as Record<string, unknown>;
  if (raw.lineage === undefined && raw.publicationKind === "immutable-publication") {
    throw new Error(
      "Immutable publication JSON without lineage is not an authorized intake path — derive from raw pipeline bytes",
    );
  }
}
