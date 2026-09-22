import { GTLDRESULT_ORIGIN } from "./constants";

const ALLOWED_HOST = new URL(GTLDRESULT_ORIGIN).hostname;

export class NetworkTargetPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkTargetPolicyError";
  }
}

/** Only https://gtldresult.icann.org/... — no HTTP, no arbitrary hosts. */
export function assertAllowedGtldresultRequestUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new NetworkTargetPolicyError(`Invalid URL: ${url}`);
  }
  if (parsed.protocol !== "https:") {
    throw new NetworkTargetPolicyError(`Rejected non-HTTPS gtldresult request: ${url}`);
  }
  if (parsed.hostname !== ALLOWED_HOST) {
    throw new NetworkTargetPolicyError(`Rejected off-origin gtldresult request: ${url}`);
  }
  if (!parsed.pathname.startsWith("/")) {
    throw new NetworkTargetPolicyError(`Rejected gtldresult URL without path: ${url}`);
  }
}

/** Same-host redirects are permitted in live transport mocks; cross-host are not. */
export function assertAllowedGtldresultRedirect(fromUrl: string, toUrl: string): void {
  assertAllowedGtldresultRequestUrl(fromUrl);
  assertAllowedGtldresultRequestUrl(toUrl);
  const fromHost = new URL(fromUrl).hostname;
  const toHost = new URL(toUrl).hostname;
  if (fromHost !== toHost) {
    throw new NetworkTargetPolicyError(
      `Rejected cross-host redirect: ${fromUrl} → ${toUrl}`,
    );
  }
}
