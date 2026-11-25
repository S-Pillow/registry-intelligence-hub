import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FORECAST_CONVERSION_FACTORS } from "@/lib/registration-forecast";
import {
  FORECAST_PUBLICATION_CANDIDATE_EXPECTED_SHA256,
  FORECAST_PUBLICATION_CANDIDATE_RELATIVE_PATH,
  type ForecastPublicationCandidate,
} from "@/lib/forecast-publication-candidate";
import {
  FORECAST_LOCAL_PREVIEW_EXPECTED_SHA256,
  FORECAST_LOCAL_PREVIEW_EXPECTED_SOURCE_AGGREGATE_SHA256,
} from "@/lib/forecast-local-preview";
import {
  FORECAST_RELEASE_ARTIFACT_EXPECTED_SHA256,
  FORECAST_RELEASE_STAGING_RELATIVE_DIR,
  FORECAST_RELEASE_ARTIFACT_FILENAME,
  buildForecastReleaseArtifact,
  buildForecastReleaseManifest,
  projectForecastCatalogViewFromRelease,
  stableStringifyForecastRelease,
} from "@/lib/forecast-publication-release";

const SOURCE_COMMIT = "631b63a3b29dafcf3cd1db188c397d1e76ca683d";

async function loadAcceptedCandidate(): Promise<{
  candidate: ForecastPublicationCandidate;
  sha256: string;
}> {
  const raw = await readFile(
    path.resolve(process.cwd(), FORECAST_PUBLICATION_CANDIDATE_RELATIVE_PATH),
  );
  const sha256 = createHash("sha256").update(raw).digest("hex");
  expect(sha256).toBe(FORECAST_PUBLICATION_CANDIDATE_EXPECTED_SHA256);
  return {
    candidate: JSON.parse(raw.toString("utf8")) as ForecastPublicationCandidate,
    sha256,
  };
}

describe("forecast publication release", () => {
  it("builds a reproducible staged release with accepted pins and no raw ActiveDNS payload", async () => {
    const { candidate, sha256 } = await loadAcceptedCandidate();
    const release = buildForecastReleaseArtifact({
      candidate,
      sourceCommit: SOURCE_COMMIT,
      sourceCandidateSha256: sha256,
    });
    const serialized = stableStringifyForecastRelease(release);
    const releaseSha = createHash("sha256").update(serialized).digest("hex");
    expect(releaseSha).toBe(FORECAST_RELEASE_ARTIFACT_EXPECTED_SHA256);

    const again = stableStringifyForecastRelease(
      buildForecastReleaseArtifact({
        candidate,
        sourceCommit: SOURCE_COMMIT,
        sourceCandidateSha256: sha256,
      }),
    );
    expect(again).toBe(serialized);

    expect(release.status).toBe("staged-unpublished");
    expect(release.sourcePreviewSha256).toBe(FORECAST_LOCAL_PREVIEW_EXPECTED_SHA256);
    expect(release.sourceAggregateSha256).toBe(
      FORECAST_LOCAL_PREVIEW_EXPECTED_SOURCE_AGGREGATE_SHA256,
    );
    expect(release.conversionFactors).toEqual(FORECAST_CONVERSION_FACTORS);
    expect(release.referencePanelTlds).toEqual(["net", "org", "info", "biz", "app", "dev"]);
    expect(release.strings).toHaveLength(1431);
    expect(new Set(release.strings.map((s) => s.stringLabel)).size).toBe(1431);

    const wdo = release.strings.find((s) => s.stringLabel === "wdo");
    expect(wdo).toMatchObject({
      measuredDomainCount: 62,
      scenarios: { low: 50, middle: 118, high: 198 },
      brandDesignationObserved: null,
      contested: null,
    });

    const brands = release.strings.filter((s) => s.brandDesignationObserved === true);
    expect(brands.length).toBeGreaterThan(0);
    expect(brands.every((s) => typeof s.measuredDomainCount === "number")).toBe(true);

    const nullScenarios = release.strings.filter((s) => s.scenarios === null);
    expect(nullScenarios.length).toBe(27);
    const zeroMiddle = release.strings.filter((s) => s.scenarios?.middle === 0);
    expect(zeroMiddle.length).toBeGreaterThan(0);

    expect(serialized.toLowerCase()).not.toMatch(/toyroom/);
    expect(serialized).not.toMatch(/\/root\/|\.gz|domainScan|ActiveDNS mid-panel zone/);
    expect(release.attribution.toLowerCase()).toMatch(/activedns/);
    expect(release.methodologySummary).toMatch(/\.com/);
    expect(release.limitations.join(" ")).toMatch(/partial|Partial/i);

    const catalog = projectForecastCatalogViewFromRelease(release);
    expect(catalog.labelSet).toContain("wdo");
    expect(catalog.labelSet).toContain("agt");
  });

  it("matches the staged private artifact bytes when present", async () => {
    const stagedPath = path.resolve(
      process.cwd(),
      FORECAST_RELEASE_STAGING_RELATIVE_DIR,
      FORECAST_RELEASE_ARTIFACT_FILENAME,
    );
    const raw = await readFile(stagedPath);
    expect(createHash("sha256").update(raw).digest("hex")).toBe(
      FORECAST_RELEASE_ARTIFACT_EXPECTED_SHA256,
    );
  });

  it("records activation prerequisites and legal-review condition in the manifest", async () => {
    const { candidate, sha256 } = await loadAcceptedCandidate();
    const release = buildForecastReleaseArtifact({
      candidate,
      sourceCommit: SOURCE_COMMIT,
      sourceCandidateSha256: sha256,
    });
    const releaseSha = createHash("sha256")
      .update(stableStringifyForecastRelease(release))
      .digest("hex");
    const manifest = buildForecastReleaseManifest({
      sourceCommit: SOURCE_COMMIT,
      releaseArtifactSha256: releaseSha,
      attribution: release.attribution,
      limitations: release.limitations,
    });
    expect(manifest.publicationStatus).toBe("staged-unpublished");
    expect(manifest.commercialUseLegalReview.status).toBe("required-before-public-activation");
    expect(manifest.activationPrerequisites.some((line) => /Applicant/i.test(line))).toBe(true);
    expect(manifest.rollback.procedure[0]).toMatch(/RIH_FORECAST_PUBLICATION_ENABLED/);
  });
});
