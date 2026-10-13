# ORG-RES-TRANCHE-1C — targeted identity follow-up

**Status:** RESEARCH / RECOMMENDATION ONLY  
**Decision id:** `RIH-ORG-RES-TRANCHE-1C-20261013`  
**Baseline tip:** `13538b9` (ORG-RES-TRANCHE-1B CLOSED/LIVE)  
**Evidence package:** `src/organization-resolution-2026/fixtures/applicant-identity-evidence-package-tranche1c.json`

## Steward disclaimer (mandatory)

This unit **does not** approve Organization mappings.

- No `resolutionState=CONFIRMED` transitions were applied.
- No steward `APPROVE` decisions were recorded.
- Product Organization counts / semantic hash must remain the 1B baseline.
- **CONFIRM** below means *recommend for steward approval*, not product eligibility.

## Controlling question

1A may have conflated:

- **A.** Can this Applicant be identified as a defensible operating Organization?
- **B.** Can this Applicant be proven to belong to a larger parent / corporate group?

For 1C, **A may be sufficient**. **B is not required** unless the proposed Organization itself is the broader parent/group.

## Scope

Exactly ten currently non-CONFIRMED Applicants from ORG-RES-TRANCHE-1A:

1. Amazon Registry Services, Inc.  
2. AT&T Services, Inc.  
3. Taisho Pharmaceutical Co., Ltd.  
4. Corporation Service Company  
5. Registered Agents Inc  
6. Cam Connecting SARL  
7. ALIBABA INNOVATION PRIVATE LIMITED  
8. American Lebanese Syrian Associated Charities, Inc.  
9. NAME SPACE LLC  
10. TechEdge Limited  

## Current product baseline (unchanged)

| Metric | Value |
| --- | --- |
| Confirmed Applicant mappings | 154 |
| Confirmed Organizations | 98 |
| Candidate / Ambiguous / Unresolved | 2 / 2 / 322 |
| Confirmed Applications | 1,099 |
| Confirmed Brand Applications | 141 |
| Confirmed contention memberships | 714 |
| Confirmed contention set coverage | 254 / 263 |
| Organization semantic hash | `52aca2c47520e42da7773b546fff4996f307a677e2ec679546dc568d9a0b2ad8` |

## Recommendation summary

| Recommendation | Count |
| --- | --- |
| **CONFIRM** | 7 |
| KEEP_CANDIDATE | 3 |
| MARK_AMBIGUOUS | 0 |
| NO_EVIDENCE | 0 |

### CONFIRM recommendations

| Applicant | Organization | Key | Reuse? | Parent / control (separate) | A/B basis |
| --- | --- | --- | --- | --- | --- |
| Amazon Registry Services, Inc. | Amazon Registry Services | `amazon-registry-services` | new | Amazon.com, Inc. | B Conditions of Use + B APS 100% ownership |
| AT&T Services, Inc. | AT&T Services | `att-services` | new | AT&T Inc. | A SEC Exhibit 21 YE2025 |
| Taisho Pharmaceutical Co., Ltd. | Taisho Pharmaceutical | `taisho-pharmaceutical` | new | Taisho Pharmaceutical Holdings Co., Ltd. | B APS operating-company + Holdings shareholder |
| Corporation Service Company | Corporation Service Company | `corporation-service-company` | new | — | B CSC Legal Terms (Corporation Service Company® / CSC®) |
| Cam Connecting SARL | Cam Connecting | `cam-connecting` | new | Affiliate AC WEBCONNECTING NV (not parent) | A Monaco Journal + B About |
| ALIBABA INNOVATION PRIVATE LIMITED | Alibaba Group | `alibaba-group` | **reuse** | Alibaba Group Holding Limited (common control) | B APS common-control affiliate disclosure |
| American Lebanese Syrian Associated Charities, Inc. | ALSAC | `alsac` | new | St. Jude relationship ≠ Organization | B stjude.org/legal + trademark split |

### KEEP_CANDIDATE

| Applicant | Reason |
| --- | --- |
| Registered Agents Inc | First-party legal captions inconsistent (Registered Agents Inc / Registered Agent Inc / Northwest Registered Agent Service Inc) |
| NAME SPACE LLC | Generic name; no A/B legal package; nmspc.co deeper pages unavailable |
| TechEdge Limited | Name-collision risk; marketing site + APS affiliate insufficient without unitary legal imprint |

## Canonicalization

| Proposed key | Existing Confirmed match |
| --- | --- |
| `amazon-registry-services` | no |
| `att-services` | no |
| `taisho-pharmaceutical` | no |
| `corporation-service-company` | no |
| `cam-connecting` | no |
| `alibaba-group` | **yes** (reuse; currently maps CLOUD INTELLIGENCE ASSETS HOLDING (SINGAPORE) PRIVATE LIMITED, Elegant Leader Limited) |
| `alsac` | no |

No Confirmed Organization key exists for CSC / Corporation Service Company. No St. Jude Hospital Organization key is created.

## PRO FORMA if steward later approves all 7 CONFIRM recommendations

**NOT PRODUCT ACTUAL. No mappings changed in this unit.**

| Delta | Value |
| --- | --- |
| Additional Confirmed Applicant mappings | +7 (154→161) |
| Existing Organizations reused | 1 (`alibaba-group`) |
| New Organizations | +6 (98→104) |
| Applications newly covered | **+30** (1,099→1,129) |
| Brand Applications newly covered | **+19** (141→160) |
| Contention memberships newly covered | **+10** (714→724) |
| Remaining Unresolved Applicants | **315** |
| Remaining Unresolved Applications | **445** |

Breakdown of +30 Applications: Amazon 8 · AT&T 2 · Taisho 3 · CSC 2 · Cam 11 · Alibaba Innovation 2 · ALSAC 2.

## Safety gates

| Gate | Result |
| --- | --- |
| Name-only CONFIRM | **0** |
| Website-only CONFIRM | **0** |
| C/D-only CONFIRM | **0** |
| Parent conflated into Organization | **0** (self Orgs; Alibaba Group reuse is H2 with explicit common-control evidence) |
| Brand-only CONFIRM | **0** |
| Cross-round approvals | **0** |
| Selected-RSP inferences | **0** |
| 1B mappings demoted | **0** |

## Non-goals honored

No 1B decision edits · no CONFIRMED transitions · no HIST-COHORT-2C · no category taxonomy · no RSP mappings · no Change Intelligence mutation · no UI redesign.

## Next step

Return to Prompt Agent / product steward. If any CONFIRM rows are accepted, issue a separate approval unit listing exact Applicant → Organization transitions only.
