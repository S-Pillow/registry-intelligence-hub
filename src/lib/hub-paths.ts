/** Public mount path on ForgeForward (must match `basePath` in next.config.ts). */
export const HUB_BASE_PATH = "/tools/registry-intelligence-hub";

/** App-router path segment (Next.js Link/router — basePath applied automatically). */
export function hubPath(path = ""): string {
  if (!path || path === "/") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

/** Full browser URL path including basePath (smoke tests, nginx, external links). */
export function withBasePath(path = ""): string {
  const segment = hubPath(path);
  if (segment === "/") return HUB_BASE_PATH;
  return `${HUB_BASE_PATH}${segment}`;
}
