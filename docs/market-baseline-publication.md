# Market baseline publication (RIH-MARKET-BASELINE-PUBLISH-1 … 1D)

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
| Reveal Day publications | `.data/reveal-2026/publications/*.snapshot.json` | Versioned, content-hashed, gitignored |
| Browser payload projection | `.data/reveal-2026/browser/` | UI-oriented projection separate from source publication |
| Org resolution snapshot | `.data/reveal-2026/organization-resolution/` | Derived product snapshot under `.data/` |

**Selected:** reveal-style **generated, versioned, gitignored** artifact under
`.data/market-baseline/publication/`, with:

- content-addressed publication directory (semantic SHA);
- compact `index.json` for cross-TLD current rankings + shard digest manifest;
- per-TLD shards for history / registrar distribution;
- `generatedAt`, `asOfDate`, and governing acquisition audit metadata outside
  semantic content identity;
- CLI generation (`npm run market-publish`).

## Schema / version

| Field | Value |
| --- | --- |
| Publication schema | `market-baseline-publication/1.1.0` |
| Builder | `market-baseline-publication-builder/1.1.0` |
| Source | ICANN MRR Transactions (accepted normalized snapshots only) |

### Migration from 1.0.0 → 1.1.0 (PUBLISH-1D)

`1.0.0` hashed `{ index.semantic, all shard bodies }` via one `JSON.stringify`.
At full Stage-D scale (~1319 TLDs with registrar grains) that exceeded V8 string
limits (`RangeError: Invalid string length`) even with a larger heap.

`1.1.0` uses **compositional** identity:

1. Each shard body hashes independently → `shardContentSha256`
2. Index semantic commits to a sorted `tldShards[]` digest manifest
3. `publicationContentSha256` hashes only the compact index semantic

MRR `hashNormalizedContent` / normalized archive hashes are unchanged.
Publication-specific helpers live under `src/market-baseline-publication/hash.ts`.

Rebuild publications after upgrading; prior `1.0.0` content SHAs are not
comparable.

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
  current.json                              # pointer — advances last
  .staging/<id>/                            # ephemeral bounded build staging
    tlds/<tld>.json
  <publicationContentSha256>/
    index.json                              # rankings + digest manifest
    tlds/<tld>.json                         # history + registrarsByPeriod
```

## Compositional semantic identity (1.1.0)

### Shard digest

`ShardSemantic = { schemaVersion, tldAsciiLabel, periods, registrarsByPeriod }`

`shardContentSha256 = SHA256(canonical JSON of ShardSemantic)`

Excludes `publicationContentSha256` and `shardContentSha256` (no circular hash).

### Publication digest

Index semantic includes compact product facts plus:

```text
tldShards: [ { tldAsciiLabel, path, shardContentSha256 }, ... ]
```

sorted by `tldAsciiLabel` ASC.

`publicationContentSha256 = SHA256(canonical JSON of index.semantic)`

Transitively commits to every shard without concatenating shard bodies.

### Semantic exclusions (envelope / audit)

- `generatedAt`
- `asOfDate`
- `sourceAcquisitionRunId` / `sourceOutcomesArtifactSha256` /
  `sourceAcquisitionRunScope` / operational-current audit fields

### Semantic inclusions

- `schemaVersion` / `builderVersion`
- `sourceReportingPeriod`
- `coverage` / current-period facts / rankings / history counts
- every `tldShards[].shardContentSha256`

## Bounded-memory construction

Full-archive `publishFromMrrArchive`:

1. Resolve governing acquisition coverage (PUBLISH-1B / 1C).
2. **Per TLD**: load only that TLD’s requested (+ temporal prior) snapshots;
   project; hash shard; stage compact record; retain ranking/coverage grains;
   release the TLD working set.
3. Compose publication identity from digests (never all shard bodies).
4. Materialize final content-addressed artifacts from staging.
5. **Commit `current.json` last**; clean staging.

Peak memory is bounded primarily by one TLD’s working set plus compact
cross-TLD index state — not the sum of all shards.

A pure in-memory `buildMarketBaselinePublication` remains for tests/small inputs.

Failed builds leave the previous current pointer unchanged.

## Shard / index verification

- Recompute shard digest from semantic body; require match to
  `shard.shardContentSha256` and the index digest entry.
- Require `shard.publicationContentSha256` equals containing publication SHA.
- Recompute publication digest from `index.semantic` alone (compact digests).
- Fail closed on mismatch.

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

### Explicit `--run-id`

Operator authority. The run may be `FULL_STAGE_D`, `BOUNDED`, or legacy.
Still requires matching period, valid receipt fields, SHA-verified outcomes,
and probe/history aggregate reconciliation.

### Full Stage-D auto-qualification

| Check | Rule |
| --- | --- |
| **Scope authority (1C)** | `runScope.mode === FULL_STAGE_D` |
| Period | `manifest.probeReportingPeriod` matches publication source period |
| Result | `SUCCESS` or `PARTIAL` only |
| Outcomes receipt | path + SHA present; bytes verify |
| Probe completeness | PROBE count and distinct TLDs == `discoveredTldCount` |
| Probe aggregates | detailed PROBE outcomes reconcile to `manifest.probe` |
| History completeness | HISTORY count == `historyUniverse.length × (historyPeriodCount − 1)` |
| History aggregates | detailed HISTORY outcomes reconcile to `manifest.history` |
| Request total | `filesRequested` == PROBE + HISTORY counts |

### Acquisition coverage grains (PUBLISH-1A, preserved)

PROBE-phase requests define the publication universe. Missing probe identities
remain `MISSING`. Historical periods appear only when requested in outcomes.
Do **not** fabricate 24 months of `MISSING` for probe-only TLDs.

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

## Revision behavior

Publication rebuild reads **explicit period-current pointers** from the MRR
archive. Lexical normalized filename order is never used.

## Consumption examples

```bash
# Default: unique full-qualified acquisition run for the as-of probe period
npm run market-publish -- --as-of 2026-10-27

# Bounded / explicit governing receipt
npm run market-publish -- --as-of 2026-10-26 --run-id mrr-stage-d-…

# Allowlisted subset
npm run market-publish -- --as-of 2026-10-26 --run-id mrr-stage-d-… --tlds com,xyz,net --history-periods 3
```

Programmatic: `loadCurrentPublicationPointer` → `loadPublicationIndex` /
`loadTldShard` / `verifyTldShard` — no archive scan required for product reads.

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
RIH-MARKET-BASELINE-PUBLISH-1B — governing-run qualification + outcomes integrity / merged.  
RIH-MARKET-BASELINE-PUBLISH-1C — authoritative `runScope` / merged.  
RIH-MARKET-BASELINE-PUBLISH-1D — compositional identity + bounded-memory full-universe publish / pending merge.

## Full-universe acceptance (development)

Governing receipt:
`mrr-stage-d-2026-10-27-2026-10-27T05-43-34-305Z` (`FULL_STAGE_D`, probe `2026-06`).

Default authority path (no `--run-id`, no custom Node heap):

`npm run market-publish -- --as-of 2026-10-27 --cwd <DATA_CWD>`

Observed (PUBLISH-1D):

| Check | Result |
| --- | --- |
| Selected run | governing `…305Z` / `FULL_STAGE_D` |
| Coverage | 1319 / 1113 AVAILABLE / 206 MISSING |
| Shard files | 1319 |
| Duration | ~2m12s |
| Peak RSS | ~876 MiB (`Maximum resident set size` ≈ 897456 KiB) |
| OOM / Invalid string length | none |
| Sample digests | com/net/org/xyz/IDN + one MISSING verified |

Prior whole-publication path failed under default heap (OOM) and at 6 GiB
(`Invalid string length`). Compositional identity removes that bottleneck.
