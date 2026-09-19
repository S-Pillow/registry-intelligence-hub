import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadFixtureBundle } from "./load-bundle";
import { observationsFromParsedRecords } from "./observations";
import { normalizeFromObservations } from "./normalize";
import { parseBundle } from "./parse";
import { normalizeAndPersist, runNormalization } from "./pipeline";
import { assertDeterministicReport, buildQualityReport } from "./report";
import { createNormalizationStore, verifyStoredBuild } from "./store";
import { traceEntity } from "./trace";
import { readFile } from "node:fs/promises";
import { PARSER_VERSION } from "./types";

const workspaceRoot = join(import.meta.dirname, "..", "..");
const bundleId = "icann2012-representative-v1";
const projectDocsRoot = "/cursor/stores/bc-e04e6cc5-a825-4e04-8ec0-9262ee0fe1cb/docs";

describe("2012 normalization foundation", () => {
  it("loads bundle with stable input content hash", async () => {
    const a = await loadFixtureBundle(bundleId, workspaceRoot);
    const b = await loadFixtureBundle(bundleId, workspaceRoot);
    expect(a.inputContentHash).toBe(b.inputContentHash);
    expect(a.rawSnapshots[0].redirectChain).toHaveLength(1);
    expect(a.rawSnapshots[0].redirectChain[0].httpStatus).toBe(301);
  });

  it("preserves lineage hashes and record locators on parsed records", async () => {
    const loaded = await loadFixtureBundle(bundleId, workspaceRoot);
    const parsed = parseBundle(loaded);
    expect(parsed.every((r) => r.parserVersion === PARSER_VERSION)).toBe(true);
    expect(parsed.every((r) => r.locator.bundleId === bundleId)).toBe(true);
    const appRecord = parsed.find((r) => r.payload.applicationId === "1-1200-1-3");
    expect(appRecord?.payload.isIdn).toBe(true);
    expect(appRecord?.payload.stringAlabel).toBe("xn--mgbuq0c");
  });

  it("emits distinct entity kinds and disagreement states", async () => {
    const loaded = await loadFixtureBundle(bundleId, workspaceRoot);
    const parsed = parseBundle(loaded);
    const observations = observationsFromParsedRecords(parsed);
    const entities = normalizeFromObservations(loaded, parsed, observations);

    const kinds = new Set(entities.map((e) => e.entityKind));
    expect(kinds.has("application")).toBe(true);
    expect(kinds.has("applied-string")).toBe(true);
    expect(kinds.has("applicant")).toBe(true);
    expect(kinds.has("organization")).toBe(true);
    expect(kinds.has("contention-set")).toBe(true);
    expect(kinds.has("registry-operator")).toBe(true);
    expect(kinds.has("round")).toBe(true);
    expect(kinds.has("tld")).toBe(true);

    const conflictApp = entities.find((e) => e.entityId === "application:1-1200-1-1");
    expect(conflictApp?.reconciliationState).toBe("CONFLICT");

    const missingRef = entities.find((e) => e.entityId === "application:1-1200-1-4");
    expect(missingRef?.reconciliationState).toBe("REQUIRES_REVIEW");

    const org = entities.find((e) => e.entityKind === "organization");
    expect(org?.entityKind).toBe("organization");
    if (org && org.entityKind === "organization") {
      expect(org.candidates.length).toBeGreaterThan(0);
    }
  });

  it("reapplies immutable overrides on deterministic rebuild", async () => {
    const loaded = await loadFixtureBundle(bundleId, workspaceRoot);
    const parsed = parseBundle(loaded);
    const observations = observationsFromParsedRecords(parsed);
    const entities = normalizeFromObservations(loaded, parsed, observations);
    const applicant = entities.find((e) => e.entityId === "applicant:1-1200-1-4");
    expect(applicant && applicant.entityKind === "applicant" && applicant.legalName.value).toBe("Hotels Global S.A.");
    expect(applicant?.lineage.overrideOpIds).toContain("ovr-2012-hotels-jurisdiction");
  });

  it("produces byte-identical rebuild and passes store verification", async () => {
    const dir = await mkdtemp(join(tmpdir(), "norm-test-"));
    try {
      const first = await normalizeAndPersist({ bundleId, workspaceRoot, storeRoot: dir });
      const second = await runNormalization({ bundleId, workspaceRoot, storeRoot: dir });
      expect(first.manifest.outputContentHash).toBe(second.manifest.outputContentHash);
      expect(first.manifest.buildId).toBe(second.manifest.buildId);
      assertDeterministicReport(first.report, second.report);

      const store = createNormalizationStore(dir);
      const stored = await store.readBuild(first.manifest.buildId);
      const verification = verifyStoredBuild(stored);
      expect(verification.ok).toBe(true);

      const ids = stored.entities.map((e) => e.entityId);
      expect(new Set(ids).size).toBe(ids.length);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("trace links entity to observations and overrides", async () => {
    const artifacts = await runNormalization({ bundleId, workspaceRoot, storeRoot: "/tmp/unused" });
    const traced = traceEntity(artifacts, "application", "1-1200-1-4");
    expect(traced.entity?.entityId).toBe("application:1-1200-1-4");
    expect(traced.overrideOpIds.length).toBeGreaterThan(0);
    expect(traced.chain.some((c) => c.startsWith("raw:"))).toBe(true);
  });

  it("quality report is deterministic for fixed generatedAt", async () => {
    const loaded = await loadFixtureBundle(bundleId, workspaceRoot);
    const parsed = parseBundle(loaded);
    const observations = observationsFromParsedRecords(parsed);
    const entities = normalizeFromObservations(loaded, parsed, observations);
    const r1 = buildQualityReport(loaded.definition.id, loaded.definition.version, loaded.inputContentHash, entities, observations, ["limit"]);
    const r2 = buildQualityReport(loaded.definition.id, loaded.definition.version, loaded.inputContentHash, entities, observations, ["limit"]);
    assertDeterministicReport(r1, r2);
  });

  it("project docs describe lineage and representative scope", async () => {
    const domain = await readFile(join(projectDocsRoot, "domain-model-and-normalization.md"), "utf8");
    const quality = await readFile(join(projectDocsRoot, "normalization-quality-report.md"), "utf8");
    expect(domain).toContain("raw snapshot");
    expect(domain).toContain("REQUIRES_REVIEW");
    expect(domain).toContain("not the full");
    expect(quality).toContain("icann2012-representative-v1");
    expect(quality).toContain("not");
  });

  it("detects tampered output hash in stored build", async () => {
    const dir = await mkdtemp(join(tmpdir(), "norm-tamper-"));
    try {
      const artifacts = await normalizeAndPersist({ bundleId, workspaceRoot, storeRoot: dir });
      const store = createNormalizationStore(dir);
      const tampered = await store.readBuild(artifacts.manifest.buildId);
      tampered.manifest.outputContentHash = "0".repeat(64);
      const check = verifyStoredBuild(tampered);
      expect(check.ok).toBe(false);
      expect(check.errors.some((e) => e.includes("hash"))).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
