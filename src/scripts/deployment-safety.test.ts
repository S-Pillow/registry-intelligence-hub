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
      expect(text, `${file} must not pkill -f next-server (scope to HUB_PORT only)`).not.toMatch(forbidden);
    }
  });
});
