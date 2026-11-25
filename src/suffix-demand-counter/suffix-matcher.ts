/**
 * Literal suffix lookup over the registrable second-level label.
 * Equivalent to equals/endsWith for every candidate, with O(label length +
 * matches) work per domain instead of scanning every candidate.
 * Memory is O(total candidate-label length), independent of input domain count.
 */
type TrieNode = {
  next: Map<string, TrieNode>;
  terminal: string | null;
};

export type SuffixMatcher = {
  countMatches(sld: string, counts: Map<string, number>): void;
};

export function createSuffixMatcher(candidates: readonly string[]): SuffixMatcher {
  const root: TrieNode = { next: new Map(), terminal: null };
  for (const candidate of candidates) {
    if (!candidate) throw new Error("Empty suffix-demand candidate");
    let node = root;
    for (let i = candidate.length - 1; i >= 0; i -= 1) {
      const char = candidate[i]!;
      let next = node.next.get(char);
      if (!next) {
        next = { next: new Map(), terminal: null };
        node.next.set(char, next);
      }
      node = next;
    }
    node.terminal = candidate;
  }
  return {
    countMatches(sld, counts) {
      let node: TrieNode | undefined = root;
      for (let i = sld.length - 1; i >= 0; i -= 1) {
        node = node.next.get(sld[i]!);
        if (!node) return;
        if (node.terminal !== null) {
          const label = node.terminal;
          counts.set(label, (counts.get(label) ?? 0) + 1);
        }
      }
    },
  };
}
