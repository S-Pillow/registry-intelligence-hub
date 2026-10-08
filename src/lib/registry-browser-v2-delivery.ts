/**
 * Production delivery contract for registry-browser-applications/2.0.0.
 * Corpus stays outside the main JS bundle — PATH-based runtime configuration only.
 */

/** Canonical generated / installed relative path under the runtime data root. */
export const BROWSER_V2_ARTIFACT_RELATIVE_PATH =
  ".data/reveal-2026/browser/applications-browser-v2.json";

/**
 * Production install target (VPS Agent). Same relative path under the deployed
 * runtime-data root (often the app cwd or an explicit data volume).
 */
export const BROWSER_V2_PRODUCTION_INSTALL_PATH = BROWSER_V2_ARTIFACT_RELATIVE_PATH;

/** Preferred runtime env for the ~1.7 MB browser JSON (not inline JSON). */
export const BROWSER_V2_RUNTIME_PATH_ENV = "REGISTRY_HUB_APPLICATION_PAYLOAD_PATH";

export type BrowserV2DeliveryContract = {
  artifactRelativePath: typeof BROWSER_V2_ARTIFACT_RELATIVE_PATH;
  runtimePathEnv: typeof BROWSER_V2_RUNTIME_PATH_ENV;
  preferPathOverInlineJson: true;
  embedInMainJsBundle: false;
  generationCommand: string;
  rollbackNote: string;
};

export const BROWSER_V2_DELIVERY_CONTRACT: BrowserV2DeliveryContract = {
  artifactRelativePath: BROWSER_V2_ARTIFACT_RELATIVE_PATH,
  runtimePathEnv: BROWSER_V2_RUNTIME_PATH_ENV,
  preferPathOverInlineJson: true,
  embedInMainJsBundle: false,
  generationCommand:
    "npm run reveal-2026 -- build-browser-payload-2x --snapshot <publication-2.0.json> [--contention-snapshot <sidecar.json>] --out .data/reveal-2026/browser/applications-browser-v2.json [--compact]",
  rollbackNote:
    "Unset/repoint REGISTRY_HUB_APPLICATION_PAYLOAD_PATH only after Application claim actuality is returned to NOT_PUBLISHED. REAL + missing payload fails closed.",
};
