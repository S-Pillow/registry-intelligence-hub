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

## Non-goals / limits (retained)

- Charts / market-opportunity scoring / HHI / pricing — **not provided**
- Activity report bodies — **not ingested**
- `renewalRate` — **unsupported** from Transactions alone
- Registry Operator identity — **not modeled**
- Registrar → Confirmed Organization — **not modeled**
- RSP → TLD — **not modeled**
- Applicant → Registrar — **not modeled**
- GoDaddy customer relationships — **not inferred**
- DNMI context / Domain Metrica — **not integrated**
- MRR acquisition/publication scheduler — **not installed**
  (production holds a **static** accepted publication baseline only)
- Committing or redistributing the raw MRR corpus — **forbidden**

Do **not** label MRR registrar concentration as “customer concentration.”
Do **not** label descriptive TLD domain totals as “market share” unless the
denominator and competitive context actually support that claim.

## Status — PRODUCTION-DEPLOY-1 closed

| Unit | Status |
| --- | --- |
| SOURCE-1 | **CLOSED** |
| MRR-1 | **CLOSED** |
| MRR-1A | **CLOSED** |
| GOVERNING-RUN-1 | **COMPLETE / ACCEPTED** |
| PUBLISH-1 | **CLOSED** |
| PUBLISH-1A | **CLOSED** |
| PUBLISH-1B | **CLOSED** |
| PUBLISH-1C | **CLOSED** |
| PUBLISH-1D | **CLOSED** |
| Market-baseline acquisition + publication foundation | **CLOSED** |
| UI-1 | **MERGED / POST-MERGE VERIFIED / CLOSED** |
| Production market data | **INSTALLED / VERIFIED** |
| Production deployment | **DEPLOYED / VERIFIED / CLOSED** |
| Registry Market | **LIVE** |

Merged foundation tip (pre-UI): `b4697fa…`
UI-1 merged code: `e3d7db62841c16ed1ef1478bed2776571c74e444`
(`feat(market): add registry market intelligence UI`).
Accepted production source: `54765cbb1bb725f26da5647f746c31538713b8bf`.

**Readiness:** Market-baseline acquisition + publication foundation is
**CLOSED**. Registry Market UI-1 is **CLOSED**. Production deployment
(**RIH-MARKET-BASELINE-PRODUCTION-DEPLOY-1**) is **DEPLOYED / VERIFIED /
CLOSED**. Registry Market is **LIVE** on the accepted static publication
baseline. MRR acquisition/publication scheduler remains **NOT INSTALLED**.

### UI-1 (product consumer) — closed

| Field | Value |
| --- | --- |
| Status | **MERGED / POST-MERGE VERIFIED / CLOSED** |
| Merged code | `e3d7db62841c16ed1ef1478bed2776571c74e444` |
| Routes | `/market`, `/market/[tld]` |
| User-facing label | Registry Market |
| Source | publication-only consumer (pointer → verified index → optional verified shard) |
| Accepted publication | `ff7816b8a59823aeced2d76430b977c898ff23963b7434df71e0fd4b398f1c4d` |
| Real-data smoke baseline | 1319 / 1113 AVAILABLE / 206 MISSING (June 2026) |
| Production market data | **INSTALLED / VERIFIED** |
| Production deployment | **DEPLOYED / VERIFIED / CLOSED** |
| Visual browser acceptance | **VERIFIED** (Chromium desktop + mobile; post-merge and production) |

UI-1 still does **not** provide Registry Operator identity, Registrar→Organization,
RSP→TLD, Applicant→Registrar, GoDaddy customer inference, renewal rate, Activity,
DNMI, Domain Metrica, pricing, HHI, market-opportunity scoring, or charts.

### Production deployment acceptance (PRODUCTION-DEPLOY-1)

| Field | Value |
| --- | --- |
| Status | **DEPLOYED / VERIFIED / CLOSED** |
| Production source | `54765cbb1bb725f26da5647f746c31538713b8bf` |
| Prior production source | `88ff99e03708997156d3c3497249156b70051d23` |
| Production mode | detached HEAD |
| PM2 process | `registry-intelligence-hub` |
| Listener | `127.0.0.1:43123` |
| Production base path | `/tools/registry-intelligence-hub` |
| Nginx change / reload | **none** |
| Scheduler installed | **no** |
| MRR acquisition during deploy | **no** |
| Dependency reinstall (`npm ci`) | **no** (dependency graph unchanged) |
| Environment changes | **none** |
| Change Intelligence mutated | **no** |
| Rollback | **NOT REQUIRED** |
| Rollback backup | `/root/backups/rih-market-deploy-20261027T091333Z/` (pre-deploy `.next` + bounded evidence; not MRR archive / not full `.data`) |

#### Publication install

| Field | Value |
| --- | --- |
| Production path | `/root/registry_hub/.data/market-baseline/publication/` |
| Accepted SHA directory | `ff7816b8a59823aeced2d76430b977c898ff23963b7434df71e0fd4b398f1c4d` |
| Pointer | `current.json` → accepted SHA |
| Files transferred | 1321 total (SHA-tree 1320 + `current.json`) |
| TLD shards | 1319 |
| Installed bytes | `2,192,263,792` |
| `current.json` byte SHA-256 | `6f27bd0b3a8ee2327934f120e5b302b06e80ec67104e64ec670cd23f9b7096e9` |
| `index.json` byte SHA-256 | `18bce0df1d75b99105980f175f9390956b8e9006f2abd891966d1341552c4d22` |
| Transfer manifest SHA-256 | `57e11aab5e331dd109c658c3d82f57df66a9a69334eeda3d07dc7e6f9151399b` |
| Final transfer verification | **1321 / 1321 PASS** |
| Semantic publication verification | **PASS** |
| Schema / builder | `market-baseline-publication/1.1.0` / `market-baseline-publication-builder/1.1.0` |
| Source period | `2026-06` |
| Governing run | `mrr-stage-d-2026-10-27-2026-10-27T05-43-34-305Z` |
| Outcomes SHA | `2844672b81a1abd119bd09729951a616f5fb4858fa8ba22a0676509097bf3a56` |
| Coverage | 1319 total / 1113 AVAILABLE / 206 MISSING |

Only the product publication was installed. MRR raw/normalized archives,
manifests, outcomes, discovery cache, other publication SHA directories, and
`.staging` were **not** copied to production.

#### Accepted deployment sequence

1. Verified transfer manifest (1321 records).
2. Staged product publication only.
3. Verified all staged publication files.
4. Installed immutable publication SHA tree.
5. Committed `current.json` atomically **last**.
6. Verified Phase A while prior production source remained live (`/market` still 404).
7. Transitioned production detached HEAD to `54765cb…`.
8. Skipped `npm ci` (unchanged dependency graph).
9. Built successfully with Node `22.23.2`.
10. Restarted only `registry-intelligence-hub`.
11. Verified existing product surfaces.
12. Verified Registry Market HTTP behavior.
13. Completed desktop/mobile Chromium acceptance.
14. Reverified **1321 / 1321** publication files.

#### Production smoke — existing product

**PASS:** Command Center, Explore, Competitive Landscape, Contention, Changes,
Data Health. Reveal Day state remained intact (no actuality mutation).

#### Production smoke — Registry Market

| Route | Result |
| --- | --- |
| `/market` | **200** — June 2026; baseline **1319 / 1113 / 206** |
| `/market/com` | AVAILABLE / 24 reporting periods |
| `/market/xyz` | AVAILABLE / 24 reporting periods |
| `/market/xn--3ds443g` | AVAILABLE / 24 reporting periods |
| `/market/1998` | Report unavailable; source-period-only coverage; no fabricated history |

**MISSING ≠ zero** verification: **PASS**.

#### Browser acceptance (production Chromium)

| Viewport | Routes | Status |
| --- | --- | --- |
| Desktop | `/market`, `/market/com`, `/market/1998` | **VERIFIED** |
| Mobile | `/market`, `/market/1998` | **VERIFIED** |

Accepted checks: Registry Market navigation + active state, table overflow,
search/filter usability, registrar readability, MISSING-state clarity,
provenance disclosure, basic keyboard/focus behavior.

#### Production git / disk (informational)

Production remained **DETACHED** and **TRACKED CLEAN** at
`54765cbb1bb725f26da5647f746c31538713b8bf`. Five pre-existing untracked
operator/visual scripts remained byte-identical. Post-deploy disk context:
~24G available / ~76% used / inodes ~11%; publication
`2,192,263,792` bytes; deployment backup `277,833,640` bytes. Adequate
headroom existed; separate VPS storage cleanup is out of scope for this
closure.

## Accepted development baseline

| Field | Value |
| --- | --- |
| Publication SHA | `ff7816b8a59823aeced2d76430b977c898ff23963b7434df71e0fd4b398f1c4d` |
| Schema | `market-baseline-publication/1.1.0` |
| Builder | `market-baseline-publication-builder/1.1.0` |
| Source reporting period | `2026-06` |
| Governing run | `mrr-stage-d-2026-10-27-2026-10-27T05-43-34-305Z` |
| Run scope | `FULL_STAGE_D` / `ICANN_FULL_DISCOVERY` |
| Outcomes SHA | `2844672b81a1abd119bd09729951a616f5fb4858fa8ba22a0676509097bf3a56` |
| Coverage | 1319 total / 1113 AVAILABLE / 206 MISSING |
| History universe | 106 (Top100=100, controls=8, delegated overlaps=6) |
| Controls | com, net, org, xyz, online, shop, top, site |
| Overlaps | `xn--3ds443g`, `xn--czr694b`, `xn--fiq228c5hs`, `xn--g2xx48c`, `xn--imr513n`, `xn--io0a7i` |
| Full publish duration | 2m11.74s |
| Peak RSS | 897456 KiB (~876 MiB); no custom heap; no OOM; no Invalid string length |

Default authority path (no `--run-id`): selects the unique FULL_STAGE_D
governing receipt for the as-of probe period. Legacy 3-TLD and pre-hardened
1319 runs do not auto-qualify.

Selection labels (Top100 / controls / overlaps) are **acquisition universe
membership reasons only** — not application ownership, RSP relationship,
Registry Operator identity, or registrar relationship.
