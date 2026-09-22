import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

export function isPathContainedIn(childPath: string, parentPath: string): boolean {
  const rel = relative(parentPath, childPath);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/** Live acquisition must not write under the git workspace (symlink-resolved). */
export async function assertLiveStagingOutsideWorkspace(
  stagingRoot: string,
  workspaceRoot: string,
): Promise<void> {
  const resolvedStaging = await realpath(resolve(stagingRoot)).catch(() => resolve(stagingRoot));
  const resolvedWorkspace = await realpath(resolve(workspaceRoot));
  if (isPathContainedIn(resolvedStaging, resolvedWorkspace)) {
    throw new Error(
      `Live staging root must be outside the repository workspace: ${stagingRoot} resolves inside ${workspaceRoot}`,
    );
  }
}

export function defaultLiveStagingRoot(): string {
  return process.platform === "win32"
    ? resolve(process.env.TEMP ?? "C:\\Temp", "icann2012-rsp-staging")
    : "/var/tmp/icann2012-rsp-staging";
}
