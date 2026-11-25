/**
 * RIH-FCAST-07A — Deterministic production release artifact + promotion manifest.
 * Built from the accepted unpublished FCAST-06 candidate only (no recount / recalculation).
 * Staging packages are never treated as live merely because the file exists.
 */

import {
  FORECAST_LOCAL_PREVIEW_EXPECTED_SHA256,
  FORECAST_LOCAL_PREVIEW_EXPECTED_SOURCE_AGGREGATE_SHA256,
} from "@/lib/forecast-local-preview";
import {
  FORECAST_PUBLICATION_CANDIDATE_EXPECTED_SHA256,
  FORECAST_PUBLIC_SCENARIO_LABELS,
  assertConversionFactorsUnchanged,
  projectForecastCatalogView,
  stableStringifyForecastCandidate,
  type ForecastCatalogView,
  type ForecastPublicationCandidate,
  type ForecastPublicationString,
} from "@/lib/forecast-publication-candidate";

/** Private staging root (under gitignored `.data/`). Never `public/` or live publication. */
export const FORECAST_RELEASE_STAGING_RELATIVE_DIR =
  ".data/registration-forecast/staging/fcast-07a";

export const FORECAST_RELEASE_ARTIFACT_FILENAME =
  "experimental-registration-forecast-release-v1.json";

export const FORECAST_RELEASE_MANIFEST_FILENAME = "release-manifest.json";

/** Approved host install path relative to hub cwd (operator promotion destination). */
export const FORECAST_RELEASE_PRODUCTION_RELATIVE_PATH =
  ".data/registration-forecast/publication/experimental-registration-forecast-release-v1.json";

/**
 * Byte-level pin for the staged FCAST-07A release artifact derived from the accepted
 * FCAST-06 candidate. Updated only when release serialization intentionally changes.
 */
export const FORECAST_RELEASE_ARTIFACT_EXPECTED_SHA256 =
  "748a691d4d38fef346e56bcfbc2b084d0f1788b4f7d038b7516b631a3f3cb383";

export const FORECAST_RELEASE_SCHEMA_VERSION = 1 as const;
export const FORECAST_RELEASE_ID = "experimental-registration-forecast-v1" as const;

export type ForecastReleaseArtifact = {
  schemaVersion: typeof FORECAST_RELEASE_SCHEMA_VERSION;
  kind: "experimental-registration-forecast-release";
  /** Staged packages are not live; live activation requires operator gate + install. */
  status: "staged-unpublished";
  releaseId: typeof FORECAST_RELEASE_ID;
  sourceCommit: string;
  sourceCandidateSha256: string;
  sourcePreviewSha256: string;
  sourceAggregateSha256: string;
  horizonLabel: string;
  disclaimer: string;
  methodologySummary: string;
  conversionFactors: ForecastPublicationCandidate["conversionFactors"];
  publicScenarioLabels: typeof FORECAST_PUBLIC_SCENARIO_LABELS;
  snapshotDate: string;
  sourceName: string;
  sourceUrl: string;
  attribution: string;
  referencePanelTlds: string[];
  summary: ForecastPublicationCandidate["summary"];
  limitations: string[];
  strings: ForecastPublicationString[];
};

export type ForecastReleaseManifest = {
  schemaVersion: 1;
  kind: "experimental-registration-forecast-release-manifest";
  status: "staged-unpublished";
  releaseId: typeof FORECAST_RELEASE_ID;
  sourceCommit: string;
  sourceArtifactHashes: {
    measuredAggregateSha256: string;
    experimentalPreviewSha256: string;
    unpublishedCandidateSha256: string;
  };
  releaseArtifactSha256: string;
  releaseArtifactRelativePath: string;
  publicationSchema: {
    schemaVersion: typeof FORECAST_RELEASE_SCHEMA_VERSION;
    kind: ForecastReleaseArtifact["kind"];
    releaseId: typeof FORECAST_RELEASE_ID;
  };
  approvedTargetLocation: string;
  publicationStatus: "staged-unpublished";
  attribution: string;
  limitations: string[];
  activationPrerequisites: string[];
  rollback: {
    artifactRelativePath: string;
    procedure: string[];
  };
  commercialUseLegalReview: {
    status: "required-before-public-activation";
    note: string;
  };
};

export function buildForecastReleaseArtifact(options: {
  candidate: ForecastPublicationCandidate;
  sourceCommit: string;
  sourceCandidateSha256: string;
}): ForecastReleaseArtifact {
  const { candidate, sourceCommit, sourceCandidateSha256 } = options;
  assertConversionFactorsUnchanged(candidate.conversionFactors);
  if (candidate.status !== "unpublished-candidate") {
    throw new Error("Release artifact must be built from an unpublished candidate");
  }
  if (sourceCandidateSha256 !== FORECAST_PUBLICATION_CANDIDATE_EXPECTED_SHA256) {
    throw new Error("Source candidate SHA-256 does not match the accepted FCAST-06 pin");
  }
  if (candidate.sourcePreviewSha256 !== FORECAST_LOCAL_PREVIEW_EXPECTED_SHA256) {
    throw new Error("Candidate preview SHA-256 does not match the accepted FCAST-05A pin");
  }
  if (candidate.sourceAggregateSha256 !== FORECAST_LOCAL_PREVIEW_EXPECTED_SOURCE_AGGREGATE_SHA256) {
    throw new Error("Candidate aggregate SHA-256 does not match the accepted FCAST-04B pin");
  }

  const limitations = candidate.limitations
    .filter((line) => !/unpublished local preparation/i.test(line))
    .filter((line) => !/toyroom/i.test(line));
  limitations.push(
    "This release package is staged for controlled production publication preparation only.",
    "Public activation requires an explicit operator-approved install and RIH_FORECAST_PUBLICATION_ENABLED=1.",
  );

  return {
    schemaVersion: FORECAST_RELEASE_SCHEMA_VERSION,
    kind: "experimental-registration-forecast-release",
    status: "staged-unpublished",
    releaseId: FORECAST_RELEASE_ID,
    sourceCommit,
    sourceCandidateSha256,
    sourcePreviewSha256: candidate.sourcePreviewSha256,
    sourceAggregateSha256: candidate.sourceAggregateSha256,
    horizonLabel: candidate.horizonLabel,
    disclaimer: candidate.disclaimer,
    methodologySummary: candidate.methodologySummary,
    conversionFactors: { ...candidate.conversionFactors },
    publicScenarioLabels: { ...FORECAST_PUBLIC_SCENARIO_LABELS },
    snapshotDate: candidate.snapshotDate,
    sourceName: candidate.sourceName,
    sourceUrl: candidate.sourceUrl,
    attribution: candidate.attribution,
    referencePanelTlds: [...candidate.referencePanelTlds],
    summary: { ...candidate.summary },
    limitations,
    strings: candidate.strings.map((row) => ({
      stringLabel: row.stringLabel,
      measuredDomainCount: row.measuredDomainCount,
      status: row.status,
      scenarios: row.scenarios
        ? { low: row.scenarios.low, middle: row.scenarios.middle, high: row.scenarios.high }
        : null,
      brandDesignationObserved: row.brandDesignationObserved,
      contested: row.contested,
      origins: row.origins ? [...row.origins] : null,
      fromNormalizedApplication: row.fromNormalizedApplication,
      fromKnownExcluded: row.fromKnownExcluded,
    })),
  };
}

export function projectForecastCatalogViewFromRelease(
  release: ForecastReleaseArtifact,
): ForecastCatalogView {
  // Reuse candidate projection by adapting to the catalog source shape.
  const asCandidate: ForecastPublicationCandidate = {
    schemaVersion: 1,
    kind: "experimental-registration-forecast-publication-candidate",
    status: "unpublished-candidate",
    horizonLabel: release.horizonLabel,
    disclaimer: release.disclaimer,
    methodologySummary: release.methodologySummary,
    conversionFactors: release.conversionFactors,
    publicScenarioLabels: release.publicScenarioLabels,
    snapshotDate: release.snapshotDate,
    sourceName: release.sourceName,
    sourceUrl: release.sourceUrl,
    attribution: release.attribution,
    referencePanelTlds: release.referencePanelTlds,
    sourcePreviewSha256: release.sourcePreviewSha256,
    sourceAggregateSha256: release.sourceAggregateSha256,
    summary: release.summary,
    limitations: release.limitations,
    strings: release.strings,
  };
  return projectForecastCatalogView(asCandidate);
}

export function buildForecastReleaseManifest(options: {
  sourceCommit: string;
  releaseArtifactSha256: string;
  attribution: string;
  limitations: string[];
}): ForecastReleaseManifest {
  return {
    schemaVersion: 1,
    kind: "experimental-registration-forecast-release-manifest",
    status: "staged-unpublished",
    releaseId: FORECAST_RELEASE_ID,
    sourceCommit: options.sourceCommit,
    sourceArtifactHashes: {
      measuredAggregateSha256: FORECAST_LOCAL_PREVIEW_EXPECTED_SOURCE_AGGREGATE_SHA256,
      experimentalPreviewSha256: FORECAST_LOCAL_PREVIEW_EXPECTED_SHA256,
      unpublishedCandidateSha256: FORECAST_PUBLICATION_CANDIDATE_EXPECTED_SHA256,
    },
    releaseArtifactSha256: options.releaseArtifactSha256,
    releaseArtifactRelativePath: `${FORECAST_RELEASE_STAGING_RELATIVE_DIR}/${FORECAST_RELEASE_ARTIFACT_FILENAME}`,
    publicationSchema: {
      schemaVersion: FORECAST_RELEASE_SCHEMA_VERSION,
      kind: "experimental-registration-forecast-release",
      releaseId: FORECAST_RELEASE_ID,
    },
    approvedTargetLocation: FORECAST_RELEASE_PRODUCTION_RELATIVE_PATH,
    publicationStatus: "staged-unpublished",
    attribution: options.attribution,
    limitations: options.limitations,
    activationPrerequisites: [
      "Operator visual and methodology acceptance completed",
      "ActiveDNS commercial-use / attribution legal review recorded (do not claim legal approval in code)",
      "Release artifact SHA-256 matches this manifest",
      "Artifact installed at approvedTargetLocation (or RIH_FORECAST_PUBLICATION_PATH)",
      "RIH_FORECAST_PUBLICATION_ENABLED=1 set only after install verification",
      "Live Applicant→Forecast click-through verified on a promoted-2026 environment",
      "PM2/nginx deploy of matching source commit completed separately",
    ],
    rollback: {
      artifactRelativePath: FORECAST_RELEASE_PRODUCTION_RELATIVE_PATH,
      procedure: [
        "Unset RIH_FORECAST_PUBLICATION_ENABLED (or set to 0) — forecasts disable without affecting other RIH routes",
        "Optionally restore the previous release artifact backup, or remove the installed release file",
        "Restart the hub process only if required by host env-file reload conventions",
        "Confirm /forecast/[label] returns HTTP 404 and Applicant forecast links fall back to plain text",
      ],
    },
    commercialUseLegalReview: {
      status: "required-before-public-activation",
      note:
        "ActiveDNS attribution is retained in the release package. Operator must confirm current ActiveDNS terms allow the intended public/commercial presentation before enabling the production gate. This repository does not record legal approval.",
    },
  };
}

export function stableStringifyForecastRelease(value: unknown): string {
  return stableStringifyForecastCandidate(value);
}

export function isForecastReleaseArtifact(value: unknown): value is ForecastReleaseArtifact {
  if (!value || typeof value !== "object") return false;
  const doc = value as ForecastReleaseArtifact;
  return (
    doc.schemaVersion === 1 &&
    doc.kind === "experimental-registration-forecast-release" &&
    doc.status === "staged-unpublished" &&
    doc.releaseId === FORECAST_RELEASE_ID &&
    Array.isArray(doc.strings)
  );
}

export function resolveForecastPublicationArtifactPath(
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const override = env.RIH_FORECAST_PUBLICATION_PATH?.trim();
  if (override) {
    // Absolute override for staging smoke / host install; never from query params.
    return override.startsWith("/") ? override : `${cwd}/${override}`;
  }
  return `${cwd}/${FORECAST_RELEASE_PRODUCTION_RELATIVE_PATH}`;
}
