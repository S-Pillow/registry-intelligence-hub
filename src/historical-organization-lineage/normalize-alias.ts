/** Shared alias normalization for historical Organization lineage discovery. */

export function normalizeLineageAlias(raw: string): string {
  return raw
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function lineageAliasMatches(query: string, aliases: readonly string[]): boolean {
  const q = normalizeLineageAlias(query);
  if (!q) return false;
  return aliases.some((alias) => {
    const a = normalizeLineageAlias(alias);
    return a === q || a.includes(q) || q.includes(a);
  });
}
