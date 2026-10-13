# ORG-RES-TRANCHE-1A — steward review package

**Status:** RESEARCH / EVIDENCE / RECOMMENDATION only  
**Decision id:** `RIH-ORG-RES-TRANCHE-1A-20261013`  
**Baseline commit:** `b110927` (prioritization tip)  
**Parent production source:** `a2e334f`

## Steward disclaimer (mandatory)

This package **does not** grant steward approval and **does not** create product-eligible CONFIRMED Organization mappings.

- Build Agent recommendations ≠ APPROVE.
- No `resolutionState=CONFIRMED` transitions were applied.
- No changes were made to `organization-resolution-registry.json` approvals.
- Production Organization semantic hash remains  
  `4837173224fc89ae617de3620396950e18c8da99a5333459a8782e032ce3bb87`.
- A separate **ORG-RES-TRANCHE-1B** authorization is required before any CONFIRM recommendation becomes product-actual.

## Queue selection method

Deterministic dual-lane union over currently **UNRESOLVED** Applicant legal names (no fabricated weighted score):

1. **Brand lane** — Brand Applications ≥ 1; top 15 by Brand count ↓, Applications ↓, contention memberships ↓, legal name ↑  
2. **Multi-Application lane** — Applications ≥ 2; top 15 by Applications ↓, Brand ↓, contention memberships ↓, legal name ↑  
3. Union + de-duplicate; max 30; do not pad  

Implementation: `src/organization-resolution-2026/applicant-identity/tranche-1a-queue.ts`  
Committed queue: `src/organization-resolution-2026/fixtures/org-res-tranche-1a-queue.json`  
Evidence package: `src/organization-resolution-2026/fixtures/applicant-identity-evidence-package-tranche1a.json`

### Selection result

| Lane | Count |
| --- | --- |
| Brand | 15 |
| Multi-Application | 15 |
| Overlap | 3 |
| Unique dossiers | **27** |

Overlap: Amazon Registry Services, Inc. · Industria de Diseño Textil S.A. · ML 35 LLC

High-impact multi-Application names from prioritization (Suffix, NextGEN, Endpoint, Cam Connecting, Innovation Service, NAME SPACE, TechEdge, Amazon, PIR) appear via the deterministic Multi lane (Amazon also Brand). They were **not** hard-coded.

## Current actual coverage (unchanged)

| Metric | Value |
| --- | --- |
| Confirmed Applicant mappings | 145 |
| Confirmed Organizations | 89 |
| Candidate / Ambiguous / Unresolved | 2 / 2 / 331 |
| Applications under Confirmed Orgs | 1,036 / 1,614 |
| Brand Applications under Confirmed Orgs | 126 / 333 |
| Contention memberships under Confirmed Orgs | 685 / 891 |
| Organization semantic hash | `48371732…e3bb87` |

## Recommendations summary

| Recommendation | Count |
| --- | --- |
| CONFIRM | 15 |
| KEEP_CANDIDATE | 8 |
| MARK_AMBIGUOUS | 2 |
| REJECT_RELATIONSHIP | 0 |
| NO_EVIDENCE | 2 |

### CONFIRM (steward decision required)

| Applicant | Proposed Organization | Key | Existing? | Primary A/B basis |
| --- | --- | --- | --- | --- |
| Amazon Registry Services, Inc. | Amazon | `amazon` | new | APS Q12 100% owned by Amazon.com, Inc.; Q108 |
| ALIBABA INNOVATION PRIVATE LIMITED | Alibaba Group | `alibaba-group` | **reuse** | APS QPE/ultimate control Alibaba Group Holding Limited |
| Industria de Diseño Textil S.A. | Inditex | `inditex` | new | APS Q12 aka INDITEX, S.A. + existing .Zara RO |
| AT&T Services, Inc. | AT&T | `att` | new | APS parent/control AT&T Inc. |
| CareCredit LLC | Synchrony | `synchrony` | new | APS parent/control Synchrony Financial |
| Corporation Service Company | CSC | `csc` | new | APS subsidiary of WMB Holdings + CSC registrar family |
| ML 35 LLC | Bank of America | `bank-of-america` | new | APS 100% indirect owner Bank of America Corporation |
| Beijing Zitiao Network Technology Co., Ltd. | ByteDance | `bytedance` | new | APS ultimate parent/control Bytedance Ltd. |
| Douyin Vision Co., Ltd. | ByteDance | `bytedance` | new (shared) | same ownership chain |
| Taisho Pharmaceutical Co., Ltd. | Taisho Pharmaceutical | `taisho` | new | APS wholly-owned operating company of Holdings |
| Public Interest Registry | Public Interest Registry | `pir` | new | Existing RO; Internet Society parent/control separate |
| Hostinger UAB | Hostinger | `hostinger` | new | Strict hostinger.com self-identity + Hostinger-group APS disclosures |
| Epic systems corporation | Epic Systems | `epic-systems` | new | APS Spec-13 self brand-TLD mission for Epic Systems Corporation |
| Innovation Service Limited | Innovation Service Limited | `innovation-service` | new | Existing RO of .HELP (self) |
| Internet DotTrademark Organisation Limited | Internet DotTrademark Organisation | `internet-dottrademark` | new | Existing RO; DotTrademark Holding parents separate |

Parents/control are stored as separate fields. Product brands / applied-for strings are not Organizations.

### KEEP_CANDIDATE

Axon Enterprise, Inc. · American Lebanese Syrian Associated Charities, Inc. · Canadian Imperial Bank of Commerce · Dine Brands Global, Inc. · Endpoint Domains, Inc. · Cam Connecting SARL · NETDREAM PTE. LTD. · TechEdge Limited

### MARK_AMBIGUOUS

NAME SPACE LLC · Registered Agents Inc

### NO_EVIDENCE

Suffix Inc. · NextGEN TLDs GmbH

## PRO FORMA if steward approves **all** CONFIRM recommendations

**Not product-actual. No mappings changed.**

| Metric | Delta / result |
| --- | --- |
| Additional Confirmed Applicant mappings | +15 → 160 |
| Existing Organization keys reused | 1 (`alibaba-group`) |
| New Organization keys proposed | 13 |
| Confirmed Organizations (pro forma) | 89 + 13 = 102 |
| Additional Applications covered | +67 → 1,103 |
| Additional Brand Applications covered | +38 → 164 |
| Additional contention memberships covered | +22 → 707 |
| Distinct contention sets affected | 21 |
| Remaining UNRESOLVED Applicants | 316 |
| Remaining UNRESOLVED Applications | 471 |

## Downstream potential (only if later approved)

Organization Profiles · Organization Compare · Competitive Landscape · Contention aggregation context · future Change Organization context.

**Not created by this unit:** cross-round returning identity · selected-RSP claims · category taxonomy · HIST-COHORT-2C · ChangeRecord schema changes.

## Evidence safety checklist

| Rule | Result |
| --- | --- |
| Brand-only CONFIRM | 0 |
| Website-only CONFIRM | 0 |
| C/D-only CONFIRM | 0 |
| Parent conflated into Organization key | 0 (parents stored separately) |
| Cross-round approvals | 0 |
| Selected-RSP inferences | 0 |
| New product CONFIRMED mappings | 0 |

## Artifacts

- `src/organization-resolution-2026/fixtures/applicant-identity-evidence-package-tranche1a.json`
- `src/organization-resolution-2026/fixtures/org-res-tranche-1a-queue.json`
- `src/organization-resolution-2026/applicant-identity/tranche-1a-queue.ts`
- `src/organization-resolution-2026/applicant-identity/tranche-1a-governance.test.ts`
- `scripts/generate-org-res-tranche-1a-package.mjs` (regeneration helper; not a runtime dependency)

## Next

Return to Prompt Agent / product steward. If any CONFIRM rows are accepted, authorize **ORG-RES-TRANCHE-1B** with the exact approved Applicant → Organization transitions. Do not apply approvals automatically.
