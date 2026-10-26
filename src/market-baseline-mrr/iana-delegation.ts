import { fetchBounded } from "./http";

export const IANA_TLD_LIST_URL = "https://data.iana.org/TLD/tlds-alpha-by-domain.txt";

/** Parse IANA alpha-by-domain TLD list into lowercase ASCII/A-label set. */
export function parseIanaTldListText(text: string): Set<string> {
  const set = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    set.add(s.toLowerCase());
  }
  return set;
}

export async function loadDelegatedTldLabels(options?: {
  url?: string;
  text?: string;
  signal?: AbortSignal;
}): Promise<{ labels: Set<string>; sourceUrl: string }> {
  if (options?.text != null) {
    return { labels: parseIanaTldListText(options.text), sourceUrl: "inline" };
  }
  const url = options?.url ?? IANA_TLD_LIST_URL;
  const res = await fetchBounded(url, { signal: options?.signal, maxBytes: 500_000 });
  if (!res.ok) {
    throw new Error(`Failed to fetch IANA TLD list: ${res.error}`);
  }
  return { labels: parseIanaTldListText(res.text), sourceUrl: url };
}
