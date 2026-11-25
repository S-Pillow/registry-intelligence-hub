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

### Local data-backed forecast interface (RIH-FCAST-05B / 05C)

Development-only gated forecast experience. Enable only when **both** are set:

- `NODE_ENV=development`
- `RIH_FORECAST_LOCAL_PREVIEW=1`

Otherwise `/forecast/preview` and `/forecast/[label]` are blocked with a hard HTTP 404 from Next.js `proxy` before soft streaming. Bare `/forecast` remains available as the legacy experimental surface when gated data is off.

### Integrated forecast experience (RIH-FCAST-06)

When the gate is open and the accepted preview is present:

- `/forecast` — searchable overview with Low / Middle / High scenario labels and restrained scenario-band visuals
- `/forecast/[label]` — per-extension detail (exact proposed DNS string)
- `/forecast/preview` — redirects to `/forecast`
- Reusable `ForecastLink` from Applicant portfolio (original and selected strings remain distinct), Explore, and Contention — active only when that label exists in the catalog

Publication candidate (unpublished, ignored under `.data/`):

```bash
npm run forecast-publish-candidate
# writes .data/registration-forecast/experimental-forecast-publication-candidate.json
```

Sanitized fields only: measured counts, scenario values, snapshot/attribution metadata, and source SHA pins. Excludes ActiveDNS domain lists, absolute host paths, and unrelated aggregate blobs. Intended release location after a separate promotion decision: versioned product data under the hub publication pipeline — **not** enabled by this ticket.

```bash
RIH_FORECAST_LOCAL_PREVIEW=1 npm run dev
# open /tools/registry-intelligence-hub/forecast
# open /tools/registry-intelligence-hub/forecast/wdo
```

### Production publication preparation (RIH-FCAST-07A)

Separates **local development preview** from an independently controlled **production publication** gate:

| Gate | Enablement | Artifact |
| --- | --- | --- |
| Local preview | `NODE_ENV=development` + `RIH_FORECAST_LOCAL_PREVIEW=1` | Unpublished candidate / accepted preview (existing) |
| Production publication | `RIH_FORECAST_PUBLICATION_ENABLED=1` (any `NODE_ENV`) | SHA-pinned staged release package only |

Production defaults to disabled. Enabling the production gate without a valid approved release artifact fails closed and **never** falls back to local preview files. Stage a release package (private, gitignored):

```bash
npm run forecast-stage-release -- --source-commit 631b63a3b29dafcf3cd1db188c397d1e76ca683d
# writes .data/registration-forecast/staging/fcast-07a/{release,manifest}
```

Operator release/rollback steps: `docs/registration-forecast-production-release.md`. Do not enable the production gate on the live host from this ticket.

## Validation posture

Focused unit tests for conversions, eligibility, brand exclusion, and no-fabrication when demand is missing. No extensive 2012 backtesting in v1. Offline counter tests use synthetic gzip fixtures only. Local preview / integrated forecast tests use synthetic JSON fixtures for gate, routing, publication-candidate reproducibility, WDO/Brand visibility, null-vs-zero estimates, accessibility of scenario visuals, and missing/corrupt file failure — they do not require the real ignored preview file for the core unit suite.
