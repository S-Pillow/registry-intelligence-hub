import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { defaultSyntheticGridParserFixturePath } from "./grid-evidence-paths";
import { runMappingDryRun } from "./mapping-dry-run";
import { pilotMappingPath } from "./bundle-paths";

const workspaceRoot = join(process.cwd());

describe("mapping dry-run evidence paths", () => {
  it("rejects synthetic grid fixture as mapping evidence", async () => {
    await expect(
      runMappingDryRun({
        workspaceRoot,
        gridHtmlPath: defaultSyntheticGridParserFixturePath(workspaceRoot),
      }),
    ).rejects.toThrow(/synthetic parser fixture/);
  });

  it("loads approved mapping artifact only when explicitly passed", async () => {
    const withArtifact = await runMappingDryRun({
      workspaceRoot,
      approvedMappingJsonPath: pilotMappingPath(workspaceRoot),
    });
    expect(withArtifact.manifestResolved).toBe(1);
    expect(withArtifact.resolved.find((r) => r.applicationId === "1-1945-29108")?.source).toBe(
      "manifest",
    );
  });
});
