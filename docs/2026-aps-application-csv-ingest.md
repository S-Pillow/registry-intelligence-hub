# 2026 APS Application CSV ingest (APS-INGEST-CSV-1)

**Status:** IMPLEMENTED offline (NOT PROMOTED).  
**Schema:** `registry-2026-publication/2.0.0`  
**Governing decisions:** `docs/2026-aps-reveal-day-source-contract.md`, `docs/2026-aps-schema-grain-decision.md` (incl. 1A aggregate/coverage correction).

This document describes the production APS Application CSV → immutable local publication path. It does **not** promote, activate the browser, ingest contention, or fabricate organization/category/returning/confidence.

---

## What this path builds

Offline command:

```bash
npm run reveal-2026 -- build-publication-aps-csv \
  --input .data/reveal-2026/aps-capture/applications.csv \
  --aggregates .data/reveal-2026/aps-capture/official-aggregates.json \
  --excluded .data/reveal-2026/aps-capture/wdo-coverage-descriptor.json \
  --out .data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json \
  --review-out .data/reveal-2026/publications/aps-applications-2.0.0.review.json \
  --snapshot-id snap-aps-2026-applications-reveal-day-v1 \
  --artifact-id aps-2026-application-export \
  --capture-id capture-reveal-day-2026-10-08 \
  --source-url https://newgtldprogram-aps.icann.org/aps/applications/export/csv \
  --source-name "ICANN APS Application CSV export" \
  --source-version 1 \
  --retrieved-at 2026-10-08T04:11:53Z \
  --published-at 2026-10-07T18:00:00Z \
  --expect-source-hash a3e2bdba5d3950e87f173e3f576413d9600a6651c99b6946c35bcfd0b9d3553b \
  --recorded-http-status 200
```

Reveal Day verification expectations (against captured evidence, not hardcoded product truth):

| Fact | Value |
| --- | ---: |
| Source rows | 2783 |
| Normalized Applications observed | 1614 |
| ReplacementString relationships | 1169 |
| Official applications | 1615 |
| Official applicants | 481 |
| Application coverage | PARTIAL 1614/1615 |
| Promotion | NOT PROMOTED |

If `--expect-source-hash` does not match local bytes → fail with SOURCE_CHANGED. Do not silently rebuild against newer CSV bytes under this ticket.

---

## Schema 2.0.0 (logical Application grain)

- **Raw APS row** ≠ **normalized Application**.
- One Application is keyed by the non-`-R` Application ID.
- A replacement source row requires **both** `-R` ID suffix and `Application Type == "Replacement String"`; indicator disagreement fails closed. Matched pairs normalize to `replacementString` on the base Application (also fail-closed if unmatched or applicant mismatch).
- Keep source-backed fields: applicant, location/country, region, status, stage, APS application type, designation/label booleans, AppliedString, optional ReplacementString, source-row IDs.
- Do **not** fabricate: `organization`, `category`, `returning`, `confidence`, or official contention membership.
- Official aggregates and coverage live as separate publication channels from `applications[]`.

### Deterministic hashing

Application graph content hash covers:

- `snapshotId`
- `applications` (stable normalized authoritative content)

Excluded from that hash (still pinned in `bundleManifest`):

- retrieval timestamp / filesystem path
- official aggregate provenance
- coverage / known-excluded descriptors
- organization/category enrichment
- RIH exact-string calculations
- future contention sidecar content

Identical input evidence → identical application graph hash.

---

## Parser dispatch (safety)

Both Application and contention exports are `text/csv`. This path does **not** register an unrestricted `text/csv` `CapturedArtifactParser`.

Dispatch requires:

1. Explicit artifact role `aps-2026-application-export`
2. Deterministic Application CSV header/schema signature (34 columns; preamble before header)

Rejects:

- contention CSV shape
- missing/mismatched Application headers
- malformed preamble/header structure
- duplicate source Application IDs
- unmatched `-R` / applicant mismatch / indicator disagreement (`-R` vs `Replacement String`)

Existing NDJSON path (`registry-2026-publication/1.1.0`, `build-publication`) remains for rehearsal/drill.

---

## WDO (Option A)

`WDO2627T-T45217` is represented only as `knownExcludedRecords` coverage metadata. No fabricated normalized Application. Pre-Reveal 1616 → Reveal Day 1615 remains **OPEN** (not explained by this descriptor).

---

## Boundaries (this ticket)

| In scope | Out of scope |
| --- | --- |
| Offline CSV → 2.0.0 local bundle | Contention CSV ingest |
| Official aggregates + coverage pins | Browser / Command Center / Explore activation |
| Partial coverage honesty | Promotion / claim-actuality mutation |
| 1.1.0 coexistence | Metric eligibility unlock |
| | Deployment |

**Promotion ≠ complete metric eligibility.** Row-derived round-wide metrics requiring complete coverage remain blocked/partial while coverage is 1614/1615.

Contention sidecar: see `docs/2026-aps-contention-membership.md` (offline; NOT PROMOTED). Deferred: browser/promotion integration, organization resolution, cross-round identity.

---

## Implementation map

| Piece | Location |
| --- | --- |
| Types | `src/reveal-day-2026/publication-v2-types.ts` |
| Parser / normalizer | `src/reveal-day-2026/aps-application-csv.ts` |
| Builder + review | `src/reveal-day-2026/build-publication-v2.ts` |
| Validator | `src/reveal-day-2026/validate-v2.ts` |
| CLI | `npm run reveal-2026 -- build-publication-aps-csv` |
| Tests | `src/reveal-day-2026/aps-application-csv.test.ts` |
| Synthetic fixtures | `src/reveal-day-2026/fixtures/aps-application-csv-synthetic/` |
| Live capture (gitignored) | `.data/reveal-2026/aps-capture/` |
