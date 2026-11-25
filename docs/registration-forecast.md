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

### Offline suffix-demand counter (RIH-FCAST-03)

An offline CLI computes panel-limited observed suffix-demand aggregates from **locally supplied** ActiveDNS gzip lists. It does not download data, does not wire counts into `/forecast`, and does not apply conversion factors.

```bash
# 1) Place the six local gzip lists in a directory (do not commit them).
# 2) Copy the template manifest and fill sha256 / declaredDomains / filenames / snapshotDate.
# 3) Run:
npm run suffix-demand -- \
  --input-dir /path/to/local/lists \
  --manifest /path/to/filled-mid-panel.manifest.json \
  --out .data/suffix-demand/aggregate.json
```

### Full 2026 candidate inventory (RIH-FCAST-03A)

For the one-shot six-TLD run, supply a **local, authoritative, complete and promoted** `RegistryApplicationsDocumentV2` JSON artifact. Do **not** use a prototype fixture, partial publication, or an inactive/rehearsal snapshot:

```bash
npm run suffix-demand -- \\
  --input-dir /path/to/local/lists \\
  --manifest /path/to/filled-mid-panel.manifest.json \\
  --applications-document /path/to/complete-2026-applications-v2.json \\
  --out .data/suffix-demand/aggregate.json
```

Without `--applications-document`, the command intentionally remains in **example-only** mode; its output records `candidateProvenance.mode: "examples"`. Full-round mode uses the existing selected/current resolution and forecast-unit grouping: selected replacements are used, withdrawn/unresolved selections are skipped, each contested selected string is counted only once, and strings for which **all** applications are Brand-designated are excluded as a **Brand-designation proxy**, not evidence of a verified closed registration policy.

Full-round mode requires reconciled `applicationRecordCoverage.completeness: "complete"`, matching official and represented counts, a promoted-2026 payload and source/content pins. Missing, partial, or invalid source data **fails closed**, removing any stale output at the requested path. It will not claim a complete candidate inventory from the repository's known partial 2026 projection. To enable a one-shot run, a **complete authoritative projection** must first be available.

The aggregate records candidate mode, candidate-list SHA-256 and count, application snapshot ID/content hash, input artifact SHA-256, ICANN source and raw source hash, and coverage totals. The gzip input uses bounded-memory adjacent duplicate suppression while verifying sorted normalized domains per file; out-of-order valid records fail closed. A reversed suffix trie implements the existing literal equals/endsWith matching policy without scanning all candidates for every domain. Counts are **observed panel-limited demand evidence**, never registration forecasts.

Approved mid-panel TLDs: `.net`, `.org`, `.info`, `.biz`, `.app`, `.dev`. Template: `src/suffix-demand-counter/panel/mid-panel.manifest.template.json`. Write evidence only under `.data/`. Never commit raw domain lists.

Matching is an explicit ASCII case-insensitive **equals / literal endsWith** heuristic on the registrable second-level label — not semantic keyword analysis. Observed ActiveDNS domains are not equivalent to all registered domains.

## Validation posture

Focused unit tests for conversions, eligibility, brand exclusion, and no-fabrication when demand is missing. No extensive 2012 backtesting in v1. Offline counter tests use synthetic gzip fixtures only.
