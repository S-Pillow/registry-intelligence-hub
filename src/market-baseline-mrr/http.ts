import { MRR_USER_AGENT } from "./types";

export type FetchTextResult =
  | { ok: true; status: number; text: string; bytes: Uint8Array }
  | { ok: false; status: number; error: string; throttled?: boolean };

export type HttpClientOptions = {
  userAgent?: string;
  maxRetries?: number;
  baseDelayMs?: number;
  maxBytes?: number;
  signal?: AbortSignal;
};

const DEFAULT_MAX_BYTES = 25_000_000;

export async function fetchBounded(
  url: string,
  options: HttpClientOptions = {},
): Promise<FetchTextResult> {
  const ua = options.userAgent ?? MRR_USER_AGENT;
  const maxRetries = options.maxRetries ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 750;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  let lastError = "unknown";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        signal: options.signal,
        headers: { "User-Agent": ua, Accept: "text/csv,text/html,*/*" },
      });
      if (res.status === 404) {
        return { ok: false, status: 404, error: "HTTP 404" };
      }
      if (res.status === 429 || res.status === 403 || res.status >= 500) {
        const throttled = res.status === 429 || res.status === 403;
        if (attempt < maxRetries) {
          const retryAfter = Number(res.headers.get("retry-after"));
          const delay = Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(120_000, retryAfter * 1000)
            : Math.min(90_000, baseDelayMs * 3 ** attempt);
          await sleep(delay);
          continue;
        }
        return {
          ok: false,
          status: res.status,
          error: `HTTP ${res.status}`,
          throttled,
        };
      }
      if (!res.ok) {
        return { ok: false, status: res.status, error: `HTTP ${res.status}` };
      }
      const bytes = await readBoundedBody(res, maxBytes);
      const text = new TextDecoder("utf-8").decode(bytes);
      return { ok: true, status: res.status, text, bytes };
    } catch (e) {
      lastError = (e as Error).message;
      if (attempt < maxRetries) {
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }
      return { ok: false, status: 0, error: lastError };
    }
  }
  return { ok: false, status: 0, error: lastError };
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = response.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`Content-Length ${declared} exceeds ${maxBytes}`);
  }
  if (!response.body) {
    const buf = new Uint8Array(await response.arrayBuffer());
    if (buf.byteLength > maxBytes) throw new Error(`Body exceeds ${maxBytes}`);
    return buf;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel(`exceeded ${maxBytes}`).catch(() => undefined);
      throw new Error(`Body exceeds ${maxBytes}`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Simple concurrency pool. */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  shouldStop?: () => boolean,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      if (shouldStop?.()) return;
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return results;
}
