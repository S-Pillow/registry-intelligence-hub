# Market baseline publication (RIH-MARKET-BASELINE-PUBLISH-1 / 1A / 1B / 1C)

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
- `generatedAt`, `asOfDate`, and governing acquisition audit metadata outside
  semantic content identity;
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

## Semantic identity

Content SHA hashes `{ index.semantic, shard bodies }` and **excludes**:

- `generatedAt`
- `asOfDate` (index envelope / current pointer only)
- `sourceAcquisitionRunId` / `sourceOutcomesArtifactSha256` /
  `sourceAcquisitionRunScope` / operational-current audit fields
  (envelope / pointer only)

`sourceReportingPeriod` remains inside semantic identity. Same accepted facts +
same source period + same coverage yield the same SHA even when calendar
`asOfDate` or governing run id differs without product-fact change.

## Governing acquisition evidence (PUBLISH-1B / 1C)

`indexes/current.json` is **operational metadata** (latest completed acquisition
run). It is **not** sufficient authority that the run is publication-governing.

The durable receipt is the acquisition **manifest** + SHA-verified **outcomes**
artifact. Manifest `1.1.0` also records authoritative `runScope`.

### Default selection (`npm run market-publish -- --as-of …`)

1. Evaluate all manifests whose `probeReportingPeriod` matches the publication
   source reporting period.
2. Load each outcomes artifact and verify bytes against
   `manifest.outcomesArtifactSha256` **before** parsing.
3. Auto-qualify only candidates with `runScope.mode === FULL_STAGE_D` **and**
   internal completeness (below).
4. Exactly one full-qualified candidate → use it (even if `current.json` points
   elsewhere).
5. Zero or multiple full-qualified candidates → **fail closed**; pass `--run-id`.

Do **not** select by latest timestamp, filesystem recency, largest manifest,
lexical filename, or `current.json` alone.

A self-consistent 3-TLD smoke with `PROBE == discoveredTldCount` is **not**
full Stage-D unless `runScope.mode` was recorded as `FULL_STAGE_D` at
acquisition time. Legacy `…/1.0.0` manifests without `runScope` are
`LEGACY_UNKNOWN` and never auto-qualify.

### Explicit `--run-id`

Operator authority. The run may be `FULL_STAGE_D`, `BOUNDED`, or legacy.
Still requires:

- matching source reporting period;
- valid manifest receipt fields;
- SHA-verified outcomes bytes;
- probe/history aggregate reconciliation to request detail.

Audit metadata exposes `sourceAcquisitionRunScope` truthfully
(`FULL_STAGE_D` | `BOUNDED` | `LEGACY_UNKNOWN`). Do not relabel an explicit
bounded run as governing-full.

### Full Stage-D auto-qualification

All required:

| Check | Rule |
| --- | --- |
| **Scope authority (1C)** | `runScope.mode === FULL_STAGE_D` (legacy/missing → fail) |
| Period | `manifest.probeReportingPeriod` matches publication source period |
| Result | `SUCCESS` or `PARTIAL` only (`FAILED` / `STOPPED_THROTTLED` disqualified) |
| Outcomes receipt | path + SHA present; bytes verify |
| Probe completeness | PROBE count and distinct PROBE TLDs == `discoveredTldCount`; no duplicate PROBE TLD; every PROBE uses probe period |
| Probe aggregates | detailed PROBE outcomes reconcile exactly to `manifest.probe` |
| History completeness | HISTORY count == `historyUniverse.length × (historyPeriodCount − 1)` |
| History aggregates | detailed HISTORY outcomes reconcile exactly to `manifest.history` |
| Request total | `filesRequested` == PROBE + HISTORY counts |

This disqualifies `probeLimit`, `--skip-history`, caller `pages`, unqualified
discovery caches, and incomplete history — even when subset reconciliation
passes.

### Outcomes artifact integrity

Read raw bytes → SHA-256 (MRR `sha256Hex`) → compare to
`manifest.outcomesArtifactSha256` → only then parse JSON.

Mismatch → fail closed (`outcomes artifact integrity mismatch`).

When `indexes/current.json` refers to the **same** selected run, its path/SHA/
period must agree with the manifest. When it refers to a **different** run,
that is not an integrity failure — operational current ≠ governing publication
run (recorded in audit metadata).

### Acquisition coverage grains (PUBLISH-1A, preserved)

Publication universe and historical period maps come from the **selected**
outcomes evidence, not from period-index directory presence alone.

#### Current-period universe

PROBE-phase requests define the publication universe. Each probed TLD remains
represented even when no period-current snapshot exists (`MISSING`, with
`acquisition_outcome:…` reason when known).

`--tlds` filters the probe universe; it does not drop allowlisted identities
that lack a normalized pointer.

#### Historical coverage

Only TLD×periods present in outcomes as PROBE or HISTORY requests (and inside
the publication history window) appear in a shard’s `periods` map.

| Representation | Meaning |
| --- | --- |
| Period key absent from shard `periods` | Outside publication/acquisition coverage (never requested for this publish) |
| `availability: "MISSING"` | Requested/acquired attempt, but no accepted product fact |

Do **not** fabricate 24 months of `MISSING` for probe-only TLDs.

### Publication audit metadata

Index envelope / current pointer retain (nonsemantic):

- `sourceAcquisitionRunId`
- `sourceOutcomesArtifactSha256`
- `sourceAcquisitionRunScope`
- `operationalCurrentRunId`
- `operationalCurrentDiffersFromGoverning`

These answer: which acquisition receipt governed this publication, and whether
it was full Stage-D, bounded, or legacy?

## Provenance

Each AVAILABLE fact carries:

- `sourceSystem: icann-mrr-transactions`
- `sourceUrl`
- `rawSha256`
- `normalizedContentSha256`
- normalized schema / parser / schema-profile versions

## Missingness

- Requested but unavailable TLD×period → `MISSING` with reason
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
# Default: unique full-qualified acquisition run for the as-of probe period
npm run market-publish -- --as-of 2026-10-26

# Bounded / explicit governing receipt (required when ambiguous or only bounded runs exist)
npm run market-publish -- --as-of 2026-10-26 --run-id mrr-stage-d-…

# Allowlisted subset of the selected probe universe
npm run market-publish -- --as-of 2026-10-26 --run-id mrr-stage-d-… --tlds com,xyz,net --history-periods 3
```

Programmatic: `loadCurrentPublicationPointer` → `loadPublicationIndex` /
`loadTldShard` (single TLD; label normalized) — no archive scan required for
product reads.

## Non-goals

- UI / routes / charts  
- Activity, DNMI, Domain Metrica, pricing  
- Renewal rates, HHI, market-opportunity scores  
- Registry Operator / registrar→Organization / RSP joins  
- Committing or redistributing the raw MRR corpus  
- Scheduler / production deploy  

## Status

RIH-MARKET-BASELINE-PUBLISH-1 — implemented / merged.  
RIH-MARKET-BASELINE-PUBLISH-1A — coverage truth + semantic identity correction / merged.  
RIH-MARKET-BASELINE-PUBLISH-1B — governing-run qualification + outcomes integrity.  
RIH-MARKET-BASELINE-PUBLISH-1C — authoritative `runScope` (complete ≠ full-universe).
