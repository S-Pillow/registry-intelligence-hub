# Publication 2.0 promotion contract (RIH-PROMOTION-2X-1)

Contract version: `reveal-day-promotion-contract-2x/1.0.0`

## Actuality ≠ metric eligibility

`REAL_SOURCE_READY` means the authoritative publication identity passed promotion validation.

It does **not** mean every metric derivable from the publication is complete.

Metric eligibility remains governed by `metric-eligibility-catalog/2.0.0`.

Binary Application actuality is unchanged: `NOT_PUBLISHED` | `REAL_SOURCE_READY`.
Partial Application **record** coverage does not introduce a `PARTIAL` actuality enum.

## 2.0 Application promotion validation

Schema: `registry-2026-publication/2.0.0`

Fail-closed unless identity/evidence pins match:

- schema version + snapshot ID
- Application semantic content hash (`applicationGraphContentSha256`)
- raw Application source SHA (`lineage.rawSha256`)
- official aggregate evidence pin
- coverage descriptor pin
- coverage semantics (observed / official / completeness)
- known-excluded descriptor when required (e.g. WDO)

**Never require** `applications.length === officialApplicationCount`.

Accepted Reveal Day shape: PARTIAL **1614/1615** with known excluded `WDO2627T-T45217`.

## Aggregate / coverage pins

Official aggregates and coverage descriptors are pinned in `bundleManifest` separately from the Application graph hash. Promotion validates recomputed pins against the manifest.

## Application-only promotion allowed

Application publication may promote independently of contention.

Contention failure/absence must **not** invalidate a valid Application candidate.

## Contention independent / fail-closed

Contention activation requires its own validated evidence:

- schema `registry-2026-contention-membership/1.0.0`
- snapshot ID
- corrected semantic content hash (`480b378…` for accepted Reveal Day sidecar)
- raw source hash
- exact Application publication pin (`applicationGraphContentSha256`)

Application actuality alone never unlocks contention metrics.

## Corrected contention semantic hash

Semantic hash excludes incidental CSV `sourceRowIndex` / row order (APS-CONTENTION-HASH-1). Promotion validates the recomputed sidecar semantic hash.

## Ticket scope vs production (historical)

**RIH-PROMOTION-2X-1** implemented the **contract** and `dry-run-promotion-2x` only (no production write in that ticket).

Later authorization completed production promotion on **2026-10-08**. Live state, hashes, and rollback: [`docs/2026-reveal-day-production-closeout.md`](./2026-reveal-day-production-closeout.md). Activation write path: [`docs/2026-publication-2x-activation.md`](./2026-publication-2x-activation.md).

Dry-run CLI (still valid; never mutates actuality):

```bash
npm run reveal-2026 -- dry-run-promotion-2x \
  --snapshot .data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json \
  --contention-snapshot .data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json
```

## Browser 2.x (delivered)

Honest browser projection (`registry-browser-applications` 2.x) with mandatory partial-coverage disclosures was delivered in RIH-BROWSER-2X-1 (`docs/2026-browser-publication-2x-payload.md`) and is live in production after Phase B.

Promotion validation remains separate from `build-browser-payload` / `build-browser-payload-2x`.

## 1.1 compatibility

`registry-2026-publication/1.1.0` promote-actuality path remains intact. 2.0 is dispatched explicitly and is not converted into a synthetic 1.1 document.
