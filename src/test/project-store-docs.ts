import { accessSync, constants, existsSync } from "node:fs";
import { join } from "node:path";

export const REGISTRY_HUB_PROJECT_DOCS_ROOT_ENV = "REGISTRY_HUB_PROJECT_DOCS_ROOT";

export const DEFAULT_CURSOR_PROJECT_DOCS_ROOT =
  "/cursor/stores/bc-e04e6cc5-a825-4e04-8ec0-9262ee0fe1cb/docs";

/** Test-only: override default Cursor store path (e.g. simulate srv766238 without Project Store). */
export const TEST_DEFAULT_DOCS_ROOT_ENV = "REGISTRY_HUB_TEST_DEFAULT_DOCS_ROOT";

function effectiveDefaultCursorProjectDocsRoot(env: NodeJS.ProcessEnv = process.env): string {
  const override = env[TEST_DEFAULT_DOCS_ROOT_ENV]?.trim();
  return override || DEFAULT_CURSOR_PROJECT_DOCS_ROOT;
}

/** Markdown files referenced by doc-contract tests when a docs root is resolved. */
export const CONTROLLING_PROJECT_DOC_FILES = [
  "2012-comparison-baseline-contract.md",
  "2026-organization-resolution-contract.md",
  "2026-reveal-day-ingestion.md",
  "domain-model-and-normalization.md",
  "normalization-quality-report.md",
  "normalization-coverage-contract.md",
  "2012-full-round-quality-report.md",
  "2012-organization-promotion.md",
  "reveal-day-operations-drill.md",
] as const;

export type ControllingProjectDocFile = (typeof CONTROLLING_PROJECT_DOC_FILES)[number];

export type ProjectDocsAccess =
  | { status: "available"; root: string; source: "env" | "default-cursor-store" }
  | { status: "skip"; reason: string }
  | { status: "missing-required"; root: string; missingFiles: string[] };

export type ProjectDocsAccessOptions = {
  envRoot?: string | undefined;
  defaultRootExists?: (path: string) => boolean;
  docExists?: (path: string) => boolean;
};

function defaultRootExists(path: string): boolean {
  try {
    accessSync(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function defaultDocExists(path: string): boolean {
  return existsSync(path);
}

export function getConfiguredProjectDocsRoot(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const raw = env[REGISTRY_HUB_PROJECT_DOCS_ROOT_ENV]?.trim();
  return raw || undefined;
}

export function listMissingControllingDocs(
  root: string,
  docExists: (path: string) => boolean = defaultDocExists,
): string[] {
  const missing: string[] = [];
  for (const file of CONTROLLING_PROJECT_DOC_FILES) {
    const path = join(root, file);
    if (!docExists(path)) missing.push(file);
  }
  return missing;
}

export function resolveProjectDocsAccess(
  options: ProjectDocsAccessOptions = {},
  env: NodeJS.ProcessEnv = process.env,
): ProjectDocsAccess {
  const envRoot =
    options && "envRoot" in options ? options.envRoot : getConfiguredProjectDocsRoot(env);
  const rootExists = options.defaultRootExists ?? defaultRootExists;
  const docExists = options.docExists ?? defaultDocExists;
  const defaultRoot = effectiveDefaultCursorProjectDocsRoot(env);

  if (envRoot) {
    const missingFiles = listMissingControllingDocs(envRoot, docExists);
    if (missingFiles.length > 0) {
      return { status: "missing-required", root: envRoot, missingFiles };
    }
    return { status: "available", root: envRoot, source: "env" };
  }

  if (rootExists(defaultRoot)) {
    const missingFiles = listMissingControllingDocs(defaultRoot, docExists);
    if (missingFiles.length > 0) {
      return {
        status: "skip",
        reason: `Default Cursor project docs incomplete (missing: ${missingFiles.join(", ")})`,
      };
    }
    return {
      status: "available",
      root: defaultRoot,
      source: "default-cursor-store",
    };
  }

  return {
    status: "skip",
    reason: `${REGISTRY_HUB_PROJECT_DOCS_ROOT_ENV} unset and default Cursor store docs absent`,
  };
}

/** True when doc-contract tests should not run (portable verify on hosts without Project Store). */
export function shouldSkipProjectStoreDocContractTests(
  options: ProjectDocsAccessOptions = {},
): boolean {
  return resolveProjectDocsAccess(options).status === "skip";
}

export function getProjectDocsRootForContractTests(
  options: ProjectDocsAccessOptions = {},
): string {
  const access = resolveProjectDocsAccess(options);
  if (access.status === "skip") {
    throw new Error(`Unexpected skip: ${access.reason}`);
  }
  if (access.status === "missing-required") {
    throw new Error(
      `${REGISTRY_HUB_PROJECT_DOCS_ROOT_ENV}=${access.root} but missing controlling docs: ${access.missingFiles.join(", ")}`,
    );
  }
  return access.root;
}

export function projectDocPath(root: string, filename: string): string {
  return join(root, filename);
}

/** Vitest filter: run doc-contract tests only (`npm run verify:project-docs`). */
export const PROJECT_STORE_DOC_TEST_NAME = "[project-store-doc]";
