# Browser Publication 2.x payload contract (RIH-BROWSER-2X-1)

## Versions

| Payload | Schema id | Source |
| --- | --- | --- |
| 1.x (unchanged) | `registry-browser-applications/1.0.0` | Rehearsal / 1.1 publication projection |
| 2.x (new) | `registry-browser-applications/2.0.0` | `registry-2026-publication/2.0.0` |

Dispatch is explicit. Publication 2.0.0 is **never** down-converted into a fake 1.1 browser document.

## 2.0 → 2.x mapping

Source-backed Application fields only:

- `applicationId`, applicant legal name, country, region
- application status / processing stage / APS application type
- designation + label booleans
- `appliedString` (+ optional unicode / tldVariants)
- optional `replacementString` relationship

## Unsupported / removed fields

Never present on 2.x Application records:

- `organization`
- `category`
- `returning`
- `confidence`
- legacy `contentionSet` / flat `string` / `idn` / `replacement` aliases

Missing fields remain absent — not reconstructed from Applicant Name or Brand/Community/Geographic.

## Coverage metadata / disclosures

Document-level counts stay separate:

- `officialApplications` (official aggregate)
- `observedApplicationRecords` (RIH normalized rows)
- `officialApplicants`

Disclosure keys include `not-official-round-total`, `observed-application-records-partial`, `known-excluded-coverage-only`.

Local Search/Explore result counts mean **matching RIH observed records**, never the official round total.

## WDO treatment

Known-excluded descriptor (e.g. `WDO2627T-T45217`) lives in document coverage metadata only. It is **not** an Application row.

## Optional contention overlay

Official contention membership is joined as a separate overlay (`officialContention` on projected rows + document `contentionOverlay`).

- Valid pin → overlay `available`; terminology `official-initial-contention`
- Absent / invalid pin → Application projection still succeeds; contention unavailable
- Never fall back to exact-string competition

## 1.1 compatibility

`buildBrowserApplicationPayloadFromPublication` remains the 1.1 path.

## Activation

See `docs/2026-publication-2x-activation.md` (RIH-ACTIVATION-2X-1).  
**Live production identities / closeout:** `docs/2026-reveal-day-production-closeout.md`.

- Generate: `build-browser-payload-2x` → `.data/reveal-2026/browser/applications-browser-v2.json`
- Activate only when claim actuality is `REAL_SOURCE_READY` **and** pins match
- `REAL` + missing/mismatched payload **fails closed** (no rehearsal fallback)
- Saved/Briefings remain explicitly gated for 2.x
