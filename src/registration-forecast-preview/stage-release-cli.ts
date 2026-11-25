/**
 * Stage a deterministic FCAST-07A release package from the accepted unpublished candidate.
 * Writes only under the private staging directory (gitignored via /.data/).
 * Does not promote to the live publication path or enable any production gate.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  FORECAST_PUBLICATION_CANDIDATE_EXPECTED_SHA256,
  FORECAST_PUBLICATION_CANDIDATE_RELATIVE_PATH,
  type ForecastPublicationCandidate,
} from "@/lib/forecast-publication-candidate";
import {
  FORECAST_RELEASE_ARTIFACT_FILENAME,
  FORECAST_RELEASE_MANIFEST_FILENAME,
  FORECAST_RELEASE_STAGING_RELATIVE_DIR,
  buildForecastReleaseArtifact,
  buildForecastReleaseManifest,
  stableStringifyForecastRelease,
} from "@/lib/forecast-publication-release";

function sha256Hex(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseArgs(argv: string[]) {
  let cwd = process.cwd();
  let sourceCommit = "";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--cwd") {
      cwd = argv[++i]!;
    } else if (arg === "--source-commit") {
      sourceCommit = argv[++i]!;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: npm run forecast-stage-release -- --source-commit <sha> [--cwd <dir>]`);
      process.exit(0);
    }
  }
  if (!/^[0-9a-f]{40}$/i.test(sourceCommit)) {
    throw new Error("--source-commit must be a full 40-character Git SHA");
  }
  return { cwd, sourceCommit };
}

async function main() {
  const { cwd, sourceCommit } = parseArgs(process.argv.slice(2));
  const candidatePath = path.resolve(cwd, FORECAST_PUBLICATION_CANDIDATE_RELATIVE_PATH);
  const raw = await readFile(candidatePath);
  const candidateSha = sha256Hex(raw);
  if (candidateSha !== FORECAST_PUBLICATION_CANDIDATE_EXPECTED_SHA256) {
    throw new Error(
      `Candidate SHA mismatch: expected ${FORECAST_PUBLICATION_CANDIDATE_EXPECTED_SHA256}, got ${candidateSha}`,
    );
  }
  const candidate = JSON.parse(raw.toString("utf8")) as ForecastPublicationCandidate;
  const release = buildForecastReleaseArtifact({
    candidate,
    sourceCommit,
    sourceCandidateSha256: candidateSha,
  });
  const serialized = stableStringifyForecastRelease(release);
  const releaseSha = sha256Hex(serialized);
  const manifest = buildForecastReleaseManifest({
    sourceCommit,
    releaseArtifactSha256: releaseSha,
    attribution: release.attribution,
    limitations: release.limitations,
  });
  const stagingDir = path.resolve(cwd, FORECAST_RELEASE_STAGING_RELATIVE_DIR);
  await mkdir(stagingDir, { recursive: true });
  const artifactPath = path.join(stagingDir, FORECAST_RELEASE_ARTIFACT_FILENAME);
  const manifestPath = path.join(stagingDir, FORECAST_RELEASE_MANIFEST_FILENAME);
  await writeFile(artifactPath, serialized, "utf8");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        status: "staged-unpublished",
        artifactPath: path.relative(cwd, artifactPath),
        manifestPath: path.relative(cwd, manifestPath),
        releaseArtifactSha256: releaseSha,
        sourceCandidateSha256: candidateSha,
        stringCount: release.strings.length,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
