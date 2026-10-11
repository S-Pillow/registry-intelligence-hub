# Change Intelligence (CHANGE-INTEL-1 / 1B)

Deterministic public-source change monitoring for the 2026 round, oriented to GoDaddy Registry impact.

## Monitored sources

| Source | Role |
| --- | --- |
| ICANN APS Application CSV (official Download CSV export) | Canonical Application universe (non-replacement rows) |
| ICANN Reveal Day contention CSV | Official initial contention memberships (not exact-string grouping) |

**Not monitored in v1:** evaluated-RSP list (used only as context), official APS Statistics HTML (deferred).

## Current acquisition contract

### Applications

Public surface: [APS Applications](https://newgtldprogram-aps.icann.org/applications) (“Download CSV”).

Change Intelligence does **not** scrape the HTML table. It uses the same official machine-readable export the UI calls:

1. `GET https://newgtldprogram-aps.icann.org/api/config` → read `restBackendUrl`
2. `POST {restBackendUrl}/applications/export/csv` with the empty-filter APS search body  
   (`searchAndFilter: {}`, sort `primaryString ASC`, pagination defaults)
3. Validate success, non-empty body, CSV (reject HTML/error JSON), then run the accepted APS Application CSV parser

A legacy bare `GET /aps/applications/export/csv` is **not** authoritative (returns HTML 404).

### Contention

Public link published on the APS Applications page / program materials:

`https://newgtldprogram.icann.org/en/application-rounds/round2/reveal-day-contention-sets.csv`

Acquisition follows redirects to the durable file URL, requires a non-empty CSV body, and runs the accepted contention CSV parser. An unfollowed 301 with an empty body is treated as failure (not a zero-row CSV).

### Validation / hashes

- Raw `contentSha256` = SHA-256 of downloaded bytes
- Per-source `semanticHash` = canonical Application / contention membership hashes (not the raw bytes)
- Observation-level semantic hashes remain the diff pins

## Runtime state

Root: `.data/change-intel/` (gitignored).

- `observations/` — immutable observations
- `diffs/` — immutable diffs
- `index.json` — pointers / last-checked / last meaningful change
- `latest-feed.json` — browser-readable feed

Does **not** mutate `.data/reveal-2026/` or claim/contention actuality.

## Commands

```bash
npm run change-intel:bootstrap
npm run change-intel:refresh -- --dry-run
npm run change-intel:refresh -- --mode file
npm run change-intel:refresh
```

- Bootstrap reads accepted local browser/publication artifacts.
- Refresh acquires Application + contention sources, validates, diffs, derives impact.
- Dry-run computes without writing state.
- Failed acquisition/validation leaves prior good state active (nonzero exit).

## Product rules

- `/changes` never calls ICANN on page load — local feed only.
- No browser button to refresh sources.
- Distinguish **last checked** vs **last meaningful change**.
- Application now/no-longer-present wording does not claim “new submission” / “withdrawn”.
- Impact bands: `GODADDY_DIRECT` → `GODADDY_CONTENTION` → `RSP_RESEARCH_RELEVANT` → `MARKET_CHANGE`.
- RSP posture is public-signal context only — selected RSP is never inferred.

## Production initialization

After merge/deploy of application code, operators must explicitly:

1. bootstrap production monitoring (once);
2. run one bounded live refresh;
3. verify `/changes`;
4. only then authorize scheduling (outside Next.js).

Acquisition-only repairs (CHANGE-INTEL-1B) must not re-bootstrap an already-initialized production monitor.
