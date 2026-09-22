import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJson, sha256Hex } from "@/normalization/hashes";
import {
  SANITIZED_LIVE_PAGE_0001_CONTENT_SHA256,
  SANITIZED_LIVE_PROVENANCE_MANIFEST_CONTENT_SHA256,
} from "./sanitized-live-fixture-constants";
import {
  loadSanitizedLiveProvenanceManifest,
  sanitizedLiveProvenanceManifestPath,
} from "./sanitized-live-fixture-gate";

const workspaceRoot = join(process.cwd());

describe("sanitized-live fixture SHA gate (P0.3E-I1)", () => {
  it("committed provenance manifest pins match exported constants", async () => {
    const manifest = await loadSanitizedLiveProvenanceManifest(workspaceRoot);
    const page1 = manifest.pages.find((p) => p.pageOrdinal === 1);
    expect(page1?.contentSha256).toBe(SANITIZED_LIVE_PAGE_0001_CONTENT_SHA256);
    expect(manifest.manifestSha256).toBe(SANITIZED_LIVE_PROVENANCE_MANIFEST_CONTENT_SHA256);
  });

  it("manifestSha256 is canonical hash of body without self field", async () => {
    const path = sanitizedLiveProvenanceManifestPath(workspaceRoot);
    const parsed = JSON.parse(await readFile(path, "utf8")) as {
      manifestSha256: string;
      [key: string]: unknown;
    };
    const { manifestSha256, ...body } = parsed;
    expect(manifestSha256).toBe(sha256Hex(Buffer.from(canonicalJson(body), "utf8")));
  });
});
