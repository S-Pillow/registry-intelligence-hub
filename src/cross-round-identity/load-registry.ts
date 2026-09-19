import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CrossRoundIdentityLinkRegistry } from "./types";
import { buildCrossRoundIdentityReport, validateCrossRoundIdentityRegistry } from "./method-1.0.0";

const DEFAULT_REGISTRY_RELATIVE = "src/cross-round-identity/fixtures/rehearsal-identity-link-registry.json";

export async function loadCrossRoundIdentityRegistry(workspaceRoot: string): Promise<CrossRoundIdentityLinkRegistry> {
  const raw = await readFile(join(workspaceRoot, DEFAULT_REGISTRY_RELATIVE), "utf8");
  const registry = JSON.parse(raw) as CrossRoundIdentityLinkRegistry;
  validateCrossRoundIdentityRegistry(registry);
  return registry;
}

export async function crossRoundIdentityCliReport(workspaceRoot: string) {
  const registry = await loadCrossRoundIdentityRegistry(workspaceRoot);
  return buildCrossRoundIdentityReport(registry);
}
