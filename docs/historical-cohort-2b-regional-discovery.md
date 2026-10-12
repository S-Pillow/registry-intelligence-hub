# HIST-COHORT-2B — 2012 regional Applicant-structure discovery

**Status:** Discovery / design only (no product implementation in this ticket)  
**Branch base:** `2ac77b0238556052d5144146df44f783f7016e47`  
**Grain:** exact 2012 Applicant legal name  
**Scope:** 2012-only regional participation structure on `/historical-cohorts`

---

## 1. Source semantics

### Where region comes from

| Layer | Field | Notes |
| --- | --- | --- |
| Raw ICANN Reveal Day CSV | `Region` | Column 5 of the 14-column 13 Jun 2012 strings CSV (`EXPECTED_HEADER` in `parse-reveal-csv.ts`) |
| Parsed row | `preservedColumns.Region` | Trimmed; empty → `null` |
| Browser Application | `application.region` | `row.preservedColumns.Region?.trim() \|\| "Unknown region"` in `build-browser-payload.ts` |
| Sibling field | `Location` → `applicantJurisdiction` / `application.country` | **Not** used to derive region |

**Source-provided or derived?** **Source-provided.** The region code is copied from the ICANN Reveal Day CSV `Region` column. No country→region mapping table is applied in the 2012 browser-payload path. Normalization trims whitespace only; it does not rewrite codes to prose names.

**Mapping / version:** none beyond Reveal Day CSV parse + browser payload projection. Structural summary records `regionField: "Region"` and `locationField: "Location"`.

### Accepted raw values (re-derived)

Exactly five codes, covering all 1930 Applications:

| Raw code | Applications |
| --- | ---: |
| `NA` | 911 |
| `EUR` | 675 |
| `AP` | 303 |
| `LAC` | 24 |
| `AF` | 17 |
| **Total** | **1930** |

No null / empty / `Unknown region` rows in the committed fixture.

### Display labels

Existing Command Center 2012 geography UI intentionally surfaces **ICANN region codes** (`NA`, `EUR`, `AP`, `LAC`, `AF`) and does **not** relabel them to rehearsal prose names (“North America”, “Europe”, …). HIST-COHORT-2B should stay code-faithful on the business surface:

- Primary row label = source code.
- Optional conventional expansions (North America, Europe, Asia-Pacific, Latin America / Caribbean, Africa) may appear only in methodology / parenthetical glossary, never as “markets.”

### What region means

Region describes the Applicant’s **published ICANN Reveal Day regional classification** associated with the Application row (Applicant address / Applicant location region in the Reveal Day export), **not**:

- applied-for string geography;
- Geographic-designation Applications (`Geographic?` column → `type: "Geographic"`);
- registry service location;
- Organization headquarters;
- target market or economic market.

**Geographic designation is separate.** There are **55** Geographic-designation Applications in the corpus; they appear across all five region codes and must not be conflated with Applicant region.

---

## 2. Coverage

| Metric | Count |
| --- | ---: |
| Applications total | 1930 |
| Region populated | 1930 |
| Null / unknown / unmapped | 0 |
| Unexpected codes | 0 |
| Distinct region codes | 5 |

Totals reconcile to 1930. Prior Application baseline (911 / 675 / 303 / 24 / 17) **re-derived exactly**.

---

## 3. Applicant-region consistency

Exact Applicant legal-name grouping (trim semantics matching existing cohort grain; fixture legal names already unique as stored):

| Metric | Count |
| --- | ---: |
| Applicant legal names | 1154 |
| Single-region Applicants | 1154 |
| Multi-region Applicants | **0** |
| Applications affected by conflict | **0** |

Every Applicant legal name maps cleanly to exactly one region. No conflict resolution rule is required for v1.

Prior Applicant baseline (606 / 304 / 220 / 15 / 9) **re-derived exactly**; sum 1154.

---

## 4. Regional counts and shares

Denominators: **1154** Applicant legal names · **1930** Applications.

| Region code | Applicants | Applicant share | Applications | Application share |
| --- | ---: | ---: | ---: | ---: |
| NA | 606 | 52.51% | 911 | 47.20% |
| EUR | 304 | 26.34% | 675 | 34.97% |
| AP | 220 | 19.06% | 303 | 15.70% |
| LAC | 15 | 1.30% | 24 | 1.24% |
| AF | 9 | 0.78% | 17 | 0.88% |
| **Total** | **1154** | **100%** | **1930** | **100%** |

Percentages use two-decimal deterministic formatting (`100 * n / d`).

---

## 5. Portfolio structure by region

Descriptive intensity only — **not** productivity, success, strength, or performance.

| Region | Mean apps / Applicant | Median | One-off Applicants | One-off share | Multi Applicants | Multi share |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| NA | 1.503 | 1 | 524 | 86.47% | 82 | 13.53% |
| EUR | 2.220 | 1 | 251 | 82.57% | 53 | 17.43% |
| AP | 1.377 | 1 | 173 | 78.64% | 47 | 21.36% |
| LAC | 1.600 | 1 | 11 | 73.33% | 4 | 26.67% |
| AF | 1.889 | 1 | 5 | 55.56% | 4 | 44.44% |

**Insight:** Europe’s Application share (34.97%) exceeds its Applicant share (26.34%) because mean portfolio size is highest among large regions (2.22). Asia-Pacific’s Applicant share (19.06%) exceeds Application share (15.70%) with a lower mean (1.38). North America has the most Applicants and Applications but a lower mean than Europe (1.50).

### Outlier sensitivity (research context only)

Median is **1** in every region; means are pulled up by large legal-name portfolios. Top Applicant legal names by region (research only — **not** recommended as a product leaderboard):

| Region | Largest (apps) | Next |
| --- | --- | --- |
| NA | Charleston Road Registry Inc. (101) | Dish DBS Corporation (13); Lifestyle Domain Holdings, Inc. (13) |
| EUR | Amazon EU S.à r.l. (76) | Top Level Domain Holdings Limited (70); Uniregistry, Corp. (54) |
| AP | Asia Green IT System… (8); GMO Registry, Inc. (8) | Kerry Trading Co. Limited (6) |
| LAC | Despegar Online SRL (5) | PRIMER NIVEL S.A. (3); Punto 2012… (3) |
| AF | Electronic Media Network Limited (M-Net) (4) | MultiChoice Africa… (3); UniForum SA… (3) |

Do **not** merge Charleston Road into Google or Afilias entities into an Organization total.

---

## 6. Product story (source-backed)

**Primary question:** How were 2012 Applicant legal names and Applications distributed across Applicant regions?

**Secondary insight:** Where does Application volume differ from Applicant-count share because of portfolio structure (descriptive intensity)?

Supported, non-causal copy (using codes; conventional expansions only in methodology):

- Region **NA** accounts for the largest share of 2012 Applicant legal names (52.51%) and Applications (47.20%).
- Region **EUR** represents a larger share of Applications (34.97%) than of Applicant legal names (26.34%).
- Region **AP** represents a meaningful share of Applicant legal names (19.06%) but a smaller share of Applications (15.70%).

**Unsupported:** performance, market value, strategy, regulation, or maturity explanations. No 2012→2026 regional deltas.

---

## 7. Semantic safety

| Boundary | Rule |
| --- | --- |
| Grain | Exact Applicant legal name only |
| Organization | No affiliate / parent / acquisition merge |
| Geographic designation | Separate attribute; methodology must disambiguate |
| Cross-round regional comparison | Out of scope (blocked by CROSS-ROUND-STRUCT-1) |
| “Market” wording | Forbidden unless source establishes it (it does not) |
| Region labels | Prefer source codes; expansions are glossary-only |

Recommended methodology sentence:

> Region is the ICANN 2012 Reveal Day `Region` code on each Application (`NA`, `EUR`, `AP`, `LAC`, `AF`). It classifies the Applicant’s published regional field — not the Geographic Application designation, not Organization headquarters, and not a market.

---

## 8. Drilldown

Historical Explore already supports a **region** filter for `dataset=2012-historical`:

- Query parameter: `region` (values = source codes: `NA`, `EUR`, `AP`, `LAC`, `AF`)
- Example (app-relative; Next prefixes basePath):  
  `/explore?dataset=2012-historical&entity=applications&region=NA`
- Behavior: filters **Applications** whose `application.region` equals the selected code; preserves 2012-only context via `dataset=2012-historical`
- No new query parameter is required for v1

There is currently no dedicated `exploreHistorical2012RegionHref(code)` helper (unlike IDN / contention helpers). Implementation may add a thin basePath-safe helper wrapping the existing filter — **not** a new filter semantics.

**Recommendation:** include per-region Explore drilldown in v1 using the existing filter.

---

## 9. Performance design

Reuse the existing historical-cohort **server-side derivation** pattern (`buildHistoricalCohortIntelligence` / structural summary style):

- Server reads the committed 2012 corpus once.
- Browser receives **5 regional rows** + small metadata (denominators, methodology flags, optional drilldown hrefs).
- Do **not** hydrate 1930 Application rows into the cohort page for this lens.

Estimated serialized payload impact: on the order of a few KB for five rows + shares/means (similar to existing band / concentration blocks). Full corpus remains server-only.

---

## 10. Page placement

Extend **`/historical-cohorts`** (no new primary nav; no new top-level route).

Proposed narrative order:

1. Portfolio bands / one-off vs multi / concentration / largest portfolios (HIST-COHORT-1)
2. Exact-string competition exposure (HIST-COHORT-2A)
3. **Regional Applicant structure (HIST-COHORT-2B)** — after 2A

The page is already multi-section. Prefer **in-page section navigation / anchors** (e.g. header jump links already used for exact-string) rather than a new route. A fourth analytical section remains coherent if kept compact (five-row view + methodology).

Proposed title: **2012 Applicant regional structure**  
Avoid: “Geographic structure.”

---

## 11. Design options

### A — Paired Applicant-share vs Application-share bars

- **Shows:** five regions; two share bars each; exact counts as labels  
- **Answers:** primary + secondary product questions visually  
- **Strengths:** exposes NA / EUR / AP share divergence immediately  
- **Weaknesses:** needs careful accessibility + exact-number pairing  
- **Payload:** 5 rows  
- **Risks:** low if codes + methodology stay clear  

### B — Compact comparison table

- **Shows:** Region · Applicants · Applicant % · Applications · Application % · optional mean apps/Applicant  
- **Answers:** same questions with maximum numeric clarity  
- **Strengths:** exact denominators; easy to test; matches provenance discipline  
- **Weaknesses:** slightly less glanceable than paired bars  
- **Payload:** 5 rows  
- **Risks:** lowest  

### C — Stat cards + table

- **Shows:** hero cards for NA/EUR/AP plus detail table  
- **Strengths:** emphasis  
- **Weaknesses:** overweights large regions; feels like “winners”; more chrome  
- **Payload:** still small  
- **Risks:** implies ranking / performance  

### Recommendation

**B as primary surface, with optional lightweight paired-share visualization (A) beside or above the table if implementation stays compact.**

Do **not** ship C. Do **not** ship regional top-Applicant leaderboards, maps, exact-string-by-region, contention-by-region, or cross-round regional deltas.

Mean Applications per Applicant may appear as a secondary column **only** with explicit “descriptive portfolio intensity” wording.

---

## 12. Provenance (business-facing)

Recommend disclosing:

- ICANN 2012 Reveal Day historical source;
- Applicant legal-name grain;
- Region = Reveal Day `Region` code (source-provided);
- Application denominator 1930;
- Applicant legal-name denominator 1154;
- Geographic designation is a separate attribute;
- 2012-only; not a 2026 regional comparison;
- no Organization merging.

Do not surface internal fixture filenames / schema IDs on the normal business surface.

---

## 13. Proposed implementation acceptance criteria

1. Server-derived five-row regional aggregates only (no full corpus in the browser model for this section).  
2. Exact pins: Applications NA 911 / EUR 675 / AP 303 / LAC 24 / AF 17 (= 1930); Applicants 606 / 304 / 220 / 15 / 9 (= 1154).  
3. Shares match deterministic two-decimal formatting against 1154 / 1930.  
4. Zero multi-region Applicant legal names asserted (or fail closed if future corpus violates).  
5. Title / copy use “Applicant regional structure” (not “Geographic structure” / “markets”).  
6. Methodology states Region ≠ Geographic designation; grain = Applicant legal name; 2012-only.  
7. No Organization aggregation; Charleston Road remains distinct.  
8. No cross-round regional deltas.  
9. Optional Explore drilldown uses existing `region` + `dataset=2012-historical` (codes).  
10. Section placed on `/historical-cohorts` after exact-string; in-page nav updated if needed.  
11. Existing HIST-COHORT-1 / 2A pins unchanged.  
12. No primary-nav changes; no IDN cohort work in the same ticket.

---

## 14. Verdict

**READY FOR IMPLEMENTATION**

Region semantics are source-established; totals reconcile; Applicant↔region consistency is clean (0 conflicts); no unsupported mapping; the product question adds intelligence beyond raw global counts; 2012-only boundaries are clear; a performant five-row server-derived design fits the existing cohort architecture.

---

## 15. Out of scope (explicit)

- Production UI implementation  
- IDN historical cohorts  
- Cross-round regional comparison  
- Regional exact-string competition / regional contention  
- New Explore query parameters  
- Country→region remapping  
- Organization / affiliate merging  
