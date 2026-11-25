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
});
