# 2026 Organization resolution (ORG-RES-2026-1)

**Status:** first-pass resolution layer · offline sidecar · **not** Command Center product claim  
**Method:** `organization-resolution-2026/1.0.0`  
**Snapshot schema:** `organization-resolution-snapshot/1.0.0`  
**Registry:** `organization-resolution-registry/1.0.0`

## Applicant ≠ Organization

APS `Applicant Name` is a **source observation** (legal applicant label).  
RIH **Organization** is a derived intelligence entity that groups applications under one defensible participant/parent identity.

Unsafe: treating string equality of Applicant Name as Organization confirmation.  
Safe: versioned, evidence-backed, steward-reviewable mappings with fail-closed ambiguity.

Contention CSV `Org Name` remains `publishedOrgName` only — never RIH Organization.  
RSP / backend-provider relationships do not imply Organization identity.

## Sidecar (not Publication mutation)

Output is a **separate** resolution snapshot pinned to Application publication 2.0.0.  
It does **not** write `organization` into Publication 2.0 records.

| Field | Role |
| --- | --- |
| `applicationPublicationPin` | Fail-closed pin to Application graph hash |
| `organizations` | Resolved entities (`organization:resolved-2026:{key}`) |
| `applicantIdentityMappings` | Exact legal name → state / optional org |
| `candidateClusters` | Normalization discovery only |
| `evidence` | Strength A–D refs with provenance |
| `quality` | Deterministic coverage / state counts |
| `semanticContentSha256` | Order-normalized semantic hash |

Pinned Reveal Day Application graph:

`09e75b1c83baa2a7466033de991332f396b108dc3d8c0775d3c17d99ec6b45d2`

Wrong pin → build fails closed.

## Resolution states (shared with 2012)

| State | Meaning | Product-eligible? |
| --- | --- | --- |
| **CONFIRMED** | Steward-approved + non-low confidence + ≥1 A/B evidence | Yes |
| **CANDIDATE** | Plausible; pending steward | No |
| **AMBIGUOUS** | Related; ultimate portfolio unclear | No |
| **UNRESOLVED** | Default — no Organization entity | No |

Evidence strength: **A** ownership/control · **B** first-party identity · **C** corroborating · **D** string similarity.  
**D alone never confirms.**

## Name normalization

Used for **candidate discovery only** (case / punctuation / corporate suffixes / Unicode NFKC).  
Does not auto-confirm. Exact published legal names are always retained.

## First-pass behavior

Over the accepted 1614-record Publication 2.0.0 inventory:

- Count distinct Applicant legal names and multi-Application exact names
- Emit normalization clusters when distinct spellings share a normalized key
- Exact match to 2012 **CONFIRMED** promotion aliases → **CANDIDATE** with `possible2012OrganizationKey` (steward hint only)
- Empty steward registry → **0 CONFIRMED** (honest; A/B evidence required)
- No returning/new/expanded/contracted classification (CROSS-ROUND-ID-1)
- No category/sector inference

Steward ops live in:

`src/organization-resolution-2026/fixtures/organization-resolution-registry.json`

## Product eligibility

Only **CONFIRMED** mappings contribute to Organization counts, confirmed portfolio sizes, and later org-aware contention / cross-round identity.  
If confirmed count is 0, Organization metrics remain **blocked** (catalog unchanged readiness). Coverage disclosure must not claim `481 applicants = N organizations`.

## Operator review

```bash
npm run normalize -- organization-resolution-2026 --write
```

Writes under `.data/reveal-2026/organization-resolution/` (gitignored):

- `organization-resolution-1.0.0.snapshot.json`
- `organization-resolution-steward-review.tsv`
- `organization-resolution-steward-review.md`
- `organization-resolution-steward-queue.tsv` (ORG-RES-2026-2 research queue)

## ORG-RES-2026-2 — evidence expansion + steward review queue

**Goal:** expand public evidence for highest-impact Applicant legal names and produce recommendations — **not** steward approvals.

### Research queue (deterministic)

Union of:

1. Existing CANDIDATE mappings  
2. Top 20 unresolved by observed Application count  
3. Top 10 unresolved by official initial contention memberships  

De-duplicate; **cap 30**; do not pad. Priority uses Applicant/application facts only — never inferred Organizations.

### Source hierarchy

| Strength | Examples |
| --- | --- |
| **A** | SEC/regulatory filings, corporate registry, authoritative ownership filings |
| **B** | Explicit first-party / APS application-response ownership or self-operator statements |
| **C** | Strong corroboration (e.g. affiliate without named parent) |
| **D** | Name similarity only |

Unacceptable as primary confirmation: Wikipedia, Crunchbase, SEO directories, RSP-sharing, logos, AI summaries.

### Temporal rule

Prefer identity/control evidence at application time, Reveal Day, or clearly covering the application period. Record `asOf` / temporal limitations. If continuity is unclear → KEEP_CANDIDATE or MARK_AMBIGUOUS.

### Recommendation vs confirmation

| Field | Role |
| --- | --- |
| `reviewRecommendation` | CONFIRM / KEEP_CANDIDATE / MARK_AMBIGUOUS / REJECT_RELATIONSHIP / NO_EVIDENCE |
| Mapping `resolutionState` | Remains CANDIDATE / AMBIGUOUS / UNRESOLVED for new research |
| **CONFIRMED** | Only via steward-approved registry ops (ORG-RES-2026-2A) — **never** agent self-approval |

`reviewRecommendation=CONFIRM` requires A **or** explicit B ownership/self-identity evidence. C/D cannot recommend CONFIRM. Recommendations **do not** unlock Organization product metrics.

### Evidence coverage (first research pass)

See steward review artifacts after `npm run normalize -- organization-resolution-2026 --write`. Actual CONFIRMED remains **0** until operator approval.

## Deferred

- **ORG-RES-2026-2A** — apply steward-approved CONFIRMED mappings  
- **CROSS-ROUND-ID-1** — 2012↔2026 participant identity / returning-new  
- Command Center Organization metrics UI  
- Sector/category taxonomy  

## Implementation

- `src/organization-resolution-2026/` — types, pin, builder, hash, eligibility, research queue, research package, review, tests  
- Reuses 2012 promotion **states** and immutable-op / no-silent-merge architecture  
- Materializes `organization:resolved-2026:{key}` (parallel to 2012 `organization:promoted:{key}`)  
- Research package: `src/organization-resolution-2026/fixtures/research-package-2026-2.ts`
