# Change Intelligence (CHANGE-INTEL-1)

Deterministic public-source change monitoring for the 2026 round, oriented to GoDaddy Registry impact.

## Monitored sources

| Source | Role |
| --- | --- |
| ICANN APS Application CSV | Canonical Application universe (non-replacement rows) |
| ICANN Reveal Day contention CSV | Official initial contention memberships (not exact-string grouping) |

**Not monitored in v1:** evaluated-RSP list (used only as context), official APS Statistics HTML (deferred — no reusable fetch path).

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

1. bootstrap production monitoring;
2. run one bounded live refresh;
3. verify `/changes`;
4. only then authorize scheduling (outside Next.js).
