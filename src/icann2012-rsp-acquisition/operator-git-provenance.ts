import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const OPERATOR_COMMIT_SHA_ENV = "REGISTRY_HUB_OPERATOR_COMMIT_SHA" as const;

export async function resolveOperatorCommitSha(workspaceRoot: string): Promise<string | undefined> {
  const fromEnv = process.env[OPERATOR_COMMIT_SHA_ENV]?.trim();
  if (fromEnv) return fromEnv;
  try {
    const { stdout } = await execFileAsync("git", ["-C", workspaceRoot, "rev-parse", "HEAD"], {
      encoding: "utf8",
    });
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}
