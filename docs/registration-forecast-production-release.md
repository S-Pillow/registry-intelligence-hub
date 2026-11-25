# Experimental registration forecast — production release plan

**Status:** Release-plan preparation only. **Do not execute** this document as an automatic deploy or activation.

**Intended deployable source tip:** the merged tip of `feature/rih-fcast-07b-release-readiness` after operator merge authorization (branch builds on `main` @ `6d5f049d013ac390c4768dba71415112496df9e6`). Record the exact post-merge SHA in the operator sign-off checklist before install.

## Verified delivery architecture (read-only)

| Concern | Established in-repo pattern |
| --- | --- |
| Hosting | Manual ForgeForward VPS deploy; PM2 preferred (`deploy/ecosystem.config.cjs.example`); nginx path prefix `/tools/registry-intelligence-hub` |
| Bind | Example local bind `127.0.0.1:43123` (ops may differ) |
| CI deploy | **None** in-repo — operator-driven |
| Publication data | Gitignored under `.data/` on the hub host |
| Feature flags | Host env file + process restart per host conventions |
| 2026 apps | Claim actuality + Browser 2.x payload (independent of forecast) |

**External runbook gap:** Full PM2/nginx/ToolsPage operating procedures live outside this repository (operator project docs). Do not invent host-specific commands here; follow the established ForgeForward Hub deploy convention used for prior Reveal/Market releases.

## Accepted artifact pins (unchanged — do not regenerate)

| Artifact | SHA-256 |
| --- | --- |
| FCAST-04B aggregate | `287be9f443f45c740e3a0ff3e743e82c46d8bb98e2a55b748511bace9b1d5158` |
| FCAST-05A preview | `3e60229cae3f0950948215557f5b5fed59c5de1230165babd6c00ab89cd3bc58` |
| FCAST-06 unpublished candidate | `fd439f0465bfb18daf16c3afa0b94d3114a357eb8a3044ce52249fd240fde3eb` |
| FCAST-07A staged release | `748a691d4d38fef346e56bcfbc2b084d0f1788b4f7d038b7516b631a3f3cb383` |

## 1. Exact Git commit intended for deployment

1. Merge the authorized 07B branch (or confirm `main` already contains it).
2. Record full SHA: `git rev-parse HEAD`.
3. Deploy **that** SHA via the existing Hub source deploy path (no forecast-specific CI).

## 2. Verified PM2/nginx deployment mechanism

- Use the same ForgeForward Hub deploy path already used for RIH (PM2 ecosystem example in-repo; nginx prefixes the hub `basePath`).
- Executable host steps are in the **external** ForgeForward/RIH operations runbook — identify and follow that document; this file does not invent `pm2 restart` host names.

## 3. Release-artifact source and destination

| From (private staging) | To (host publication path) |
| --- | --- |
| `.data/registration-forecast/staging/fcast-07a/experimental-registration-forecast-release-v1.json` | `.data/registration-forecast/publication/experimental-registration-forecast-release-v1.json` under the production hub cwd |
| Optional | `RIH_FORECAST_PUBLICATION_PATH` override |

Never install into `public/`.

## 4. Artifact SHA verification before installation

```bash
sha256sum experimental-registration-forecast-release-v1.json
# must equal 748a691d4d38fef346e56bcfbc2b084d0f1788b4f7d038b7516b631a3f3cb383
```

Also confirm upstream pins in the accompanying `release-manifest.json`.

## 5. Existing production backup

Copy any existing production forecast publication file to a dated host backup directory (prior Hub practice: `/root/backups/rih-…` style locations used for Reveal/Market — follow local convention).

## 6. Feature flag and process restart requirements

| Variable | Production default | Activation value |
| --- | --- | --- |
| `RIH_FORECAST_PUBLICATION_ENABLED` | unset / not `1` | `1` **only after** artifact install + hash verify |
| `RIH_FORECAST_PUBLICATION_PATH` | default publication relative path | set only if not using default path |
| `RIH_FORECAST_LOCAL_PREVIEW` | must remain unset/off in production | development-only |

Reload/restart the Hub process only as required by the host env-file convention (external runbook).

## 7. Production pre-activation checks

- Deployed Git SHA matches the authorized tip
- Gate still **disabled**
- `GET /tools/registry-intelligence-hub/forecast/wdo` → **HTTP 404**
- `GET …/forecast/preview` → **HTTP 404**
- `GET …/forecast` → legacy fallback (not integrated overview)
- No production-facing “staging” copy in the codebase tip

## 8. Activation sequence

1. Install SHA-verified release artifact to approved destination  
2. Verify on-disk SHA again  
3. Set `RIH_FORECAST_PUBLICATION_ENABLED=1`  
4. Reload Hub process per host convention  
5. Run post-activation checks (§9–10)

## 9. Post-activation browser and HTTP verification

| Check | Expect |
| --- | --- |
| Overview | HTTP 200; heading “Experimental Registration Forecast — 2026”; shared Middle comparison |
| `/forecast/wdo` | HTTP 200; 62 / 50 / 118 / 198; Brand & contention Unknown |
| Nonexistent label | **HTTP 404** plain body (not soft-200) |
| Missing/corrupt artifact with gate on | **HTTP 503** (fail closed) |
| `/forecast/preview` | Controlled **307** to overview |
| Attribution | Visible “Source: ActiveDNS — https://activedns.net/”; snapshot date retained |
| Copy | No “Controlled publication staging” / internal release jargon |

## 10. Applicant click-through acceptance

On production (or accepted promoted-2026 environment): original and selected strings open exact `/forecast/{label}` destinations; application-details remains separate; missing forecasts are not dead links.

Builder staging evidence ≠ live production acceptance.

## 11. Immediate disable and rollback

1. Unset / disable `RIH_FORECAST_PUBLICATION_ENABLED` (forecasts off; other RIH routes unaffected)  
2. Optionally restore prior artifact from backup  
3. Reload process if required  
4. Confirm detail routes return HTTP 404

## 12. Required operator sign-off

- [ ] 07B merged / deployable SHA recorded  
- [ ] Hub source deployed via existing ForgeForward mechanism  
- [ ] ActiveDNS commercial/compliance sign-off recorded (see `docs/activedns-forecast-source-usage.md`)  
- [ ] Release artifact installed + SHA verified  
- [ ] Pre-activation HTTP matrix passed  
- [ ] Gate enabled deliberately  
- [ ] Post-activation browser + HTTP matrix passed  
- [ ] Live Applicant→Forecast acceptance  
- [ ] Rollback drill understood  

## Source-usage pointer

`docs/activedns-forecast-source-usage.md`

## Experimental methodology (operator-readable)

Measured matches count existing domains whose second-level names equal or literally end with a proposed extension string, on an ActiveDNS mid-panel snapshot of `.net`, `.org`, `.info`, `.biz`, `.app`, and `.dev` (not `.com`). Low / Middle / High estimates multiply that count by **0.8 / 1.9 / 3.2** for an approximately four-year horizon. These are experimental scenario values, not statistically validated market predictions.
