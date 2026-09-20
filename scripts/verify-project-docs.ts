#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import {
  getConfiguredProjectDocsRoot,
  listMissingControllingDocs,
  REGISTRY_HUB_PROJECT_DOCS_ROOT_ENV,
} from "../src/test/project-store-docs";

const root = getConfiguredProjectDocsRoot();
if (!root) {
  console.error(`${REGISTRY_HUB_PROJECT_DOCS_ROOT_ENV} must be set for npm run verify:project-docs`);
  process.exit(1);
}

try {
  accessSync(root, constants.R_OK);
} catch {
  console.error(`${REGISTRY_HUB_PROJECT_DOCS_ROOT_ENV}=${root} is not readable`);
  process.exit(1);
}

const missing = listMissingControllingDocs(root);
if (missing.length > 0) {
  console.error(
    `${REGISTRY_HUB_PROJECT_DOCS_ROOT_ENV}=${root} missing controlling docs:\n  ${missing.join("\n  ")}`,
  );
  process.exit(1);
}

const vitest = spawnSync("npx", ["vitest", "run", "-t", "\\[project-store-doc\\]"], {
  stdio: "inherit",
  env: process.env,
});

process.exit(vitest.status ?? 1);
