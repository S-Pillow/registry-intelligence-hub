# Intelligence frontier discovery (INTEL-FRONTIER-1)

Read-only evidence / architecture discovery after:

- **ORG-RES-TRANCHE-1D** CLOSED/LIVE  
- **CHANGE-INTEL-2A** CLOSED/LIVE  
- **ORG-CONCENTRATION-1** CLOSED/LIVE  

Base: `249d8eb` / tree `d8517a57…` (production BUILD_ID `c_XyQaWnDQK4Gg-hDnToV`).

This document selects the next **defensible** intelligence investment among three frontiers. It does **not** implement product behavior, acquire external datasets, or mutate production.

---

## 1. Current intelligence frontier

RIH already answers (Confirmed-subset / source-backed):

| Layer | What exists |
| --- | --- |
| Application / Applicant | Explore, Applicant profiles, official aggregates 1615/481, represented 1614/480 |
| Organization identity | 161 Confirmed mappings → 104 Confirmed Organizations (hash `06ba3920…346c`) |
| Concentration | Portfolio + contention ranks/shares; crowded-set structure; GoDaddy-relative counterparts |
| Contention | Official 263/891; GoDaddy 77 apps / 66 memberships |
| Change | Scheduled public-source monitoring (2A CLOSED/LIVE); 2B evidence-gated |
| Cross-round | Confirmed returning sample; steward-gated expansion |
| RSP | Public Main-RSP posture only (479/476/3/0) |

**Still open structurally:** participant-to-participant **co-membership networks** beyond “counterparts of GoDaddy”; **replacement-string relationship analytics** beyond preserving `replacementString`; **post-delegation registry market / channel** baselines at TLD/operator/registrar grain.

Existing gates **unchanged** by this discovery:

- **CHANGE-INTEL-2B** — DEFERRED / EVIDENCE-GATED (needs meaningful multi-record production diffs).  
- **Another Organization tranche** — WATCH / EVIDENCE-GATED (residuals already researched).  
- **Cross-round expansion** — steward-confirmed identity only.

---

## 2. Frontier A — global Organization contention pairings

### Question

Can official contention membership + Confirmed Organization resolution yield a deterministic **Organization↔Organization structural co-membership model**?

### Evidence readiness: **HIGH**

No new acquisition. Inputs already LIVE:

- Active browser Application document V2 with official contention overlay (263 sets / 891 memberships).  
- Steward Organization resolution snapshot (Confirmed-only mappings).  
- ORG-CONCENTRATION-1 already proved GoDaddy-relative counterparts (21 Orgs / 214 memberships / top Identity Digital) — this frontier **generalizes** that edge type to all Confirmed Organization pairs.

### Discovery-derived scale (Confirmed-only; live prod data pinned to accepted publications)

| Metric | Value |
| --- | --- |
| Official sets / memberships | 263 / 891 |
| Confirmed memberships / unresolved (UNRESOLVED state) | 724 / 149 |
| Other non-Confirmed memberships (Candidate/Ambiguous) | 18 (excluded from pairs; not “Unknown Organization”) |
| Sets with ≥1 Confirmed Organization | 256 |
| Sets with ≥2 distinct Confirmed Organizations (pairable) | **208** |
| Unique undirected Confirmed Organization pairs | **165** |
| Pairs recurring across >1 shared set | **112** |
| Max shared-set count (single pair) | **77** (Identity Digital ↔ XYZ.COM LLC) |
| Confirmed Organizations that appear in ≥1 pair | **27** / 104 |
| Confirmed Organizations with zero Confirmed counterparts | 77 (mostly single-org or non-contended footprints) |

**Widest Confirmed counterpart networks (degree):**

| Organization | Distinct Confirmed counterparts |
| --- | --- |
| Link Freedom Group Ltd | 22 |
| GoDaddy (Registry Services, LLC) | 21 |
| Intercap Registry Inc. | 21 |
| XYZ.COM LLC | 21 |
| Identity Digital | 19 |

**GoDaddy-relative pairs:** **21** (matches ORG-CONCENTRATION-1). Top shared-set counts: Identity Digital 51, Link Freedom 32, XYZ 29, Intercap 19, ShortDot 18.

**Top global pairs by sharedSetCount:**

| Pair | Shared sets |
| --- | --- |
| Identity Digital ↔ XYZ.COM LLC | 77 |
| Identity Digital ↔ Link Freedom Group Ltd | 68 |
| GoDaddy ↔ Identity Digital | 51 |
| Link Freedom ↔ XYZ | 49 |
| Identity Digital ↔ Radix | 36 |

### Product questions — defensibility

| Question | Defensible now? |
| --- | --- |
| Which Confirmed Organizations most frequently co-occur in official sets? | **Yes** (sharedSetCount) |
| Widest network of distinct Confirmed counterparts? | **Yes** (degree) |
| Which pairs recur across multiple sets? | **Yes** (sharedSetCount > 1) |
| Who most often co-occurs with GoDaddy? | **Yes** (already partially surfaced; generalize) |
| Crowded sets with most distinct Confirmed Organizations? | **Yes** (extends crowded-set panel) |
| Footprint from many counterparts vs few repeated overlaps? | **Yes** (degree vs concentration of sharedSetCount) |

All remain **structural / source-backed**. None answer auction outcomes or commercial rivalry.

### Surface fit

Prefer existing surfaces — **no new top-level route**:

| Surface | Fit |
| --- | --- |
| `/contention` | Primary — pair tables, per-set Confirmed Organization composition, GoDaddy adjacency already adjacent |
| `/competitive-landscape` | Secondary — “repeated pairings” / network orientation under Confirmed concentration |
| `/organization` | High value — “frequent contention counterparts” for the profiled Org |
| Command Center home | **Out** — avoid home hierarchy churn |

### Recommended

**IMPLEMENT NEXT** as a focused unit (see §12).

---

## 3. Pairing semantics / formulas

### Safe terminology

**Use:** co-membership · shared official contention sets · repeated pairing · counterpart Organization · structural overlap  

**Avoid:** rival · threat · auction severity · win/loss · opportunity · market share · competitive adjacency *(too interpretive — prefer “structural co-membership”)*  

### Edge unit

Undirected edge between two **distinct Confirmed Organization IDs** when both have ≥1 Application membership in the **same official contention set**.

### Self handling

Multiple Applicants / Applications under the **same** Confirmed Organization in one set:

- **Do not** create a self-pair edge.  
- Underlying memberships remain visible at Applicant/Application grain.  
- Pair contribution for that set is among **distinct Organization IDs only**.

### Two separate measures (do not conflate)

| Measure | Definition | Notes |
| --- | --- | --- |
| **sharedSetCount** | Number of distinct official set IDs where both Orgs appear | Primary ranking key |
| **membershipInteractions** | Over shared sets, sum of `\|membA\| × \|membB\|` within each set | Captures multi-Application intensity; often equals sharedSetCount when each Org has one membership per set |

Keep both; **do not** invent a single opaque “strength” score.

### Optional companion fields

- `largestOfficialSharedSetSize` — official membership count of the largest co-membered set (clarify vs counterpart-only memberships — same carryforward caution as concentration’s `largestSharedSetMembershipCount`).  
- `sharedSetIds` — for drill-through.  
- `applicantPairs` — optional detail grain; not required for v1 ranking.  
- Share of each Org’s confirmed contention memberships that fall in sets shared with the counterpart — useful profile context; secondary.

### Ranking (sufficient for v1)

1. `sharedSetCount` DESC  
2. `membershipInteractions` DESC  
3. Organization canonical names ASC (stable tie-break)

### Coverage disclosure (required)

> Confirmed-Organization pairings describe co-membership among steward-Confirmed Organizations only. They cover the resolved portion of official contention (**724** Confirmed memberships; **208** / **263** sets contain ≥2 Confirmed Organizations). Unresolved Applicants are not paired as Organizations. Candidate/Ambiguous mappings are excluded.

---

## 4. Unresolved-coverage limitations

| Item | Handling |
| --- | --- |
| UNRESOLVED memberships (149) | Count in disclosure; **never** invent Unknown Organization edges |
| Candidate / Ambiguous memberships (18) | Exclude from Confirmed pairs; do not relabel as Unresolved Organization |
| Sets with only one Confirmed Org + unresolved others | No Confirmed–Confirmed edge; may still appear in crowded-set structure as PARTIAL_RESOLUTION |
| Pairable coverage | **676** Confirmed memberships sit in sets with ≥2 Confirmed Orgs; **208** pairable sets |

---

## 5. Frontier B — replacement / composition evidence

### Question

Do replacement rows + designation composition create **new** intelligence beyond Command Center / Explore aggregates?

### What the source already establishes

From APS Application CSV contract + publication 2.x (already implemented):

| Fact | Evidence |
| --- | --- |
| Replacement indicators | ID ends with `-R` **and** `Application Type == "Replacement String"` (disagree → fail closed) |
| Linkage | Base ID = strip final `-R`; base must exist; same Applicant Name |
| Multiplicity | **At most one** replacement row per Application (parser fail-closed on multiples) |
| Observed scale | **1169** replacement relationships on **1614** represented Applications |
| Grain | Logical Application = non-R ID; `replacementString` is **relationship evidence**, not a second Application |
| Statistics vs CSV | Apps with a replacement string count as **one** application on APS Statistics |
| After String Confirmation | Non-selected strings become `Deactivated` (Help / source contract) |

### Live composition of preserved relationships (browser payload)

| Slice | Count |
| --- | --- |
| Applications with `replacementString` | **1169** / 1614 |
| Replacement status Active / Deactivated | **442** / **727** |
| Processing stage | All observed replacement rows: Pre-Evaluation Processing |
| Label equals primary applied string | **0** (all 1169 labels differ — replacement is an alternate string) |
| Distinct Applicants with ≥1 replacement | 187 |
| Confirmed Organizations with ≥1 replacement | 19 |
| GoDaddy apps with replacement | **76** / 77 |
| Top Applicant replacement counts | Link Freedom 158 · XYZ 139 · GoDaddy 76 · Intercap 69 · Radix 46 |
| Brand apps among those with replacement | 13 / 333 Brand |

Designation row counts on represented Applications already match accepted orientation: Brand **333**, Community **16**, self-identified Geographic **15**, IDN **21**, variants **9**.

### Duplicate of existing UI risk: **HIGH** for designation tallies

Command Center / Explore / metric eligibility already expose Brand / Community / Geographic / IDN orientation. Another “count by type” chart fails the Frontier B value test.

### New intelligence that *could* be real (if scoped tightly)

1. **Replacement structure** — Active vs Deactivated replacement status; which portfolios nearly always filed a replacement string (e.g. GoDaddy 76/77).  
2. **String-change evidence** — primary vs replacement labels (always distinct in this capture).  
3. **Organization clustering of replacement intensity** — Confirmed Orgs that account for most replacement relationships.

These are **not** “withdrawn applications” and **not** variants unless separately evidenced. Variants remain a distinct APS grain (9 variant application types).

### Semantic blockers

- Must not equate replacement with withdrawal, supersession, or variant.  
- Must not double-count Applications when analyzing replacement presence.  
- Must not treat Deactivated replacement rows as round-loss without String Confirmation semantics.

### Recommended

**DEFER as NEXT.** Optionally schedule a later **small** unit only if product prioritizes string-replacement portfolio structure over contention networks. Designation-only composition: **DEFER permanently** as a standalone chart.

---

## 6. Replacement source semantics (normative summary)

```text
ReplacementString relationship:
  requires: applicationId.endswith("-R") AND applicationType == "Replacement String"
  baseApplicationId = applicationId without final "-R"
  integrity: base exists; same Applicant Name; at most one -R per base
  preserved fields: sourceRowId, label (replacement string), status, stage, type, provenance
  NOT a second logical Application in publication 2.x / browser projection
```

Contention membership forbids `-R` member IDs (official contention is Application-grain non-replacement).

---

## 7. Frontier C — market baseline source landscape

### Strategic upside: **HIGH** — but **not implementation-ready without a new source contract**

Post-delegation registry market questions (DUM, creates, renewals, registrar channel, abuse) live at **TLD / Registry Operator / Registrar** grains. They are **not** answerable from APS Application contention alone.

### Sources evaluated (public, read-only)

| Source | Publisher | Access | Machine-readable | Grain | Notes |
| --- | --- | --- | --- | --- | --- |
| **Monthly Registry Reports (MRR)** — transactions + activity CSVs | ICANN | Public web; ~3-month withhold | CSV per TLD / month | TLD (+ registrar rows in transactions) | Strongest authoritative baseline for domains, adds, renewals, transfer activity |
| **DNMI (Domain Name Marketplace Indicators)** | ICANN Open Data | Public CSV, no login (post-2026 migration) | CSV | Mostly category / ecosystem aggregates | Annual; robust competition / stability / trust indicators — not per-new-gTLD Application join |
| **Domain Metrica** (DAAR successor) | ICANN OCTO | ICANN account + API; role/licensing limits | JSON/CSV downloads where enabled | TLD / registrar / domain | Abuse focus; not a free anonymous bulk dump |
| **DAAR historical PDFs** | ICANN | Public archive | PDF (retired Sep 2025) | TLD aggregates | Historical only |
| **CZDS zone files** | Registries via ICANN CZDS | Credentialed requests; ToS limits | Zone files | TLD DNS names | Not registration WHOIS; redistribution restricted; heavy ops |
| **Registry first-party reports / filings** | Operators | Varies | Varies | Operator / TLD | Opportunistic; not a uniform contract |
| **Commercial SEO / “market share” sites** | Third parties | Public | Scraped HTML/API | Opaque | **Reject** for product facts |

### Channel / distribution readiness

| Metric | Public path? |
| --- | --- |
| Registrar concentration per TLD | **Candidate** via MRR transactions CSV (`registrar-name`, `iana-id`, `total-domains`, net-adds, …) |
| Registrar breadth | **Candidate** (count registrars with domains > 0 in MRR) |
| GoDaddy-internal distribution / private wholesale | **Blocked** without separate authorization — do not import internal customer data into this public-intel architecture |

### Renewal / pricing / abuse

| Topic | Readiness |
| --- | --- |
| Renewals | MRR / DNMI renewal-related indicators — **candidate** after acquisition design |
| Pricing / promotions | **Low** public reproducibility; mostly registry marketing pages — not a clean contract |
| Abuse / security | Domain Metrica **candidate** with auth + licensing review; DAAR historical only |

### New acquisition required: **YES**

Before any market-baseline implementation unit:

1. Pin MRR URL/path patterns + withhold policy + hash strategy per TLD/month.  
2. Decide TLD universe (all gTLDs vs next-round applied strings only).  
3. Define joins to RIH grains (see §9) — most Application/Org joins remain **blocked** or **candidate**.  
4. Licensing review for Domain Metrica Community API if abuse metrics are in scope.

---

## 8. Source-contract table

| Candidate contract | Authority | Update cadence | Reproducibility | Product use now? |
| --- | --- | --- | --- | --- |
| ICANN MRR transactions/activity CSV | High (Spec 3 RA) | Monthly (lag ~3 months) | High if URL+hash pinned | **Discovery only** — acquire in a dedicated unit |
| ICANN DNMI CSVs | High | Annual (active indicators) | High | Ecosystem context; weak Application join |
| Domain Metrica Community API | High (ICANN) | Ongoing | Medium (auth, quotas, licenses) | Abuse later; not NEXT |
| CZDS | High but gated | Daily zones | Medium–Low ops cost | Research tool; poor fit as first market product |
| APS Application/Contention (current) | High | Reveal / change monitor | High | **Already LIVE** — powers Frontier A |

---

## 9. Grain / join safety

| Grain | Natural external metrics | Join to 2026 Applications | Join to Confirmed Organizations |
| --- | --- | --- | --- |
| **Application** | APS only | Identity | Via Confirmed mapping |
| **Applicant** | APS only | Identity | Via Confirmed mapping |
| **Organization** | Contention co-membership (A) | Via Confirmed Applicants | Identity |
| **Registry Operator** | MRR/DNMI operator counts | **Blocked** without separate operator identity evidence | **Candidate** only with steward/operator registry — do not force via Org resolution |
| **TLD** | MRR DUM/creates/renewals; Metrica abuse | **Candidate** via applied string == TLD label **after** delegation — many applied strings are not delegated yet | **Blocked** as Org rollup of TLDs |
| **RSP** | Public Main-RSP lists (already) | Posture only | No selected-RSP |
| **Registrar** | MRR transactions; Metrica | **Blocked** to Applications | **Blocked** |

**Rule:** Organization resolution must **not** merge unrelated TLD/operator market series.

---

## 10. Cross-frontier scorecard

| Criterion | A Pairings | B Replacement/composition | C Market baselines |
| --- | --- | --- | --- |
| 1. Evidence readiness | **HIGH** | **HIGH** (data already in payload) | **LOW–MEDIUM** (sources exist; contract absent) |
| 2. Differentiation from APS raw | **HIGH** | **MEDIUM** | **HIGH** |
| 3. User decision value | **HIGH** (who you co-occur with) | **MEDIUM** (string strategy) | **HIGH** long-term |
| 4. GoDaddy Registry relevance | **HIGH** | **MEDIUM** (76/77 have -R) | **HIGH** post-delegation |
| 5. Semantic defensibility | **MEDIUM–HIGH** (with language discipline) | **MEDIUM** (status semantics) | **MEDIUM** (grain traps) |
| 6. Implementation size | **S–M** | **S** if narrow; **M** if broad UI | **M–L** |
| 7. Maintenance burden | **LOW** | **LOW** | **HIGH** (monthly TLD corpus) |
| 8. Cross-surface leverage | **HIGH** | **MEDIUM** | **MEDIUM** (new domain) |
| 9. Need for new acquisition | **None** | **None** | **Required** |
| 10. Reproducibility | **HIGH** | **HIGH** | **MEDIUM–HIGH** after pin |

---

## 11. NEXT / RUNNER-UP / DEFER

### NEXT — **Frontier A**

**Name (proposed):** `RIH-ORG-CONTENTION-PAIRS-1` — Confirmed Organization official-contention co-membership pairs  

**Why:** Immediately implementation-ready; extends ORG-CONCENTRATION-1 from “GoDaddy counterparts” to a global deterministic pair graph; answers repeated pairing / network width questions operators already ask; no new acquisition; fits `/contention`, `/organization`, `/competitive-landscape`.

**Evidence ready:** Yes  
**Implementation size:** S–M  
**Semantic risk:** Medium (mitigate with co-membership language + Confirmed-subset disclosure)

### RUNNER-UP — **Frontier C**

**Name (proposed discovery follow-on):** `RIH-MARKET-BASELINE-SOURCE-1` — MRR/DNMI/Metrica source-contract design (still discovery/acquisition — not product charts yet)

**Why:** Highest long-term upside for registry-market decisions, but **blocked** until a reproducible acquisition + grain/join policy exists. Do not implement market-share UI from APS contention.

### DEFER

| Item | Reason |
| --- | --- |
| Frontier B as NEXT | Replacement semantics already preserved; designation tallies duplicate CC/Explore; remaining value is niche string-structure analytics |
| Standalone designation composition charts | Commodity; already oriented |
| CHANGE-INTEL-2B | Still evidence-gated (no new multi-record pain demonstrated here) |
| New Organization identity tranche | Still watch/evidence-gated |
| Cross-round expansion | Steward evidence still required |
| Importing private GoDaddy channel data | Separate authorization; out of public-intel architecture |

---

## 12. Proposed next authorization unit

### `RIH-ORG-CONTENTION-PAIRS-1`

**Type:** Implementation (pure derivation + surface presentation)  

**In scope:**

1. Deterministic Confirmed-only undirected pair model (`sharedSetCount`, `membershipInteractions`, largest official shared set size, counterpart degree).  
2. Coverage disclosure (724 / 891; 208 pairable sets; no Unknown Organization).  
3. Surfaces: Contention (primary), Organization profile counterparts, optional Landscape section; **Command Center home unchanged**.  
4. GoDaddy slice must reconcile with ORG-CONCENTRATION-1 (21 counterparts; Identity Digital top).  
5. Tests: self-pair exclusion; Confirmed-only; language safety; ranking stability.

**Out of scope:**

- Strength/opportunity/rival scores  
- Market/MRR acquisition  
- Replacement analytics  
- CHANGE-INTEL-2B  
- New top-level route  
- Steward identity research  

**Carryforward:** clarify `largestOfficialSharedSetSize` semantics before display (official set size vs counterpart memberships in that set).

---

## Safety checklist (this discovery)

| Gate | Result |
| --- | --- |
| Selected-RSP inference | 0 |
| Unmatched = new inference | 0 |
| Market-share misuse | 0 (explicitly rejected for concentration/pairs) |
| AI-authored numeric facts | 0 (counts from live pinned publications / accepted docs) |
| Publication mutations | 0 |
| Runtime / Change mutations | 0 |
| Production deploy | 0 |
