# Cross-round Organization identity (CROSS-ROUND-ID-1)

Versioned sidecar: **`cross-round-organization-identity/1.0.0`**

Connects **CONFIRMED 2026 Organizations** to **CONFIRMED 2012 Organizations** where evidence supports continuity of analytical identity. Produces steward-review recommendations only — never returning/new product facts.

## Identity semantics

2026 Organization A and 2012 Organization B are the same cross-round participant only when evidence supports continuity of the analytical Organization identity.

Do **not** equate them solely because:

- names or aliases look similar;
- brands match;
- both use the same RSP;
- both belong to the same broad corporate group *today*;
- one acquired the other after the relevant application period.

Canonical mapping keys are **Organization IDs** (`organization:promoted:…` / `organization:resolved-2026:…`), never Applicant legal names, display names, or contention Org Name.

## Temporal continuity

The matching question is:

> Does the 2026 resolved Organization represent the same defensible participant/parent identity as the accepted 2012 resolved Organization for cross-round analytical comparison?

Record acquisitions, divestitures, renames, mergers, reorganizations, parent changes, and successor entities. An acquisition after 2012 does **not** make the acquiring parent the 2012 participant (`ACQUIRED_AFTER_2012` / related-but-not-same). A rename may preserve identity if supported (`RENAMED_ENTITY`). Reorganizations often require steward judgment (`SUCCESSOR_ENTITY_REVIEW_REQUIRED`).

## Confirmed-subset nature of both rounds

| Round | Confirmed Organizations | Confirmed Applications | Notes |
| --- | --- | --- | --- |
| 2012 | 16 | 466 | Browser-confirmed portfolios. Offline registry has 19/501 including candidate/ambiguous — **excluded** from identity matching. |
| 2026 | 14 | 669 | ORG-RES-2026-2A steward-confirmed subset. CANDIDATE/AMBIGUOUS/UNRESOLVED stay outside this universe. |

Complete-round Organization metrics remain blocked while both layers are partial.

## Candidate vs steward-approved identity

| Field | Role |
| --- | --- |
| `reviewRecommendation` | CONFIRM / REJECT / AMBIGUOUS / NO_MATCH (Build Agent) |
| Mapping `state` | CANDIDATE / REJECTED / AMBIGUOUS / UNMATCHED until steward |
| `stewardDecision` | Always `null` in CROSS-ROUND-ID-1 |
| **CONFIRMED** | Only via later steward ticket (CROSS-ROUND-ID-1A) |

ORG-RES-2026-2A approvals authorize **2026 Organization** confirmation only — they do **not** authorize cross-round identity.

## Unmatched ≠ NEW

Absence of a confirmed 2012 match is **not** proof that a 2026 Organization is NEW. The 2012 confirmed layer is partial. An unmatched 2026 Organization may be genuinely new, historically present but unresolved in 2012, represented by another legal entity, acquired/reorganized, or otherwise outside the confirmed historical subset.

Returning / new / expanded / contracted classifications remain **0** until steward-approved CONFIRMED cross-round mappings exist.

## Relationship types

`SAME_ORGANIZATION` · `RENAMED_ENTITY` · `CONTINUOUS_PARENT_IDENTITY` · `SUCCESSOR_ENTITY_REVIEW_REQUIRED` · `ACQUIRED_AFTER_2012` · `RELATED_BUT_NOT_SAME_ANALYTICAL_IDENTITY` · `NO_PLAUSIBLE_CONFIRMED_2012_MATCH`

Only relationship types accepted as true analytical continuity may become CONFIRMED returning identity after steward approval.

## Pinning / hash

Snapshot pins:

- 2012 promotion registry content hash: `b080c6e7c02b7c0f32c9e781dff4660c842b9d228ac2e6a6f9177d2a5924c286`
- 2026 Organization-resolution semantic hash: `d19b5773dc72a95ba624441b1961762a15e76624ca3dff37bc4646ec4c1d0cdd`
- 2026 Application graph: `09e75b1c83baa2a7466033de991332f396b108dc3d8c0775d3c17d99ec6b45d2`

Semantic hash is order-invariant and includes pins, Organization IDs, relationship types, mapping states, evidence refs, and steward decisions (when later present). Wrong pins fail closed.

## Review process

```bash
npm run normalize -- cross-round-organization-identity --write
```

Writes under `.data/reveal-2026/cross-round-organization-identity/` (gitignored):

- `cross-round-organization-identity-1.0.0.snapshot.json`
- `cross-round-organization-identity-steward-review.tsv`
- `cross-round-organization-identity-steward-review.md`

Every confirmed 2026 Organization appears, including unmatched cases.

## Later steward application / returning-new

1. **CROSS-ROUND-ID-1A** — apply explicit operator steward decisions to CONFIRMED cross-round mappings.
2. **RETURNING-NEW-1** — returning/new and portfolio-change intelligence over steward-approved identities only, with confirmed-subset coverage disclosure.

Until then: Returning, New, Expanded/contracted, and cross-round portfolio concentration remain **BLOCKED**.

## Implementation

- `src/cross-round-organization-identity/` — types, pins, 2012 loader, discovery, research package, builder, hash, eligibility, review, tests
- Rehearsal-only `src/cross-round-identity/` is unchanged (method fixture; not live 2026 identity)
