import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildBrowserApplicationPayloadFromPublication } from "../lib/registry-application-payload";
import { contentHash } from "../normalization/hashes";
import { sha256Hex } from "../pipeline/content-store";
import {
  buildPublicationFromLocalArtifact,
  type LocalArtifactBuildRequest,
  PUBLICATION_REVIEW_VERSION,
} from "./build-publication";
import { NORMALIZER_VERSION, PARSER_VERSION, PUBLICATION_SCHEMA_VERSION_V11 } from "./types";

const FIXTURE_DIR = join(process.cwd(), "src/reveal-day-2026/fixtures/synthetic-ingest-1-not-a-publication");
const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs) await rm(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

async function readFixture(name: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(join(FIXTURE_DIR, name)));
}

function requestFor(
  bytes: Uint8Array,
  overrides: Partial<LocalArtifactBuildRequest> = {},
): LocalArtifactBuildRequest {
  const finalBytes = overrides.bytes ?? bytes;
  return {
    artifactId: "synthetic-ingest-1-not-a-publication",
    sourceVersion: "1",
    captureId: "capture-synthetic-ingest-1",
    sourceUrl: "https://example.invalid/synthetic-ingest-1-not-a-publication",
    sourceName: "Synthetic local capture (not an ICANN 2026 publication)",
    retrievedAt: "2026-09-26T00:00:00.000Z",
    publishedAt: "2026-09-26T00:00:00.000Z",
    mediaType: "application/x-ndjson",
    round: "2026",
    evidenceClass: "synthetic-not-a-2026-publication",
    snapshotId: "snap-synthetic-ingest-1-not-a-publication",
    fixtureId: "synthetic-ingest-1-not-a-publication",
    expectedRowCount: "100",
    recordedHttpStatus: "200",
    parserVersion: PARSER_VERSION,
    normalizerVersion: NORMALIZER_VERSION,
    schemaVersion: PUBLICATION_SCHEMA_VERSION_V11,
    ...overrides,
    bytes: finalBytes,
    expectSourceHash: overrides.expectSourceHash ?? sha256Hex(finalBytes),
  };
}

function fileHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function snapshotDirectory(directory: string): Promise<Record<string, string> | null> {
  let names: string[];
  try {
    names = await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const files: Record<string, string> = {};
  for (const name of names.sort()) {
    const path = join(directory, name);
    const info = await stat(path);
    if (!info.isFile()) continue;
    files[name] = fileHash(new Uint8Array(await readFile(path)));
  }
  return files;
}

describe("build-publication offline bundle", () => {
  it("builds a valid synthetic capture into an unpromoted publication", async () => {
    const sourcePath = join(FIXTURE_DIR, "captured-valid.ndjson");
    const before = await readFile(sourcePath);
    const result = buildPublicationFromLocalArtifact(requestFor(new Uint8Array(before)));
    const after = await readFile(sourcePath);
    expect(Buffer.compare(before, after)).toBe(0);

    expect(result.ok).toBe(true);
    expect(result.publication).toBeDefined();
    const publication = result.publication;
    if (!publication) throw new Error("expected publication");
    expect(publication.schemaVersion).toBe(PUBLICATION_SCHEMA_VERSION_V11);
    expect(publication.publicationKind).toBe("immutable-publication");
    expect(publication.snapshotId).toBe("snap-synthetic-ingest-1-not-a-publication");
    expect(publication.applications).toHaveLength(100);
    expect(publication.lineage?.rawSha256).toBe(sha256Hex(new Uint8Array(before)));
    expect(publication.lineage?.fetchUrl).toBe("https://example.invalid/synthetic-ingest-1-not-a-publication");
    expect(publication.lineage?.pipelineSourceId).toBe("synthetic-ingest-1-not-a-publication");
    expect(publication.lineage?.manifestAttemptId).toBe("capture-synthetic-ingest-1");
    expect(publication.lineage?.adapterId).toBe("local-artifact");
    expect(publication.retrievedAt).toBe("2026-09-26T00:00:00.000Z");
    expect(publication.limitations[0]).toBe("NOT PROMOTED.");
    expect(new Set(publication.applications.map((row) => row.string)).size).toBe(99);
    expect(publication.applications.filter((row) => row.idn)).toHaveLength(1);
    expect(publication.applications.filter((row) => row.string === "synthetic-ingest-not-real-shared")).toHaveLength(2);

    expect(result.review.reviewVersion).toBe(PUBLICATION_REVIEW_VERSION);
    expect(result.review.promotionStatus).toBe("NOT_PROMOTED");
    expect(result.review.promoted).toBe(false);
    expect(result.review.realSourceReady).toBe(false);
    expect(result.review.networkFetchPerformed).toBe(false);
    expect(result.review.claimActualityWritten).toBe(false);
    expect(result.review.promotionHistoryWritten).toBe(false);
    expect(result.review.browserDatasetChanged).toBe(false);
    expect(result.review.validationStatus).toBe("pass");
    expect(result.review.contaminationGuardStatus).toBe("clear");
    expect(result.review.rowCount).toBe(100);
    expect(result.review.distinctExactStrings).toBe(99);
    expect(result.review.idnCount).toBe(1);
    expect(result.review.parserVersion).toBe(PARSER_VERSION);
    expect(result.review.retrievalTimestampInsideContentHash).toBe(false);
    expect(result.review.contentHash).toBe(contentHash({
      snapshotId: publication.snapshotId,
      applications: publication.applications,
    }));
    expect(JSON.stringify(result.review)).not.toMatch(/\/workspace|\/home|\/tmp/);
  });

  it("accepts the publication in the existing browser-payload converter", async () => {
    const bytes = await readFixture("captured-valid.ndjson");
    const result = buildPublicationFromLocalArtifact(requestFor(bytes));
    if (!result.publication || !result.review.contentHash) throw new Error("expected publication");
    const payload = buildBrowserApplicationPayloadFromPublication(result.publication);
    expect(payload.snapshotId).toBe(result.publication.snapshotId);
    expect(payload.snapshotContentHash).toBe(result.review.contentHash);
    expect(payload.applications).toHaveLength(100);
    expect(payload.payloadVersion).toBe("registry-browser-applications/1.0.0");
  });

  it("rebuilds identical bytes and keeps retrieval time outside the content hash", async () => {
    const bytes = await readFixture("captured-valid.ndjson");
    const first = buildPublicationFromLocalArtifact(requestFor(bytes));
    const second = buildPublicationFromLocalArtifact(requestFor(bytes));
    expect(JSON.stringify(first.publication)).toBe(JSON.stringify(second.publication));
    expect(JSON.stringify(first.review)).toBe(JSON.stringify(second.review));

    const later = buildPublicationFromLocalArtifact(requestFor(bytes, { retrievedAt: "2026-09-27T00:00:00.000Z" }));
    expect(later.ok).toBe(true);
    expect(later.review.sourceHash).toBe(first.review.sourceHash);
    expect(later.review.contentHash).toBe(first.review.contentHash);
    expect(JSON.stringify(later.publication)).not.toBe(JSON.stringify(first.publication));
  });

  it("changes source and content hashes when application bytes change", async () => {
    const bytes = await readFixture("captured-valid.ndjson");
    const original = buildPublicationFromLocalArtifact(requestFor(bytes));
    const changed = Buffer.from(bytes).toString("utf8").replace("Synthetic Applicant Ingest", "Synthetic Applicant Ingest Two");
    const nextBytes = new Uint8Array(Buffer.from(changed));
    const rebuilt = buildPublicationFromLocalArtifact(requestFor(nextBytes));
    expect(rebuilt.ok).toBe(true);
    expect(rebuilt.review.sourceHash).not.toBe(original.review.sourceHash);
    expect(rebuilt.review.contentHash).not.toBe(original.review.contentHash);
  });

  it("rejects a source hash that does not match the bytes", async () => {
    const bytes = await readFixture("captured-valid.ndjson");
    const result = buildPublicationFromLocalArtifact(requestFor(bytes, { expectSourceHash: "a".repeat(64) }));
    expect(result.ok).toBe(false);
    expect(result.publication).toBeUndefined();
    expect(result.review.sourceHash).toBe(sha256Hex(bytes));
    expect(result.review.sourceHash).not.toBe("a".repeat(64));
    expect(result.review.promotionStatus).toBe("NOT_PROMOTED");
  });

  it("fails closed on duplicate ids without dropping rows", async () => {
    const bytes = await readFixture("captured-duplicate-id.ndjson");
    const result = buildPublicationFromLocalArtifact(requestFor(bytes));
    expect(result.ok).toBe(false);
    expect(result.publication).toBeUndefined();
    expect(result.review.rowCount).toBe(100);
    expect(result.review.validationStatus).toBe("fail");
    expect(result.review.errors.some((error) => error.includes("duplicate-application-id"))).toBe(true);
  });

  it("fails closed when the applied-for string is missing", async () => {
    const bytes = await readFixture("captured-missing-string.ndjson");
    const result = buildPublicationFromLocalArtifact(requestFor(bytes));
    expect(result.ok).toBe(false);
    expect(result.publication).toBeUndefined();
    expect(result.review.errors.some((error) => error.includes("missing string_label"))).toBe(true);
    expect(result.review.promotionStatus).toBe("NOT_PROMOTED");
  });

  it("does not trim an applied-for string into a valid label", async () => {
    const bytes = await readFixture("captured-valid.ndjson");
    const changed = Buffer.from(bytes).toString("utf8").replace(
      "synthetic-ingest-not-real-shared",
      "synthetic-ingest-not-real-shared ",
    );
    const result = buildPublicationFromLocalArtifact(requestFor(new Uint8Array(Buffer.from(changed))));
    expect(result.ok).toBe(false);
    expect(result.publication).toBeUndefined();
    expect(result.review.errors.some((error) => error.includes("malformed-string"))).toBe(true);
  });

  it("fails closed on malformed JSON", async () => {
    const bytes = await readFixture("captured-malformed.ndjson");
    const result = buildPublicationFromLocalArtifact(requestFor(bytes));
    expect(result.ok).toBe(false);
    expect(result.publication).toBeUndefined();
    expect(result.review.errors.some((error) => error.includes("invalid JSON"))).toBe(true);
    expect(result.review.contaminationGuardStatus).toBe("not-run");
  });

  it("fails closed on an unexpected wire field", async () => {
    const bytes = await readFixture("captured-unexpected-field.ndjson");
    const result = buildPublicationFromLocalArtifact(requestFor(bytes));
    expect(result.ok).toBe(false);
    expect(result.publication).toBeUndefined();
    expect(result.review.errors.some((error) => error.includes("unexpected field"))).toBe(true);
  });

  it("rejects the wrong round and the wrong publication schema", async () => {
    const bytes = await readFixture("captured-valid.ndjson");
    const wrongRound = buildPublicationFromLocalArtifact(requestFor(bytes, { round: "2012" }));
    expect(wrongRound.ok).toBe(false);
    expect(wrongRound.publication).toBeUndefined();
    expect(wrongRound.review.errors.some((error) => error.includes("round must be 2026"))).toBe(true);

    const wrongSchema = buildPublicationFromLocalArtifact(requestFor(bytes, {
      schemaVersion: "registry-2026-publication/1.0.0",
    }));
    expect(wrongSchema.ok).toBe(false);
    expect(wrongSchema.publication).toBeUndefined();
    expect(wrongSchema.review.validationStatus).toBe("fail");
  });

  it("does not parse HTML or CSV", async () => {
    const html = new Uint8Array(Buffer.from("<html>synthetic page</html>"));
    const htmlResult = buildPublicationFromLocalArtifact(requestFor(html, { mediaType: "text/html" }));
    expect(htmlResult.ok).toBe(false);
    expect(htmlResult.publication).toBeUndefined();
    expect(htmlResult.review.errors.some((error) => error.includes("no captured-artifact parser"))).toBe(true);

    const csv = new Uint8Array(Buffer.from("String,Applicant\nsynthetic,Synthetic Applicant\n"));
    const csvResult = buildPublicationFromLocalArtifact(requestFor(csv, { mediaType: "text/csv" }));
    expect(csvResult.ok).toBe(false);
    expect(csvResult.publication).toBeUndefined();
  });

  it("keeps the contamination guard effective", async () => {
    const bytes = await readFixture("captured-contamination.ndjson");
    const contaminated = buildPublicationFromLocalArtifact(requestFor(bytes));
    expect(contaminated.ok).toBe(false);
    expect(contaminated.publication).toBeUndefined();
    expect(contaminated.review.contaminationGuardStatus).toBe("blocked");
    expect(contaminated.review.promotionStatus).toBe("NOT_PROMOTED");

    const rehearsalId = buildPublicationFromLocalArtifact(requestFor(await readFixture("captured-valid.ndjson"), {
      snapshotId: "snap-rehearsal-synthetic-ingest-1",
    }));
    expect(rehearsalId.ok).toBe(false);
    expect(rehearsalId.publication).toBeUndefined();
    expect(rehearsalId.review.contaminationGuardStatus).toBe("blocked");
    expect(rehearsalId.review.snapshotId).toBe("snap-rehearsal-synthetic-ingest-1");
  });

  it("writes two identical CLI outputs and does not touch claim or promotion state", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ingest-1-proof-"));
    tempDirs.push(dir);
    const promotionDir = join(process.cwd(), ".data/reveal-2026");
    const promotionBefore = await snapshotDirectory(promotionDir);

    const rehearsalPath = join(process.cwd(), "src/data/fixtures/registry-applications.json");
    const drillPath = join(process.cwd(), "src/reveal-day-2026/fixtures/drill-2026-intake-v1/publication.snapshot.json");
    const rehearsalBefore = fileHash(new Uint8Array(await readFile(rehearsalPath)));
    const drillBefore = fileHash(new Uint8Array(await readFile(drillPath)));

    const source = await readFixture("captured-valid.ndjson");
    const sourceHash = sha256Hex(source);
    const inputPath = join(dir, "official-looking-icann-2026.ndjson");
    await writeFile(inputPath, source);

    const env = { ...process.env };
    for (const key of Object.keys(env)) {
      if (key.startsWith("REGISTRY_HUB_")) delete env[key];
    }
    const tsx = join(process.cwd(), "node_modules/tsx/dist/cli.mjs");
    const cli = join(process.cwd(), "src/reveal-day-2026/cli.ts");

    function run(outName: string, reviewName: string) {
      return spawnSync(process.execPath, [
        tsx,
        cli,
        "build-publication",
        "--input", inputPath,
        "--out", join(dir, outName),
        "--review-out", join(dir, reviewName),
        "--snapshot-id", "snap-synthetic-ingest-1-not-a-publication",
        "--artifact-id", "synthetic-ingest-1-not-a-publication",
        "--capture-id", "capture-synthetic-ingest-1",
        "--source-url", "https://example.invalid/synthetic-ingest-1-not-a-publication",
        "--source-name", "Synthetic local capture (not an ICANN 2026 publication)",
        "--source-version", "1",
        "--retrieved-at", "2026-09-26T00:00:00.000Z",
        "--published-at", "2026-09-26T00:00:00.000Z",
        "--media-type", "application/x-ndjson",
        "--round", "2026",
        "--evidence-class", "synthetic-not-a-2026-publication",
        "--expected-row-count", "100",
        "--expect-source-hash", sourceHash,
        "--recorded-http-status", "200",
        "--parser-version", PARSER_VERSION,
        "--normalizer-version", NORMALIZER_VERSION,
        "--schema-version", PUBLICATION_SCHEMA_VERSION_V11,
        "--fixture-id", "synthetic-ingest-1-not-a-publication",
      ], { cwd: process.cwd(), env, encoding: "utf8" });
    }

    const first = run("out-a.json", "review-a.json");
    const second = run("out-b.json", "review-b.json");
    if (first.status !== 0) throw new Error(first.stderr || first.stdout);
    if (second.status !== 0) throw new Error(second.stderr || second.stdout);
    const outA = await readFile(join(dir, "out-a.json"));
    const outB = await readFile(join(dir, "out-b.json"));
    const reviewA = await readFile(join(dir, "review-a.json"));
    const reviewB = await readFile(join(dir, "review-b.json"));
    expect(Buffer.compare(outA, outB)).toBe(0);
    expect(Buffer.compare(reviewA, reviewB)).toBe(0);
    expect(fileHash(outA)).toBe(fileHash(outB));
    expect(reviewA.toString("utf8")).toContain("\"promotionStatus\": \"NOT_PROMOTED\"");
    expect(reviewA.toString("utf8")).not.toContain("official-looking-icann-2026");
    expect(reviewA.toString("utf8")).toContain("synthetic-ingest-1-not-a-publication");

    expect(await snapshotDirectory(promotionDir)).toEqual(promotionBefore);
    expect(fileHash(new Uint8Array(await readFile(rehearsalPath)))).toBe(rehearsalBefore);
    expect(fileHash(new Uint8Array(await readFile(drillPath)))).toBe(drillBefore);
    expect(Buffer.compare(await readFile(inputPath), Buffer.from(source))).toBe(0);
  });

  it("removes a stale publication output when validation fails", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ingest-1-fail-"));
    tempDirs.push(dir);
    const source = await readFixture("captured-duplicate-id.ndjson");
    const inputPath = join(dir, "capture.ndjson");
    const outPath = join(dir, "publication.json");
    const reviewPath = join(dir, "review.json");
    await writeFile(inputPath, source);
    await writeFile(outPath, "{\"stale\":true}\n");
    const env = { ...process.env };
    for (const key of Object.keys(env)) {
      if (key.startsWith("REGISTRY_HUB_")) delete env[key];
    }
    const result = spawnSync(process.execPath, [
      join(process.cwd(), "node_modules/tsx/dist/cli.mjs"),
      join(process.cwd(), "src/reveal-day-2026/cli.ts"),
      "build-publication",
      "--input", inputPath,
      "--out", outPath,
      "--review-out", reviewPath,
      "--snapshot-id", "snap-synthetic-ingest-1-not-a-publication",
      "--artifact-id", "synthetic-ingest-1-not-a-publication",
      "--capture-id", "capture-synthetic-ingest-1",
      "--source-url", "https://example.invalid/synthetic-ingest-1-not-a-publication",
      "--source-name", "Synthetic local capture (not an ICANN 2026 publication)",
      "--source-version", "1",
      "--retrieved-at", "2026-09-26T00:00:00.000Z",
      "--published-at", "2026-09-26T00:00:00.000Z",
      "--media-type", "application/x-ndjson",
      "--round", "2026",
      "--evidence-class", "synthetic-not-a-2026-publication",
      "--expected-row-count", "100",
      "--expect-source-hash", sha256Hex(source),
      "--recorded-http-status", "200",
      "--parser-version", PARSER_VERSION,
      "--normalizer-version", NORMALIZER_VERSION,
      "--schema-version", PUBLICATION_SCHEMA_VERSION_V11,
    ], { cwd: process.cwd(), env, encoding: "utf8" });
    if (result.status !== 1) throw new Error(result.stderr || result.stdout);
    await expect(readFile(outPath)).rejects.toThrow();
    const review = JSON.parse(await readFile(reviewPath, "utf8")) as { validationStatus: string; promotionStatus: string };
    expect(review.validationStatus).toBe("fail");
    expect(review.promotionStatus).toBe("NOT_PROMOTED");
  });
});
