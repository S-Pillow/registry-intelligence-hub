# 2026 APS schema / grain decision (APS-SCHEMA-GRAIN-1)

**Status:** ACCEPTED — offline Application CSV ingest implemented as `registry-2026-publication/2.0.0` (see `docs/2026-aps-application-csv-ingest.md`). Still NOT PROMOTED; browser/contention deferred.  
**Base (decision):** `d456f1f384587681f0502676d6d6bff8f71d2046` (`docs(data): record live APS source contract`).  
**Scope of this decision record:** architecture. Implementation is APS-INGEST-CSV-1 (offline only).

This record resolves the APS-CONTRACT-2 Decision Request for normalization grain and schema evolution, under the governing product intent (logical Application ≠ APS export row; applicant ≠ organization; no fabricated category/returning; official contention ≠ exact-string; fail-closed promotion).

---

## Decision summary

| Topic | Decision |
| --- | --- |
| Normalized Application grain | One logical application per non-`-R` APS Application ID from the ordinary export |
| APS export rows | Immutable source evidence; both primary and `-R` rows retained with full source identity |
| Replacement linkage | Deterministic: every `Replacement String` ID ends with `-R`; base ID = ID without final `-R`; base always exists in the same export (verified 1169/1169) |
| String model | Separate AppliedString / ReplacementString (and VariantString when present) entities/relationships under the Application |
| `organization` / `category` / `returning` | Not source fields; omit from source application schema (derived / later enrichment only) |
| Official contention | Separate supplemental artifact + normalized membership sidecar (Case E); never fill from app-CSV `Label: In Contention` |
| WDO | **Option A** — do not invent a full normalized WDO Application; keep partial record coverage + separate admin-check evidence descriptor |
| Official aggregates vs observed records | Keep **separate channels**: official Statistics/announcement aggregates ≠ `len(normalizedApplications)` (observed coverage). Never collapse 1614 into 1615 |
| Promotion vs metric eligibility | **Separate.** Promoting a partial-coverage snapshot does **not** authorize round-wide calculated metrics as complete |
| Publication schema version | **`registry-2026-publication/2.0.0`** (breaking grain + field disposition) |
| Wire / browser | New wire `registry-2026-intake-wire/2.0.0`; browser payload bump coordinated (`registry-browser-applications/2.0.0` or equivalent) |
| NDJSON drill `1.1.0` | Remains offline rehearsal/drill only until migrated; not production APS path |

---

## Governing grain

| Concept | Definition |
| --- | --- |
| **Raw APS row** | One Applications-tab / CSV export record (`source_row_count` = **2783** in current capture), including `-R` rows |
| **Normalized Application (observed)** | One logical application record normalized from the ordinary export, identified by the non-`-R` APS Application ID. Current capture: `normalized_application_records_observed` = **1614**. This is **coverage/observed-record** truth, **not** the official round application total |
| **AppliedString** | Primary applied-for string evidence for that Application (source row without `-R`) |
| **ReplacementString** | Replacement applied-for string evidence linked by `applicationId + "-R"` (source row with `-R`) |
| **VariantString** | Variant label evidence from APS fields (`TLD Variants`, variant application types / labels) — separate from primary/replacement |
| **Applicant** | Published legal applicant (`Applicant Name`) — source |
| **Organization** | Broader evidence-backed resolved entity — **never** inferred from Applicant Name during APS normalize |
| **ContentionSet (official)** | Membership from Reveal Day contention CSV (set id `#`, member Application ID) |
| **Exact-string group** | RIH calculated layer only (`exact-applied-string-grouping/1.0.0`) |
| **Official aggregate** | APS Statistics / announcement channel facts stored as metadata (`official_application_count` = **1615**, `official_applicant_count` = **481**, …). **Never** derived from, or replaced by, `len(normalizedApplications)` |

**Hard separation (APS-SCHEMA-GRAIN-1A):**  
`1614` normalized observed records **≠** official `1615` applications. Any headline or cross-round “application count” must use an approved official-aggregate contract when comparable, otherwise mark comparison unavailable/blocked — never substitute the incomplete normalized count.

---

## Replacement normalization

**Source relationship (deterministic):**

1. A valid replacement source row requires **both** indicators: Application ID ends with `-R` **and** `Application Type == "Replacement String"`. A base/normal row has neither. If the indicators disagree (exactly one true), fail closed — do not treat disagreement as a classification rule for “replacement.”
2. When both indicators are true:
   - `replacementSourceId = Application ID`
   - `baseApplicationId = Application ID` without the final `-R` suffix
   - Require `baseApplicationId` present as a non-replacement row in the same artifact
   - Require same `Applicant Name` as base (integrity check; observed 1169/1169)
   - Attach as `ReplacementString` under Application `baseApplicationId`
   - Preserve full `-R` id, primary-string column value (this is the replacement string label), status, stage, flags, row provenance
3. Non-`-R` rows with a normal application type become Applications; their `Primary String` becomes `AppliedString`.

**Failure behavior:** unmatched `-R`, double-`-R`, indicator disagreement, or applicant mismatch → quarantine row; do not silently drop; do not create orphan Applications from `-R` alone.

**Ordering:** linkage is by identifier, not CSV order.

---

## WDO / coverage (Option A)

| Item | Decision |
| --- | --- |
| Recommended option | **A** |
| Why | Ordinary export yields **1614** normalized application records; WDO is absent from export/list/contention CSV; HTML admin-check page states related information is “not currently available”; inventing a full Application (or fabricating flags) to force **1615** would fabricate source facts |
| Coverage representation | See explicit `application_record_coverage` below |
| Pre-Reveal 1616 vs Reveal Day 1615 | Remains **OPEN**. WDO explains export vs Statistics consistency (**1614 + WDO ≈ 1615**) as observed consistency only; **do not** claim WDO proves why pre-Reveal **1616** became Reveal Day **1615** |
| Promotion implication | A later authorized gate **may** promote a hash-pinned snapshot containing **1614** normalized application records **plus** explicit partial coverage metadata. **Promotion ≠ complete metric eligibility.** Partial row coverage must not be treated as complete round-wide metric coverage |

### Required coverage fields (names normative for implementers)

```text
source_row_count = 2783
normalized_application_records_observed = 1614
official_application_count = 1615
official_applicant_count = 481

application_record_coverage:
  observed = 1614
  official = 1615
  completeness = partial
  known_excluded_records = [ WDO descriptor … ]
```

WDO descriptor (coverage / separate evidence only): application id, string, applicant, region/location, status text, source URL — **not** a fabricated full normalized Application.

Option B (normalize WDO from supplemental HTML/API) is deferred until a machine-complete official row appears in the ordinary export or a field-complete official artifact is contracted.

---

## Official counts vs observed records

Store under publication/bundle metadata. Channels must stay distinct:

| Fact | Value (current Reveal Day observation) | Channel | Role |
| --- | --- | --- | --- |
| `source_row_count` | **2783** | Application CSV | Artifact observation |
| `normalized_application_records_observed` | **1614** | Count of normalized Applications from ordinary export | **Coverage / observed-record metric only** |
| `official_application_count` | **1615** | APS Statistics | **Authoritative official aggregate** |
| `official_applicant_count` | **481** | APS Statistics | **Authoritative official aggregate** |
| Observed ordinary-export distinct applicant names | **480** | Application CSV (derived) | Source-record coverage observation — **not** the official applicant total |
| Applicants-by-region | APS Statistics values | APS Statistics | Official aggregate |
| Designation announcement counts | Press (optional supporting) | Announcement | Labeled supporting aggregate — not silently row-derived |
| Contention members/sets | 891 / 263 | Contention CSV | Supplemental artifact observation |

**Forbidden collapse:** never present `normalized_application_records_observed` (1614) as `official_application_count` (1615).

Reconciliation report (review/quality): compare observed vs official; record WDO under `known_excluded_records`; never overwrite official aggregates with row-derived counts.

---

## Metric eligibility (promotion is separate)

Snapshot promotion and metric eligibility are **separate gates**.

A promoted application snapshot with disclosed **partial** `application_record_coverage` does **not** automatically authorize round-wide calculated metrics.

Eligibility classes:

| Class | Meaning |
| --- | --- |
| **OFFICIAL_AGGREGATE** | May use a separately sourced authoritative aggregate when grain and comparability with the historical metric are established |
| **ROW_DERIVED_COMPLETE_REQUIRED** | Remains blocked/partial while missing source records could change the metric |
| **ROW_DERIVED_UNAFFECTED_PROVEN** | Eligible only when evidence **proves** the coverage gap cannot change the metric (equality of two numbers alone is **not** proof) |

### Headline / cross-round application count

- Authoritative figure while coverage is partial: **`official_application_count` = 1615** under an **OFFICIAL_AGGREGATE** contract **if** that aggregate’s semantic definition is approved as comparable with the historical metric.
- Otherwise mark comparison **unavailable/blocked**.
- **`len(normalizedApplications)` / 1614** is a coverage/observed-record metric only. It **MUST NOT** be presented as the official 2026 round application count while coverage is 1614/1615.

### Metric applications

| Metric | Class / rule |
| --- | --- |
| **Application count** | Official **1615** = authoritative aggregate. Observed normalized records = **1614**. Never collapse. Headline/cross-round uses OFFICIAL_AGGREGATE when comparable; else blocked. Row-derived 1614 is coverage only |
| **Unique applied strings** | **ROW_DERIVED_COMPLETE_REQUIRED** while ordinary export coverage is partial — do not treat a 1614-record calculation as complete round-wide truth; blocked/partial until complete evidence or an approved official aggregate exists |
| **IDN applications** | Announcement reports **21**; ordinary-export non-replacement CSV also shows **21**. **Do not** infer from equality alone that the missing record cannot affect future source-derived calculations. Official **21** may be used only under an explicitly defined **OFFICIAL_AGGREGATE** metric contract; otherwise keep row-derived IDN blocked/partial |
| **Applicant count** | Official Statistics = **481**. Observed ordinary-export distinct names = **480**. Distinguish aggregate from source-record coverage; do not present 480 as official 481 |

Org/category/returning remain blocked as before (not APS source fields).

---

## Contention model

| Boundary | Decision |
| --- | --- |
| Artifact | Immutable supplemental CSV (Case E), own `rawSha256` |
| Normalized form | Versioned sidecar e.g. `registry-2026-contention-membership/1.0.0` (name illustrative) patterned on 2012 confirmed-portfolios sidecar |
| Membership | `{ contentionSetId, memberApplicationId, orgNameAsPublished, appliedForStringAsPublished }` + provenance |
| Join | By official Application ID to normalized Applications (base ids; no `-R` members observed) |
| Application row field | Do **not** require `contentionSet` on source application schema; optional join projection for browser later under explicit method version |
| Exact-string | Remains separate calculated layer; never replaced by membership |
| Hash | Sidecar content hash + pin to base application publication `snapshotContentHash` / corpus hash; fail closed on orphan members or pin mismatch |

Primary publication schema version changes for Application grain; contention uses a **related** versioned evidence schema, not embedded as fake application fields.

---

## Proposed publication schema `registry-2026-publication/2.0.0`

### Objects (minimum)

1. **PublicationSnapshot** — top-level: schemaVersion, publicationKind, snapshotId, timestamps, parser/normalizer versions, source, limitations, lineage (raw app-CSV bytes), `officialAggregates`, `coverage`, `applications[]`, optional pointers/hashes for supplemental artifacts.
2. **Application** — logical application: `id` (base APS Application ID), `applicant` (legal name), source status/stage as published on the primary/base row, designation/TLD-type/label flags from the base row (booleans as published), provenance to base source row id, relationships to strings.
3. **AppliedString** — primary string label, unicode label if present, a-label/idn representation rules, source-row id (= application id for non-`-R`), provenance.
4. **ReplacementString** — replacement string label, source-row id (with `-R`), link to application id, status/stage on that source row, provenance.
5. **VariantString** (minimal) — only when APS provides variant evidence; do not invent.

### Null / unavailable semantics

| Case | Representation |
| --- | --- |
| APS boolean `FALSE` / `TRUE` | Store boolean as published |
| Empty Priority / empty unicode for non-IDN | empty/absent per field rules — not “false” |
| `Label: In Contention` | Store raw if retained on source-row evidence; **do not** treat as official membership; prefer omit from Application claim surface |
| Organization / category / returning | **Absent** (not null-as-unknown-org string; not false) |
| Official contention on Application | Absent until sidecar join projection |
| WDO | Not an Application in ordinary snapshot; listed under coverage / separate evidence |

Missing ≠ zero. Unavailable ≠ false unless APS explicitly publishes false.

### Field disposition (current `Registry2026ApplicationRow` / wire)

| Current field | Disposition | Reason |
| --- | --- | --- |
| `id` | **KEEP_SOURCE** (as Application id = base APS id) | Official application identifier for logical app |
| `string` | **MOVE_RELATIONSHIP** → AppliedString.label | String is not the Application |
| `aLabel` | **MOVE_RELATIONSHIP** → AppliedString / IDN representation | IDN encoding belongs with string evidence |
| `applicant` | **KEEP_SOURCE** | Legal applicant |
| `organization` | **MOVE_DERIVED** / omit from source schema | Not APS; must not fabricate |
| `country` | **KEEP_SOURCE** (from `Location`) | APS Location |
| `region` | **KEEP_SOURCE** | APS Region |
| `category` | **MOVE_DERIVED** / omit | No APS sector taxonomy |
| `type` | **KEEP_SOURCE** (APS Application Type on base row) + retain designation flags as separate source fields | APS type ≠ market category; Brand/Community/Geo/IDN are source flags |
| `returning` | **MOVE_DERIVED** / omit | Cross-round intelligence |
| `idn` | **KEEP_SOURCE** (from `TLD Type: IDN` on base row) | APS designation flag |
| `replacement` | **MOVE_RELATIONSHIP** → ReplacementString (+ keep `-R` source row id) | Dual-row APS grain |
| `contentionSet` | **DEPRECATE** on source application; **NEW** sidecar membership | Official membership is separate CSV |
| `confidence` | **MOVE_DERIVED** / omit from source | Not an APS field; do not default to `1` as if measured |
| *(new)* source-row evidence ids | **NEW_FIELD_NEEDED** | Reconstruct export rows exactly |
| *(new)* status / processing stage | **NEW_FIELD_NEEDED** (source) | Present in APS; required for journey honesty |
| *(new)* TLD type / label flags | **OPTIONAL_SOURCE** / KEEP as published booleans | Designation evidence; not sector taxonomy |
| *(new)* officialAggregates / coverage | **NEW_FIELD_NEEDED** (snapshot metadata) | Official vs calculated separation |
| *(new)* supplemental artifact pins | **NEW_FIELD_NEEDED** | Contention CSV hash / sidecar pin |

---

## Content hash / promotion

Preserve fail-closed pinning. Do **not** design a second promotion system.

| Hash / pin | Inputs | Must exclude |
| --- | --- | --- |
| **Normalized application content hash** | Canonical normalized Application graph (`applications[]` / string relationships / source flags as fixed by implementation) + `snapshotId` | `retrievedAt`, local paths, org/category/returning enrichment, exact-string calculations, browser-only projections |
| **Coverage metadata** | Stored on the publication/bundle; pin/version with the promoted snapshot (see below) | Must not be silently dropped on promote |
| **Official aggregate provenance** | Statistics (and any approved announcement aggregates) with source URL/retrieved-at/raw digest as available | Must not be invented from row counts |
| **Raw application artifact** | `lineage.rawSha256` of immutable CSV bytes | — |
| **Contention raw + sidecar** | Separate `rawSha256` + sidecar content hash pinned to application `snapshotContentHash` | Retrieval time / paths |

### Official aggregates vs application content hash

**Preferred principle:**

- Official aggregate values may be **outside** the normalized application graph hash (so changing only a retrieved-at on Stats does not rewrite application-row identity).
- A change in the authoritative official aggregate **relevant to the promoted snapshot** must still be **detectably versioned/pinned somewhere in the publication bundle/manifest** (e.g. aggregate provenance digest / bundle manifest hash referenced by claim actuality), even when excluded from the normalized application graph hash.

Claim actuality continues to pin `snapshotId` + application `snapshotContentHash` (+ raw sha) and must retain linkage to coverage + official-aggregate pins. Org metrics remain gated.

**Promotion ≠ metric eligibility:** promoting a partial-coverage 1614-record snapshot does not unlock row-derived round-wide metrics as complete, and does not authorize presenting 1614 as official 1615.

---

## Compatibility

| Item | Impact |
| --- | --- |
| `registry-2026-publication/1.1.0` | Not compatible with logical Application grain + omitted fabricated fields → **2.0.0** |
| NDJSON wire `1.0.0` | Drill-only; migrate fixtures later or keep parallel rehearsal path |
| Browser `registry-browser-applications/1.0.0` | Requires coordinated bump; Explore filters on category/returning/org become evidence-aware / deferred |
| Fixtures / tests | Rehearsal 12-app fixture and drill publication need migration or dual-schema test matrix |
| 2012 patterns | Unchanged; contention sidecar follows confirmed-portfolios pin pattern |

---

## Adversarial cases (schema sufficiency)

| # | Case | Representation without fabrication |
| --- | --- | --- |
| 1 | Normal app, no replacement | One Application + one AppliedString; no ReplacementString |
| 2 | App with one `-R` row | One Application; AppliedString + ReplacementString; both source ids preserved |
| 3 | `-R` before/after base in CSV | Link by id suffix; order irrelevant |
| 4 | Unmatched `-R` | Quarantine / fail closed; no orphan Application |
| 5 | WDO admin-check | Coverage exclusion + separate evidence descriptor; not a fabricated full Application |
| 6 | APS false vs unavailable | Booleans stored as published; absent fields omitted — never coerce unavailable→false |
| 7 | Official contention member | Sidecar membership join by Application ID |
| 8 | Exact-string group, no official membership | Calculated layer only; no fake contentionSet |
| 9 | Applicant, no resolved org | Applicant present; organization absent |
| 10 | Same applicant text, multiple apps | Multiple Applications share applicant string; no org merge |
| 11 | Post–String Confirmation deactivation | Status/stage on AppliedString/ReplacementString source evidence updates across snapshots; Application id stable |
| 12 | Later status change snapshot | New immutable capture + new snapshot hash; history via successive pinned snapshots |

---

## Implementation plan (for APS-INGEST-CSV-1 / follow-ons)

1. Land schema types + validators for `registry-2026-publication/2.0.0` and wire `2.0.0` (no live fetch).
2. Register CSV `CapturedArtifactParser` producing source-row evidence then logical Applications (local bytes only).
3. Build publication review with officialAggregates + coverage (Stats JSON optional supporting capture).
4. Contention CSV → separate raw store + `registry-2026-contention-membership/1.0.0` sidecar builder pinned to app snapshot.
5. Browser converter 2.x: map logical Applications without inventing org/category/returning; contention join optional/labeled.
6. Migrate tests: grain counts, `-R` linkage, quarantine, coverage vs official aggregates, metric eligibility classes, hash/bundle pins, promotion≠eligibility, gate retention.
7. Keep `1.1.0` NDJSON path marked rehearsal/drill until explicitly retired.

**Likely files (later tickets):** `src/reveal-day-2026/types.ts`, `validate.ts`, `intake-adapter.ts`, `build-publication.ts`, `normalize.ts`, `claim-actuality.ts`, `src/lib/registry-application-payload*.ts`, `registry-data.ts` / Explore consumers, fixtures/tests, docs cross-links.

**Not in those tickets:** organization inference, category inference, promotion to production, UI redesign beyond honest field absence.

---

## Decision status

**READY_FOR_IMPLEMENTATION** for schema/grain design, as corrected by **APS-SCHEMA-GRAIN-1A** (official aggregate ≠ observed record coverage; promotion ≠ complete metric eligibility).

No remaining owner decision is required to begin schema typing and offline CSV normalization design work under Option A with partial coverage metadata. Whether/when to **promote** a partial-coverage snapshot remains an authorized quality/promotion-gate timing choice — and even after promotion, metric eligibility stays separately gated.
