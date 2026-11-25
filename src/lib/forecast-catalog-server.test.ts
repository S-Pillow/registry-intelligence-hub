import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildAndOptionallyWritePublicationCandidate,
  loadForecastCatalog,
} from "@/lib/forecast-catalog-server";
import {
  FORECAST_LOCAL_PREVIEW_EXPECTED_SHA256,
  FORECAST_LOCAL_PREVIEW_EXPECTED_SOURCE_AGGREGATE_SHA256,
  FORECAST_LOCAL_PREVIEW_RELATIVE_PATH,
} from "@/lib/forecast-local-preview";
import {
  FORECAST_PUBLICATION_CANDIDATE_EXPECTED_SHA256,
  FORECAST_PUBLICATION_CANDIDATE_RELATIVE_PATH,
} from "@/lib/forecast-publication-candidate";
import { FORECAST_RELEASE_ARTIFACT_EXPECTED_SHA256 } from "@/lib/forecast-publication-release";

const enabledEnv = {
  NODE_ENV: "development",
  RIH_FORECAST_LOCAL_PREVIEW: "1",
} as NodeJS.ProcessEnv;

async function fixtureRootWithPreview(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "rih-fcast-06a-"));
  const previewSrc = path.resolve(process.cwd(), FORECAST_LOCAL_PREVIEW_RELATIVE_PATH);
  const previewDest = path.resolve(root, FORECAST_LOCAL_PREVIEW_RELATIVE_PATH);
  await mkdir(path.dirname(previewDest), { recursive: true });
  await writeFile(previewDest, await readFile(previewSrc));
  return root;
}

describe("loadForecastCatalog integrity", () => {
  it("accepts the pinned publication candidate file", async () => {
    const result = await loadForecastCatalog({
      cwd: process.cwd(),
      env: enabledEnv,
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.candidateSha256).toBe(FORECAST_PUBLICATION_CANDIDATE_EXPECTED_SHA256);
    expect(result.catalog.sourcePreviewSha256).toBe(FORECAST_LOCAL_PREVIEW_EXPECTED_SHA256);
    expect(result.catalog.sourceAggregateSha256).toBe(
      FORECAST_LOCAL_PREVIEW_EXPECTED_SOURCE_AGGREGATE_SHA256,
    );
    expect(JSON.stringify(result.catalog)).not.toMatch(/\/root\/|\.data\//);
  });

  it("fails closed when a present candidate is corrupted", async () => {
    const root = await fixtureRootWithPreview();
    const candidatePath = path.resolve(root, FORECAST_PUBLICATION_CANDIDATE_RELATIVE_PATH);
    await mkdir(path.dirname(candidatePath), { recursive: true });
    await writeFile(candidatePath, '{"schemaVersion":1,"kind":"experimental-registration-forecast-publication-candidate","status":"unpublished-candidate","strings":[]}\n');

    const result = await loadForecastCatalog({ cwd: root, env: enabledEnv });
    expect(result).toEqual({
      status: "error",
      reason: "Publication candidate SHA-256 mismatch",
    });
  });

  it("fails closed when a present candidate is malformed despite matching length noise", async () => {
    const root = await fixtureRootWithPreview();
    const accepted = await readFile(
      path.resolve(process.cwd(), FORECAST_PUBLICATION_CANDIDATE_RELATIVE_PATH),
    );
    const candidatePath = path.resolve(root, FORECAST_PUBLICATION_CANDIDATE_RELATIVE_PATH);
    await mkdir(path.dirname(candidatePath), { recursive: true });
    // Flip one byte so SHA fails closed before projection.
    const corrupted = Buffer.from(accepted);
    corrupted[20] = corrupted[20]! ^ 0xff;
    await writeFile(candidatePath, corrupted);

    const result = await loadForecastCatalog({ cwd: root, env: enabledEnv });
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.reason).toBe("Publication candidate SHA-256 mismatch");
    }
  });

  it("derives from accepted preview when candidate is absent and pins the derived hash", async () => {
    const root = await fixtureRootWithPreview();
    const result = await loadForecastCatalog({ cwd: root, env: enabledEnv });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.candidateSha256).toBe(FORECAST_PUBLICATION_CANDIDATE_EXPECTED_SHA256);

    const built = await buildAndOptionallyWritePublicationCandidate({ cwd: root, write: false });
    expect(built.sha256).toBe(FORECAST_PUBLICATION_CANDIDATE_EXPECTED_SHA256);
  });

  it("returns disabled when the development gate is off", async () => {
    const result = await loadForecastCatalog({
      cwd: process.cwd(),
      env: { NODE_ENV: "production", RIH_FORECAST_LOCAL_PREVIEW: "1" } as NodeJS.ProcessEnv,
    });
    expect(result).toEqual({ status: "disabled" });
  });

  it("loads a pinned production release artifact without falling back to local preview", async () => {
    const stagingArtifact = path.resolve(
      process.cwd(),
      ".data/registration-forecast/staging/fcast-07a/experimental-registration-forecast-release-v1.json",
    );
    const result = await loadForecastCatalog({
      cwd: process.cwd(),
      env: {
        NODE_ENV: "production",
        RIH_FORECAST_PUBLICATION_ENABLED: "1",
        RIH_FORECAST_PUBLICATION_PATH: stagingArtifact,
      } as NodeJS.ProcessEnv,
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.mode).toBe("production-release");
    expect(result.candidateSha256).toBe(FORECAST_RELEASE_ARTIFACT_EXPECTED_SHA256);
    expect(result.catalog.labelSet).toContain("wdo");
  });

  it("fails closed when production gate is on but the release artifact is missing", async () => {
    const root = await fixtureRootWithPreview();
    const result = await loadForecastCatalog({
      cwd: root,
      env: {
        NODE_ENV: "production",
        RIH_FORECAST_PUBLICATION_ENABLED: "1",
      } as NodeJS.ProcessEnv,
    });
    expect(result).toEqual({
      status: "error",
      reason: "Forecast release artifact missing",
    });
  });

  it("fails closed when a production release artifact is corrupted", async () => {
    const root = await fixtureRootWithPreview();
    const artifactPath = path.resolve(
      root,
      ".data/registration-forecast/publication/experimental-registration-forecast-release-v1.json",
    );
    await mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, '{"schemaVersion":1,"kind":"experimental-registration-forecast-release","status":"staged-unpublished","strings":[]}\n');

    const result = await loadForecastCatalog({
      cwd: root,
      env: {
        NODE_ENV: "production",
        RIH_FORECAST_PUBLICATION_ENABLED: "1",
      } as NodeJS.ProcessEnv,
    });
    expect(result).toEqual({
      status: "error",
      reason: "Forecast release artifact SHA-256 mismatch",
    });
  });
});
