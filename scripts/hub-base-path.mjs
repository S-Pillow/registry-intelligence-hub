/** Keep in sync with next.config.ts `basePath` and src/lib/hub-paths.ts */
export const HUB_BASE_PATH = "/tools/registry-intelligence-hub";

export function withBasePath(path = "") {
  if (!path || path === "/") return HUB_BASE_PATH;
  return path.startsWith("/") ? `${HUB_BASE_PATH}${path}` : `${HUB_BASE_PATH}/${path}`;
}
