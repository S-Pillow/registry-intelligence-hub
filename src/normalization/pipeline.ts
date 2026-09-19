import { buildIdFromInput } from "./hashes";
import { loadFixtureBundle } from "./load-bundle";
import { observationsFromParsedRecords } from "./observations";
import { normalizeFromObservations } from "./normalize";
import { parseBundle } from "./parse";
import { buildQualityReport } from "./report";
import { computeOutputContentHash, createNormalizationStore, type NormalizationStore } from "./store";
import { validateOverrideRegistryVersion } from "./overrides";
import type { BuildManifest, NormalizationArtifacts } from "./types";
import {
  BUILD_MANIFEST_VERSION,
  NORMALIZER_VERSION,
  OVERRIDE_REGISTRY_VERSION,
  PARSER_VERSION,
} from "./types";

export interface NormalizeOptions {
  bundleId: string;
  workspaceRoot: string;
  storeRoot: string;
}

export async function runNormalization(options: NormalizeOptions): Promise<NormalizationArtifacts> {
  const loaded = await loadFixtureBundle(options.bundleId, options.workspaceRoot);
  validateOverrideRegistryVersion(loaded.overrides.registryVersion, OVERRIDE_REGISTRY_VERSION);

  const parsedRecords = parseBundle(loaded);
  const observations = observationsFromParsedRecords(parsedRecords);
  const entities = normalizeFromObservations(loaded, parsedRecords, observations);

  const buildId = buildIdFromInput(loaded.inputContentHash, [PARSER_VERSION, NORMALIZER_VERSION, OVERRIDE_REGISTRY_VERSION]);

  const report = buildQualityReport(
    loaded.definition.id,
    loaded.definition.version,
    loaded.inputContentHash,
    entities,
    observations,
    [
      loaded.definition.coverageNote,
      "Registry operator records are SOURCE_ONLY in this slice — delegation not replayed.",
      "Live ICANN HTML/API ingest is out of scope; fixtures only.",
    ],
  );

  const manifestBase: Omit<BuildManifest, "outputContentHash"> = {
    manifestVersion: BUILD_MANIFEST_VERSION,
    buildId,
    bundleId: loaded.definition.id,
    bundleVersion: loaded.definition.version,
    parserVersion: PARSER_VERSION,
    normalizerVersion: NORMALIZER_VERSION,
    overrideRegistryVersion: OVERRIDE_REGISTRY_VERSION,
    inputContentHash: loaded.inputContentHash,
    builtAt: "2012-06-13T12:00:00.000Z",
    entityCount: entities.length,
    observationCount: observations.length,
    parsedRecordCount: parsedRecords.length,
  };

  const outputContentHash = computeOutputContentHash({
    manifest: manifestBase,
    parsedRecords,
    observations,
    entities,
    report,
  });

  const manifest: BuildManifest = { ...manifestBase, outputContentHash };

  return {
    manifest,
    parsedRecords,
    observations,
    entities,
    report,
  };
}

export async function normalizeAndPersist(options: NormalizeOptions): Promise<NormalizationArtifacts> {
  const artifacts = await runNormalization(options);
  const store = createNormalizationStore(options.storeRoot);
  await store.writeBuild(artifacts);
  return artifacts;
}

export function createStore(storeRoot: string): NormalizationStore {
  return createNormalizationStore(storeRoot);
}
