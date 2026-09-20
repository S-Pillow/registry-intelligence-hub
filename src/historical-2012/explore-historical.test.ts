import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveActiveRegistryApplicationsDocument } from "@/lib/registry-application-payload-shared";
import { DEFAULT_CLAIM_ACTUALITY_STATE } from "@/reveal-day-2026/claim-actuality";
import rehearsalFixture from "@/data/fixtures/registry-applications.json";
import { parse2012ApplicationPayloadJson } from "@/historical-2012/payload-server";
import { resolveHistorical2012BrowserPayload } from "@/historical-2012/payload-shared";
import { APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH } from "@/historical-2012/approved-corpus-hash";

describe("Explore dataset isolation (D1)", () => {
  it("2026 rehearsal resolution unchanged when 2012 payload is absent", () => {
    const rehearsal = resolveActiveRegistryApplicationsDocument(DEFAULT_CLAIM_ACTUALITY_STATE, null);
    expect(rehearsal.mode).toBe("rehearsal");
    expect(rehearsal.document.applications).toHaveLength(rehearsalFixture.applications.length);
  });

  it("2012 historical payload does not replace 2026 hub registry document", async () => {
    const text = await readFile(
      join(process.cwd(), "src/data/fixtures/registry-2012-applications.payload.json"),
      "utf8",
    );
    const historical = parse2012ApplicationPayloadJson(text);
    const rehearsal = resolveActiveRegistryApplicationsDocument(DEFAULT_CLAIM_ACTUALITY_STATE, null);
    expect(historical.applications).toHaveLength(1930);
    expect(rehearsal.document.applications).toHaveLength(12);
    expect(rehearsal.document.applications[0]?.id).not.toBe(historical.applications[0]?.id);
  });

  it("loaded 2012 resolution is distinct from rehearsal row count", async () => {
    const text = await readFile(
      join(process.cwd(), "src/data/fixtures/registry-2012-applications.payload.json"),
      "utf8",
    );
    const historical = parse2012ApplicationPayloadJson(text);
    const resolution = resolveHistorical2012BrowserPayload(
      historical,
      APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH,
    );
    expect(resolution.status).toBe("loaded");
    if (resolution.status === "loaded") {
      expect(resolution.document.payloadMode).toBe("historical-2012");
    }
  });
});
