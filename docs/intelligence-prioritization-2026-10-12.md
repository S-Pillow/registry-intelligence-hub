# RIH next intelligence investment — 2026-10-12

**Unit:** RIH-INTEL-PRIORITY-1 (discovery / prioritization only)  
**Baseline:** `a2e334f` / tree `bd33293` / BUILD `TzvGUWSLVPzF0LZluHG8H`  
**Method:** read-only quantification against production runtime data + committed fixtures. No mappings, refreshes, or product implementation.

## 1. Decision

| Role | Candidate |
| --- | --- |
| **NEXT** | **A1 — Organization-resolution depth** (scoped Brand + multi-Application unresolved tranche) |
| **RUNNER-UP** | **B — Change Intelligence actionability** (affected-context / investigation continuation) |
| **DEFER** | A2 (Applicant-only depth as primary), C (provider/channel), D (HIST-COHORT-2C IDN), E (category/market) |

**Why A1 now:** Confirmed Organization intelligence already powers Competitive Landscape, Organization Profiles, Org Compare, returning overlays, and contention rollups — but **538 / 1,614 Applications (33%)** and **205 / 333 Brand Applications (62%)** still cannot enter that layer. That is a concentration and contention blind spot APS cannot close. Applicant-level surfaces already cover unresolved names; the blocked value is Organization rollup, not another Applicant chart.

**Smallest next authorization:** a **resolution tranche / evidence discovery** unit (not a UI feature): steward-ready evidence packaging for (1) Brand Applications under UNRESOLVED Applicants and (2) largest multi-Application UNRESOLVED portfolios, fail-closed, no auto-confirm.

## 2. Current product state

Live intelligence layers (post HIST-COHORT-2B + HIST-EXPLORE-ROUTING-1):

Command Center hierarchy · Explore (2026 + historical routing) · Competitive Landscape · official Contention · Applicant / Organization Profiles · Compare · cross-round structural · returning Organization overlays · HIST-COHORT-1/2A/2B · historical Explore drillthrough · scheduled Change Intelligence · public RSP posture · provenance/actuality controls.

Material gaps that still block decisions:

- Organization-complete competitive concentration (round-wide org view remains blocked; confirmed coverage 64% Applications / 77% contention memberships).
- Change → confirmed Organization context (detection live; Organization not on `ChangeRecord`).
- Selected RSP / true provider channel (non-public).
- 2026 category / market taxonomy (absent).

## 3. Candidate matrix

| Candidate | Evidence | Product value | vs APS | Cross-surface | Semantic risk | Size | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **A1 Org resolution depth** | READY WITH LIMITATION | HIGH | HIGH | HIGH | MEDIUM | MEDIUM (scoped) / LARGE (all 331) | **NEXT** |
| **A2 Applicant-only depth** | READY | MEDIUM | MEDIUM | MEDIUM | LOW | MEDIUM | Defer as primary (mostly live) |
| **B Change actionability** | READY WITH LIMITATION | HIGH | HIGH | HIGH | LOW | SMALL–MEDIUM | **RUNNER-UP** |
| **C Provider / channel** | READY WITH LIMITATION | MEDIUM | HIGH | MEDIUM | HIGH | MEDIUM | Defer |
| **D HIST-COHORT-2C IDN** | READY | LOW–MEDIUM | LOW | LOW | LOW | SMALL | Defer |
| **E Category / market** | NOT READY | HIGH (strategic) | HIGH (if ready) | HIGH | HIGH | LARGE | Defer |

Labels are gates, not a weighted score.

## 4. Evidence / gap findings

### A — Organization / participant

**Current resolution:** 145 Confirmed Applicant mappings · 89 Confirmed Organizations · 2 Candidate · 2 Ambiguous · **331 Unresolved**.

Read-only impact of UNRESOLVED (production org snapshot + browser + contention publication):

| Gap | Count | Share |
| --- | --- | --- |
| Unresolved Applicants | 331 | 331 / 480 observed legal names |
| Applications under unresolved Applicants | **538** | **33.3%** of 1,614 |
| Brand Applications under unresolved Applicants | **205** | **61.6%** of 333 Brand |
| Contention memberships under unresolved Applicants | **188** | **21.1%** of 891 |
| Distinct contention sets touched by unresolved Applicants | **137** | **52.1%** of 263 |
| Multi-Application unresolved Applicants | **69** | 276 Applications |
| Confirmed Application coverage (contrast) | 1,036 | 64.2% |
| Confirmed contention membership coverage (contrast) | 685 | 76.9% |

Largest unresolved portfolios (Applications): Suffix Inc. 24 · NextGEN TLDs GmbH 22 · Endpoint Domains 12 · Cam Connecting SARL 11 · Innovation Service / NAME SPACE / TechEdge 10 each · Amazon Registry Services, Inc. 8 (all Brand) · Public Interest Registry 8.

**A1 vs A2**

- **A1 (more Organization evidence):** unlocks Org Profiles, Org Compare, confirmed returning overlays, org-level landscape/contention rollups for the unresolved slice. **Select A1.**
- **A2 (Applicant intelligence without Organization):** largely already shipped (Applicant Profiles, Applicant Compare, Landscape, Explore). Further A2 work is incremental polish, not the blocked rollup. **Reject A2 as the primary next investment.**

**Strongest questions**

1. Which unresolved Brand and multi-Application portfolios most distort confirmed Organization competitive concentration and contention rollups?
2. Which high-portfolio UNRESOLVED Applicant legal names are evidence-ready for a steward CONFIRMED tranche without semantic overreach?

**Surfaces compounded:** Organization · Compare · Competitive Landscape · Contention · Command Center coverage · Cross-round returning overlays · (later) Changes org context.

### B — Change actionability

**Runtime (read-only, unchanged):** 3 observations · 2 diffs · `lastCheckedAt` 2026-10-12T13:16:25.080Z · latest meaningful change: none · timer enabled/active. No refresh invoked.

**Model already answers today (when a change exists):**

| Question | Support |
| --- | --- |
| What changed? | Change types + field diffs |
| Which Applicant? | `applicantLegalName` + Applicant Profile link |
| Application context? | `applicationId` + Explore href |
| Contention exposure? | `contentionSetId` + `/contention?set=` when membership-shaped |
| GoDaddy affected? | `GODADDY_DIRECT` / `GODADDY_CONTENTION` bands |
| RSP public posture? | Label on record |
| Confirmed Organization? | **Not on `ChangeRecord`** |
| Compare / “investigate next” playbook? | **Missing / partial** |

Production meaningful-change events: **0** — linkage rates among real events are not yet observable; assessment is from the typed model + Changes UI.

**Strongest questions**

1. When a public Application or contention membership changes, which GoDaddy contention exposures and confirmed Organizations are affected?
2. What is the deterministic next investigation path (Applicant → set → Organization → Compare)?

**Surfaces compounded:** Changes · Command Center recent-changes · Explore · Contention · Applicant · (Organization once A1 attaches keys).

### C — Provider / channel

Accepted aggregate: **479** external non-GoDaddy Applicants · **476** no public Main-RSP capability · **3** public Main-RSP capable · **0** via confirmed Organization.

**Supported now:** public evaluated Main-RSP capability match; self-RSP-capable visibility; research ordering without commercial claims.  
**Blocked forever without new public evidence:** available customer · unassigned · needs an RSP · GoDaddy opportunity · competitor selected · no selected provider.

**Strongest question:** Which large Applicant / confirmed Organization portfolios publicly demonstrate their own Main-RSP capability, and where does that intersect contention?

**Verdict:** strategically differentiated but **positive-signal coverage is tiny (3 / 479)**. Expanding claims now risks semantic overreach. Defer until more public capability evidence or a bounded “capability ∩ contention” discovery proves decision value.

### D — HIST-COHORT-2C (2012 IDN)

Committed corpus: **116** IDN Applications · **67** Applicant legal names · **109** unique strings.

Structure:

- One-off IDN Applicants: 46 · multi: 21  
- Top portfolios: VeriSign Sarl 12 · Amazon EU S.à r.l. 11 · PIR 4 · …  
- Top-5 share of IDN apps ≈ 29%; top-10 ≈ 41%  
- Region: AP 51 (16.8% of AP apps) · EUR 50 (7.4%) · NA 14 (1.5%) · AF 1 · LAC 0  
- 31 IDN-only Applicants · 36 mixed IDN+non-IDN portfolios  

**Incremental value:** Explore already filters 116 IDN; CROSS-ROUND-STRUCT-1 already headlines 116 → 21; HIST-COHORT-1/2A/2B already cover portfolio, exact-string, and regional lenses. An IDN cohort would add a descriptive section, not a new decision class. AP enrichment is the only notable distinct signal — insufficient alone after three live historical lenses.

### E — Category / market

- **Accepted 2026 taxonomy:** none.  
- **Deterministic 2026 classification:** not available (`categoryInferencesCreated: 0`; browser omits `category`).  
- **2012 offline `registry-market-taxonomy/1.0` fixture exists** but is not an accepted 2026 product taxonomy.  
- **Market-demand / registrar signals:** not established for a bounded unit.  

**Verdict:** strategically large in the PRD, **NOT READY**. Needs a separate taxonomy/evidence foundation before any market-opportunity score or UI.

## 5. Adversarial check

1. **Strategic vs easy?** A1 is harder evidence work, not an easy chart. B is easier UX/derivation — valuable, but partly “because detection is live.”
2. **Could APS answer?** A1/B/C: no. D: mostly yes via export + existing Explore IDN filter. E: APS has no sector taxonomy.
3. **Unprovable identity?** A1 must remain steward + A/B evidence fail-closed (Brand flag ≠ Organization). C must not invent selected RSP. E must not invent demand.
4. **New decision vs new chart?** A1 enables org-level concentration/contention decisions currently blocked. D risks another chart. B improves investigation when events occur.
5. **Makes existing surfaces more useful?** A1 yes (Org/Compare/Landscape/Contention). B yes (Changes/CC). D weak. C weak at current coverage.
6. **Foundational blocker first?** Category is more foundational for *market* intel but not evidence-ready. For *participant* intel, Organization coverage is the active blocker — and it also unlocks richer Change org context (helps B later).

**Collapsed under check:** D (incremental), E (not ready), C (signal-starved / high semantic risk), A2-as-primary (already largely delivered).

## 6. Recommended next authorization

**Ticket concept:** `ORG-RES-TRANCHE-1` (name flexible) — scoped Organization-resolution evidence tranche.

**Scope**

1. Inventory UNRESOLVED Applicants with ≥1 Brand Application and/or multi-Application portfolios (priority by Application count × Brand × contention memberships).  
2. Package steward-reviewable evidence dossiers only where public A/B-grade evidence exists.  
3. Apply steward CONFIRMED / keep UNRESOLVED fail-closed (no auto-confirm from Brand designation alone).  
4. Re-measure coverage deltas (Applications, Brand, contention memberships/sets) after the tranche.  
5. Document residual gaps; do not claim round-complete Organization intelligence.

**Evidence boundary:** existing APS Applicant fields, ICANN public application materials already used by WEB-1/BRAND-1 patterns, steward registry. No paid enrichment campaign required to *start*; any new external evidence must be explicitly ticketed.

**Expected payoff:** more Applications/Brand/contention enter confirmed Organization Profiles, Org Compare, Landscape rollups, and returning overlays — compounding across live surfaces.

**Explicit non-goals:** HIST-COHORT-2C · category taxonomy · selected-RSP claims · Change scheduler changes · resolving all 331 in one unit · UI redesign.

## 7. Deferred work and revisit triggers

| Deferred | Why | Revisit when |
| --- | --- | --- |
| **B Change actionability** | Runner-up; basic path already live; 0 meaningful prod events | After first meaningful change wave, or immediately after A1 if org keys should attach to `ChangeRecord` |
| **A2 Applicant-only primary** | Profiles/Compare/Landscape already answer Applicant questions | Specific Applicant question not covered by current profiles |
| **C Provider/channel** | 3 / 479 positive Main-RSP signals; high overclaim risk | Evaluated-RSP list gains material cleared matches, or bounded capability-and-contention discovery succeeds |
| **D HIST-COHORT-2C IDN** | Evidence-ready but incremental after 1/2A/2B + cross-round IDN | Explicit demand for AP/IDN historical narrative beyond Explore filter |
| **E Category/market** | No accepted 2026 taxonomy / demand evidence | Taxonomy contract + provenance design accepted in a dedicated discovery |

---

*Not a PRD. Not a roadmap rewrite. Implementation of the winning candidate is out of scope for this unit.*
