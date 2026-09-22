import { describe, expect, it } from "vitest";
import { join } from "node:path";
import {
  RESTRICTED_RAW_PAGE_0001_SOURCE_SHA256,
  SANITIZED_LIVE_FIXTURE_MANIFEST_DECLARED_SHA256,
  SANITIZED_LIVE_PAGE_0001_CONTENT_SHA256,
  SANITIZED_LIVE_PAGE_0002_CONTENT_SHA256,
} from "./sanitized-live-fixture-constants";
import { loadSanitizedLiveFixtureManifest } from "./sanitized-live-fixture-gate";

const workspaceRoot = join(process.cwd());

describe("sanitized-live fixture SHA gate (P0.3E-I2)", () => {
  it("committed fixture manifest pins match exported constants", async () => {
    const manifest = await loadSanitizedLiveFixtureManifest(workspaceRoot);
    expect(manifest.manifestDeclaredSha256).toBe(SANITIZED_LIVE_FIXTURE_MANIFEST_DECLARED_SHA256);

    const page1 = manifest.pages.find((p) => p.pageOrdinal === 1);
    expect(page1?.contentSha256).toBe(SANITIZED_LIVE_PAGE_0001_CONTENT_SHA256);
    expect(page1?.rawSourceSha256).toBe(RESTRICTED_RAW_PAGE_0001_SOURCE_SHA256);
    expect(page1?.contentSha256).not.toBe(page1?.rawSourceSha256);

    const page2 = manifest.pages.find((p) => p.pageOrdinal === 2);
    expect(page2?.contentSha256).toBe(SANITIZED_LIVE_PAGE_0002_CONTENT_SHA256);
    expect(page2?.rawSourceSha256).toBeUndefined();
  });
});
