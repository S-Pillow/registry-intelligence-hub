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

## ORG-RES-WEB-1 — Applicant Website identity discovery

**Decision batch:** `RIH-ORG-RES-WEB-1-20261012`  
**Authority:** operator product steward (not Build Agent)

### Entity layers (preserved)

| Layer | Meaning |
| --- | --- |
| **Applicant** | Exact ICANN-published legal name (never renamed) |
| **Organization** | Broader evidence-backed operating/corporate identity used by RIH |
| **Direct parent** | Explicit Q26 disclosure where public |
| **Ultimate parent / control** | Explicit Q36 / Q108 disclosures where public |

Do not collapse these into one display name. Example: Applicant `Hair Apparent, LLC` → Organization **Identity Digital**; Direct parent `Slow Rider, LLC`; Ultimate parent/control `Ethos Capital Digital Infrastructure UGP LLC`.

### Applicant Website — evidence semantics

Applicant Website (`applicantDetails.organizationWebsite` on APS Application summary) is a **first-party discovery signal**.

| Maturity | Use |
| --- | --- |
| Discovery | Same unusual corporate domain → investigate |
| Corroborated Candidate | Shared domain + email domain + prior Candidate/Ambiguous alignment |
| Confirmation-quality | Explicit affiliate / parent / control disclosures (Q11–Q14, Q26, Q36, Q108) |

**Forbidden:** auto-CONFIRM from domain alone, or from shared-domain count alone.

### Acquisition (first-party ICANN only)

1. APS frontend config: `https://newgtldprogram-aps.icann.org/api/config` → `restBackendUrl`
2. Summary: `GET {restBackendUrl}/applications/{applicationId}/summary` → `organizationWebsite`
3. Responses: `GET {restBackendUrl}/applications/{applicationId}/responses` → sectioned Q&A
4. Representative Application per Applicant: lexicographically first `applicationId`
5. **No PDF dependency** for this ticket; no authentication; no external corporate-site crawling

Artifacts (committed fixtures):

- `src/organization-resolution-2026/fixtures/applicant-identity-web1/website-inventory.json`
- `src/organization-resolution-2026/fixtures/applicant-identity-web1/website-clusters.json`
- `src/organization-resolution-2026/fixtures/applicant-identity-web1/discovery-report.json`
- `src/organization-resolution-2026/fixtures/applicant-identity-evidence-package-web1.json`
- Hair Apparent proof: `src/organization-resolution-2026/fixtures/aps-detail/`

Live re-fetch: `node scripts/acquire-applicant-identity-web1.mjs` (writes under `.data/applicant-identity-2026/`, gitignored).

### Shared Applicant Website clusters

Deterministic clusters by **registrable website domain** (not “corporate groups”).  
Sort: distinct Applicant count ↓, Application count ↓, domain ↑.  
`example.com` and peers are **INVALID_OR_UNUSABLE_WEBSITE**. Shared website without corroborating identity (e.g. `jt.com`) is **MAPPING_CONFLICT** → Ambiguous review, no auto-confirm.

### Decision thresholds (WEB-1)

Authorized transitions when first-party ICANN evidence supports them:

- UNRESOLVED / AMBIGUOUS / CANDIDATE → **CANDIDATE** (website + partial corroboration)
- UNRESOLVED / AMBIGUOUS / CANDIDATE → **CONFIRMED** when affiliate disclosure + consistent parent/control (or equivalent confirmation-quality set) unambiguously establishes the operating Organization
- Existing **CONFIRMED** mappings: never auto-demote; conflicts flagged for review

Canonical Organization keys reused (e.g. `identity-digital` → **Identity Digital**), not one org per legal affiliate name.

### Identity Digital proof case

Application `SS2654T-T11896` · Applicant `Hair Apparent, LLC` · Website `identity.digital` · Affiliate disclosures naming Identity Digital RO/RSP entities · Direct parent `Slow Rider, LLC` · Ultimate parent/control Ethos Capital Digital Infrastructure UGP LLC → **Confirmed · Identity Digital**.

### Downstream

- Competitive Landscape / Contention / Explore consume the shared Organization overlay + compact Applicant Website / parent / evidence panel
- RSP Main capability via **CONFIRMED_ORGANIZATION** only (Candidate/Ambiguous never propagate)
- Contention memberships remain Applicant-authoritative (263 / 891 unchanged by Organization enrichment)
- Does **not** mutate `.data/reveal-2026` publication, Change Intelligence, or scheduler state

## ORG-RES-BRAND-1 — Brand & self-identity Applicant resolution

**Decision batch:** `RIH-ORG-RES-BRAND-1-20261012`  
**Authority:** operator product steward (not Build Agent)  
**Prior WEB-1 semantic hash:** `6dbbe567816c0afb2091eb5fb6eb8b0da5c8a32dbf00d461806ae70e84851199`

### Brand designation (discovery / corroboration only)

Application `designations.brand` helps prioritize Applicants whose applied-for strings align with corporate or product identity.  
**Forbidden:** Brand → automatic CONFIRMED.  
**Forbidden:** applied-for string resemblance → automatic CONFIRMED or separate Organization (e.g. `.slack` / `.tableau` do not create Slack/Tableau Organizations when the Applicant is Salesforce, Inc.).

### Self-identity resolution

A straightforward self-identifying Applicant may be steward-confirmed when first-party ICANN evidence consistently shows the Applicant and proposed Organization are the same business identity:

1. Exact Applicant legal name  
2. Applicant Website supplied to ICANN  
3. Brand designation (corroboration)  
4. Optional business email domain  
5. Explicit parent/affiliate disclosures preserved separately when present  
6. No contradictory first-party evidence  

Conservative discovery matching (lowercase, legal-suffix removal, punctuation/whitespace, www/host stem) is **queue-building only**. Steward evidence still controls CONFIRMED.

### Parent vs Organization

If ICANN discloses Direct Parent / Ultimate Parent / Ultimate Control, those facts are stored separately. They do **not** automatically become the product Organization. Example: Applicant `Converse Inc.` → Organization **Converse**; Direct/Ultimate parent `NIKE, Inc.` retained as relationship context.

### Salesforce proof case

Applicant `Salesforce, Inc.` · Website `salesforce.com` · Brand Applications for `salesforce`, `force`, `slack`, `tableau` → **Confirmed · Salesforce**.  
Applications remain Salesforce, Inc. Applications. Slack/Tableau are not Organizations.

### Discovery / decision counts (this batch)

| Metric | Value |
| --- | --- |
| Represented Applicants | 480 |
| Non-Confirmed universe (pre-batch) | 405 |
| Applicants with ≥1 Brand Application | 247 |
| Non-Confirmed Brand Applicants | 237 |
| Brand Applications represented | 333 |
| Self-identity discovery signals | 70 |
| Parent-brand discovery signals | 167 |
| New steward Confirmed Applicants | 70 |
| Post-batch Confirmed Applicants / Organizations | 145 / 89 |
| Post-batch semantic hash | `4837173224fc89ae617de3620396950e18c8da99a5333459a8782e032ce3bb87` |

Artifacts:

- `src/organization-resolution-2026/fixtures/applicant-identity-evidence-package-brand1.json`
- `src/organization-resolution-2026/fixtures/applicant-identity-brand1/`
- Salesforce APS fixtures under `src/organization-resolution-2026/fixtures/aps-detail/CRM2628T-*`

Identity panel shows Brand applications as supporting context (e.g. `4 of 4`) — not as proof of brand ownership.

## ORG-RES-TRANCHE-1B — steward-approved 1A CONFIRM transitions

**Decision ID:** `RIH-ORG-RES-TRANCHE-1B-ALL9-20261013`  
**Authority:** operator / product steward (not Build Agent)  
**Approval:** all nine exact ORG-RES-TRANCHE-1A CONFIRM recommendations  
**Source evidence:** immutable 1A package `applicant-identity-evidence-package-tranche1.json` @ `35b1ff8` (research record unchanged)

### Counts before → after

| Metric | Before | After |
| --- | --- | --- |
| Confirmed Applicant mappings | 145 | **154** |
| Confirmed Organizations | 89 | **98** |
| Candidate / Ambiguous | 2 / 2 | 2 / 2 |
| Unresolved Applicants | 331 | **322** |
| Confirmed Applications | 1,036 | **1,099** |
| Confirmed Brand Applications | 126 | **141** |
| Confirmed contention memberships | 685 | **714** |
| Residual unresolved Applications | — | **475** |
| Residual unresolved Brand Applications | — | **190** |

### Semantic hash

| | Value |
| --- | --- |
| Old (post BRAND-1) | `4837173224fc89ae617de3620396950e18c8da99a5333459a8782e032ce3bb87` |
| New (post TRANCHE-1B) | `52aca2c47520e42da7773b546fff4996f307a677e2ec679546dc568d9a0b2ad8` |

Repeated regeneration must reproduce the same new hash.

Confirmed contention set coverage (distinct official sets with ≥1 Confirmed membership): **254** / 263 (membership coverage 714 / 891).

**Confirmed subset ≠ complete round.** Product surfaces continue to disclose confirmed-only Organization coverage limits. Round-wide Organization total remains blocked.

KEEP_CANDIDATE / MARK_AMBIGUOUS / NO_EVIDENCE dossiers from 1A were **not** approved and remain non-CONFIRMED.

Artifacts:

- `src/organization-resolution-2026/applicant-identity/steward-decision-tranche1b.ts`
- `src/organization-resolution-2026/applicant-identity/apply-tranche1b-steward.ts`

## Deferred

- **CROSS-ROUND-ID-1 / 1A** — see `docs/cross-round-organization-identity.md` (2 steward-confirmed identity pairs; returning-new still blocked)  
- **RETURNING-NEW-1** — returning/new / portfolio-change over approved cross-round identities  
- Command Center confirmed-subset portfolio UI (with coverage disclosure)  
- Sector/category taxonomy  
- External (non-ICANN) corporate evidence for remaining Unresolved / Ambiguous Applicants  

## Implementation

- `src/organization-resolution-2026/` — types, pin, builder, hash, eligibility, research queue, research package, steward apply, review, tests  
- `src/organization-resolution-2026/applicant-identity/` — website normalize/cluster, Brand inventory/match/discovery, APS detail extract, WEB-1 + BRAND-1 evidence apply + steward  
- Reuses 2012 promotion **states** and immutable-op / no-silent-merge architecture  
- Materializes `organization:resolved-2026:{key}` (parallel to 2012 `organization:promoted:{key}`)  
- Research package: `src/organization-resolution-2026/fixtures/research-package-2026-2.ts`  
- Steward decisions: `steward-decision.ts` (ALL14) + `applicant-identity/steward-decision-web1.ts` + `applicant-identity/steward-decision-brand1.ts` + `applicant-identity/steward-decision-tranche1b.ts`
