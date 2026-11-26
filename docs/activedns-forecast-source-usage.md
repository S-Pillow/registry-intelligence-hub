# ActiveDNS source-usage assessment (RIH-FCAST-07B / PROD-03)

**Purpose:** Operator-facing record of published ActiveDNS terms relevant to the experimental registration forecast. **Not legal advice. Not formal legal approval.**

**Reviewed URLs (fetched 2026-11-25):**

| Document | URL | Version / date stated |
| --- | --- | --- |
| Terms and attribution | https://activedns.net/terms/ | Version 1 — 23 November 2026 |
| Domain lists | https://activedns.net/domain-lists/ | Page live as of review; lists updated monthly |

## Permission relevant to derived observations / aggregates

From Terms v1 (23 Nov 2026):

- Publicly available ActiveDNS DNS observations may be accessed, used, summarized, reproduced, and redistributed — including in research, reports, and **derivative datasets** — **provided** ActiveDNS is clearly attributed with a link to https://activedns.net/ (or a relevant result page where available).
- The page explicitly states it is **not legal advice** and that final wording should be reviewed before commercial reliance.
- Access remains subject to rate limits / fair use (access controls, not additional reuse restrictions beyond attribution).
- No warranty: passive historical observations; not exhaustive; verify important facts against DNS itself.

Domain lists page:

- Free downloadable domain lists; credit ActiveDNS when used in work/publications/tooling.
- Example credit: “Domain list provided by ActiveDNS — https://activedns.net/”.
- Snapshot files include header metadata (source URL, generated date, method).

## Minimum requested attribution

Terms v1 minimum:

> Source: ActiveDNS — https://activedns.net/

One prominent attribution per answer or dataset is sufficient.

## Snapshot / historical-data requirements

- Do not misrepresent historical observations as verified current DNS records.
- Where practical, keep observation timestamps with the data.
- Forecast UI retains snapshot date **November 7, 2026** (`2026-11-07`) and six-TLD mid-panel scope.

## Operator acceptance (production)

**Recorded on production host (private ops evidence), 2026-11-26 UTC, for RIH-FCAST-PROD-03:**

> The operator accepts public use of the attributed ActiveDNS-derived aggregate observations in Registry Intelligence Hub. The forecast is intended as a publicly available experimental information resource, not a commercial forecasting product.

This is **operator acceptance** of the attributed experimental Hub presentation. It is **not** formal legal advice, counsel memo, or a broader commercial-licensing clearance beyond that recorded decision.

Terms v1 still instruct that wording be reviewed before commercial reliance; this repository does not equate operator acceptance with counsel approval.

Private host record path (not in git):
`.data/registration-forecast/ops/operator-activedns-data-use-acceptance.txt` under the production hub root (also mirrored in the activation backup decision file).

## Does the current UI satisfy published attribution conditions?

| Requirement | Forecast UI status |
| --- | --- |
| Clear ActiveDNS attribution | Yes — methodology disclosure cites **Source: ActiveDNS — https://activedns.net/** |
| Link to https://activedns.net/ | Yes |
| Snapshot / historical context | Yes — snapshot date and mid-panel TLD list; `.com` not represented |
| No raw domain list redistribution in the product artifact | Yes — release package excludes domain lists |

## Material unresolved licensing issue?

**No blocking contradiction identified against the published Terms v1 attribution/reuse text for derived aggregate counts**, provided attribution remains visible.

**Not claimed:** independent counsel approval, warranty of fitness, or rights beyond the operator’s recorded acceptance of attributed aggregate experimental publication.
