# Returning + portfolio-change participation intelligence (RETURNING-NEW-1)

Versioned sidecar: **`cross-round-participation-intelligence/1.0.0`**

Derived intelligence from **steward-confirmed** cross-round Organization identities only.

## Returning semantics

An Organization is a **confirmed returning Organization** only when:

1. its 2012 Organization identity is CONFIRMED;
2. its 2026 Organization identity is CONFIRMED;
3. their cross-round identity relationship is steward-approved CONFIRMED;
4. relationship semantics support continuity (`SAME_ORGANIZATION`, `RENAMED_ENTITY`, or `CONTINUOUS_PARENT_IDENTITY`).

Current confirmed returning Organizations:

| Organization | 2012 Apps | 2026 Apps | Portfolio change |
| --- | --- | --- | --- |
| Microsoft Corporation | 11 | 2 | CONTRACTED |
| Google (Charleston Road Registry Inc.) | 101 | 39 | CONTRACTED |

## Why confirmed identity is required

Name similarity, brand match, RSP sharing, or today’s corporate group membership do **not** establish returning status. Only steward-approved cross-round continuity does.

## Unmatched ≠ NEW

The 2012 confirmed Organization universe is partial (16 Organizations / 466 Applications). The 2026 confirmed universe is also partial (14 / 669).

Therefore:

- UNMATCHED ≠ NEW  
- CANDIDATE ≠ NEW  
- AMBIGUOUS ≠ NEW  
- REJECTED continuity ≠ necessarily NEW  

**New Organization** metrics remain `BLOCKED_SOURCE`. Unavailable/blocked is not zero. Do not publish `new = 10` from the unmatched set.

## Portfolio-change semantics

For a steward-confirmed same Organization, classify by absolute Application-count change:

| Rule | Classification |
| --- | --- |
| 2026 > 2012 | EXPANDED |
| 2026 < 2012 | CONTRACTED |
| 2026 = 2012 | UNCHANGED |

Percent change is secondary context only. Correct wording describes **Application portfolios**, not company performance:

> Application portfolio contracted from 101 applications in 2012 to 39 in 2026.

Avoid business-performance claims.

## Exclusions

| Case | State | Treatment |
| --- | --- | --- |
| GoDaddy ↔ Uniregistry | REJECTED / ACQUIRED_AFTER_2012 | Excluded — not same analytical participant; do not compute 54→77 as portfolio change |
| EchoStar ↔ Dish | AMBIGUOUS / SUCCESSOR_ENTITY_REVIEW_REQUIRED | Excluded until resolved |
| 10 unmatched 2026 Organizations | UNMATCHED | Label: “No confirmed 2012 Organization match” — not “New in 2026” |

## Confirmed-subset eligibility

| Metric | Posture |
| --- | --- |
| `confirmed-returning-organizations` | CONFIRMED_SUBSET_READY_WITH_LIMITATION (`PARTIAL` / `READY_WITH_LIMITATION`) |
| `confirmed-expanded-organizations` | same |
| `confirmed-contracted-organizations` | same |
| `confirmed-unchanged-organizations` | same |
| `returning-participant-identity` (complete) | BLOCKED_SOURCE |
| `new-organizations` | BLOCKED_SOURCE |

Disclosure must state the value counts steward-confirmed continuity only and is not a complete round-wide returning count.

## Coverage

Coverage ratios are **identity-resolution coverage**, not round coverage:

- 2 / 14 confirmed 2026 Organizations  
- 41 / 669 confirmed 2026 Applications  
- 2 / 16 confirmed 2012 Organizations  
- 112 / 466 confirmed 2012 Applications  

Combined confirmed-subset Application delta (−71) is not a round-wide change.

## Pins

Derived snapshot pins to:

- Cross-round identity hash: `87f5aad91fb1c59a0082ae046c4d3017408f18c79253f78ef162ba3f9c4b9621`
- 2012 Organization pin: `b080c6e7c02b7c0f32c9e781dff4660c842b9d228ac2e6a6f9177d2a5924c286`
- 2026 Organization-resolution pin: `d19b5773dc72a95ba624441b1961762a15e76624ca3dff37bc4646ec4c1d0cdd`
- Application graph pin: `09e75b1c83baa2a7466033de991332f396b108dc3d8c0775d3c17d99ec6b45d2`

Wrong pins fail closed.

## Review artifacts

```bash
npm run normalize -- cross-round-participation-intelligence --write
```

Writes under `.data/reveal-2026/cross-round-participation-intelligence/` (gitignored).

## Product surfacing

Command Center is unchanged in this ticket. A later bounded surface may show “2 confirmed returning Organizations” with coverage context — avoid weak hero stats from only two identities.

## Future path

Broader participation intelligence requires additional steward-confirmed cross-round identities and/or a more complete historical Organization-resolution method. Until then, complete returning/new/expanded/contracted metrics remain blocked.

## Related

- `docs/cross-round-organization-identity.md` — identity evidence + steward approvals  
- `docs/2026-organization-resolution.md` — 2026 Organization confirmed subset  
