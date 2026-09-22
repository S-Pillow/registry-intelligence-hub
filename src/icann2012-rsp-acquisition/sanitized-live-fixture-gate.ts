import { access, readFile } from "node:fs/promises";
import { canonicalJson, sha256Hex } from "@/normalization/hashes";
import {
  defaultSanitizedLiveMappingRunDir,
  sanitizedLivePageHtmlPath,
} from "./grid-evidence-paths";
import {
  REGISTRY_HUB_RSP_REQUIRE_SANITIZED_FIXTURE_ENV,
  SANITIZED_LIVE_PAGE_0001_CONTENT_SHA256,
  SANITIZED_LIVE_PROVENANCE_MANIFEST_CONTENT_SHA256,
} from "./sanitized-live-fixture-constants";
import {
  SANITIZED_LIVE_PROVENANCE_MANIFEST_VERSION,
  type SanitizedLiveProvenanceManifest,
} from "./sanitized-live-fixture-types";

export function sanitizedLiveProvenanceManifestPath(workspaceRoot: string): string {
  return `${defaultSanitizedLiveMappingRunDir(workspaceRoot)}/sanitized-live-provenance.json`;
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

function assertManifestPinsMatchConstants(manifest: SanitizedLiveProvenanceManifest): void {
  const page1 = manifest.pages.find((p) => p.pageOrdinal === 1);
  if (!page1 || page1.contentSha256 !== SANITIZED_LIVE_PAGE_0001_CONTENT_SHA256) {
    throw new Error(
      "sanitized-live-provenance.json page-0001 pin does not match SANITIZED_LIVE_PAGE_0001_CONTENT_SHA256",
    );
  }
  if (manifest.manifestSha256 !== SANITIZED_LIVE_PROVENANCE_MANIFEST_CONTENT_SHA256) {
    throw new Error(
      "sanitized-live-provenance.json manifestSha256 does not match SANITIZED_LIVE_PROVENANCE_MANIFEST_CONTENT_SHA256",
    );
  }
}

export async function loadSanitizedLiveProvenanceManifest(
  workspaceRoot: string,
): Promise<SanitizedLiveProvenanceManifest> {
  const path = sanitizedLiveProvenanceManifestPath(workspaceRoot);
  const text = await readFile(path, "utf8");
  const parsed = JSON.parse(text) as SanitizedLiveProvenanceManifest;
  if (parsed.manifestVersion !== SANITIZED_LIVE_PROVENANCE_MANIFEST_VERSION) {
    throw new Error(`Unexpected sanitized-live provenance version: ${parsed.manifestVersion}`);
  }
  const bodyWithoutSelf = { ...parsed };
  delete (bodyWithoutSelf as { manifestSha256?: string }).manifestSha256;
  const expectedManifestSha256 = sha256Hex(Buffer.from(canonicalJson(bodyWithoutSelf), "utf8"));
  if (parsed.manifestSha256 !== expectedManifestSha256) {
    throw new Error(
      `sanitized-live-provenance.json manifestSha256 mismatch (file ${parsed.manifestSha256}, canonical ${expectedManifestSha256})`,
    );
  }
  assertManifestPinsMatchConstants(parsed);
  return parsed;
}

export async function assertSanitizedLivePageBytesMatchPins(
  workspaceRoot: string,
  manifest: SanitizedLiveProvenanceManifest,
): Promise<void> {
  for (const pin of manifest.pages) {
    const htmlPath = sanitizedLivePageHtmlPath(workspaceRoot, pin.pageOrdinal);
    if (!(await pathExists(htmlPath))) {
      throw new Error(`Missing sanitized-live fixture ${pin.relativePath} at ${htmlPath}`);
    }
    const bytes = await readFile(htmlPath);
    const actual = sha256Hex(bytes);
    if (actual !== pin.contentSha256) {
      throw new Error(
        `${pin.relativePath} SHA mismatch: expected pin ${pin.contentSha256}, got ${actual}`,
      );
    }
  }
}

export async function sanitizedLivePrimaryFixturesPresent(
  workspaceRoot: string,
): Promise<boolean> {
  const manifestPath = sanitizedLiveProvenanceManifestPath(workspaceRoot);
  const page1Path = sanitizedLivePageHtmlPath(workspaceRoot, 1);
  return (await pathExists(manifestPath)) && (await pathExists(page1Path));
}

export async function enforceSanitizedLiveFixtureGate(
  workspaceRoot: string,
  options: { requireFixtures: boolean },
): Promise<SanitizedLiveProvenanceManifest | null> {
  const manifestPath = sanitizedLiveProvenanceManifestPath(workspaceRoot);
  const manifestPresent = await pathExists(manifestPath);
  const page1Present = await pathExists(sanitizedLivePageHtmlPath(workspaceRoot, 1));

  if (!manifestPresent || !page1Present) {
    if (options.requireFixtures) {
      throw new Error(
        "Missing P0.3D sanitized-live fixtures — expected " +
          "src/normalization/fixtures/icann2012-rsp-public-portions-v1/fixtures/sanitized-live/mapping-20260922-vps-01/ " +
          "(sanitized-live-provenance.json and page-0001.html) on checkpoint/d2-5a-p0-3d2-sanitized-live-fixtures",
      );
    }
    return null;
  }

  const manifest = await loadSanitizedLiveProvenanceManifest(workspaceRoot);
  await assertSanitizedLivePageBytesMatchPins(workspaceRoot, manifest);
  return manifest;
}
