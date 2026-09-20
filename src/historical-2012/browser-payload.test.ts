import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APPROVED_2012_BASELINE } from "@/comparison/approved-2012-baseline";
import { APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH } from "@/historical-2012/approved-corpus-hash";
import { buildRegistry2012BrowserPayload } from "@/historical-2012/build-browser-payload";
import {
  APPLICATION_PAYLOAD_2012_JSON_ENV,
  parse2012ApplicationPayloadJson,
} from "@/historical-2012/payload-server";
import { resolveHistorical2012BrowserPayload } from "@/historical-2012/payload-shared";

const COMMITTED_PAYLOAD = join(
  process.cwd(),
  "src/data/fixtures/registry-2012-applications.payload.json",
);

describe("2012 historical browser payload (Ticket D1)", () => {
  it("builds deterministic 1930-application payload aligned to APPROVED_2012_BASELINE counts", async () => {
    const first = await buildRegistry2012BrowserPayload(process.cwd());
    const second = await buildRegistry2012BrowserPayload(process.cwd());
    expect(first.corpusContentHash).toBe(second.corpusContentHash);
    expect(first.applications).toHaveLength(APPROVED_2012_BASELINE.applications);
    expect(new Set(first.applications.map((a) => a.string)).size).toBe(
      APPROVED_2012_BASELINE.uniqueStrings,
    );
    expect(first.applications.filter((a) => a.idn).length).toBe(
      APPROVED_2012_BASELINE.idnApplications,
    );
    expect(first.roundProgramYear).toBe(2012);
    expect(first.provenance.normalizationBundleId).toBe(APPROVED_2012_BASELINE.bundleId);
  });

  it("committed artifact matches builder output and approved corpus hash", async () => {
    const built = await buildRegistry2012BrowserPayload(process.cwd());
    const committedText = await readFile(COMMITTED_PAYLOAD, "utf8");
    const committed = parse2012ApplicationPayloadJson(committedText);
    expect(committed.corpusContentHash).toBe(APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH);
    expect(committed.corpusContentHash).toBe(built.corpusContentHash);
    expect(committed.applications).toHaveLength(1930);
  });

  it("fail-closes invalid round, count, and corpus hash", async () => {
    const payload = await buildRegistry2012BrowserPayload(process.cwd());
    const loaded = resolveHistorical2012BrowserPayload(payload, APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH);
    expect(loaded.status).toBe("loaded");

    const badHash = resolveHistorical2012BrowserPayload(payload, "0".repeat(64));
    expect(badHash.status).toBe("not-loaded");
    expect(badHash.reason).toBe("corpus-hash-mismatch");

    const badCount = resolveHistorical2012BrowserPayload({
      ...payload,
      applications: payload.applications.slice(0, 100),
    });
    expect(badCount.reason).toBe("record-count-mismatch");

    expect(resolveHistorical2012BrowserPayload(null).reason).toBe("not-configured");
  });

  it("parses env-injected 2012 payload JSON separately from 2026 env", async () => {
    const payload = await buildRegistry2012BrowserPayload(process.cwd());
    const previous = process.env[APPLICATION_PAYLOAD_2012_JSON_ENV];
    process.env[APPLICATION_PAYLOAD_2012_JSON_ENV] = JSON.stringify(payload);
    try {
      const parsed = parse2012ApplicationPayloadJson(process.env[APPLICATION_PAYLOAD_2012_JSON_ENV]!);
      expect(parsed.payloadVersion).toBe("registry-browser-2012-applications/1.0.0");
      expect(parsed.applications[0]?.id).toMatch(/\d-\d+-\d+/);
    } finally {
      if (previous === undefined) delete process.env[APPLICATION_PAYLOAD_2012_JSON_ENV];
      else process.env[APPLICATION_PAYLOAD_2012_JSON_ENV] = previous;
    }
  });
});
