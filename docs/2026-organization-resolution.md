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

Only **CONFIRMED** mappings contribute to confirmed Organization counts, confirmed portfolio sizes, and confirmed-subset contention exposure.  
Round-wide Organization count / complete portfolio concentration remain **blocked**. Confirmed-subset readiness requires coverage disclosure (confirmed ≠ round total). Coverage disclosure must not claim `481 applicants = N organizations` or treat unresolved Applications as Unknown Organization.

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

See steward review artifacts after `npm run normalize -- organization-resolution-2026 --write`. Pre-steward package semantic hash:

`04316e1c52c94970f9f7a9c2afd83374ad3a6c4ceadd42b975f10d03f5f0b49b`

(14 `recommendation=CONFIRM`, actual CONFIRMED **0** until ORG-RES-2026-2A.)

## ORG-RES-2026-2A — steward-approved confirmations

**Decision ID:** `RIH-ORG-RES-2026-2-ALL14-20261009`  
**Authority:** operator / product steward (not Build Agent)  
**Decided:** 2026-10-09  
**Scope:** 2026 Organization resolution confirmations only  

Operator decision: **Approve all 14** `recommendation=CONFIRM` dossiers from the accepted ORG-RES-2026-2 package at `c80d4041d38c8579cd85fcaf53c737121a90cc2e`.

| Role | Rule |
| --- | --- |
| Research `reviewRecommendation` | Retained on dossiers (history: recommend → approve → CONFIRMED) |
| Steward `APPROVE` | Required to transition mapping/org `CANDIDATE` → `CONFIRMED` |
| Exact identity | Uses dossier `organizationId` / canonical / aliases / evidenceRefs — no invented IDs |

### Approved mappings (14)

Exact Applicant legal names transitioned (organization identity from accepted dossiers):

1. Link Freedom Group Ltd  
2. XYZ.COM LLC  
3. Registry Services, LLC  
4. Intercap Registry Inc.  
5. Radix Technologies Inc SEZC  
6. ShortDot (Ireland) Limited  
7. Charleston Road Registry Inc.  
8. Aruba PEC S.P.A.  
9. Meta Registry Holdings LLC  
10. Knock Knock WHOIS There, LLC  
11. OPENAI OPCO, LLC  
12. Squarespace Registry LLC  
13. ECHO Domain Co L.L.C.  
14. Microsoft Corporation  

### Non-approved (preserved)

| State | Applicants |
| --- | --- |
| KEEP_CANDIDATE | Oinkadot Inc; XRegistry Incorporated; 101130013 Saskatchewan Ltd. |
| AMBIGUOUS | Toddler Logic, LLC; Pirin Tablet, LLC; Hair Apparent, LLC |
| NO_EVIDENCE / unresolved | Suffix Inc.; NextGEN TLDs GmbH (+ all other unresolved legal names) |

### Confirmed-subset coverage (recomputed)

Pinned Application graph unchanged:

`09e75b1c83baa2a7466033de991332f396b108dc3d8c0775d3c17d99ec6b45d2`

Acceptance expectations (recomputed from mappings — not hardcoded product facts):

| Metric | Value |
| --- | --- |
| Confirmed Organizations (resolved subset) | 14 |
| Confirmed Applicant legal names | 14 |
| Confirmed Applications | 669 / 1614 observed (~41.45%) |
| Confirmed initial contention memberships | 483 / 891 (~54.21%) |
| Candidate / Ambiguous / Unresolved remaining | 3 / 3 / 460 |
| Post-steward semantic hash | `d19b5773dc72a95ba624441b1961762a15e76624ca3dff37bc4646ec4c1d0cdd` |

**Confirmed subset ≠ complete round.** Do not present 14 as the total 2026 Organization count, or confirmed portfolio concentration as round-wide concentration. Unresolved Applications are not “Unknown Organization.”

Product posture: **CONFIRMED_SUBSET_READY_WITH_LIMITATION** for confirmed portfolios / confirmed contention exposure; round-wide Organization metrics remain blocked (`organization-round-count` NOT_PUBLISHED).

### Explicitly not authorized here

- Cross-round identity approvals (including CRR→Google / Microsoft historical candidates)  
- Returning/new / expanded/contracted  
- Category/sector inference  
- Application or contention publication mutation  
- Deployment / production actuality  

**CROSS-ROUND-ID-1** remains a separate ticket.

## Deferred

- **CROSS-ROUND-ID-1** — see `docs/cross-round-organization-identity.md` (evidence/candidates; returning-new still blocked until steward)  
- **CROSS-ROUND-ID-1A** — apply steward-approved cross-round mappings  
- **RETURNING-NEW-1** — returning/new / portfolio-change after approved identities  
- Command Center confirmed-subset portfolio UI (with coverage disclosure)  
- Sector/category taxonomy  

## Implementation

- `src/organization-resolution-2026/` — types, pin, builder, hash, eligibility, research queue, research package, steward apply, review, tests  
- Reuses 2012 promotion **states** and immutable-op / no-silent-merge architecture  
- Materializes `organization:resolved-2026:{key}` (parallel to 2012 `organization:promoted:{key}`)  
- Research package: `src/organization-resolution-2026/fixtures/research-package-2026-2.ts`  
- Steward decision: `src/organization-resolution-2026/steward-decision.ts`
