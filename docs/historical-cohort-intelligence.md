# Historical cohort intelligence (HIST-COHORT-1)

Route: **`/historical-cohorts`**  
Title: **2012 Applicant portfolio structure**  
Subtitle: How Applications were distributed across Applicant legal names in the 2012 round

## Product question

Was the 2012 round dominated by one-off Applicants or portfolio players, and how concentrated were Applications among the largest Applicant legal names?

## Governing grain

**Exact Applicant legal name** on each 2012 Reveal Day Application.

Do **not**:

- merge affiliates or parent companies;
- treat Applicant legal names as Organizations by name similarity;
- invent returning / new-entrant identity from name equality;
- present this page as a 2012 vs 2026 comparison.

## Denominators

| Denominator | Value |
| --- | ---: |
| Applications | 1930 |
| Applicant legal names | 1154 |

Source: committed `registry-2012-applications.payload.json` (ICANN 2012 Reveal Day export).

## Portfolio-size bands

| Band | Applicants | Applications |
| --- | ---: | ---: |
| 1 Application | 964 | 964 |
| 2–4 Applications | 154 | 379 |
| 5–9 Applications | 22 | 134 |
| 10–24 Applications | 8 | 100 |
| 25+ Applications | 6 | 353 |

Sums: 1154 Applicants · 1930 Applications.

Bands are descriptive only — larger portfolios are not labeled better, stronger, or more successful.

## One-off vs multi-Application

| Cohort | Applicants | Applications |
| --- | ---: | ---: |
| One-off (1 Application) | 964 (83.54%) | 964 (49.95%) |
| Multi-Application (≥2) | 190 (16.46%) | 966 (50.05%) |

Primary story: most Applicant legal names submitted one Application, but multi-Application Applicants collectively accounted for about half of all Applications.

## Concentration method

Top-N Application totals at Applicant legal-name grain, denominator **1930**:

| Top N | Applications | Share |
| --- | ---: | ---: |
| 5 | 327 | 16.94% |
| 10 | 407 | 21.09% |
| 25 | 530 | 27.46% |
| 50 | 643 | 33.32% |

Copy must qualify this as **Application concentration by Applicant legal name**, not economic market share.

## Top-N ranking method

1. Count Applications per trimmed Applicant legal name (`applicant-legal-name-count/1.0.0`).
2. Sort by Application count descending.
3. Break ties A→Z by Applicant legal name.
4. Surface a bounded largest-portfolio table (includes the tied 26-Application rows for Afilias Limited and United TLD Holdco Ltd.).

**Afilias Limited remains 26** — do not collapse into a broader Afilias Organization total.

## Exclusions (v1)

Not first-class on this page:

- Community / Geographic leaderboards
- Exact-repeat competition leaderboard
- Preliminary contention leaderboard
- Historical Organization cohort as round coverage
- Cross-round Applicant / concentration deltas
- IDN as a primary historical workflow (deferred)

Exact-repeat and preliminary contention are nearly coextensive in the 2012 fixture; both remain available for later tickets but are not peer leaderboards here.

## Cross-round non-comparability

CROSS-ROUND-STRUCT-1 blocked dimensions remain blocked, including multi-Application concentration and Applicant legal entities. This page does **not** unlock those deltas.

Entry from `/cross-round` is a 2012-only drill-down, not another comparison metric.

## Performance architecture

- Server loads the committed 2012 fixture.
- `buildHistoricalApplicantPortfolioCohorts` derives aggregates + top-N only.
- Client payload excludes the 1930-row Application corpus.
- Historical Explore continues to hydrate the full document when opened; the cohort page does not.

## Drill-down behavior

Largest-portfolio rows link to:

`/explore?dataset=2012-historical&entity=applications&q=<Applicant legal name>`

No new 2012 Applicant Profile. No automatic link to 2026 Applicant Profiles from name equality.

## Provenance (business UI)

Expose:

- 2012 Reveal Day source label
- Applicant legal-name grain
- 1930 / 1154 denominators
- methodology limitations

Do not expose corpus hashes, internal schema IDs, or fixture filenames on the normal business surface.

## Entry points

- Command Center — “Explore 2012 Applicant structure” (near 2012 vs 2026 CTA; also from historical structure)
- `/cross-round` — “Explore 2012 Applicant structure” under Participation shape

## Code

- Derivation: `src/lib/historical-cohort-intelligence.ts`
- Page: `src/app/historical-cohorts/page.tsx`
- UI: `src/components/registry/historical-cohort-content.tsx`
