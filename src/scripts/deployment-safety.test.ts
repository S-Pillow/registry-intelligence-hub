import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "../..");

function listScriptFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) continue;
    if (entry.endsWith(".mjs") || entry.endsWith(".js") || entry.endsWith(".sh")) {
      files.push(full);
    }
  }
  return files;
}

describe("deployment script safety", () => {
  it("does not use broad pkill against next-server in scripts or package.json", () => {
    const forbidden = /pkill\s+-f\s+['"]?next-server/i;
    const scriptDir = join(repoRoot, "scripts");
    const targets = [
      ...listScriptFiles(scriptDir),
      join(repoRoot, "package.json"),
    ];
    for (const file of targets) {
      const text = readFileSync(file, "utf8");
      const codeOnly = text
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(codeOnly, `${file} must not pkill -f next-server (scope to HUB_PORT only)`).not.toMatch(forbidden);
    }
  });

  it("centralizes port-scoped cleanup in smoke-process-utils.mjs", () => {
    const utilsPath = join(repoRoot, "scripts/smoke-process-utils.mjs");
    const utils = readFileSync(utilsPath, "utf8");
    expect(utils).toMatch(/fuser -k \$\{targetPort\}/);
    expect(utils).toMatch(/teardownSpawnedServer/);
    expect(utils).toMatch(/waitForPortFree/);

    const smoke = readFileSync(join(repoRoot, "scripts/production-smoke.mjs"), "utf8");
    expect(smoke).toMatch(/from "\.\/smoke-process-utils\.mjs"/);
    expect(smoke).not.toMatch(/function killListenersOnPort/);
  });
});
