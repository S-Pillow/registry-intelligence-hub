# ICANN 2012 Reveal Day full application bundle (`icann2012-reveal-day-v1`)

Immutable offline sources for the 1,930-application Reveal Day CSV and the 26 Feb 2013 string-similarity contention PDF.

## Sources (committed bytes)

| File | Role |
| --- | --- |
| `sources/strings-1200utc-13jun12-en.csv` | Official Reveal Day application/string/applicant export (preserved via Internet Archive; live ICANN CDN path 404 as of 2026-09-19) |
| `sources/similarity-contention-26feb13-en.pdf` | Official preliminary contention-set membership (still served from `newgtlds.icann.org`) |
| `contention-sets.json` | Deterministic PDF extraction (`scripts/extract-2012-contention-sets.py`) — not inferred from identical strings |

Acquisition notes: `scripts/acquire-icann2012-reveal-day.md`

## Not in this bundle

- Post-Reveal application status, withdrawals, delegations (`gtldresult.icann.org` HTML — not scraped)
- Steward organization promotion (candidates-only / unavailable hints)
- Administrative columns beyond the normalization coverage contract (preserved on parsed payload only)
