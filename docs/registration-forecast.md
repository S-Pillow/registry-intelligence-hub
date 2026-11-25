# Registration forecast (RIH-FCAST-01)

Experimental estimates of how many domains an eligible 2026 extension might hold approximately four years after launch.

## Method (inspiration, not a copy)

Publicly described Toyroom approach: measure **suffix demand** (how many existing domains’ second-level labels equal/end with the applied-for word), then apply a transparent conversion band for word-like / compound strings:

| Scenario | Factor |
| --- | --- |
| Conservative | 0.8 |
| Expected | 1.9 |
| Optimistic | 3.2 |

Toyroom’s proprietary predictions are **not** displayed as RIH facts.

## Hard rules

- One forecast per unique **selected/current** string
- Exclude confirmed closed-brand strings (all Applications Brand-designated)
- Preserve contention status; **do not** predict auction/CPE winners
- Label outputs as **estimates, not facts**
- **Never** treat ICANN MRR TLD totals as suffix-demand counts

## Current coverage (v1)

Route: `/forecast`

Application identity comes from the active browser publication. Domain-name-level suffix-demand evidence is **not** currently accessible in this environment (no approved CZDS/zone-file panel or licensed domain index). The UI therefore shows representative strings with an explicit **demand unavailable** state rather than fabricated numbers.

### Simplest alternative input

Authorize a bounded, redistributable domain-name sample or approved zone-file panel for a fixed set of existing open gTLDs; compute suffix-demand counts against that panel; then emit numeric ranges with the experimental conversions.

### Offline suffix-demand counter (RIH-FCAST-03 / 03A / 04B)

An offline CLI computes panel-limited observed suffix-demand aggregates from **locally supplied** ActiveDNS gzip lists. It does not download data, does not wire counts into `/forecast`, and does not apply conversion factors.

```bash
# 1) Place the six local gzip lists in a directory (do not commit them).
# 2) Copy the template manifest and fill sha256 / declaredDomains / filenames / snapshotDate.
# 3a) Prototype example strings:
npm run suffix-demand -- \
  --input-dir /path/to/local/lists \
  --manifest /path/to/filled-mid-panel.manifest.json \
  --candidate-mode example-list \
  --out .data/suffix-demand/aggregate.json

# 3b) Forecast-eligible selected/current strings (Brand proxy exclusion; omits knownExcluded-only):
npm run suffix-demand -- \
  --input-dir /path/to/local/lists \
  --manifest /path/to/filled-mid-panel.manifest.json \
  --candidate-mode applications-document-v2 \
  --applications-document /path/to/RegistryApplicationsDocumentV2.json \
  --out .data/suffix-demand/aggregate.json

# 3c) Observed proposed-string demand (includes WDO knownExcluded primaryString; Brand not suppressed):
npm run suffix-demand -- \
  --input-dir /path/to/local/lists \
  --manifest /path/to/filled-mid-panel.manifest.json \
  --candidate-mode observed-proposed-strings \
  --applications-document /path/to/RegistryApplicationsDocumentV2.json \
  --out .data/suffix-demand/rih-fcast-04b-observed-aggregate.json
```

Approved mid-panel TLDs: `.net`, `.org`, `.info`, `.biz`, `.app`, `.dev`. Template: `src/suffix-demand-counter/panel/mid-panel.manifest.template.json`. Write evidence only under `.data/`. Never commit raw domain lists. Choose a fresh output path (the CLI refuses to overwrite).

Matching is an explicit ASCII case-insensitive **equals / literal endsWith** heuristic on the registrable second-level label (reversed suffix trie) — not semantic keyword analysis. Duplicate suppression assumes each ActiveDNS list is **sorted** and fails closed otherwise. Memory does not grow with distinct domain cardinality. Observed ActiveDNS domains are not equivalent to all registered domains.

- **example-list:** prototype strings only.
- **applications-document-v2:** `buildForecastUnits` / selected-string resolution; Brand proxy exclusion; omits knownExcluded-only labels such as WDO.
- **observed-proposed-strings (04B):** distinct source-backed labels from `appliedString.label`, `replacementString.label`, and `knownExcludedRecords.primaryString` (explicitly including WDO). Does **not** filter by Brand, contention, withdrawal, or selection status. Partial application coverage (e.g. 1614/1615) does not block measurement. Domain-scan `status: complete` is **not** a complete application-census claim.

### Offline experimental forecast preview (RIH-FCAST-05A)

Derives experimental four-year scenario ranges from an existing FCAST-04B measured aggregate (no ActiveDNS download, no recount):

```bash
npm run forecast-preview -- \
  --aggregate .data/suffix-demand/rih-fcast-04b-2026-11-07-observed-aggregate.json \
  --out-dir .data/registration-forecast
```

Uses existing factors 0.8 / 1.9 / 3.2 via `estimateRegistrationsFromSuffixDemand`. Retains all measured strings including WDO and Brand; does not apply Brand exclusion. Labels that fail `isCompoundWordCandidate` keep `measuredDomainCount` with `range: null` and `conversion_not_recommended`. Outputs under `.data/registration-forecast/` are offline analysis artifacts only — not website integration or verified market predictions.

### Local data-backed forecast interface (RIH-FCAST-05B)

Development-only preview UI at `/forecast/preview` (with hub `basePath`: `/tools/registry-intelligence-hub/forecast/preview`).

Enable only when **both** are set:

- `NODE_ENV=development`
- `RIH_FORECAST_LOCAL_PREVIEW=1`

Otherwise the route is blocked: a narrow Next.js `proxy` matcher returns **HTTP 404** before the App Router streams a soft-200 shell, and the page still calls `notFound()` as defense in depth. Preview data is not loaded. The existing `/forecast` experimental page is unchanged.

Server-only loader reads the fixed local path `.data/registration-forecast/experimental-forecast-preview.json` (no query-controlled paths, no `public/` copy, no public API). The accepted preview SHA-256 and source-aggregate pin are validated before projection. The browser receives a trimmed view model only (no absolute host paths or unrelated aggregate blobs).

```bash
RIH_FORECAST_LOCAL_PREVIEW=1 npm run dev
# open /tools/registry-intelligence-hub/forecast/preview
```

## Validation posture

Focused unit tests for conversions, eligibility, brand exclusion, and no-fabrication when demand is missing. No extensive 2012 backtesting in v1. Offline counter tests use synthetic gzip fixtures only. Local preview tests use synthetic JSON fixtures for gate, validation, search/sort/pagination, WDO/Brand visibility, null-vs-zero estimates, and missing/corrupt file failure — they do not require the real ignored preview file.
