# Cross-round Organization identity (CROSS-ROUND-ID-1 / 1A)

Versioned sidecar: **`cross-round-organization-identity/1.0.0`**

Connects **CONFIRMED 2026 Organizations** to **CONFIRMED 2012 Organizations** where evidence supports continuity of analytical identity.

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
| 2012 | 17 | 467 | Browser-confirmed portfolios (includes NeuStar, Inc.). Offline registry has 20/502 including candidate/ambiguous — **excluded** from identity matching. |
| 2026 | 14 | 669 | ORG-RES-2026-2A steward-confirmed subset. CANDIDATE/AMBIGUOUS/UNRESOLVED stay outside this universe. |

Complete-round Organization metrics remain blocked while both layers are partial.

## Candidate vs steward-approved identity

| Field | Role |
| --- | --- |
| `reviewRecommendation` | CONFIRM / REJECT / AMBIGUOUS / NO_MATCH (Build Agent research) |
| Mapping `state` | CANDIDATE → CONFIRMED only via steward APPROVE |
| `stewardDecision` | Set by CROSS-ROUND-ID-1A for approved pairs |
| **CONFIRMED** | Steward-approved analytical continuity only |

ORG-RES-2026-2A approvals authorize **2026 Organization** confirmation only — they do **not** authorize cross-round identity.

## CROSS-ROUND-ID-1A steward approval

**Decision ID:** `RIH-CROSS-ROUND-ID-1-BOTH-20261009`  
**Authority:** operator / product steward  
**Decided:** 2026-10-09  
**Scope:** cross-round Organization identity only  

Operator decision: **Approve both** `recommendation=CONFIRM` mappings from accepted CROSS-ROUND-ID-1 at `9c05725c8c92687b5e6b7926182e6559dc06b6c7`.

### CONFIRMED (2)

| 2026 Organization | 2012 Organization | Relationship | 2026 Apps | 2012 Apps |
| --- | --- | --- | --- | --- |
| Microsoft Corporation (`organization:resolved-2026:hist-2012-microsoft`) | Microsoft Corporation (`organization:promoted:microsoft`) | SAME_ORGANIZATION | 2 | 11 |
| Google / Charleston Road (`organization:resolved-2026:hist-2012-google-charleston-road`) | Google / Charleston Road (`organization:promoted:google-charleston-road`) | SAME_ORGANIZATION | 39 | 101 |

### Preserved non-approved

| State | Mapping |
| --- | --- |
| REJECTED | GoDaddy (Registry Services, LLC) ↔ Uniregistry — `ACQUIRED_AFTER_2012` (do not rewrite 2012 participant) |
| AMBIGUOUS | EchoStar ↔ Dish DBS — `SUCCESSOR_ENTITY_REVIEW_REQUIRED` |
| UNMATCHED | 10 remaining confirmed 2026 Organizations |

Separately from returning-identity mappings, steward-approved **historical Organization lineage** may link NeuStar, Inc. (2012) to GoDaddy Registry via registry-business succession (`historical-organization-lineage/1.0.0`). That lineage is **not** `SAME_ORGANIZATION` returning identity and does not replace the Uniregistry rejection.

## Unmatched ≠ NEW

Absence of a confirmed 2012 match is **not** proof that a 2026 Organization is NEW. The 2012 confirmed layer is partial.

Returning / new / expanded / contracted classifications remain **0** until **RETURNING-NEW-1**.

## Relationship types

`SAME_ORGANIZATION` · `RENAMED_ENTITY` · `CONTINUOUS_PARENT_IDENTITY` · `SUCCESSOR_ENTITY_REVIEW_REQUIRED` · `ACQUIRED_AFTER_2012` · `RELATED_BUT_NOT_SAME_ANALYTICAL_IDENTITY` · `NO_PLAUSIBLE_CONFIRMED_2012_MATCH`

Only relationship types accepted as true analytical continuity may become CONFIRMED returning identity after steward approval (and only after RETURNING-NEW-1 for product classification).

## Pinning / hash

Snapshot pins (unchanged by steward application):

- 2012 promotion registry content hash: `f024f75d5283f46244578ace6a8b3eb5a56c16589a5a0f8daff6592a36f5a69b`
- 2026 Organization-resolution semantic hash: `d19b5773dc72a95ba624441b1961762a15e76624ca3dff37bc4646ec4c1d0cdd`
- 2026 Application graph: `09e75b1c83baa2a7466033de991332f396b108dc3d8c0775d3c17d99ec6b45d2`

Cross-round semantic hashes:

| Stage | Hash |
| --- | --- |
| Pre-steward (CROSS-ROUND-ID-1) | `3468c8b60c482f2187cd7bca70173d7f418c739c16ffd0fa6925f10333736255` |
| Post-steward (CROSS-ROUND-ID-1A) | `c44e8035c1f20de7f37c06d9bdc8668c407d53d9c5e3ae3cdede0e5bb6b364eb` |

Semantic hash is order-invariant and includes pins, Organization IDs, relationship types, mapping states, evidence refs, and steward decisions. Wrong pins fail closed.

## Product eligibility

Post-1A posture for the two approved pairs: **CONFIRMED_SUBSET_READY_WITH_LIMITATION**.

Still **BLOCKED** until RETURNING-NEW-1:

- complete returning Organization count
- complete new Organization count
- round-wide expanded/contracted
- complete Organization concentration

## Review process

```bash
npm run normalize -- cross-round-organization-identity --write
```

Applies steward approvals by default. Writes under `.data/reveal-2026/cross-round-organization-identity/` (gitignored):

- `cross-round-organization-identity-1.0.0.snapshot.json`
- `cross-round-organization-identity-steward-review.tsv`
- `cross-round-organization-identity-steward-review.md`

## Next / derived layer

**RETURNING-NEW-1** — see `docs/returning-new-participation-intelligence.md` (confirmed-subset returning + portfolio-change; complete new remains blocked).

## Implementation

- `src/cross-round-organization-identity/` — types, pins, 2012 loader, discovery, research package, steward apply, builder, hash, eligibility, review, tests
- Rehearsal-only `src/cross-round-identity/` is unchanged (method fixture; not live 2026 identity)
