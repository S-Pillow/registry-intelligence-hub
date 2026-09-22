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
npm run acquire-rsp-portions -- preflight-report --operation pilot-live
```

Dry-run prints exact URLs that **would** be fetched, staging paths, limits, and join ids. Preflight reports artifact SHA-256, purpose/approval, corpus hash, **`artifactMappedCount`** (rows in the JSON artifact only), **`pilotExpectedCount` / `pilotResolvedCount` / `pilotUnresolvedCount`** (25-app manifest join coverage), auth state, and expected HTTP volume **without network I/O**.

## Mapping artifact eligibility (`registry-2012-rsp-mapping/1.0.0`)

| Field | Values | Live rule |
| --- | --- | --- |
| `artifactPurpose` | `TEST_ONLY`, `EVIDENCE` | Pilot-live requires `EVIDENCE` |
| `approvalState` | `DRAFT`, `APPROVED` | Pilot-live requires `APPROVED` |

Committed `pilot-gtldresult-mapping.json` is **`TEST_ONLY` / `DRAFT`** (probe row only). Synthetic round-wide rows belong in `fixtures/synthetic/` or test generators — never as approved evidence.

## Live pilot (after written approval only)

**Do not run in CI or during implementation.** Requires steward **`EVIDENCE` + `APPROVED`** mapping with referential snapshot rows. Legacy `REGISTRY_HUB_RSP_ACQUISITION_AUTHORIZED` **does not** authorize HTTP.

```bash
REGISTRY_HUB_RSP_PILOT_LIVE_AUTHORIZED=1 \
  npm run acquire-rsp-portions -- pilot-live \
  --staging /var/tmp/icann2012-rsp-staging \
  --approved-mapping /path/to/steward-approved-mapping.json
```

## Mapping live

**Not implemented.** `mapping-live` exits with `MAPPING_LIVE_NOT_IMPLEMENTED` (zero HTTP). When implemented, it will require **`REGISTRY_HUB_RSP_MAPPING_AUTHORIZED=1`** (separate from pilot-live). Do not treat it as a network command until the grid crawl exists.

Caps (defaults): pilot batch **25**, **250** applications/calendar day, **≥1s** between gtldresult requests, **2 MiB** max portion size. See Project plan §4.

## Limits configuration

Implemented in `src/icann2012-rsp-acquisition/constants.ts` (`RSP_ACQUISITION_LIMITS`).

## Pipeline registry

`gtldresult.icann.org` is **not** added to `src/pipeline/registry.ts` in this slice — acquisition remains a documented offline script.
