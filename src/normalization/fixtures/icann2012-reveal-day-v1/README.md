# ICANN 2012 Reveal Day full application bundle (`icann2012-reveal-day-v1`)

Immutable offline sources for the 1,930-application Reveal Day CSV and the 26 Feb 2013 string-similarity contention PDF.

## Sources (committed bytes)

| File | Role |
| --- | --- |
| `sources/strings-1200utc-13jun12-en.csv` | **Source:** ICANN 2012 Reveal Day export · **Preserved from:** Internet Archive copy · **Original ICANN URL** retained · live origin **404** (2026-09-19) · hash in `raw-snapshots.json` |
| `application-taxonomy.json` | Offline `registry-market-taxonomy/1.0` assignments (`scripts/generate-2012-taxonomy-fixture.ts`) |
| `sources/similarity-contention-26feb13-en.pdf` | Official preliminary contention-set membership (still served from `newgtlds.icann.org`) |
| `contention-sets.json` | Deterministic PDF extraction (`scripts/extract-2012-contention-sets.py`) — not inferred from identical strings |

Acquisition notes: `scripts/acquire-icann2012-reveal-day.md`

## Not in this bundle

- Post-Reveal application status, withdrawals, delegations (`gtldresult.icann.org` HTML — not scraped)
- Full-round steward organization promotion — **partial** via `organization-promotions.json` (19 targeted ops; see Project docs `2012-organization-promotion.md`)
- Administrative columns beyond the normalization coverage contract (preserved on parsed payload only)
