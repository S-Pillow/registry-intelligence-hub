/**
 * Reversed-character suffix trie for literal equals / endsWith matching.
 *
 * Inserting each candidate reversed lets one walk of a reversed SLD collect
 * every candidate that equals the SLD or is a literal suffix of it — same
 * semantics as scanning sldMatchesCandidate over all candidates, without
 * O(candidates) work per domain.
 */

type TrieNode = {
  children: Map<string, TrieNode>;
  /** Candidate labels that end at this reversed path. */
  terminals: string[];
};

export type SuffixMatchIndex = {
  /** All candidate labels in deterministic insertion order. */
  candidates: readonly string[];
  /** Collect every candidate that equals or is a literal suffix of `sld`. */
  matchAll(sld: string): readonly string[];
};

export function buildSuffixMatchIndex(candidates: readonly string[]): SuffixMatchIndex {
  const root: TrieNode = { children: new Map(), terminals: [] };
  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const raw of candidates) {
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    ordered.push(raw);
    let node = root;
    for (let i = raw.length - 1; i >= 0; i -= 1) {
      const ch = raw[i]!;
      let next = node.children.get(ch);
      if (!next) {
        next = { children: new Map(), terminals: [] };
        node.children.set(ch, next);
      }
      node = next;
    }
    node.terminals.push(raw);
  }

  return {
    candidates: ordered,
    matchAll(sld: string): readonly string[] {
      if (!sld) return [];
      const hits: string[] = [];
      let node: TrieNode | undefined = root;
      for (let i = sld.length - 1; i >= 0; i -= 1) {
        node = node.children.get(sld[i]!);
        if (!node) break;
        if (node.terminals.length) {
          for (const label of node.terminals) hits.push(label);
        }
      }
      return hits;
    },
  };
}
