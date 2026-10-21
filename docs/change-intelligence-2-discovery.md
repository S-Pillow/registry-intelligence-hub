# Change Intelligence 2 — discovery / architecture / prioritization

**Status:** DISCOVERY ONLY — no product behavior implemented  
**Decision context tip:** `759bfed` (ORG-RES-TRANCHE-1D CLOSED/LIVE)  
**Organization semantic hash (accepted):** `06ba3920f6028b1a410835332869869691252432bdb1b7c923e7baee519d346c`  
**Production Change runtime (accepted at 1D deploy; not re-read here):** 11 observations · 10 diffs · `lastCheckedAt` 2026-10-20T13:18:53.196Z · timer enabled/active  

This unit answers how Change Intelligence should evolve from a **change monitor** into **actionable Registry Intelligence** without inventing significance, selected-RSP status, commercial opportunity, or unsupported Organization claims.

---

## 1. Current architecture

### Observation

`ChangeIntelObservation` (`change-intel-observation/1.0.0`) is an immutable snapshot of:

- tracked Application fields for every observed Application record;
- official contention memberships as `(contentionSetId, applicationId)` pairs;
- per-source artifact meta (URL, raw `contentSha256`, retrievedAt, recordCount, semanticHash);
- observation-level Application / contention semantic hashes used as diff pins;
- official aggregate counters when available.

Bootstrap reads accepted local publications; refresh acquires APS Application CSV + Reveal Day contention CSV, validates, then writes a new observation. `/changes` **never** contacts ICANN.

### Diff

`ChangeIntelDiff` (`change-intel-diff/1.0.0`) compares consecutive observations and emits:

- ordered `ChangeRecord[]`;
- impact-band summary counts;
- `semanticUnchanged` when both semantic hashes match **and** there are zero change records.

### ChangeRecord

Each record carries:

| Field | Present today |
| --- | --- |
| Application ID | yes |
| Applied-for string | yes |
| Applicant legal name | yes |
| Field-level before/after | yes (Application field changes) |
| Contention set ID | yes (contention membership changes; null for pure Application changes unless derived for impact) |
| Primary impact band + reasons | yes |
| Applicant portfolio / contention counts (at observation time) | yes |
| Public RSP posture label | yes (context) |
| Explore / Competitive Landscape hrefs | yes |
| Confirmed Organization id/name | **no** |
| Investigation grouping key | **no** |
| Materiality level separate from impact band | **no** |

### Impact bands (priority order)

1. `GODADDY_DIRECT` — Applicant legal name is exactly `Registry Services, LLC`
2. `GODADDY_CONTENTION` — change’s contention set (or Application’s memberships) intersects a set that includes GoDaddy
3. `RSP_RESEARCH_RELEVANT` — non-GoDaddy Application change whose Applicant has public posture `NO_PUBLIC_MAIN_RSP_CAPABILITY_FOUND`
4. `MARKET_CHANGE` — everything else

### Persistence

Gitignored runtime root `.data/change-intel/`:

- `observations/` immutable;
- `diffs/` immutable;
- `index.json` pointers / last-checked / last meaningful;
- `latest-feed.json` browser feed.

Does **not** mutate `.data/reveal-2026/` publications or actuality.

### Scheduler

External systemd timer (`rih-change-intel-refresh.timer`) invokes refresh. Product UI has no refresh control. Failed acquisition leaves prior good state.

### UI

- `/changes` — orientation (last checked / compared with / last meaningful), impact+type filters, search, flat change cards, zero-state, recent meaningful history when latest is empty.
- Command Center — compact recent-changes card (count + highest-priority teaser → `/changes`).

### What exists vs missing

| Capability | Exists | Missing |
| --- | --- | --- |
| Deterministic Application/contention diffs | yes | — |
| GoDaddy direct / contention impact | yes | — |
| Applicant profile link | yes | Organization profile link |
| Contention set link | yes (when set id on record) | set link for Application-only changes that are in contention |
| Explore / Landscape links | yes | Compare / Watchlist deep links |
| RSP public posture context | yes | safe wording (see §9) |
| Confirmed Organization enrichment | no | read-time or versioned overlay |
| Materiality ≠ technical diff | only `semanticUnchanged` | business-material taxonomy |
| Investigation grouping | no | applicant/org/set clusters |
| Timeline per entity | no | historical index by Application/Applicant/Org |

---

## 2. Current evidence model

**Sources monitored**

- ICANN APS Application CSV (official export) — tracked fields only (see taxonomy).
- ICANN Reveal Day contention CSV — membership add/remove only.

**Not monitored:** evaluated-RSP list as a change source (used only as context at diff time); APS Statistics HTML.

**Provenance per observation:** source URL, raw content hash, retrievedAt, record counts, per-source semantic hashes.

**Safety already encoded**

- Presence wording: “now present / no longer present in the current published list” — not “new submission” / “withdrawn”.
- Selected RSP never inferred from public Application data (stated in UI aside).
- Impact reasons are template strings from deterministic rules.

---

## 3. ChangeRecord limitations (entity linkage)

| Entity | Can identify today? | How |
| --- | --- | --- |
| Application | yes | `applicationId` |
| Applicant legal name | yes | `applicantLegalName` (authoritative source identity) |
| Confirmed Organization | **no** | not on record; not resolved at feed load |
| Contention set | partial | on contention changes; Application field changes do not attach set ids even when memberships exist |
| GoDaddy involvement | yes | impact band + reasons |
| RSP | contextual only | `rspPublicPosture` label; band `RSP_RESEARCH_RELEVANT` |

Implication: after ORG-RES-TRANCHE-1D (161 Confirmed mappings / 104 Organizations / 1,129 Confirmed Applications), Change cards still look like Applicant-string events. Organization Profiles, Compare, and Landscape cannot be opened from a change without the user re-searching.

---

## 4. Organization-enrichment options

### A — Persist Organization on ChangeRecord at creation

- Pros: frozen “who we thought it was then”.
- Cons: Couples immutable public observation to a mutable intelligence layer; later corrections require rewrite or dual fields; refresh path must load Organization snapshot during acquisition.

### B — Resolve Organization dynamically at read time only

- Pros: always current; no ChangeRecord schema mutation.
- Cons: Historical view silently rewrites identity as mappings improve; hard to explain “what we knew then”.

### C — Keep ChangeRecord immutable; add versioned derived enrichment (recommended)

At feed/view-model derivation:

```
ChangeRecord (immutable public fact)
  + DerivedChangeContext {
      organizationSnapshotHash,
      confirmedOrganizationId | null,
      confirmedOrganizationName | null,
      confirmedOrganizationKey | null,
      resolutionState: CONFIRMED | UNRESOLVED | CANDIDATE | AMBIGUOUS | null,
      derivedAt
    }
```

Rules:

- Confirmed only for product Organization links;
- unresolved / candidate / ambiguous → no Confirmed Organization claim (may show “Not yet resolved”);
- Applicant legal name remains the source identity;
- enrichment reproducible against the stated Organization semantic hash;
- never rewrite observation/diff files.

**Recommendation: C.** Separates “what was publicly observed then” from “what RIH currently knows about the participant.”

---

## 5. Temporal / reproducibility recommendation

| Approach | Verdict |
| --- | --- |
| A persist at creation | defer — useful later as optional audit pin, not required for 2A |
| B dynamic only | reject as sole model — erases temporal honesty |
| **C immutable + versioned derived enrichment** | **adopt** |

Feed JSON may include derived context computed at read time (or a regenerable sidecar keyed by `diffId` + org hash). Historical diffs keep original ChangeRecords; UI labels “Organization context as of Organization snapshot `<hash>`”.

---

## 6. Supported change taxonomy

Mapped to **actual** `ChangeType` values and tracked fields — not aspirational labels.

| Supported type | Source | Old/new | Deterministic severity seed | Affected entity | Safe user-facing wording |
| --- | --- | --- | --- | --- | --- |
| `APPLICATION_NOW_PRESENT` | Application id set | absent → row | high if GoDaddy/contested; else medium | Application + Applicant | “Now present in the current published Application list” |
| `APPLICATION_NO_LONGER_PRESENT` | Application id set | row → absent | high if GoDaddy/contested; else medium | Application + Applicant | “No longer present in the current published Application list” |
| `APPLICATION_FIELD_CHANGED` | Tracked fields below | before/after per field | depends on field (see materiality) | Application + Applicant | “Application field changed” + field list |
| `CONTENTION_MEMBERSHIP_ADDED` | Membership set | absent → pair | high if GoDaddy set or own | Application + set | “Official contention membership added” |
| `CONTENTION_MEMBERSHIP_REMOVED` | Membership set | pair → absent | high if GoDaddy set or own | Application + set | “Official contention membership removed” |

**Tracked Application fields (only these can FIELD_CHANGE):**  
`applicantLegalName`, `appliedForString`, `applicationStatus`, `processingStage`, `applicationType`, `country`, `region`, `idn`, `community`, `brand`, `geoSelfDesignated`.

| Proposed name (eval) | Supported? |
| --- | --- |
| APPLICATION_ADDED / REMOVED | yes as NOW_PRESENT / NO_LONGER_PRESENT |
| APPLICATION_STATUS_CHANGED | yes as FIELD_CHANGED(`applicationStatus`) |
| APPLICANT_IDENTITY_CHANGED | yes as FIELD_CHANGED(`applicantLegalName`) |
| STRING_CHANGED | yes as FIELD_CHANGED(`appliedForString`) |
| DESIGNATION_CHANGED | yes as FIELD_CHANGED(`idn`/`community`/`brand`/`geoSelfDesignated`) |
| CONTENTION_MEMBERSHIP_CHANGED | yes as ADD/REMOVE |
| CONTENTION_SET_CHANGED (set metadata) | **no** — memberships only; set label/size metadata not tracked |

---

## 7. Deterministic materiality options

Today “meaningful” = any non-empty diff (`!semanticUnchanged && changes.length > 0`). That conflates **technical difference** with **business consequence**.

### Proposed levels (deterministic, no AI)

| Level | Rule sketch |
| --- | --- |
| `MATERIAL` | ANY of: presence change; contention membership add/remove; field in `{applicantLegalName, appliedForString, applicationStatus, brand, community, idn, geoSelfDesignated}`; OR impact ∈ `{GODADDY_DIRECT, GODADDY_CONTENTION}` |
| `CONTEXTUAL` | Only `processingStage` and/or `applicationType` and/or `{country,region}` without other MATERIAL triggers; non-GoDaddy |
| `TECHNICAL_ONLY` | Reserved — not currently reachable if only tracked fields diff; keep for future non-business fields |

### Available deterministic signals

- Represented Application count delta (observation `observedApplicationRecords`).
- Contention membership add/remove (direct).
- GoDaddy Application / GoDaddy set (existing impact).
- Designation booleans (tracked).
- Large portfolio: `applicantApplicationCount` already on record (threshold policy needed if used — e.g. ≥10 apps elevates CONTEXTUAL→display priority, not a new commercial band).

### Limitations

- No defensible automatic “this is a competitive win/loss”.
- Portfolio-size thresholds are product policy; must be explicit constants, not model judgment.
- Organization size enrichment (Confirmed Org member count) should use **current** org snapshot under model C, labeled as current context.

---

## 8. GoDaddy-context model

Existing source truth: **77** own Applications · **66** contention memberships.

| Question | Answerable today? |
| --- | --- |
| Direct GoDaddy Application changed | yes → `GODADDY_DIRECT` |
| Non-GoDaddy Application in a GoDaddy contention set changed | yes → `GODADDY_CONTENTION` |
| Broader confirmed Organization involved | **no** until enrichment C |
| Unrelated market change | yes → `MARKET_CHANGE` |

**Safe semantics (keep):** portfolio membership and official contention co-membership only.  
**Forbidden inferences:** sales opportunity, available customer, RSP need, competitive win/loss, selected provider.

---

## 9. RSP semantic review

**Current band:** `RSP_RESEARCH_RELEVANT`  
**Trigger:** Applicant public posture `NO_PUBLIC_MAIN_RSP_CAPABILITY_FOUND` (and not GoDaddy direct/contention).  
**UI label:** “RSP research”.  
**Reason text today includes:** “may be worth GoDaddy Registry investigation.”

### Risk

- Label “RSP research” + investigation wording can be read as **selected-RSP gap** or **sales opportunity**, even though code only means “no public Main-RSP capability match.”
- Public aggregate remains 479 / 476 / 3 / 0; selected RSP stays non-public.

### Recommendation (discovery only — do not implement here)

1. Rename band/label toward **“No public Main-RSP match”** or **“Public RSP posture: unmatched”**.
2. Rewrite reason to factual posture only; drop “worth investigation / opportunity” language.
3. Keep posture as **context**, not a commercial priority band; optionally demote sorting weight below GoDaddy bands but above generic market, or fold into MARKET_CHANGE with a posture chip.

Do **not** redesign RSP intelligence in Change-Intel-2.

---

## 10. UI / actionability gap analysis

### Current gaps

- Flat list does not scale when a diff has many FIELD_CHANGED rows.
- No Confirmed Organization line or profile link.
- Application-only changes rarely surface contention set links.
- Impact explanation shows only `impactReasons[0]`.
- No Compare / Watchlist actions.
- Command Center shows a single top teaser — weak when several GoDaddy-relevant changes land together.
- Zero-state is clear; meaningful-state hierarchy is “filter + cards” only.

### Proposed information architecture (no visual redesign)

Per change (or grouped investigation card):

1. **What changed** — type + field diffs / membership delta  
2. **Who is affected** — Applicant (source) · Confirmed Organization (derived, if any) · Application id · string  
3. **Competitive context** — impact band · GoDaddy direct/set · contention set link(s) · portfolio counts  
4. **Why this matters** — deterministic reasons only (full list) · materiality level  
5. **Source evidence** — observation time · source type · hashes via Data & methodology link  

**Next actions (reuse existing surfaces):**

- open Application (Explore query — exists);
- open Applicant profile (exists);
- open Confirmed Organization profile (add when enriched);
- open contention set (expand to Application changes with memberships);
- Compare affected participant (Organization or Applicant — exists Compare routes);
- provenance / Data & methodology (exists);
- Watchlist add (client Saved/Watchlist already supports organization/applicant entities — optional deep link later).

**New controls required for 2A?** Minimal: Organization line + links; optional materiality filter. No new workflow system.

---

## 11. Ranked implementation options

| Rank | Option | User value | Evidence readiness | Semantic risk | Size | Cross-surface leverage | Rec |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **1** | **A+C+E** Confirmed Organization enrichment (read-time/versioned) + entity investigation links + fuller impact explanation | high | high (1D live) | low if Confirmed-only | S–M | Profiles, Compare, Landscape, Contention | **do next** |
| **2** | **B** Deterministic materiality levels + RSP band wording safety | high | high | medium (wording) | S | `/changes`, Command Center | **do with 2A or immediate 2B** |
| **3** | **D** Grouping/dedup by Applicant (and Org when confirmed) within a diff | medium-high | high | low | M | `/changes` readability | follow 2A |
| 4 | **G** Watchlist integration (“add Applicant/Org”) | medium | high (Saved exists) | low | S | Saved/Watch | defer unless cheap in 2A |
| 5 | **F** Historical timeline per Application/Applicant/Org | medium | medium (needs index) | low | L | Profiles | defer |
| 6 | Other: attach contention set ids onto Application field-change records at derive time | medium | high | low | S | Contention | include in 2A if cheap |

**Defer:** commercial-opportunity bands; selected-RSP inference; AI significance text; persisting Organization into immutable observations.

---

## 12. Organization-tranche vs Change-Intel comparison

### Remaining unresolved (source-derived at 1D tip; hash `06ba3920…`)

| Metric | Value |
| --- | --- |
| Unresolved Applicants | 315 |
| Unresolved Applications | 445 |
| Unresolved Brand Applications | 171 |
| Unresolved contention memberships | 149 |

### Top unresolved by apps → contention → brand (deterministic)

| Applicant | Apps | Cont. mem. | Brand |
| --- | --- | --- | --- |
| NextGEN TLDs GmbH | 22 | 11 | 0 |
| TechEdge Limited | 10 | 8 | 0 |
| Innovation Service Limited | 10 | 7 | 0 |
| NAME SPACE LLC | 10 | 6 | 0 |
| Internet DotTrademark Organisation Limited | 7 | 4 | 0 |
| Registered Agents Inc | 6 | 5 | 0 |
| ML 35 LLC | 5 | 0 | 5 |
| NETDREAM PTE. LTD. | 4 | 4 | 0 |
| … | | | |

Several top names were **already researched** in TRANCHE-1A/1C and left KEEP_CANDIDATE / NO_EVIDENCE / AMBIGUOUS for evidence reasons (not “forgotten”). Marginal value of another narrow identity pass is **real but diminishing** until new A/B evidence appears (especially generic names / registry aggregators).

### Comparison

| Criterion | Next Org tranche | Change-Intel-2 |
| --- | --- | --- |
| Differentiation | More Confirmed coverage | Makes **existing** Confirmed coverage usable in the change loop |
| User value | Portfolio clarity for remaining large Applicants | Day-2 monitoring actionability with 11/10 history already accumulated |
| Evidence readiness | Uneven — top residuals are hard cases | High — org layer + change model already shipped |
| Semantic risk | Medium (identity boundaries) | Controllable if enrichment is Confirmed-only + RSP wording fix |
| Implementation size | M–L research + steward | S–M derivation/UI wiring |
| Cross-surface leverage | Profiles/Landscape/Contention | Changes + CC + deep links into Org/Applicant/Contention/Compare |

**Recommended next investment: CHANGE-INTEL-2A** (Organization-aware investigation enrichment + materiality/RSP wording safety), not another Organization research tranche, unless new authoritative evidence lands for NextGEN / TechEdge / NAME SPACE / RAI.

---

## 13. Recommended implementation boundary

### Unit name

**RIH-CHANGE-INTEL-2A — Organization-aware change investigation enrichment**

### In scope

1. Read-time / versioned derived enrichment of Change feed entries with Confirmed Organization context (model C), pinned to Organization semantic hash.  
2. Entity links: Organization profile; contention set links for Application changes that have memberships in the observation; keep Applicant/Explore.  
3. Show full `impactReasons`; optional materiality chip (`MATERIAL` / `CONTEXTUAL`).  
4. Safer RSP band label + reason copy (no investigation/opportunity phrasing).  
5. Optional light grouping by Applicant within a single diff (display-only).  
6. Tests for enrichment purity (unresolved stays unlinkable as Confirmed), temporal labeling, RSP wording, and GoDaddy bands unchanged in meaning.

### Out of scope

- Manual/runtime refresh; scheduler/systemd; publication mutation  
- Persisting Organization into observation/diff files  
- New commercial impact bands  
- Selected-RSP / opportunity inference  
- Full per-entity timeline (2F)  
- New Organization research tranche  
- Visual redesign of `/changes`

### Files likely affected

- `src/change-intel/types.ts` (derived context types only, or parallel view-model types)
- `src/change-intel/load-feed-server.ts` / new `derive-change-context.ts`
- `src/change-intel/impact.ts` (wording / materiality helpers)
- `src/components/registry/changes-content.tsx`
- `docs/change-intelligence.md` (amend after implementation)
- focused vitest coverage under `src/change-intel/`

### Tests

- Confirmed-only Organization link  
- unresolved Applicant → no Confirmed Org claim  
- enrichment uses stated org hash  
- GoDaddy bands unchanged  
- RSP label/reason safety  
- materiality classification table  
- `/changes` + Command Center render smoke

### Risk

Low–medium (copy/semantics). Mitigate with golden strings and Confirmed-only gate.

### Estimated size

**S–M** (about one focused implementation unit).

---

## Safety checklist (discovery)

| Gate | Result |
| --- | --- |
| Selected-RSP inference | 0 (flagged existing wording risk only) |
| AI-authored source facts | 0 |
| Publication mutations | 0 |
| Runtime mutations | 0 |
| Scheduler changes | 0 |
| Production `.data/change-intel` read/write | 0 (used accepted deploy counts; ranking from source publications + resolution pass) |
