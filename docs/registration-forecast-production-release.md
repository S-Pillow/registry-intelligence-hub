# Experimental registration forecast — production release plan (RIH-FCAST-07A)

**Status:** Source preparation only. This document must **not** be executed as an automatic deploy.

**Source commit (required):** `631b63a3b29dafcf3cd1db188c397d1e76ca683d` (plus any later merge of `feature/rih-fcast-07a-publication-prep`).

## Verified delivery architecture (read-only)

| Concern | Established pattern |
| --- | --- |
| Hosting | Manual ForgeForward VPS deploy (PM2 preferred; nginx path prefix `/tools/registry-intelligence-hub`) |
| CI deploy | None in-repo — operator-driven |
| Publication data | Gitignored under `.data/` on the host (Reveal, Market, Forecast) |
| Feature flags | Host env file (e.g. `/etc/registry-intelligence-hub/env`) + process restart conventions |
| 2026 apps | Claim actuality `REAL_SOURCE_READY` + Browser 2.x payload path (independent of forecast) |

**Gap:** Full PM2/nginx operator runbooks live outside this repository. Transfer/rsync details are ops-local.

## Accepted source pins (unchanged)

| Artifact | SHA-256 |
| --- | --- |
| FCAST-04B aggregate | `287be9f443f45c740e3a0ff3e743e82c46d8bb98e2a55b748511bace9b1d5158` |
| FCAST-05A preview | `3e60229cae3f0950948215557f5b5fed59c5de1230165babd6c00ab89cd3bc58` |
| FCAST-06 unpublished candidate | `fd439f0465bfb18daf16c3afa0b94d3114a357eb8a3044ce52249fd240fde3eb` |
| FCAST-07A staged release | `748a691d4d38fef346e56bcfbc2b084d0f1788b4f7d038b7516b631a3f3cb383` |

Unpublished candidate remains under `.data/registration-forecast/experimental-forecast-publication-candidate.json` and is **not** the live production file.

## 1. Exact source commit and release artifact

- Source tip used to stage: `631b63a3b29dafcf3cd1db188c397d1e76ca683d`
- Staged package (private, gitignored):
  - `.data/registration-forecast/staging/fcast-07a/experimental-registration-forecast-release-v1.json`
  - `.data/registration-forecast/staging/fcast-07a/release-manifest.json`
- Rebuild: `npm run forecast-stage-release -- --source-commit <full-sha>`

## 2. Promotion source and destination

| From | To |
| --- | --- |
| Staging release artifact (above) | `.data/registration-forecast/publication/experimental-registration-forecast-release-v1.json` on the production hub cwd (typically `/root/registry_hub/…`) |
| Optional override | `RIH_FORECAST_PUBLICATION_PATH` absolute or cwd-relative path |

Do **not** copy into `public/`.

## 3. Required checks before artifact replacement

1. Confirm hub source commit includes FCAST-07A loader/gate code.
2. `sha256sum` of staged artifact equals `748a691d4d38fef346e56bcfbc2b084d0f1788b4f7d038b7516b631a3f3cb383`.
3. Manifest source pins match the three accepted upstream hashes.
4. `npm run verify` (or lint/typecheck/test/build) on the deployable tree.
5. Backup any existing production forecast publication file, if present.

## 4. Backup and rollback

1. Copy the current production release file (if any) to a dated backup directory (host convention, e.g. `/root/backups/rih-forecast-…`).
2. Install the new artifact to the approved target path.
3. **Rollback:** unset `RIH_FORECAST_PUBLICATION_ENABLED` first (disables forecasts without affecting other RIH routes), optionally restore the previous artifact, then reload the process if required by host env conventions.

## 5. Production feature-gate activation

| Variable | Default | Meaning |
| --- | --- | --- |
| `RIH_FORECAST_PUBLICATION_ENABLED` | unset / not `1` | Production integrated forecast **off** |
| `RIH_FORECAST_PUBLICATION_PATH` | default publication relative path | Optional path override |
| `RIH_FORECAST_LOCAL_PREVIEW` | development-only | Must remain off in production |

Enabling the gate **without** a valid SHA-pinned release artifact fails closed (error / no catalog). Production **never** falls back to the unpublished local preview or candidate.

## 6. Pre-activation and post-activation checks

**Pre**

- Artifact hash match
- Gate still disabled
- `/forecast/wdo` returns HTTP 404 (proxy)
- Bare `/forecast` shows legacy fallback (or unavailable), not the integrated overview

**Post** (only after explicit operator enablement)

- `/forecast` shows integrated overview (shared-scale Middle comparison)
- `/forecast/wdo` → 62 / 50 / 118 / 198; Brand & contention Unknown
- One Brand string detail retains scenarios when estimated
- Missing label → HTTP 404 without forecast body
- Applicant portfolio forecast links active only for catalog labels

## 7. HTTP and application navigation tests

- Overview, search, sort, pagination
- Exact-string links from Applicant (original + replacement), Explore, Contention
- Confirm original and replacement are never conflated (e.g. `.agt` → `/forecast/agt`)

## 8. Attribution and methodology

- ActiveDNS source URL and attribution strings are embedded in the release package.
- Snapshot date, six-TLD panel, missing `.com`, common-suffix caveat, and partial application census disclosures must remain visible.
- **Commercial-use / legal review:** required before public activation. Record operator confirmation against current ActiveDNS terms; this repository does **not** claim legal approval.

## 9. Disable forecasts without affecting the rest of RIH

Unset or set `RIH_FORECAST_PUBLICATION_ENABLED` to anything other than `1`. Application, contention, market, and claim-actuality behavior remain unchanged. Detail routes return hard HTTP 404; Applicant forecast links fall back to plain text.

## 10. Remaining operator approvals

- [ ] Merge of FCAST-07A implementation branch (separate ticket)
- [ ] Deploy matching source commit to ForgeForward
- [ ] ActiveDNS commercial-use / attribution legal review
- [ ] Install release artifact on host + hash verification
- [ ] Live Applicant→Forecast click-through on production (or accepted staging with promoted 2026 apps)
- [ ] Explicit enablement of `RIH_FORECAST_PUBLICATION_ENABLED=1`
- [ ] Post-activation smoke sign-off

## Experimental methodology (operator-readable)

Measured matches count existing domains whose second-level names equal or literally end with a proposed extension string, on an ActiveDNS mid-panel snapshot of `.net`, `.org`, `.info`, `.biz`, `.app`, and `.dev` (not `.com`). Low / Middle / High estimates multiply that count by **0.8 / 1.9 / 3.2** for an approximately four-year horizon. These are experimental scenario values, not statistically validated market predictions. Common word endings can produce large match totals without establishing registration intent. Brand, withdrawn, contested, and uncertain strings remain in the inventory when measured; missing application-export details are not rejection findings.
