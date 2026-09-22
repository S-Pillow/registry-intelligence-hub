import { GTLDRESULT_ORIGIN } from "./constants";
import { absoluteGtldresultUrl } from "./urls";

const APPLICATION_RESULT_MOUNT = "/application-result";

/**
 * Resolve Tapestry-relative hrefs from the gtldresult status grid mount.
 * Live pages often emit `/applicationstatus/...` while the session is rooted at
 * `/application-result/applicationstatus/...`.
 */
export function resolveGtldresultTapestryUrl(contextUrl: string, href: string): string {
  const trimmed = href.trim();
  if (!trimmed || trimmed === "#") return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  let contextPath = "/";
  try {
    contextPath = new URL(contextUrl).pathname;
  } catch {
    contextPath = "/";
  }

  if (
    trimmed.startsWith("/applicationstatus/") &&
    (contextPath.startsWith(`${APPLICATION_RESULT_MOUNT}/`) ||
      contextPath === `${APPLICATION_RESULT_MOUNT}`)
  ) {
    return absoluteGtldresultUrl(`${APPLICATION_RESULT_MOUNT}${trimmed}`);
  }

  return absoluteGtldresultUrl(trimmed);
}

export function gtldresultOriginPath(url: string): string {
  return new URL(url, GTLDRESULT_ORIGIN).pathname;
}
