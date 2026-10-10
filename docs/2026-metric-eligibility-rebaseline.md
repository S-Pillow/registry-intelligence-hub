# 2026 metric eligibility rebaseline (RIH-METRIC-ELIGIBILITY-2)

Catalog version: `metric-eligibility-catalog/2.0.0`

Live production ready/partial/blocked summary after Reveal Day promotion: [`docs/2026-reveal-day-production-closeout.md`](./2026-reveal-day-production-closeout.md).

## Publication actuality ≠ metric eligibility

| Concept | Answers |
| --- | --- |
| **Publication actuality** (binary `NOT_PUBLISHED` \| `REAL_SOURCE_READY`) | Is the authoritative Application publication real and approved? |
| **Metric eligibility** | May this specific claim be made (grain, channel, coverage, cross-round)? |

Application actuality alone must **not** elevate row-derived complete-coverage metrics (e.g. `unique-applied-strings`) merely because the snapshot is real under partial coverage (1614/1615).

Preferred model: keep binary Application actuality. Per-metric gates live on catalog fields:

- `sourceChannel`
- `coverageRequirement`
- `crossRoundStatus`
- `disclosureKeys`
- `advancesWithApplicationActuality`
- `advancesWithContentionActuality`

## Official aggregate channel

Headline orientation counts bind to **official aggregates**, not `applications.length`:

| Metric id | Official fact (Reveal Day) | Channel |
| --- | --- | --- |
| `application-count` | 1615 | `OFFICIAL_AGGREGATE` |
| `applicant-count` | 481 | `OFFICIAL_AGGREGATE` |
| `idn-applications` | 21 | `OFFICIAL_AGGREGATE` |
| `brand-applications` | 333 | `OFFICIAL_AGGREGATE` |
| `community-applications` | 16 | `OFFICIAL_AGGREGATE` |
| `geographic-applications` | 15 (self-identified) | `OFFICIAL_AGGREGATE` |
| `variant-applications` | 9 | `OFFICIAL_AGGREGATE` |

**Boundary (this ticket):** catalog semantics + resolver contracts are implemented. Runtime binding of official aggregate **values** into browser presentation is deferred to the promotion/browser integration ticket. Do not hardcode 1615/481 into generic eligibility logic; values come from publication/manifest evidence when bound.

## Partial row coverage

| Metric id | Grain | Notes |
| --- | --- | --- |
| `observed-application-records` | observed Applications | 1614 — coverage only, never round total |
| `observed-applicant-legal-names` | observed legal names | 480 — not official 481 |
| `unique-applied-strings` | exact applied-for string | `BLOCKED_COVERAGE` for complete/headline/cross-round; `advancesWithApplicationActuality: false` |
| `exact-applied-string-competition` | exact-string groups | Partial / blocked for round-wide claims; never official contention |
| `application-by-region-observed` | application × region | Do not mix with applicant-by-region |

## Contention source independence

Official contention metrics require **contention sidecar** actuality + pin fields (`sidecarContentHash`, `applicationPublicationPinHash`). Application publication actuality alone is insufficient.

| Metric id | Official fact | Channel |
| --- | --- | --- |
| `initial-contention-sets` | 263 | `OFFICIAL_CONTENTION` |
| `initial-contention-memberships` | 891 | `OFFICIAL_CONTENTION` |
| `contention-member-analysis` | member/set analyses | `OFFICIAL_CONTENTION` (portfolio shares using 1614 remain partial) |

Minimum contention actuality contract (`ContentionActualityState`) is defined for later promotion binding — not a second independent promotion framework.

## Cross-round eligibility matrix

| Metric | Cross-round status |
| --- | --- |
| Applications | `READY_WITH_LIMITATION` |
| Unique strings | `BLOCKED_COVERAGE` |
| IDN | `READY_WITH_LIMITATION` |
| Brand | `NOT_APPLICABLE` (2026 only) |
| Community | `BLOCKED_SEMANTICS` |
| Geographic | `BLOCKED_SEMANTICS` |
| Applicant legal-name concentration | `BLOCKED_COVERAGE` / semantic caution |
| Region | `BLOCKED_SEMANTICS` |
| Exact-string | `BLOCKED_COVERAGE` |
| Official contention vs 2012 234/232 | `BLOCKED_METHOD` / `BLOCKED_SEMANTICS` |
| Organization portfolios | `BLOCKED_SOURCE` |
| Returning / new | `BLOCKED_SOURCE` |

Do not unlock because values happen to exist on both sides.

## Blocked capabilities

- Resolved organizations / portfolio round-wide — `BLOCKED_SOURCE` / derived requires review
- Returning / new — `BLOCKED_SOURCE` / `BLOCKED_METHOD`
- Category / sector — `BLOCKED_SOURCE` / not applicable
- Unique strings as complete round total under partial coverage
- Exact-string as official contention

## Disclosure metadata

Eligibility output carries machine-readable `disclosureKeys` for later browser binding (presentation owns copy). Examples:

- Applications 1615 → `official-aggregate`, `reveal-day-as-of`, `not-applications-length`
- Observed 1614 → `partial-coverage`, `not-round-total`
- Geographic 15 → `self-identified-geographic`
- Contention 263/891 → `initial-reveal-day-contention`, `may-change-later`
- Replacements → `relationship-grain`, `not-extra-applications`

## Out of scope (this ticket)

No browser payload converter, Explore/Search/Command Center/Compare/Saved/Briefings value binding, claim-actuality enum expansion, promotion, deployment, or org/category/returning inference.
