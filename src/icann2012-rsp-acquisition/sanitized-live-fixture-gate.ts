import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256Hex } from "@/normalization/hashes";
import {
  defaultSanitizedLiveMappingRunDir,
  sanitizedLivePageHtmlPath,
} from "./grid-evidence-paths";
import {
  REGISTRY_HUB_RSP_REQUIRE_SANITIZED_FIXTURE_ENV,
  SANITIZED_LIVE_FIXTURE_MANIFEST_FILE_BODY_SHA256,
  SANITIZED_LIVE_FIXTURE_MANIFEST_SELF_DIGEST_SHA256,
  SANITIZED_LIVE_PAGE_0001_SANITIZED_SHA256,
  SANITIZED_LIVE_PAGE_0001_SOURCE_SHA256,
  SANITIZED_LIVE_PAGE_0002_SANITIZED_SHA256,
  SANITIZED_LIVE_PAGE_0002_SOURCE_SHA256,
} from "./sanitized-live-fixture-constants";
import {
  manifestRecordWithoutSelfDigest,
  sanitizedLiveFixtureManifestSelfDigest,
} from "./sanitized-live-fixture-manifest-digest";
import {
  SANITIZED_LIVE_FIXTURE_MANIFEST_VERSION,
  type SanitizedLiveFixtureManifest,
  type SanitizedLiveFixturePagePin,
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

export async function sanitizedLiveV3FixtureBundlePresent(
  workspaceRoot: string,
): Promise<boolean> {
  const manifestPath = sanitizedLiveFixtureManifestPath(workspaceRoot);
  if (!(await pathExists(manifestPath))) {
    return false;
  }
  const bytes = await readFile(manifestPath);
  return sha256Hex(bytes) === SANITIZED_LIVE_FIXTURE_MANIFEST_FILE_BODY_SHA256;
}

function pagePin(manifest: SanitizedLiveFixtureManifest, pageOrdinal: number): SanitizedLiveFixturePagePin {
  const pin = manifest.pages.find((p) => p.pageOrdinal === pageOrdinal);
  if (!pin) {
    throw new Error(`sanitized-live-fixture-manifest.json missing page ordinal ${pageOrdinal}`);
  }
  return pin;
}

function assertManifestPinsMatchConstants(manifest: SanitizedLiveFixtureManifest): void {
  const page1 = pagePin(manifest, 1);
  if (page1.sanitizedHtmlSha256 !== SANITIZED_LIVE_PAGE_0001_SANITIZED_SHA256) {
    throw new Error(
      "sanitized-live-fixture-manifest.json page-0001 sanitizedHtmlSha256 does not match SANITIZED_LIVE_PAGE_0001_SANITIZED_SHA256",
    );
  }
  if (page1.sourceHtmlSha256 !== SANITIZED_LIVE_PAGE_0001_SOURCE_SHA256) {
    throw new Error(
      "sanitized-live-fixture-manifest.json page-0001 sourceHtmlSha256 does not match SANITIZED_LIVE_PAGE_0001_SOURCE_SHA256",
    );
  }

  const page2 = pagePin(manifest, 2);
  if (page2.sanitizedHtmlSha256 !== SANITIZED_LIVE_PAGE_0002_SANITIZED_SHA256) {
    throw new Error(
      "sanitized-live-fixture-manifest.json page-0002 sanitizedHtmlSha256 does not match SANITIZED_LIVE_PAGE_0002_SANITIZED_SHA256",
    );
  }
  if (page2.sourceHtmlSha256 !== SANITIZED_LIVE_PAGE_0002_SOURCE_SHA256) {
    throw new Error(
      "sanitized-live-fixture-manifest.json page-0002 sourceHtmlSha256 does not match SANITIZED_LIVE_PAGE_0002_SOURCE_SHA256",
    );
  }
}

function assertManifestDigests(manifestText: string, manifest: SanitizedLiveFixtureManifest): void {
  const fileBodySha = sha256Hex(Buffer.from(manifestText, "utf8"));
  if (fileBodySha !== SANITIZED_LIVE_FIXTURE_MANIFEST_FILE_BODY_SHA256) {
    throw new Error(
      "sanitized-live-fixture-manifest.json file-body SHA does not match SANITIZED_LIVE_FIXTURE_MANIFEST_FILE_BODY_SHA256",
    );
  }

  const withoutSelf = manifestRecordWithoutSelfDigest(manifest as unknown as Record<string, unknown>);
  const selfDigest = sanitizedLiveFixtureManifestSelfDigest(withoutSelf);
  if (selfDigest !== SANITIZED_LIVE_FIXTURE_MANIFEST_SELF_DIGEST_SHA256) {
    throw new Error(
      "sanitized-live-fixture-manifest.json manifestSha256 self-digest does not match SANITIZED_LIVE_FIXTURE_MANIFEST_SELF_DIGEST_SHA256",
    );
  }
  if (manifest.manifestSha256 !== SANITIZED_LIVE_FIXTURE_MANIFEST_SELF_DIGEST_SHA256) {
    throw new Error(
      "sanitized-live-fixture-manifest.json manifestSha256 field does not match pinned self-digest constant",
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
  assertManifestDigests(text, parsed);
  assertManifestPinsMatchConstants(parsed);
  return parsed;
}

export function sanitizedLivePageHtmlPathForPin(
  workspaceRoot: string,
  pin: SanitizedLiveFixturePagePin,
): string {
  return join(defaultSanitizedLiveMappingRunDir(workspaceRoot), pin.sanitizedHtmlRelativePath);
}

export async function assertSanitizedLivePageBytesMatchPins(
  workspaceRoot: string,
  manifest: SanitizedLiveFixtureManifest,
): Promise<void> {
  for (const pin of manifest.pages) {
    const htmlPath = sanitizedLivePageHtmlPathForPin(workspaceRoot, pin);
    if (!(await pathExists(htmlPath))) {
      throw new Error(`Missing sanitized-live fixture ${pin.sanitizedHtmlRelativePath} at ${htmlPath}`);
    }
    const bytes = await readFile(htmlPath);
    const sanitizedContentSha = sha256Hex(bytes);
    if (sanitizedContentSha !== pin.sanitizedHtmlSha256) {
      throw new Error(
        `${pin.sanitizedHtmlRelativePath} sanitized SHA mismatch: expected pin ${pin.sanitizedHtmlSha256}, got ${sanitizedContentSha}`,
      );
    }
  }
}

export async function sanitizedLivePrimaryFixturesPresent(
  workspaceRoot: string,
): Promise<boolean> {
  if (!(await sanitizedLiveV3FixtureBundlePresent(workspaceRoot))) {
    return false;
  }
  const page1Path = sanitizedLivePageHtmlPath(workspaceRoot, 1);
  return pathExists(page1Path);
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

  if (!(await sanitizedLiveV3FixtureBundlePresent(workspaceRoot))) {
    if (options.requireFixtures) {
      throw new Error(
        "Missing canonical v3 sanitized-live fixture bundle — import transfer/d2-5a-p0-3i3c-sanitized-fixture-v3 @ 354878d",
      );
    }
    return null;
  }

  const manifest = await loadSanitizedLiveFixtureManifest(workspaceRoot);
  await assertSanitizedLivePageBytesMatchPins(workspaceRoot, manifest);
  return manifest;
}
