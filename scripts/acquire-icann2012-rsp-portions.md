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
```

Dry-run prints exact URLs that **would** be fetched, staging paths, limits, and join ids.

## Live pilot (after written approval only)

**Do not run in CI or during implementation.** Single documented command:

```bash
REGISTRY_HUB_RSP_ACQUISITION_AUTHORIZED=1 \
  npm run acquire-rsp-portions -- pilot \
  --staging /var/tmp/icann2012-rsp-staging
```

Caps (defaults): pilot batch **25**, **250** applications/calendar day, **≥1s** between gtldresult requests, **2 MiB** max portion size. See Project plan §4.

## Limits configuration

Implemented in `src/icann2012-rsp-acquisition/constants.ts` (`RSP_ACQUISITION_LIMITS`).

## Pipeline registry

`gtldresult.icann.org` is **not** added to `src/pipeline/registry.ts` in this slice — acquisition remains a documented offline script.
