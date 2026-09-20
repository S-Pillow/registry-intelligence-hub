import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONTROLLING_PROJECT_DOC_FILES,
  DEFAULT_CURSOR_PROJECT_DOCS_ROOT,
  resolveProjectDocsAccess,
  shouldSkipProjectStoreDocContractTests,
} from "./project-store-docs";

function envWithoutProjectDocsOverrides(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.REGISTRY_HUB_PROJECT_DOCS_ROOT;
  delete env.REGISTRY_HUB_TEST_DEFAULT_DOCS_ROOT;
  return env;
}

describe("project store docs access (portable verify)", () => {
  it("skips doc-contract tests when env unset and default Cursor store absent", () => {
    const env = envWithoutProjectDocsOverrides();
    const access = resolveProjectDocsAccess(
      {
        envRoot: undefined,
        defaultRootExists: () => false,
        docExists: () => true,
      },
      env,
    );
    expect(access.status).toBe("skip");
    expect(
      shouldSkipProjectStoreDocContractTests({
        envRoot: undefined,
        defaultRootExists: () => false,
      }),
    ).toBe(true);
  });

  it("requires all controlling docs when REGISTRY_HUB_PROJECT_DOCS_ROOT is set", () => {
    const root = "/tmp/fake-project-docs";
    const access = resolveProjectDocsAccess(
      {
        envRoot: root,
        defaultRootExists: () => true,
        docExists: (path) => !path.endsWith("reveal-day-operations-drill.md"),
      },
      envWithoutProjectDocsOverrides(),
    );
    expect(access.status).toBe("missing-required");
    if (access.status === "missing-required") {
      expect(access.missingFiles).toEqual(["reveal-day-operations-drill.md"]);
    }
  });

  it("uses default Cursor store when present and env unset", () => {
    const env = envWithoutProjectDocsOverrides();
    const access = resolveProjectDocsAccess(
      {
        envRoot: undefined,
        defaultRootExists: (p) => p === DEFAULT_CURSOR_PROJECT_DOCS_ROOT,
        docExists: () => true,
      },
      env,
    );
    expect(access.status).toBe("available");
    if (access.status === "available") {
      expect(access.root).toBe(DEFAULT_CURSOR_PROJECT_DOCS_ROOT);
      expect(access.source).toBe("default-cursor-store");
    }
  });

  it("lists every controlling doc filename used by contract tests", () => {
    expect(CONTROLLING_PROJECT_DOC_FILES.length).toBeGreaterThan(0);
    expect(new Set(CONTROLLING_PROJECT_DOC_FILES).size).toBe(CONTROLLING_PROJECT_DOC_FILES.length);
  });

  it("skips [project-store-doc] vitest cases when default store path absent (portable verify)", () => {
    const repoRoot = join(import.meta.dirname, "../..");
    const result = spawnSync(
      "npx",
      ["vitest", "run", "src/comparison/contract-docs.test.ts"],
      {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          REGISTRY_HUB_PROJECT_DOCS_ROOT: "",
          REGISTRY_HUB_TEST_DEFAULT_DOCS_ROOT: "/tmp/rih-no-cursor-project-store-docs",
        },
      },
    );
    const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    expect(result.status, combined).toBe(0);
    expect(combined).toMatch(/skipped/i);
  });
});
