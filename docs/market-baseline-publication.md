# Market baseline publication (RIH-MARKET-BASELINE-PUBLISH-1)

Deterministic, provenance-bearing product publication derived from accepted
ICANN MRR Transactions snapshots.

Closed acquisition contracts: [`market-baseline-source-1.md`](./market-baseline-source-1.md),
[`market-baseline-mrr.md`](./market-baseline-mrr.md).

## Purpose

Transform accepted MRR normalized facts into a stable product contract that
future Market / Registry Lifecycle UI can consume **without** reading:

- raw ICANN CSVs;
- acquisition manifests / revalidation state;
- revision-pointer internals;
- the multi-gigabyte raw archive.

Boundary:

`ICANN source` → `MRR acquisition archive` → `normalized accepted snapshots`
→ **`market-baseline publication`** → future UI

## Pattern selected

Inspected RIH patterns:

| Pattern | Location | Notes |
| --- | --- | --- |
| Reveal Day publications | `.data/reveal-2026/publications/*.snapshot.json` | Versioned, content-hashed, gitignored, CLI-built |
| Browser payload projection | `.data/reveal-2026/browser/` | UI-oriented projection separate from source publication |
| Org resolution snapshot | `.data/reveal-2026/organization-resolution/` | Derived product snapshot under `.data/` |

**Selected:** reveal-style **generated, versioned, gitignored** artifact under
`.data/market-baseline/publication/`, with:

- content-addressed publication directory (semantic SHA);
- compact `index.json` for cross-TLD current rankings;
- per-TLD shards for history / registrar distribution;
- `generatedAt` outside semantic content identity;
- CLI generation (`npm run market-publish`).

Rationale: matches existing RIH `.data` publication discipline; avoids
committing bulk corpus; enables single-TLD reads without loading the archive.

## Schema / version

| Field | Value |
| --- | --- |
| Publication schema | `market-baseline-publication/1.0.0` |
| Builder | `market-baseline-publication-builder/1.0.0` |
| Source | ICANN MRR Transactions (accepted normalized snapshots only) |

## Grains

### TLD × Reporting Period

Intrinsic: `totalDomains`, `netAddsCount`, `netRenewCount`, `deleteCount`,
transfer gaining/losing counts, `registrarBreadth`, top/top5 registrar share,
accredited/special domain sums.

Derived temporal (exact calendar join via `deriveTldMarketSeriesTemporal`):
`netDomainBaseChange`, `monthOverMonthGrowth`, `yearOverYearGrowth`.

Missing period → `availability: "MISSING"` (not zero, not substituted).

### TLD × Registrar × Reporting Period

`ianaRegistrarId`, `registrarName`, `classification`, `totalDomains`,
`shareOfTldTotal` when denominator defensible.

Totals rows excluded. Special/system rows retain classification.
No registrar → Confirmed Organization mapping.

## Layout

```text
.data/market-baseline/publication/          # gitignored via /.data/
  current.json                              # pointer to active publication
  <publicationContentSha256>/
    index.json                              # rankings + current-period facts
    tlds/<tld>.json                         # history + registrarsByPeriod
```

Semantic identity hashes `{ index.semantic, shard bodies }` and **excludes**
`generatedAt`.

## Provenance

Each AVAILABLE fact carries:

- `sourceSystem: icann-mrr-transactions`
- `sourceUrl`
- `rawSha256`
- `normalizedContentSha256`
- normalized schema / parser / schema-profile versions

## Missingness

- Unavailable TLD×period → `MISSING` with reason
- Temporal prior missing → OptionalMetric `{ available: false, reason }`
- Zero prior denominator → `{ available: false, reason: "prior_denominator_zero" }`
- Available `totalDomains === 0` remains AVAILABLE (distinct from MISSING)

No common-period substitution with an older month.

## Revision behavior

Publication rebuild reads **explicit period-current pointers** from the MRR
archive (`indexes/periods/<tld>/<YYYY-MM>.json`). Lexical normalized filename
order is never used.

After ICANN source revisions A→B→C, publication uses C. Content SHA changes
iff product-semantic facts change.

## Consumption examples

```bash
# Build from accepted local MRR archive
npm run market-publish -- --as-of 2026-10-26

# Bounded smoke
npm run market-publish -- --as-of 2026-10-26 --tlds com,xyz,net --history-periods 3
```

Programmatic: `loadCurrentPublicationPointer` → `loadPublicationIndex` /
`loadTldShard` (single TLD) — no archive scan required for product reads.

## Non-goals

- UI / routes / charts  
- Activity, DNMI, Domain Metrica, pricing  
- Renewal rates, HHI, market-opportunity scores  
- Registry Operator / registrar→Organization / RSP joins  
- Committing or redistributing the raw MRR corpus  
- Scheduler / production deploy  

## Status

RIH-MARKET-BASELINE-PUBLISH-1 — implemented on feature branch; see RETURN report.
