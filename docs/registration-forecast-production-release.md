# Experimental registration forecast — production release record

**Status:** **ACCEPTED PRODUCTION RELEASE** (public forecast publication enabled).
Completed **2026-11-26 UTC** (Builder-observed production activation handoff, RIH-FCAST-PROD-02 / PROD-03).

This document is the durable release record and operational reference. Sections marked **Historical preparation** retain the pre-activation procedure; they are not a claim that activation is still pending.

## Current production release facts

| Fact | Value |
| --- | --- |
| Production source (detached) | `360021d720dd9af0ba2a57d78325714dfcd5d3c5` |
| Production BUILD_ID | `RIi1jQHCv9i0QKF60LhuY` |
| Release artifact SHA-256 | `748a691d4d38fef346e56bcfbc2b084d0f1788b4f7d038b7516b631a3f3cb383` |
| Publication gate | **`RIH_FORECAST_PUBLICATION_ENABLED=1`** (live) |
| Local preview gate | Off (`RIH_FORECAST_LOCAL_PREVIEW` not enabled) |
| Artifact path (host) | `.data/registration-forecast/publication/experimental-registration-forecast-release-v1.json` |
| Public overview | https://forgeforward.app/tools/registry-intelligence-hub/forecast |
| PM2 application | `registry-intelligence-hub` only (Node **22.23.2**; persisted via host ecosystem + `env_file` + `pm2 save`) |
| ActiveDNS aggregate use | **Operator-accepted** for public attributed experimental presentation (see `docs/activedns-forecast-source-usage.md`) |

### Accepted live HTTP matrix (Builder-observed, 2026-11-26 UTC)

| Route | Result |
| --- | --- |
| `/forecast` | **200** integrated overview |
| `/forecast/wdo` | **200** |
| `/forecast/abion` | **200** |
| `/forecast/zzznolabel` | **404** |
| `/forecast/preview` | **307** to overview |
| Command Center, Explore, Contention, Market, Applicant | **200** |

### Accepted WDO sample

- Measured matches: **62**
- Low / Middle / High: **50 / 118 / 198**
- Brand designation: **Unknown**
- Contested: **Unknown**

### Accepted Applicant navigation sample

Salesforce Applicant profile: **12** `/forecast/…` links (including `.force` and `.salesforce`) and **eight** separate Application details links.

### Release checklist (from Builder handoff evidence)

- [x] 07B merged / deployable SHA recorded (`360021d…`)
- [x] Hub source deployed via existing ForgeForward mechanism (PROD-02)
- [x] ActiveDNS operator acceptance recorded (private host evidence; see source-usage doc)
- [x] Release artifact installed + SHA verified
- [x] Pre-activation HTTP matrix passed
- [x] Gate enabled deliberately
- [x] Post-activation browser + HTTP matrix passed (Builder-observed)
- [x] Live Applicant→Forecast acceptance (Salesforce sample)
- [ ] Rollback **drill** executed on production — **not performed** (procedure available; activation rollback not required)

### Explicit qualifications

- A brief PM2 startup disruption occurred during activation recovery and was restored; final state was healthy with publication enabled.
- Corrupt-artifact HTTP **503** fail-closed behavior was verified in **non-public** tests; it was **not** destructively retested against the live production artifact.
- Activation rollback procedures are available on the host; an activation rollback was **not** executed.
- Reboot persistence is configured (`pm2 save` / `pm2-root`); a host reboot was **not** performed to prove resurrect.
- Live production verification in the release handoff is **Builder-observed**, not independently re-observed by a separate Prompt Agent pass.
- Do **not** treat an unexecuted rollback drill as passed.

## Verified delivery architecture (read-only)

| Concern | Established in-repo / host pattern |
| --- | --- |
| Hosting | Manual ForgeForward VPS deploy; PM2; nginx path prefix `/tools/registry-intelligence-hub` |
| Bind | `127.0.0.1:43123` |
| CI deploy | **None** in-repo — operator-driven |
| Publication data | Gitignored under `.data/` on the hub host |
| Feature flags | Host `env_file` + ecosystem runtime + `pm2 save` |
| 2026 apps | Claim actuality + Browser 2.x payload (independent of forecast) |

**External runbook gap:** Full PM2/nginx/ToolsPage operating procedures live outside this repository (operator project docs).

## Accepted artifact pins (unchanged — do not regenerate)

| Artifact | SHA-256 |
| --- | --- |
| FCAST-04B aggregate | `287be9f443f45c740e3a0ff3e743e82c46d8bb98e2a55b748511bace9b1d5158` |
| FCAST-05A preview | `3e60229cae3f0950948215557f5b5fed59c5de1230165babd6c00ab89cd3bc58` |
| FCAST-06 unpublished candidate | `fd439f0465bfb18daf16c3afa0b94d3114a357eb8a3044ce52249fd240fde3eb` |
| FCAST-07A / production release | `748a691d4d38fef346e56bcfbc2b084d0f1788b4f7d038b7516b631a3f3cb383` |

---

## Historical preparation — operational reference

The following sections preserve the pre-activation procedure used for PROD-02/03. They describe how to deploy/activate or disable; they do **not** imply the forecast is unpublished.

### H1. Exact Git commit for deployment

1. Confirm authorized tip (current: `360021d720dd9af0ba2a57d78325714dfcd5d3c5`).
2. Record full SHA: `git rev-parse HEAD`.
3. Deploy that SHA via the existing Hub source deploy path (no forecast-specific CI).

### H2. PM2/nginx deployment mechanism

- Same ForgeForward Hub deploy path already used for RIH.
- Executable host steps remain in the external ForgeForward/RIH operations runbook.

### H3. Release-artifact source and destination

| From (private staging) | To (host publication path) |
| --- | --- |
| `.data/registration-forecast/staging/fcast-07a/experimental-registration-forecast-release-v1.json` | `.data/registration-forecast/publication/experimental-registration-forecast-release-v1.json` under the production hub cwd |
| Optional | `RIH_FORECAST_PUBLICATION_PATH` override |

Never install into `public/`.

### H4. Artifact SHA verification before installation

```bash
sha256sum experimental-registration-forecast-release-v1.json
# must equal 748a691d4d38fef346e56bcfbc2b084d0f1788b4f7d038b7516b631a3f3cb383
```

Also confirm upstream pins in the accompanying `release-manifest.json`.

### H5. Existing production backup

Copy any existing production forecast publication file to a dated host backup directory (prior Hub practice: `/root/backups/rih-…`).

### H6. Feature flag and process restart requirements

| Variable | Default when unpublished | Activation value |
| --- | --- | --- |
| `RIH_FORECAST_PUBLICATION_ENABLED` | unset / not `1` | `1` **only after** artifact install + hash verify |
| `RIH_FORECAST_PUBLICATION_PATH` | default publication relative path | set only if not using default path |
| `RIH_FORECAST_LOCAL_PREVIEW` | must remain unset/off in production | development-only |

Reload/restart **only** `registry-intelligence-hub` as required by host env conventions.

### H7. Production pre-activation checks

- Deployed Git SHA matches the authorized tip
- Gate still **disabled**
- Detail/preview routes return HTTP 404 when gate off
- Overview returns legacy fallback when gate off
- No production-facing “staging” copy in the codebase tip

### H8. Activation sequence

1. Install SHA-verified release artifact to approved destination
2. Verify on-disk SHA again
3. Set `RIH_FORECAST_PUBLICATION_ENABLED=1` via the verified host PM2 configuration mechanism
4. Reload Hub process (`pm2` RIH-only)
5. Run post-activation checks

### H9. Post-activation verification expectations

| Check | Expect |
| --- | --- |
| Overview | HTTP 200; heading “Experimental Registration Forecast — 2026”; shared Middle comparison |
| `/forecast/wdo` | HTTP 200; 62 / 50 / 118 / 198; Brand & contention Unknown |
| Nonexistent label | **HTTP 404** plain body (not soft-200) |
| Missing/corrupt artifact with gate on | **HTTP 503** (fail closed; non-public proof accepted for this release) |
| `/forecast/preview` | Controlled **307** to overview |
| Attribution | Visible “Source: ActiveDNS — https://activedns.net/”; snapshot date retained |
| Copy | No “Controlled publication staging” / internal release jargon |

### H10. Applicant click-through

Original and selected strings open exact `/forecast/{label}` destinations; application-details remains separate.

### H11. Immediate disable and rollback

1. Disable `RIH_FORECAST_PUBLICATION_ENABLED` (forecasts off; other RIH routes unaffected)
2. Optionally restore prior artifact from backup
3. Reload RIH process if required
4. Confirm detail routes return HTTP 404

Source-code rollback is not automatically required for a forecast-only disable.

## Source-usage pointer

`docs/activedns-forecast-source-usage.md`

## Experimental methodology (operator-readable)

Measured matches count existing domains whose second-level names equal or literally end with a proposed extension string, on an ActiveDNS mid-panel snapshot of `.net`, `.org`, `.info`, `.biz`, `.app`, and `.dev` (not `.com`). Low / Middle / High estimates multiply that count by **0.8 / 1.9 / 3.2** for an approximately four-year horizon. These are experimental scenario values, not statistically validated market predictions.
