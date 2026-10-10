# Publication 2.x activation contract (RIH-ACTIVATION-2X-1)

**Ticket scope (historical):** RIH-ACTIVATION-2X-1 delivered the activation-capable source path; that ticket itself did not execute production promotion.

**Current production state (2026-10-08):** Application and contention are promoted on `srv766238` at deployed commit `e66c57945826e22e390c666053a637ef500e4447`. Canonical closeout: [`docs/2026-reveal-day-production-closeout.md`](./2026-reveal-day-production-closeout.md).

## Explicit Application 2.0 write

```bash
npm run reveal-2026 -- promote-actuality \
  --snapshot <registry-2026-publication/2.0.0.json> \
  --steward-approval <id> \
  --product-approval <id> \
  --state <claim-actuality-state.json>
```

- Validates via `evaluateApplicationPublicationV2PromotionCandidate` / `evaluateApplicationPublicationV2ActualityPromotion`
- Requires steward + product approvals (same strength as 1.1)
- Persists `ClaimActualityState` (`REAL_SOURCE_READY`) + promotion history
- Does **not** change metric eligibility catalog
- Does **not** switch active browser config by itself
- `dry-run-promotion-2x` never writes

## Fail-closed active 2.x selection

| Claim actuality | Configured payload | Result |
| --- | --- | --- |
| `NOT_PUBLISHED` | any / none | Rehearsal (unchanged) |
| `REAL_SOURCE_READY` | matching `registry-browser-applications/2.0.0` | Active 2.x |
| `REAL_SOURCE_READY` | matching 1.x | Active 1.x (unchanged) |
| `REAL_SOURCE_READY` | missing / wrong schema / pin mismatch / malformed | **FAIL CLOSED** — no rehearsal |

`REAL_SOURCE_READY` must **never** silently fall back to rehearsal.

## External payload delivery

| Item | Value |
| --- | --- |
| Generated artifact | `.data/reveal-2026/browser/applications-browser-v2.json` |
| Production install | same relative path under runtime data root |
| Runtime config | `REGISTRY_HUB_APPLICATION_PAYLOAD_PATH` (PATH preferred; avoid inline JSON for ~1.7MB) |
| JS bundle | must **not** embed the corpus |

```bash
npm run reveal-2026 -- build-browser-payload-2x \
  --snapshot .data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json \
  --out .data/reveal-2026/browser/applications-browser-v2.json \
  --compact
```

## Search / Explore coverage disclosure

Active 2.x lists render persistent disclosure from document fields:

- ICANN official applications (aggregate)
- RIH normalized observed records
- PARTIAL coverage + known-excluded descriptor (WDO metadata only)
- Local result counts = matching RIH observed records (not official total)

Unsupported facets (organization / category / returning / confidence) stay hidden.

## Contention independent activation

```bash
npm run reveal-2026 -- promote-contention-actuality \
  --contention-snapshot <sidecar.json> \
  --application-graph-hash <application-graph-sha256> \
  --steward-approval <id> \
  --product-approval <id> \
  --contention-state .data/reveal-2026/contention-actuality-state.json
```

Runtime:

- `REGISTRY_HUB_CONTENTION_ACTUALITY_STATE_PATH` / `_JSON`
- `REGISTRY_HUB_CONTENTION_MEMBERSHIP_PATH` (sidecar for overlay)

Missing / hash mismatch / Application-pin mismatch → contention unavailable; **Application remains active**. Never exact-string fallback.

## Rollback ordering

1. Return Application claim actuality to `NOT_PUBLISHED` (or remove state file / env JSON)
2. Then unset/repoint `REGISTRY_HUB_APPLICATION_PAYLOAD_PATH`
3. Contention may roll back independently anytime

Do **not** leave `REAL_SOURCE_READY` while removing the required active 2.x payload (that fails closed).

Immutable Reveal Day evidence under `.data/reveal-2026/publications/` is retained.

## VPS Agent handoff

**Production promotion completed 2026-10-08** — see [`docs/2026-reveal-day-production-closeout.md`](./2026-reveal-day-production-closeout.md) for live paths, hashes, backups, and rollback.

Procedure retained for re-install / disaster recovery:

1. Deploy activation-capable build (`e66c579…` or successor authorized commit)
2. Install browser 2.x artifact at `.data/reveal-2026/browser/applications-browser-v2.json` (or absolute path)
3. Install contention sidecar under `.data/reveal-2026/publications/`
4. On explicit operator authorization only:
   - write claim actuality via `promote-actuality` (default path `.data/reveal-2026/claim-actuality-state.json`)
   - set `REGISTRY_HUB_APPLICATION_PAYLOAD_PATH` to the browser 2.x artifact
   - **Do not** set `REGISTRY_HUB_CLAIM_ACTUALITY_STATE_PATH` / `REGISTRY_HUB_CONTENTION_ACTUALITY_STATE_PATH` to nonexistent files (hard-fails the app). Prefer default paths when files live under `.data/reveal-2026/`.
5. Smoke: Data Health shows 2.x metadata; Search/Explore show disclosure; bad payload fails closed
6. Rollback via actuality → then payload path (ordering above)

**Do not auto-promote merely because files are present.**
