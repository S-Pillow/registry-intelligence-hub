# Market baseline — ICANN MRR Transactions (RIH-MARKET-BASELINE-MRR-1 / 1A)

Implementation of the first round-neutral registry lifecycle acquisition slice.
Controlling discovery contract: [`market-baseline-source-1.md`](./market-baseline-source-1.md).
Product publication: [`market-baseline-publication.md`](./market-baseline-publication.md).

MRR-1A corrects temporal purity, remote revision revalidation, and per-request
coverage evidence.

PUBLISH-1C adds authoritative **`runScope`** on the acquisition manifest
(`market-baseline-mrr-run-manifest/1.1.0`) so internally complete bounded runs
are not mistaken for full Stage-D governing evidence.

## Source

- **Index:** https://www.icann.org/resources/pages/registry-reports
- **Report type:** Transactions only (Spec 3 §1)
- **Auth:** none (public HTTP)
- **Activity / DNMI / Metrica / pricing:** deferred / blocked per source contract

## Discovery

1. Fetch the Registry Reports index HTML.
2. Collect per-TLD resource page URLs from published anchors (`.label` → `/resources/pages/…`).
3. Fetch each TLD page and resolve **Transactions** (and observe Activity) CSV `href`s.
4. Do **not** treat hard-coded CDN path construction as authoritative discovery.

CDN path pattern (validation only):

`/sites/default/files/mrr/<tld>/<tld>-transactions-<YYYYMM>-en.csv`

## Reporting period / withhold

Every run records `asOfDate` and derives a single **`probeReportingPeriod`**:

- Reports are withheld until **three months after the end of the reporting month**.
- Locked example: `asOfDate=2026-10-26` → `probeReportingPeriod=2026-06`.
- Implementation: calendar month of `asOfDate` minus **4** months.
- `asOfDate` must be a real calendar date (rejects e.g. `2026-02-31`).

All probe rankings use that **same** period. Missing → `MISSING_REPORT` (no silent older substitute).

## Schema profiles

| Profile id | Columns | Notes |
| --- | --- | --- |
| `spec3-core-39` | 39 | Spec 3 core ending at `attempted-adds` |
| `com-extended-41` | 41 | Adds `consolidate-transaction-days`, `consolidate-transactions` |

Unknown material headers → `UNSUPPORTED_SCHEMA` for that TLD/month; siblings continue.

CSV parsing: RFC 4180 (reused APS-style parser; **no new dependency**).

## Registrar classification

| Class | Rule |
| --- | --- |
| `TOTALS` | `registrar-name` = Totals |
| `SPECIAL_REGISTRY_OR_SYSTEM` | IANA IDs **9995–9999** |
| `ACCREDITED_OR_STANDARD` | numeric IANA ID in `(0, 9995)` |
| `UNKNOWN_OR_UNCLASSIFIED` | otherwise |

Breadth / share numerators use accredited rows with `totalDomains > 0` only.
Totals reconciliation **includes** special rows in the non-Totals sum.

## Normalized model (intrinsic only)

- Schema: `market-baseline-mrr-transactions/1.0.0`
- Parser: `market-baseline-mrr-transactions-parser/1.0.0`
- Keys: `tldAsciiLabel` (lowercase A-label, no leading dot) × `reportingPeriod` (`YYYY-MM`)
- Snapshot is a **pure** function of raw bytes + intentional source provenance + parser/schema versions.
- Intrinsic metrics only: `totalDomains`, `netAddsCount`, `netRenewCount`, deletes, transfers, breadth, top/top5 share, accredited/special domain sums.
- `retrievedAt` is on the envelope **outside** the normalized content hash.
- Neighboring reporting periods **must not** affect `normalizedContentSha256`.

## Temporal metrics (cross-snapshot)

`netDomainBaseChange`, `monthOverMonthGrowth`, and `yearOverYearGrowth` are **not**
stored in the source-normalized snapshot. They are derived via
`deriveTldMarketSeriesTemporal` by joining period `t` with exact calendar
`t−1` and `t−12` snapshots. Missing prerequisites → unavailable with reason.
No bridging across gaps. Zero prior denominator → unavailable.

## Metrics (blocked / unsupported)

- **`renewalRate`**
- customer concentration / HHI as product metric
- revenue, pricing, market opportunity scores
- Registry Operator / Registrar→Organization / RSP→TLD joins

## Remote revision revalidation

Authoritative acquisition **always revalidates** the source URL (conditional
`If-None-Match` / `If-Modified-Since` when validators are known, otherwise GET + SHA-256).

- HTTP **304** → reuse current revision; no duplicate raw write; no revision event.
- HTTP **200** → hash body; same SHA → reuse; different SHA → new revision.
- Do **not** skip remote validation merely because a normalized snapshot exists.
- Optional explicit `cacheOnly` mode exists for offline use; it is **not** the default.

## Current revision pointer

Per TLD×period explicit index (not lexical hash filenames):

```text
.data/market-baseline/mrr/indexes/periods/<tld>/<YYYY-MM>.json
```

Fields include `currentRawSha256`, `currentNormalizedSha256`, `previousRawSha256`,
`retrievedAt`, optional `etag` / `lastModified`.

`readNormalizedForPeriod` returns the **explicitly current** revision.
`revisionOfRawSha256` chains A→B→C by previous-current pointer, not sorted hashes.

## Stage D universe

1. Discover all TLD pages  
2. Common-period Transactions probe  
3. Top 100 by `Totals.total-domains` DESC, `tldAsciiLabel` ASC  
4. Control set: `com`, `net`, `org`, `xyz`, `online`, `shop`, `top`, `site`  
5. Delegated RIH overlaps: exact ASCII applied-string ∩ IANA delegated labels ∩ discovered MRR TLDs (selection metadata only)  
6. Up to **24** months ending at probe for the union  

## Storage (gitignored)

```text
.data/market-baseline/mrr/
  raw/<tld>/<YYYY-MM>/<rawSha256>.csv
  normalized/<tld>/<YYYY-MM>/<normalizedSha256>.json
  manifests/<runId>.json
  manifests/<runId>.outcomes.json
  indexes/current.json
  indexes/periods/<tld>/<YYYY-MM>.json
  indexes/discovery-cache.json
```

Raw bytes are content-addressed; same TLD/period/URL with a new hash creates a **new revision** (no overwrite).

## Per-request coverage evidence

Every requested TLD×period is persisted in
`manifests/<runId>.outcomes.json` (schema
`market-baseline-mrr-request-outcomes/1.0.0`) with phase (`PROBE`|`HISTORY`),
outcome, URLs, hashes, reuse/revalidation/revision flags, bytes, and errors.
The run manifest references the artifact path + SHA-256.
Detail counts must reconcile exactly to `manifest.probe` / `manifest.history`.
`PARTIAL` remains valid for legitimate `MISSING_REPORT` identities.

## Acquisition runScope (manifest 1.1.0)

Durable receipt field `runScope` is recorded at orchestration time from
invocation facts (not inferred later from observed counts alone).

| `mode` | Meaning |
| --- | --- |
| `FULL_STAGE_D` | Ordinary full ICANN discovery, no `pages` override, no `probeLimit`, history not skipped, 24-month Stage-D history contract, probe all discovered TLDs |
| `BOUNDED` | Any of: caller `pages`, `probeLimit`, `skipHistory`, short history, unqualified/legacy discovery cache, fixture/smoke subset |

`discoveredTldCount == PROBE count` proves **internal completeness**, not
full-universe authority. Legacy manifests (`…/1.0.0` without `runScope`) are
`LEGACY_UNKNOWN` for publication auto-selection.

Fresh ordinary discovery writes `indexes/discovery-cache.json` with
`discoveryProvenance.qualifiedForFullStageD=true`. Legacy caches without that
provenance cannot support `FULL_STAGE_D`.

## CLI

```bash
npm run market-mrr -- stage-d --as-of 2026-10-26
```

Options: `--concurrency` (≤4), `--applied-labels`, `--probe-limit`, `--skip-history`, `--cwd`.

## Failure modes

Per TLD/month: `SUCCESS` | `MISSING_REPORT` | `DOWNLOAD_FAILED` | `UNSUPPORTED_SCHEMA` |
`PARSE_FAILED` | `VALIDATION_FAILED` | `NORMALIZATION_FAILED`.

Network: concurrency ≤4, bounded retries/backoff; stop bulk on material 429/403/5xx.

## Live acceptance (MRR-1)

Recorded under `.data/market-baseline/mrr/manifests/` (gitignored).

| Field | Value (MRR-1 acceptance) |
| --- | --- |
| asOfDate | `2026-10-26` |
| probeReportingPeriod | `2026-06` |
| resultStatus | `PARTIAL` (missing reports represented; no schema/validation failures) |
| TLD pages discovered | 1319 |
| probe success / missing | 1113 / 206 |
| Top-100 / controls / overlaps | 100 / 8 / 6 |
| 24-month universe | 106 |
| files requested / downloaded / cached | 3757 / 3432 / 118 |
| bytes downloaded | ~352 MiB |
| disk footprint | ~3.0 GiB |
| duration | ~951 s (resume run after initial 429 cooldown; concurrency 2) |
| throttling (final run) | none |

MRR-1A does **not** re-run the full corpus; correctness is proven with mocked
revision/outcome tests plus optional bounded public smoke.

## Acceptance status (post-merge closure)

| Unit | Status | Commit |
| --- | --- | --- |
| MARKET-BASELINE-SOURCE-1 | **MERGED / ACCEPTED / CLOSED** | `abe5d5d1fb3dfa686ac37e99046073167f89fb9a` |
| MARKET-BASELINE-MRR-1 | **MERGED / ACCEPTED / CLOSED** | `e50e6d5b89c86cb1504fccfe578060b3260cef4a` |
| MARKET-BASELINE-MRR-1A | **MERGED / ACCEPTED / CLOSED** | `071d3bdecf790fb7a428bc27fd8296aa96618a5f` |

Merged on `main` via fast-forward through `071d3bd…` (no merge commit).
Post-merge verification on `main` @ `071d3bd`: focused MRR tests **29/29**, lint, typecheck, and build all exit `0`.

Explicit non-actions for this closure:

- no production deployment
- no scheduler enabled
- no UI/routes added by closure
- no full corpus re-download
- no credentials / private data
- bulk `.data` corpus remains uncommitted

**DEPLOYMENT: NOT STARTED**

Product publication contract (derived facts for future UI):
[`market-baseline-publication.md`](./market-baseline-publication.md)
(`RIH-MARKET-BASELINE-PUBLISH-1`).

## Limitations

- Activity bodies not acquired  
- IDN applied-string overlap deferred unless already ASCII/A-label  
- No operator identity, no product UI, no scheduler  
- Registrar names may drift; identity key remains `iana-id`  
