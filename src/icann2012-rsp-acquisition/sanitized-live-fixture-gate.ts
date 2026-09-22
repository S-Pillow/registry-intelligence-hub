import { access, readFile } from "node:fs/promises";
import { sha256Hex } from "@/normalization/hashes";
import {
  defaultSanitizedLiveMappingRunDir,
  sanitizedLivePageHtmlPath,
} from "./grid-evidence-paths";
import {
  REGISTRY_HUB_RSP_REQUIRE_SANITIZED_FIXTURE_ENV,
  RESTRICTED_RAW_PAGE_0001_SOURCE_SHA256,
  SANITIZED_LIVE_FIXTURE_MANIFEST_DECLARED_SHA256,
  SANITIZED_LIVE_PAGE_0001_CONTENT_SHA256,
  SANITIZED_LIVE_PAGE_0002_CONTENT_SHA256,
} from "./sanitized-live-fixture-constants";
import {
  SANITIZED_LIVE_FIXTURE_MANIFEST_VERSION,
  type SanitizedLiveFixtureManifest,
} from "./sanitized-live-fixture-types";

export function sanitizedLiveFixtureManifestPath(workspaceRoot: string): string {
  return `${defaultSanitizedLiveMappingRunDir(workspaceRoot)}/sanitized-live-fixture-manifest.json`;
}

export function requireSanitizedLiveFixturesFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env[REGISTRY_HUB_RSP_REQUIRE_SANITIZED_FIXTURE_ENV] === "1";
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function assertManifestDeclaredShaMatchesConstant(manifest: SanitizedLiveFixtureManifest): void {
  if (manifest.manifestDeclaredSha256 !== SANITIZED_LIVE_FIXTURE_MANIFEST_DECLARED_SHA256) {
    throw new Error(
      "sanitized-live-fixture-manifest.json manifestDeclaredSha256 does not match SANITIZED_LIVE_FIXTURE_MANIFEST_DECLARED_SHA256",
    );
  }
}

function assertManifestPageEntriesMatchConstants(manifest: SanitizedLiveFixtureManifest): void {
  const page1 = manifest.pages.find((p) => p.pageOrdinal === 1);
  if (!page1 || page1.contentSha256 !== SANITIZED_LIVE_PAGE_0001_CONTENT_SHA256) {
    throw new Error(
      "sanitized-live-fixture-manifest.json page-0001 contentSha256 does not match SANITIZED_LIVE_PAGE_0001_CONTENT_SHA256",
    );
  }
  if (page1.rawSourceSha256 !== RESTRICTED_RAW_PAGE_0001_SOURCE_SHA256) {
    throw new Error(
      "sanitized-live-fixture-manifest.json page-0001 rawSourceSha256 does not match RESTRICTED_RAW_PAGE_0001_SOURCE_SHA256",
    );
  }

  const page2 = manifest.pages.find((p) => p.pageOrdinal === 2);
  if (!page2 || page2.contentSha256 !== SANITIZED_LIVE_PAGE_0002_CONTENT_SHA256) {
    throw new Error(
      "sanitized-live-fixture-manifest.json page-0002 contentSha256 does not match SANITIZED_LIVE_PAGE_0002_CONTENT_SHA256",
    );
  }
}

export async function loadSanitizedLiveFixtureManifest(
  workspaceRoot: string,
): Promise<SanitizedLiveFixtureManifest> {
  const path = sanitizedLiveFixtureManifestPath(workspaceRoot);
  const text = await readFile(path, "utf8");
  const parsed = JSON.parse(text) as SanitizedLiveFixtureManifest;
  if (parsed.manifestVersion !== SANITIZED_LIVE_FIXTURE_MANIFEST_VERSION) {
    throw new Error(`Unexpected sanitized-live fixture manifest version: ${parsed.manifestVersion}`);
  }
  assertManifestDeclaredShaMatchesConstant(parsed);
  assertManifestPageEntriesMatchConstants(parsed);
  return parsed;
}

export async function assertSanitizedLivePageBytesMatchPins(
  workspaceRoot: string,
  manifest: SanitizedLiveFixtureManifest,
): Promise<void> {
  for (const pin of manifest.pages) {
    const htmlPath = sanitizedLivePageHtmlPath(workspaceRoot, pin.pageOrdinal);
    if (!(await pathExists(htmlPath))) {
      throw new Error(`Missing sanitized-live fixture ${pin.relativePath} at ${htmlPath}`);
    }
    const bytes = await readFile(htmlPath);
    const sanitizedContentSha = sha256Hex(bytes);
    if (sanitizedContentSha !== pin.contentSha256) {
      throw new Error(
        `${pin.relativePath} sanitized SHA mismatch: expected pin ${pin.contentSha256}, got ${sanitizedContentSha}`,
      );
    }
    if (pin.rawSourceSha256 && sanitizedContentSha === pin.rawSourceSha256) {
      throw new Error(
        `${pin.relativePath}: sanitized content SHA must not equal rawSourceSha256 (provenance-only pin)`,
      );
    }
  }
}

export async function sanitizedLivePrimaryFixturesPresent(
  workspaceRoot: string,
): Promise<boolean> {
  const manifestPath = sanitizedLiveFixtureManifestPath(workspaceRoot);
  const page1Path = sanitizedLivePageHtmlPath(workspaceRoot, 1);
  return (await pathExists(manifestPath)) && (await pathExists(page1Path));
}

export async function enforceSanitizedLiveFixtureGate(
  workspaceRoot: string,
  options: { requireFixtures: boolean },
): Promise<SanitizedLiveFixtureManifest | null> {
  const manifestPath = sanitizedLiveFixtureManifestPath(workspaceRoot);
  const manifestPresent = await pathExists(manifestPath);
  const page1Present = await pathExists(sanitizedLivePageHtmlPath(workspaceRoot, 1));

  if (!manifestPresent || !page1Present) {
    if (options.requireFixtures) {
      throw new Error(
        "Missing P0.3D sanitized-live fixtures — expected " +
          "src/normalization/fixtures/icann2012-rsp-public-portions-v1/fixtures/sanitized-live/mapping-20260922-vps-01/ " +
          "(sanitized-live-fixture-manifest.json and page-0001.html) on checkpoint/d2-5a-p0-3d2-sanitized-live-fixtures",
      );
    }
    return null;
  }

  const manifest = await loadSanitizedLiveFixtureManifest(workspaceRoot);
  await assertSanitizedLivePageBytesMatchPins(workspaceRoot, manifest);
  return manifest;
}
