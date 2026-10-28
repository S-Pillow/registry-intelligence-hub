# Acquire ICANN 2012 RSP public application portions

Documents the **offline-first** acquisition tooling for `icann2012-rsp-public-portions-v1`. **No bulk gtldresult fetch is authorized** until steward/legal sign-off (source-inventory blocker #1 — details live in **internal/operator documentation not included in this repository**).

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

**`PARTIAL_MAPPING` + `pilotOnlyExactCandidate: true` is not a dead end.** Round-wide mechanical **APPROVE** stays blocked (`ROUND_WIDE_EXACT` false), but an exact **25-app pilot** may still advance to a **separate steward decision** (pilot-scoped approval — not auto-approve, no silent downgrade of artifact purpose or approval state).

**Human approval packet** schema: `rsp-mapping-review/1.0.0` — fields `mappingArtifactSha256`, `runId`, `reviewer`, `reviewedAt`, `decision` (`APPROVE` | `REJECT` | `HOLD`), `notes`. Mechanical **`DRAFT` → `APPROVED`** on the mapping artifact only when decision is **APPROVE**, SHA + runId match the reviewed run, and mapping-review passed with **ROUND_WIDE_EXACT**. Wrong SHA or runId **rejects APPROVE**. Do **not** commit real steward APPROVE files — tests use synthetic decisions only.

Relationship taxonomy (Applicant vs Registry Operator vs RSP vs DNS): Project doc `registry-operator-vs-rsp-relationship-contract.md`.

## Live pilot (after written approval only)

**Do not run in CI or during implementation.** Requires steward **`EVIDENCE` + `APPROVED`** mapping with referential snapshot rows. Legacy `REGISTRY_HUB_RSP_ACQUISITION_AUTHORIZED` **does not** authorize HTTP.

```bash
REGISTRY_HUB_RSP_PILOT_LIVE_AUTHORIZED=1 \
  npm run acquire-rsp-portions -- pilot-live \
  --staging /var/tmp/icann2012-rsp-staging \
  --approved-mapping /path/to/steward-approved-mapping.json \
  --evidence-index /path/to/persistent-rsp-evidence/icann2012-rsp-mapping/<run-id>
```

`--evidence-index` is the mapping-live run directory (`mapping-live-checkpoint.json` plus `sources/index/<run-id>/page-NNNN.html` and fetch metadata). Pilot-live verifies each approved row's `evidenceSnapshotId` and content hash against those bytes. A checkout `raw-snapshots.json`, including one filled in by hand, is not evidence and is not read for this preflight. Missing pages, hash mismatches, and unknown snapshot ids fail closed.

## Mapping live operator plan (zero HTTP — D2.5A-P0.3A)

**Always run before the first authorized live crawl.** Produces the full VPS operator checklist, pacing, corpus pin, staging/disk checks, failure-branch summary, one-run rule, and truthful live-run expectation fields (`planNetworkRequests: 0`, `liveRunNetworkRequired: true`, page safety cap — **not** a provable pre-contact HTTP total). **Performs zero HTTP** even when `REGISTRY_HUB_RSP_MAPPING_AUTHORIZED=1` is set.

```bash
npm run acquire-rsp-portions -- mapping-live-plan \
  --staging /path/to/persistent-rsp-evidence/icann2012-rsp-mapping/<run-id>
npm run acquire-rsp-portions -- mapping-live --preflight-only --staging <same>
```

Project runbook: `d2-5a-p0-3-mapping-live-vps-operator-runbook.md` (isolated clone/worktree, persistent evidence outside git, production PM2/nginx untouched).

Evidence-bundle manifest schema: `registry-hub-rsp-mapping-evidence-bundle/1.0.0` (deterministic per-file SHA-256; no cookies/tokens).

## Mapping live (grid index crawl)

**Implemented (D2.5A-P0.2)** — deterministic viewstatus grid crawl with session bootstrap, server-provided pager hrefs (never manufactured `_csrf` URLs), immutable index snapshots, canonical 1,930 reconciliation, and checkpoint/resume.

**Authorization (separate from pilot-live). First authorized run — new staging root + fresh `--run-id` only (no `--force-new-run`):**

```bash
REGISTRY_HUB_RSP_MAPPING_AUTHORIZED=1 \
  npm run acquire-rsp-portions -- mapping-live \
  --workspace /path/to/isolated-clone \
  --staging /path/to/persistent-rsp-evidence/icann2012-rsp-mapping/<run-id> \
  --run-id mapping-<date>-<host-label>
unset REGISTRY_HUB_RSP_MAPPING_AUTHORIZED
```

**Do not use `--force-new-run` on the first authorized run.** Before HTTP #1, a normal first run fail-closed if an active checkpoint, run-id evidence directory, mapping artifact, or page snapshots already exist — use fresh run-id/staging or explicit `--resume` / `--force-new-run` recovery.

| Flag | Purpose |
| --- | --- |
| `--resume` | Continue from `mapping-live-checkpoint.json` (validates page SHA-256 + corpus pin). **Mutually exclusive with `--force-new-run`.** |
| `--force-new-run` | **Recovery / subsequent steward run only** — archives the active `mapping-live-checkpoint.json`, starts a fresh checkpoint for `--run-id`, **preserves** prior run directories on disk. **Not for first authorized run.** Mutually exclusive with `--resume`. Does not bypass the one-run rule. |

**Sensitive artifacts:** evidence-bundle manifest, mapping-review report, and provenance summary **fail closed** if cookies, CSRF/session header material, or RSP auth env names/values would be persisted. Scrub staging before re-running offline post-steps.

**Staging layout (not committed by default):**

| Path | Content |
| --- | --- |
| `sources/index/<run-id>/page-NNNN.html` | Immutable grid HTML |
| `sources/index/<run-id>/page-NNNN.fetch.json` | Safe HTTP metadata + body SHA-256 (no cookies/CSRF) |
| `registry-2012-rsp-mapping/<run-id>/mapping.json` | Round-wide mapping artifact (`DRAFT`) |
| `mapping-live-checkpoint.json` | Non-sensitive resume state |

**Hard stops:** HTTPS `gtldresult.icann.org` only, concurrency 1, paced requests, 403/429 halt, cross-host redirect reject, pagination safety cap (~60 pages), loop/overlap/gap detection.

**CI / agent runs:** use `src/icann2012-rsp-acquisition/synthetic-replay-corpus.ts` and inject a mock fetcher — **never** call ICANN from automated tests.

## Pager live diagnostic (bounded — D2.5A-P0.3G-R1)

Not a mapping crawl. Own gate: `REGISTRY_HUB_RSP_PAGER_DIAGNOSTIC_AUTHORIZED=1`. `REGISTRY_HUB_RSP_MAPPING_AUTHORIZED` does not authorize it.

Allowed HTTP only:

1. GET the status hub (session), plus at most 5 same-origin redirects.
2. GET viewstatus page 1, plus at most 5 same-origin redirects.
3. GET the server href for logical page 2 once.
4. Follow that response's same-origin redirects, at most 5.
5. Validate the grid and stop.

Ceiling: **18** HTTP calls (`3 × (1 + 5)`). No logical page 3. No portion download. No 1,930-record crawl. Success is Displaying 36–70 of 1930, 35 parsed rows, and not an ICANN error page. A different page size is reported and the command stops. Cookie values, CSRF, and form data are not persisted.

```bash
REGISTRY_HUB_RSP_PAGER_DIAGNOSTIC_AUTHORIZED=1 \
  npm run acquire-rsp-portions -- pager-live-diagnostic
unset REGISTRY_HUB_RSP_PAGER_DIAGNOSTIC_AUTHORIZED
```

## Portion live diagnostic (one application — D2.5A-P0.4B)

Not a pilot and not a mapping crawl. Own gate: `REGISTRY_HUB_RSP_PORTION_DIAGNOSTIC_AUTHORIZED=1`. Pilot-live, mapping-live, and pager-diagnostic authorization do not grant it.

Bound to Application ID `1-1945-29108`, gtldresultAcId `170`. BOSCH is the validation row only. The command does not extract or hard-code an RSP provider name.

Allowed HTTP only, then stop:

1. GET `https://gtldresult.icann.org/applicationstatus/applicationdetails/170` (no `/application-result` prefix), plus at most 5 same-origin redirects.
2. Validate Application ID `1-1945-29108` and the official "download public portion of application" anchor. Use that server href. Do not manufacture a download URL.
3. GET that href in the same in-memory session, plus at most 5 same-origin redirects.
4. Validate the returned document: Application ID `1-1945-29108`, Question 23 present, not a status-grid hub, not an ICANN error page.

Ceiling: **12** HTTP calls (`2 × (1 + 5)`). `applicationVersionBasis` is `current_public_portion`. `retrievedAt` is stored separately. An official download is not labeled `original_submission`. Cookie and token values are not persisted.

Status-grid routes stay on `/application-result/applicationstatus`. Details and public-portion routes do not.

```bash
REGISTRY_HUB_RSP_PORTION_DIAGNOSTIC_AUTHORIZED=1 \
  npm run acquire-rsp-portions -- portion-live-diagnostic
unset REGISTRY_HUB_RSP_PORTION_DIAGNOSTIC_AUTHORIZED
```

Caps (defaults): pilot batch **25**, **250** applications/calendar day, **≥1s** between gtldresult requests, **2 MiB** max portion size. See Project plan §4.

## Limits configuration

Implemented in `src/icann2012-rsp-acquisition/constants.ts` (`RSP_ACQUISITION_LIMITS`).

## Pipeline registry

`gtldresult.icann.org` is **not** added to `src/pipeline/registry.ts` in this slice — acquisition remains a documented offline script.
