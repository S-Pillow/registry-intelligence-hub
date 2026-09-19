# Acquire ICANN 2012 Reveal Day fixtures

Documents how `icann2012-reveal-day-v1` bytes were obtained. **No bulk-fetch legal approval is claimed** — these are public ICANN archival files stored as immutable fixtures for offline normalization.

## Application export (CSV)

| Field | Value |
| --- | --- |
| Requested URL (canonical Reveal Day page) | `https://newgtlds.icann.org/en/program-status/application-results/strings-1200utc-13jun12-en` |
| Resolved URL (2026-09-19) | `https://gtldresult.icann.org/application-result/applicationstatus` (301 from Reveal Day page) |
| Structured export (historical) | `http://newgtlds-cloudfront.icann.org/sites/default/files/reveal/strings-1200utc-13jun12-en.csv` |
| Live ICANN origin path (2026-09-19) | `https://newgtlds.icann.org/sites/default/files/reveal/strings-1200utc-13jun12-en.csv` → **404** |
| Preserved retrieval (not publisher) | `https://web.archive.org/web/20120615172359id_/http://newgtlds-cloudfront.icann.org/sites/default/files/reveal/strings-1200utc-13jun12-en.csv` |
| Source publisher | **ICANN** (2012 Reveal Day export) |
| Effective time | `2012-06-13T12:00:00.000Z` (Reveal Day publication) |
| Row count | 1,930 applications (+ header) |

Committed copy: `src/normalization/fixtures/icann2012-reveal-day-v1/sources/strings-1200utc-13jun12-en.csv`

## Contention membership (PDF)

| Field | Value |
| --- | --- |
| URL | `https://newgtlds.icann.org/sites/default/files/similarity-contention-26feb13-en.pdf` |
| HTTP status (2026-09-19) | 200 |
| Effective time | `2013-02-26` (preliminary string-similarity publication) |
| Extraction | `python3 scripts/extract-2012-contention-sets.py <pdf> contention-sets.json` |

Committed copy: `src/normalization/fixtures/icann2012-reveal-day-v1/sources/similarity-contention-26feb13-en.pdf`

## Not acquired (blockers)

- **`gtldresult.icann.org` HTML application table** — no approved structured export; HTML adapter deferred (see source inventory).
- **Live status / delegation** — not part of Reveal Day parity contract.

## Regenerate contention JSON

```bash
python3 scripts/extract-2012-contention-sets.py \
  src/normalization/fixtures/icann2012-reveal-day-v1/sources/similarity-contention-26feb13-en.pdf \
  src/normalization/fixtures/icann2012-reveal-day-v1/contention-sets.json
```

Expected extractor summary: **754** unique application memberships, **234** unique contention-set entities (ICANN publication cites **232** sets — see full-round quality report).
