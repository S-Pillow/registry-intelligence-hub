import { describe, expect, it } from "vitest";
import { join } from "node:path";
import {
  SANITIZED_LIVE_FIXTURE_MANIFEST_FILE_BODY_SHA256,
  SANITIZED_LIVE_FIXTURE_MANIFEST_SELF_DIGEST_SHA256,
  SANITIZED_LIVE_PAGE_0001_SANITIZED_SHA256,
  SANITIZED_LIVE_PAGE_0001_SOURCE_SHA256,
  SANITIZED_LIVE_PAGE_0002_SANITIZED_SHA256,
  SANITIZED_LIVE_PAGE_0002_SOURCE_SHA256,
} from "./sanitized-live-fixture-constants";
import {
  loadSanitizedLiveFixtureManifest,
  sanitizedLiveV3FixtureBundlePresent,
} from "./sanitized-live-fixture-gate";

const workspaceRoot = join(process.cwd());

describe("sanitized-live fixture SHA gate (P0.3E-I4 v3)", () => {
  it("committed v3 fixture manifest pins match exported constants", async () => {
    if (!(await sanitizedLiveV3FixtureBundlePresent(workspaceRoot))) {
      return;
    }
    const manifest = await loadSanitizedLiveFixtureManifest(workspaceRoot);
    expect(manifest.manifestSha256).toBe(SANITIZED_LIVE_FIXTURE_MANIFEST_SELF_DIGEST_SHA256);

    const page1 = manifest.pages.find((p) => p.pageOrdinal === 1);
    expect(page1?.sanitizedHtmlSha256).toBe(SANITIZED_LIVE_PAGE_0001_SANITIZED_SHA256);
    expect(page1?.sourceHtmlSha256).toBe(SANITIZED_LIVE_PAGE_0001_SOURCE_SHA256);

    const page2 = manifest.pages.find((p) => p.pageOrdinal === 2);
    expect(page2?.sanitizedHtmlSha256).toBe(SANITIZED_LIVE_PAGE_0002_SANITIZED_SHA256);
    expect(page2?.sourceHtmlSha256).toBe(SANITIZED_LIVE_PAGE_0002_SOURCE_SHA256);
    expect(page2?.sourceHtmlSha256).toBe(page2?.sanitizedHtmlSha256);
  });

  it("manifest file-body pin constant documents v3 bundle authority", () => {
    expect(SANITIZED_LIVE_FIXTURE_MANIFEST_FILE_BODY_SHA256).toHaveLength(64);
  });
});
