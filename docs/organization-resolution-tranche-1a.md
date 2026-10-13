# ORG-RES-TRANCHE-1A — steward review package

**Status:** RESEARCH / RECOMMENDATION ONLY  
**Decision id:** `RIH-ORG-RES-TRANCHE-1A-20261013`  
**Baseline tip:** `b110927` (prioritization) · production source `a2e334f`  
**Evidence package:** `src/organization-resolution-2026/fixtures/applicant-identity-evidence-package-tranche1.json`

## Steward disclaimer (mandatory)

This unit **does not** approve Organization mappings.

- No `resolutionState=CONFIRMED` transitions were applied.
- No steward `APPROVE` decisions were recorded.
- No product Organization sidecar / semantic hash change is authorized by this package.
- **CONFIRM** below means *recommend for steward approval*, not product eligibility.

A separate **ORG-RES-TRANCHE-1B** authorization listing exact Applicant → Organization approvals is required before any recommendation becomes CONFIRMED.

## Queue selection method

Deterministic dual-lane selection over currently **UNRESOLVED** Applicant legal names (re-derived from production Organization snapshot + browser + contention publication; reconciled to prioritization baselines).

**Lane A — Brand** (UNRESOLVED with ≥1 Brand Application): top 15 by Brand Application count ↓, total Applications ↓, official initial contention memberships ↓, Applicant legal name ↑.

**Lane B — Multi-Application** (UNRESOLVED with ≥2 Applications): top 15 by Applications ↓, Brand Applications ↓, contention memberships ↓, name ↑.

Union + de-duplicate → **27** dossiers (15+15−3 overlap). Not padded to 30.

### Overlap (both lanes)

1. Amazon Registry Services, Inc.  
2. Industria de Diseño Textil S.A.  
3. ML 35 LLC  

### Expected high-impact names

Suffix Inc., NextGEN TLDs GmbH, Endpoint Domains, Inc., Cam Connecting SARL, Innovation Service Limited, NAME SPACE LLC, TechEdge Limited, Amazon Registry Services, Inc., and Public Interest Registry **all appear** via the deterministic rules (no hard-coding).

## Current actual coverage (unchanged)

| Metric | Value |
| --- | --- |
| Confirmed Applicant mappings | 145 |
| Confirmed Organizations | 89 |
| Candidate / Ambiguous / Unresolved | 2 / 2 / 331 |
| Applications under Confirmed Organizations | 1,036 / 1,614 |
| Brand Applications under Confirmed Organizations | 126 / 333 |
| Contention memberships under Confirmed Organizations | 685 / 891 |
| Organization semantic hash | `4837173224fc89ae617de3620396950e18c8da99a5333459a8782e032ce3bb87` |

Unresolved impact (re-derived): **538** Applications · **205** Brand · **188** contention memberships · **137** sets · **69** multi-Application Applicants (276 Applications).

## Selected Applicants

Format: Applicant · Applications · Brand · contention memberships · lane(s) · recommendation

### Lane A (Brand)

1. Amazon Registry Services, Inc. · 8 · 8 · 2 · BRAND+MULTI · KEEP_CANDIDATE  
2. Industria de Diseño Textil S.A. · 6 · 6 · 0 · BRAND+MULTI · **CONFIRM → Inditex**  
3. ML 35 LLC · 5 · 5 · 0 · BRAND+MULTI · MARK_AMBIGUOUS  
4. Beijing Zitiao Network Technology Co., Ltd. · 3 · 3 · 0 · BRAND · MARK_AMBIGUOUS  
5. Dine Brands Global, Inc. · 3 · 3 · 0 · BRAND · **CONFIRM → Dine Brands Global**  
6. Douyin Vision Co., Ltd. · 3 · 3 · 0 · BRAND · MARK_AMBIGUOUS  
7. Taisho Pharmaceutical Co., Ltd. · 3 · 3 · 0 · BRAND · KEEP_CANDIDATE  
8. Epic systems corporation · 2 · 2 · 1 · BRAND · **CONFIRM → Epic Systems**  
9. ALIBABA INNOVATION PRIVATE LIMITED · 2 · 2 · 0 · BRAND · KEEP_CANDIDATE (possible `alibaba-group` reuse)  
10. AT&T Services, Inc. · 2 · 2 · 0 · BRAND · KEEP_CANDIDATE  
11. American Lebanese Syrian Associated Charities, Inc. · 2 · 2 · 0 · BRAND · KEEP_CANDIDATE  
12. Axon Enterprise, Inc. · 2 · 2 · 0 · BRAND · **CONFIRM → Axon Enterprise**  
13. Canadian Imperial Bank of Commerce · 2 · 2 · 0 · BRAND · **CONFIRM → Canadian Imperial Bank of Commerce**  
14. CareCredit LLC · 2 · 2 · 0 · BRAND · MARK_AMBIGUOUS  
15. Corporation Service Company · 2 · 2 · 0 · BRAND · KEEP_CANDIDATE  

### Lane B (Multi-Application) — unique additions beyond overlap

1. Suffix Inc. · 24 · 0 · 13 · MULTI · **CONFIRM → Suffix**  
2. NextGEN TLDs GmbH · 22 · 0 · 11 · MULTI · NO_EVIDENCE  
3. Endpoint Domains, Inc. · 12 · 0 · 7 · MULTI · **CONFIRM → Endpoint Domains**  
4. Cam Connecting SARL · 11 · 0 · 8 · MULTI · KEEP_CANDIDATE  
5. TechEdge Limited · 10 · 0 · 8 · MULTI · KEEP_CANDIDATE  
6. Innovation Service Limited · 10 · 0 · 7 · MULTI · KEEP_CANDIDATE  
7. NAME SPACE LLC · 10 · 0 · 6 · MULTI · KEEP_CANDIDATE  
8. Public Interest Registry · 8 · 0 · 4 · MULTI · **CONFIRM → Public Interest Registry**  
9. Internet DotTrademark Organisation Limited · 7 · 0 · 4 · MULTI · KEEP_CANDIDATE  
10. Registered Agents Inc · 6 · 0 · 5 · MULTI · KEEP_CANDIDATE  
11. Hostinger UAB · 4 · 0 · 4 · MULTI · **CONFIRM → Hostinger**  
12. NETDREAM PTE. LTD. · 4 · 0 · 4 · MULTI · NO_EVIDENCE  

## Recommendation summary

| Recommendation | Count | Notes |
| --- | --- | --- |
| **CONFIRM** | 9 | All have ≥1 A or B evidence; none Brand-only / website-only / C|D-only |
| KEEP_CANDIDATE | 12 | Plausible but below CONFIRM threshold |
| MARK_AMBIGUOUS | 4 | Conflicting website vs legal-name / corporate-family boundary |
| REJECT_RELATIONSHIP | 0 | — |
| NO_EVIDENCE | 2 | Placeholder / invalid website only |

### CONFIRM recommendations (steward decision list)

| Applicant | Proposed Organization | Key | A/B summary |
| --- | --- | --- | --- |
| Suffix Inc. | Suffix | `suffix` | B strict self-identity + B first-party copyright |
| Endpoint Domains, Inc. | Endpoint Domains | `endpoint-domains` | B strict self-identity + B first-party copyright |
| Public Interest Registry | Public Interest Registry | `public-interest-registry` | B first-party Who We Are identity |
| Dine Brands Global, Inc. | Dine Brands Global | `dine-brands-global` | A SEC registrant exact match |
| Axon Enterprise, Inc. | Axon Enterprise | `axon-enterprise` | A SEC registrant match |
| Canadian Imperial Bank of Commerce | Canadian Imperial Bank of Commerce | `canadian-imperial-bank-of-commerce` | A SEC registrant match |
| Epic systems corporation | Epic Systems | `epic-systems` | B first-party copyright + B APS |
| Industria de Diseño Textil S.A. | Inditex | `inditex` | A SEC ADR title linking legal name↔Inditex |
| Hostinger UAB | Hostinger | `hostinger` | B privacy policy HOSTINGER, UAB + B APS |

**Existing Organization keys reused in CONFIRM set:** none (all newly proposed keys).  
**Parent/control:** AT&T Services notes AT&T Inc. as separate possible parent (KEEP_CANDIDATE only). PIR notes Internet Society as founding context, not collapse.

## Evidence safety gates

| Gate | Result |
| --- | --- |
| Brand-only CONFIRM | **0** |
| Website-only CONFIRM | **0** |
| C/D-only CONFIRM | **0** |
| Parent conflated into Organization | **0** |
| Cross-round approvals | **0** |
| Selected-RSP inferences | **0** |
| Existing CONFIRMED demotions | **0** |

Brand was used for **queue prioritization / C corroboration only**.

## PRO FORMA if steward approves all 9 CONFIRM recommendations

**Not product-actual. No mappings changed.**

| Delta | Value |
| --- | --- |
| Additional Confirmed Applicant mappings | +9 (145→154) |
| Additional Confirmed Organizations | +9 new keys (89→98) |
| Applications newly entering Confirmed coverage | **+63** (1,036→1,099) |
| Brand Applications newly entering Confirmed coverage | **+15** (126→141) |
| Contention memberships newly entering Confirmed coverage | **+29** (685→714) |
| Distinct contention sets affected | **29** |
| Remaining unresolved Applicants | **322** |
| Remaining unresolved Applications | **475** |

Residual Brand gap would remain large (205−15 = **190** Brand Applications still unresolved) — this tranche is intentionally bounded.

## Downstream potential (only if 1B approves)

| Surface | Potential |
| --- | --- |
| Organization Profiles | New profiles for 9 keys |
| Organization Compare | New comparable Organizations |
| Competitive Landscape | Confirmed rollups gain 63 Applications |
| Contention | Aggregation/context enrichment only (263/891 unchanged) |
| Cross-round | **None** in this unit (no returning approvals) |
| Change future Org context | Keys would be available later to attach; Change Intel untouched here |

## Non-goals honored

No HIST-COHORT-2C · no category taxonomy · no selected-RSP claims · no Change Intelligence mutation · no registry steward APPROVE edits · no resolve-all-331 · no UI.

## Next step

Return to Prompt Agent / product steward. If any CONFIRM rows are accepted, issue **ORG-RES-TRANCHE-1B** with the exact approved Applicant → Organization transitions only.
