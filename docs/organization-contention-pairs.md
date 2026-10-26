# Confirmed Organization contention co-membership pairs (ORG-CONTENTION-PAIRS-1)

Deterministic Confirmed Organization ↔ Confirmed Organization co-membership in official ICANN initial contention sets. Structural overlap only — not rivalry, auction severity, opportunity, or market share.

## Purpose

Answer:

- which Confirmed Organization pairs most frequently share official contention sets;
- which Organizations have the widest Confirmed counterpart breadth;
- which pairings recur across multiple sets;
- for a selected Organization, which Confirmed counterparts share the most sets.

## Edge definition

One **undirected** edge between two **distinct** Confirmed Organization IDs when both have ≥1 Application membership in the same official contention set.

Canonical identity:

```text
organizationAId < organizationBId  (lexical)
pairKey = `${organizationAId}::${organizationBId}`
```

Self-pairs (`A ↔ A`) are forbidden. Multiple Applicants under the same Confirmed Organization in one set remain underlying memberships but do not create self-edges.

## Primary measures

| Field | Definition |
| --- | --- |
| `sharedSetCount` | Distinct official `contentionSetId`s containing both Organizations |
| `membershipInteractions` | Σ over shared sets of `\|membA\| × \|membB\|` |
| `largestOfficialSharedSetSize` | **TOTAL official membership count** of the largest co-membered set (includes unresolved / non-Confirmed members) |

These measures stay separate. There is no strength / opportunity / rivalry score.

## Confirmed-only rule

Pair endpoints are steward-**CONFIRMED** Organizations only.

| Membership class | Pair endpoint? |
| --- | --- |
| CONFIRMED | Yes |
| UNRESOLVED | Coverage only |
| CANDIDATE | Coverage only |
| AMBIGUOUS | Coverage only |

Never invent Unknown / Unresolved / Other Organization nodes.

## Counterpart degree / breadth

For each Confirmed Organization:

- `distinctConfirmedCounterpartCount`
- `recurringCounterpartCount` (counterparts with `sharedSetCount > 1`)
- ranked counterpart rows by sharedSetCount → membershipInteractions → name

Product wording: **Distinct Confirmed counterparts** / **Confirmed counterpart breadth** — not market reach or dominance.

## Ranking

**Global pairs:** sharedSetCount DESC → membershipInteractions DESC → organizationAName ASC → organizationBName ASC  

**Breadth:** distinctConfirmedCounterpartCount DESC → organizationName ASC → organizationKey ASC  

**Per-org counterparts:** sharedSetCount DESC → membershipInteractions DESC → counterpart name ASC

## Coverage contract (accepted live baseline)

| Metric | Value |
| --- | --- |
| Official sets / memberships | 263 / 891 |
| Confirmed / UNRESOLVED / Candidate+Ambiguous memb. | 724 / 149 / 18 |
| Sets with ≥1 Confirmed Org | 256 |
| Pairable sets (≥2 Confirmed Orgs) | 208 |
| Pairable Confirmed memberships | 676 |
| Unique pairs / recurring | 165 / 112 |
| Orgs with / without a Confirmed pair | 27 / 77 |
| Max sharedSetCount | 77 (Identity Digital ↔ XYZ.COM LLC) |
| Organization hash | `06ba3920…346c` |

Do **not** assume `724 + 149 = 891` — Candidate/Ambiguous account for the remaining 18.

## GoDaddy reconciliation

Must match ORG-CONCENTRATION-1 counterpart count:

- Organization: `godaddy-registry-services`
- Distinct Confirmed counterparts: **21**
- Top by shared sets: Identity Digital **51**, Link Freedom **32**, XYZ **29**, Intercap **19**, ShortDot **18**

## Surfaces

| Surface | Role |
| --- | --- |
| `/contention` | **Primary** — top pairs + breadth tables |
| `/organization` | Frequent counterparts for the profiled Org |
| `/competitive-landscape` | Compact top-5 teaser + link to Contention |
| Command Center home | Unchanged |

## Semantic limitations / blocked claims

Blocked language: rival, threat, auction severity, win/loss probability, sales opportunity, market share, dominance, market power, competitive adjacency, selected RSP, available customer.

Co-membership ≠ commercial rivalry or auction participation.

## Module

- `src/lib/organization-contention-pairs.ts` — pure derivation  
- `src/lib/organization-contention-pairs-server.ts` — Active V2 + org snapshot loader  
