import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, contentHash } from "./hashes";
import type { BuildManifest, NormalizationArtifacts, NormalizationQualityReport } from "./types";
import { BUILD_MANIFEST_VERSION } from "./types";

export interface NormalizationStore {
  root: string;
  writeBuild(artifacts: NormalizationArtifacts): Promise<void>;
  readBuild(buildId: string): Promise<NormalizationArtifacts>;
  readManifest(buildId: string): Promise<BuildManifest>;
  listBuildIds(): Promise<string[]>;
}

const ARTIFACT_FILES = {
  manifest: "manifest.json",
  parsedRecords: "parsed-records.json",
  observations: "observations.json",
  entities: "entities.json",
  report: "quality-report.json",
} as const;

export function createNormalizationStore(root: string): NormalizationStore {
  const buildsRoot = join(root, "builds");

  async function ensureDir(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }

  return {
    root,

    async writeBuild(artifacts) {
      const dir = join(buildsRoot, artifacts.manifest.buildId);
      await ensureDir(dir);
      const files = {
        [ARTIFACT_FILES.manifest]: artifacts.manifest,
        [ARTIFACT_FILES.parsedRecords]: artifacts.parsedRecords,
        [ARTIFACT_FILES.observations]: artifacts.observations,
        [ARTIFACT_FILES.entities]: artifacts.entities,
        [ARTIFACT_FILES.report]: artifacts.report,
      };
      for (const [name, data] of Object.entries(files)) {
        await writeFile(join(dir, name), `${canonicalJson(data)}\n`, "utf8");
      }
    },

    async readBuild(buildId) {
      const dir = join(buildsRoot, buildId);
      const manifest = JSON.parse(await readFile(join(dir, ARTIFACT_FILES.manifest), "utf8")) as BuildManifest;
      const parsedRecords = JSON.parse(await readFile(join(dir, ARTIFACT_FILES.parsedRecords), "utf8"));
      const observations = JSON.parse(await readFile(join(dir, ARTIFACT_FILES.observations), "utf8"));
      const entities = JSON.parse(await readFile(join(dir, ARTIFACT_FILES.entities), "utf8"));
      const report = JSON.parse(await readFile(join(dir, ARTIFACT_FILES.report), "utf8")) as NormalizationQualityReport;
      return { manifest, parsedRecords, observations, entities, report };
    },

    async readManifest(buildId) {
      const dir = join(buildsRoot, buildId);
      return JSON.parse(await readFile(join(dir, ARTIFACT_FILES.manifest), "utf8")) as BuildManifest;
    },

    async listBuildIds() {
      try {
        const { readdir } = await import("node:fs/promises");
        const entries = await readdir(buildsRoot, { withFileTypes: true });
        return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw error;
      }
    },
  };
}

export function computeOutputContentHash(artifacts: Omit<NormalizationArtifacts, "manifest"> & { manifest: Omit<BuildManifest, "outputContentHash"> }): string {
  return contentHash({
    parsedRecords: artifacts.parsedRecords,
    observations: artifacts.observations,
    entities: artifacts.entities,
    report: { ...artifacts.report, generatedAt: "FIXED" },
  });
}

export function verifyStoredBuild(artifacts: NormalizationArtifacts): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (artifacts.manifest.manifestVersion !== BUILD_MANIFEST_VERSION) {
    errors.push(`Unexpected manifest version ${artifacts.manifest.manifestVersion}`);
  }
  const manifestWithoutOutput = { ...artifacts.manifest };
  delete (manifestWithoutOutput as { outputContentHash?: string }).outputContentHash;
  const expectedOutput = computeOutputContentHash({
    ...artifacts,
    manifest: manifestWithoutOutput,
  });
  if (expectedOutput !== artifacts.manifest.outputContentHash) {
    errors.push("Output content hash mismatch — tampering or version drift");
  }
  const entityIds = artifacts.entities.map((e) => e.entityId);
  const unique = new Set(entityIds);
  if (unique.size !== entityIds.length) {
    errors.push(`Duplicate entity ids: ${entityIds.length - unique.size}`);
  }
  return { ok: errors.length === 0, errors };
}
