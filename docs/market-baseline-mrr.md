# Market baseline — ICANN MRR Transactions (RIH-MARKET-BASELINE-MRR-1)

Implementation of the first round-neutral registry lifecycle acquisition slice.
Controlling discovery contract: [`market-baseline-source-1.md`](./market-baseline-source-1.md).

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

## Normalized model

- Schema: `market-baseline-mrr-transactions/1.0.0`
- Parser: `market-baseline-mrr-transactions-parser/1.0.0`
- Keys: `tldAsciiLabel` (lowercase A-label, no leading dot) × `reportingPeriod` (`YYYY-MM`)
- Snapshot includes Totals, registrar rows, metrics, raw/normalized SHA-256, parser/schema profile, optional `revisionOfRawSha256`
- `retrievedAt` is stored on the envelope **outside** the normalized content hash

## Metrics (supported)

`totalDomains`, `netAddsCount` (Σ net-adds-1..10-yr), `netRenewCount` (count only),
`deleteCount`, `transferGainingCount`, `transferLosingCount`, `registrarBreadth`,
`topRegistrarShare`, `top5RegistrarShare`, `accreditedRegistrarDomains`, `specialOrSystemDomains`,
`netDomainBaseChange` / MoM / YoY when prior periods exist.

## Metrics (blocked / unsupported)

- **`renewalRate`**
- customer concentration / HHI as product metric
- revenue, pricing, market opportunity scores
- Registry Operator / Registrar→Organization / RSP→TLD joins

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
  indexes/current.json
```

Raw bytes are content-addressed; same TLD/period/URL with a new hash creates a **new revision** (no overwrite).

## CLI

```bash
npm run market-mrr -- stage-d --as-of 2026-10-26
```

Options: `--concurrency` (≤4), `--applied-labels`, `--probe-limit`, `--skip-history`, `--cwd`.

## Failure modes

Per TLD/month: `SUCCESS` | `MISSING_REPORT` | `DOWNLOAD_FAILED` | `UNSUPPORTED_SCHEMA` |
`PARSE_FAILED` | `VALIDATION_FAILED` | `NORMALIZATION_FAILED`.

Network: concurrency ≤4, bounded retries/backoff; stop bulk on material 429/403/5xx.

## Live acceptance

Recorded under `.data/market-baseline/mrr/manifests/` (gitignored).

| Field | Value (acceptance) |
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

An earlier attempt at concurrency 4 hit HTTP 429 and stopped safely (`STOPPED_THROTTLED`); the resumed run reused cached normalized probe files and completed Stage D.

## Limitations

- Activity bodies not acquired  
- IDN applied-string overlap deferred unless already ASCII/A-label  
- No operator identity, no product UI, no scheduler  
- Registrar names may drift; identity key remains `iana-id`  
