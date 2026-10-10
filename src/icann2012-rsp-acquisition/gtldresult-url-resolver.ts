import { GTLDRESULT_ORIGIN } from "./constants";
import { assertAllowedGtldresultRequestUrl, NetworkTargetPolicyError } from "./network-target-policy";
import { absoluteGtldresultUrl } from "./urls";

const ALLOWED_HOST = new URL(GTLDRESULT_ORIGIN).hostname;

/**
 * Resolve a server-provided href against a gtldresult page URL.
 * Root-relative `/applicationstatus/...` paths stay on that path.
 * REQUEST_PATH_RESOLUTION_DEFECT: prefixing those hrefs with `/application-result`.
 * Browser evidence shows `/applicationstatus/viewstatus.statusgrid.pager/{n}` is intentional.
 * This function does not invent pager URLs and does not follow redirects.
 */
export function resolveGtldresultTapestryUrl(contextUrl: string, href: string): string {
  const trimmed = href.trim();
  if (!trimmed || trimmed === "#") return trimmed;
  if (trimmed.startsWith("//")) {
    throw new NetworkTargetPolicyError(`Rejected protocol-relative gtldresult link: ${trimmed}`);
  }

  if (/^https?:\/\//i.test(trimmed)) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new NetworkTargetPolicyError(`Invalid URL: ${trimmed}`);
    }
    if (parsed.protocol !== "https:" || parsed.hostname !== ALLOWED_HOST) {
      throw new NetworkTargetPolicyError(`Rejected cross-host gtldresult link: ${trimmed}`);
    }
    assertAllowedGtldresultRequestUrl(trimmed);
    return trimmed;
  }

  if (!trimmed.startsWith("/")) {
    let resolved: string;
    try {
      resolved = new URL(trimmed, contextUrl).toString();
    } catch {
      resolved = absoluteGtldresultUrl(trimmed);
    }
    assertAllowedGtldresultRequestUrl(resolved);
    return resolved;
  }

  const resolved = absoluteGtldresultUrl(trimmed);
  assertAllowedGtldresultRequestUrl(resolved);
  return resolved;
}

export function gtldresultOriginPath(url: string): string {
  return new URL(url, GTLDRESULT_ORIGIN).pathname;
}
