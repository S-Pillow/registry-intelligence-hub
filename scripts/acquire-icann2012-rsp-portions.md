# Acquire ICANN 2012 RSP public application portions

Documents the **offline-first** acquisition tooling for `icann2012-rsp-public-portions-v1`. **No bulk gtldresult fetch is authorized** until steward/legal sign-off ([Project source inventory](../../cursor/stores/bc-e04e6cc5-a825-4e04-8ec0-9262ee0fe1cb/docs/source-inventory.md) blocker #1).

## Product constraints

- **Primary evidence:** public portion HTML — Guidebook **Q23–Q25** only.
- **Forbidden for RSP assignment:** applicant legal name, contact, email, fuzzy matching.
- **Join key:** Reveal Day **`Application ID`**; fetch uses **`gtldresultAcId`** from index/mapping pass.
- **Staging:** raw downloads land under the fixture workspace on the acquisition host — **do not auto-commit** HTML to git without steward review.

## Fixture bundle

`src/normalization/fixtures/icann2012-rsp-public-portions-v1/`

Pilot list: `pilot-manifest-25.json` (includes **`1-863-45071`** NeuStar applicant case — applicant ≠ RSP evidence).

## CLI (default: dry-run, zero HTTP)

```bash
npm run acquire-rsp-portions -- pilot
npm run acquire-rsp-portions -- mapping-dry-run
npm run acquire-rsp-portions -- mapping-review --run-dir /var/tmp/icann2012-rsp-staging
npm run acquire-rsp-portions -- preflight-report --operation mapping-live
npm run acquire-rsp-portions -- preflight-report --operation pilot-live
```

Dry-run prints exact URLs that **would** be fetched, staging paths, limits, and join ids. Preflight reports artifact SHA-256, purpose/approval, corpus hash, **`artifactMappedCount`** (rows in the JSON artifact only), **`pilotExpectedCount` / `pilotResolvedCount` / `pilotUnresolvedCount`** (25-app manifest join coverage), auth state, and expected HTTP volume **without network I/O**.

## Mapping artifact eligibility (`registry-2012-rsp-mapping/1.0.0`)

| Field | Values | Live rule |
| --- | --- | --- |
| `artifactPurpose` | `TEST_ONLY`, `EVIDENCE` | Pilot-live requires `EVIDENCE` |
| `approvalState` | `DRAFT`, `APPROVED` | Pilot-live requires `APPROVED` |

Committed `pilot-gtldresult-mapping.json` is **`TEST_ONLY` / `DRAFT`** (probe row only). Synthetic round-wide rows belong in `fixtures/synthetic/` or test generators — never as approved evidence.

**Mapping-live output** is always **`EVIDENCE` + `DRAFT`** with `scope: ROUND_WIDE_EXACT` and `mappingSourceClass: STATUS_GRID` — never self-`APPROVED`.

## Mapping review (offline operator gate — D2.5A-P0.2A)

Zero HTTP. Validates a **completed mapping-live staging run** before any human approval packet is filed.

```bash
npm run acquire-rsp-portions -- mapping-review --run-dir /var/tmp/icann2012-rsp-staging
```

Checks (non-exhaustive): mapping artifact SHA-256, Reveal Day corpus pin (1,930 Application IDs), mapped/missing/extra counts, duplicate public IDs / AC IDs, every mapped row → on-disk index page snapshot + fetch metadata (body SHA match), no cookie/CSRF/session persisted, allowed `sourceUrl` hosts, pagination diagnostics consistent with checkpoint, checkpoint ↔ artifact consistency.

**Immutable JSON report** (`registry-hub-rsp-mapping-review-report/1.0.0`) includes: `runId`, artifact path + SHA, purpose, approval state, corpus hash, reconciliation counts, pilot **25/25** rows, validation-lead assertion checks (BOSCH/HOTELS/ABBOTT/DOCS — mismatch → **review hold**, no auto-fix), `roundWideExact`, optional `pilotOnlyExactCandidate` when round-wide incomplete, and `failureClassification` (`EXACT_COMPLETE`, `PARTIAL_MAPPING`, `PAGINATION_DRIFT`, `INTEGRITY_FAILURE`, …).

**Human approval packet** schema: `rsp-mapping-review/1.0.0` — fields `mappingArtifactSha256`, `runId`, `reviewer`, `reviewedAt`, `decision` (`APPROVE` | `REJECT` | `HOLD`), `notes`. Mechanical **`DRAFT` → `APPROVED`** on the mapping artifact only when decision is **APPROVE**, SHA + runId match the reviewed run, and mapping-review passed with **ROUND_WIDE_EXACT**. Wrong SHA or runId **rejects APPROVE**. Do **not** commit real steward APPROVE files — tests use synthetic decisions only.

Relationship taxonomy (Applicant vs Registry Operator vs RSP vs DNS): Project doc `registry-operator-vs-rsp-relationship-contract.md`.

## Live pilot (after written approval only)

**Do not run in CI or during implementation.** Requires steward **`EVIDENCE` + `APPROVED`** mapping with referential snapshot rows. Legacy `REGISTRY_HUB_RSP_ACQUISITION_AUTHORIZED` **does not** authorize HTTP.

```bash
REGISTRY_HUB_RSP_PILOT_LIVE_AUTHORIZED=1 \
  npm run acquire-rsp-portions -- pilot-live \
  --staging /var/tmp/icann2012-rsp-staging \
  --approved-mapping /path/to/steward-approved-mapping.json
```

## Mapping live (grid index crawl)

**Implemented (D2.5A-P0.2)** — deterministic viewstatus grid crawl with session bootstrap, server-provided pager hrefs (never manufactured `_csrf` URLs), immutable index snapshots, canonical 1,930 reconciliation, and checkpoint/resume.

**Authorization (separate from pilot-live):**

```bash
REGISTRY_HUB_RSP_MAPPING_AUTHORIZED=1 \
  npm run acquire-rsp-portions -- mapping-live \
  --staging /var/tmp/icann2012-rsp-staging \
  --run-id mapping-2026-09-22-steward
```

| Flag | Purpose |
| --- | --- |
| `--resume` | Continue from `mapping-live-checkpoint.json` (validates page SHA-256 + corpus pin) |
| `--force-new-run` | Replace checkpoint when steward intentionally starts over |

**Staging layout (not committed by default):**

| Path | Content |
| --- | --- |
| `sources/index/<run-id>/page-NNNN.html` | Immutable grid HTML |
| `sources/index/<run-id>/page-NNNN.fetch.json` | Safe HTTP metadata + body SHA-256 (no cookies/CSRF) |
| `registry-2012-rsp-mapping/<run-id>/mapping.json` | Round-wide mapping artifact (`DRAFT`) |
| `mapping-live-checkpoint.json` | Non-sensitive resume state |

**Hard stops:** HTTPS `gtldresult.icann.org` only, concurrency 1, paced requests, 403/429 halt, cross-host redirect reject, pagination safety cap (~60 pages), loop/overlap/gap detection.

**CI / agent runs:** use `src/icann2012-rsp-acquisition/synthetic-replay-corpus.ts` and inject a mock fetcher — **never** call ICANN from automated tests.

Caps (defaults): pilot batch **25**, **250** applications/calendar day, **≥1s** between gtldresult requests, **2 MiB** max portion size. See Project plan §4.

## Limits configuration

Implemented in `src/icann2012-rsp-acquisition/constants.ts` (`RSP_ACQUISITION_LIMITS`).

## Pipeline registry

`gtldresult.icann.org` is **not** added to `src/pipeline/registry.ts` in this slice — acquisition remains a documented offline script.
