# 2026 APS schema / grain decision (APS-SCHEMA-GRAIN-1)

**Status:** READY_FOR_IMPLEMENTATION (schema design).  
**Base:** `d456f1f384587681f0502676d6d6bff8f71d2046` (`docs(data): record live APS source contract`).  
**Scope:** architecture decision only. No parser, no ingestion, no promotion, no UI, no code/schema implementation in this ticket.

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
| WDO | **Option A** — do not invent a 1615th normalized application; coverage 1614/1615 + separate admin-check evidence record |
| Official aggregates (1615 / 481 / …) | Snapshot/bundle **metadata** (official channel), never row-calculated masquerading as Statistics |
| Publication schema version | **`registry-2026-publication/2.0.0`** (breaking grain + field disposition) |
| Wire / browser | New wire `registry-2026-intake-wire/2.0.0`; browser payload bump coordinated (`registry-browser-applications/2.0.0` or equivalent) |
| NDJSON drill `1.1.0` | Remains offline rehearsal/drill only until migrated; not production APS path |

---

## Governing grain

| Concept | Definition |
| --- | --- |
| **Raw APS row** | One Applications-tab / CSV export record (2783 in current capture), including `-R` rows |
| **Normalized Application** | One logical submitted application in the 2026 round, identified by the non-`-R` APS Application ID |
| **AppliedString** | Primary applied-for string evidence for that Application (source row without `-R`) |
| **ReplacementString** | Replacement applied-for string evidence linked by `applicationId + "-R"` (source row with `-R`) |
| **VariantString** | Variant label evidence from APS fields (`TLD Variants`, variant application types / labels) — separate from primary/replacement |
| **Applicant** | Published legal applicant (`Applicant Name`) — source |
| **Organization** | Broader evidence-backed resolved entity — **never** inferred from Applicant Name during APS normalize |
| **ContentionSet (official)** | Membership from Reveal Day contention CSV (set id `#`, member Application ID) |
| **Exact-string group** | RIH calculated layer only (`exact-applied-string-grouping/1.0.0`) |
| **Official aggregate** | APS Statistics / announcement channel facts stored as metadata, not derived from normalized row length |

---

## Replacement normalization

**Source relationship (deterministic):**

1. If `Application Type == "Replacement String"` XOR `Application ID` ends with `-R` → fail closed (inconsistent source).
2. Otherwise if ID ends with `-R`:
   - `replacementSourceId = Application ID`
   - `baseApplicationId = Application ID` without the final `-R` suffix
   - Require `baseApplicationId` present as a non-replacement row in the same artifact
   - Require same `Applicant Name` as base (integrity check; observed 1169/1169)
   - Attach as `ReplacementString` under Application `baseApplicationId`
   - Preserve full `-R` id, primary-string column value (this is the replacement string label), status, stage, flags, row provenance
3. Non-`-R` rows become Applications; their `Primary String` becomes `AppliedString`.

**Failure behavior:** unmatched `-R`, double-`-R`, type/id mismatch, or applicant mismatch → quarantine row; do not silently drop; do not create orphan Applications from `-R` alone.

**Ordering:** linkage is by identifier, not CSV order.

---

## WDO / coverage (Option A)

| Item | Decision |
| --- | --- |
| Recommended option | **A** |
| Why | Ordinary export has 1614 non-replacement applications; WDO is absent from export/list/contention CSV; HTML admin-check page states related information is “not currently available”; inventing flags/FALSE values or a full Application to force 1615 would fabricate source facts |
| Coverage representation | Publication metadata: `coverage.normalizedApplicationsFromOrdinaryExport = 1614`, `coverage.officialStatisticsApplications = 1615`, `coverage.knownExcludedRecords[]` including WDO admin-check descriptor (id, string, applicant, region/location, status text, source URL) without claiming full CSV-equivalent field coverage |
| Promotion implication | May promote a hash-pinned 1614-application snapshot with explicit coverage limitations; must **not** claim normalized `applications.length === 1615`; official 1615 remains metadata |

Option B (normalize WDO from supplemental HTML/API) is deferred until a machine-complete official row appears in the ordinary export or a field-complete official artifact is contracted.

---

## Official counts

Store under publication/bundle metadata, e.g. `officialAggregates` (name illustrative):

| Fact | Channel | Stored as |
| --- | --- | --- |
| Applications 1615 | APS Statistics | official aggregate |
| Applicants 481 | APS Statistics | official aggregate |
| Applicants-by-region | APS Statistics | official aggregate |
| Designation announcement counts | Reveal Day press (optional supporting) | labeled supporting aggregate — not row-derived unless explicitly computed and labeled from non-replacement flags |
| Source-row count 2783 | Application CSV | artifact observation |
| Normalized application count | Count of normalized Applications | **calculated** |
| Contention members/sets | Contention CSV | supplemental artifact observation / normalized membership counts |

Reconciliation report (review/quality): compare calculated vs official; record WDO gap; never overwrite official with calculated.

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

| Hash | Inputs | Must exclude |
| --- | --- | --- |
| Application publication content hash | Canonical normalized Application graph for the snapshot (ids, applicants, source flags, string relationships, coverage descriptors that are part of the pinned claim set — exact key list fixed in implementation) + `snapshotId` | `retrievedAt`, local paths, org/category/returning enrichment, exact-string calculations, browser-only projections |
| Raw application artifact | `lineage.rawSha256` of immutable CSV bytes | — |
| Contention raw artifact | Separate `rawSha256` | — |
| Contention sidecar content hash | Canonical membership rows + pin to application `snapshotContentHash` | Retrieval time / paths |

Claim actuality continues to pin `snapshotId` + application `snapshotContentHash` (+ raw sha). Org metrics remain gated. Application-count method = count(normalized Applications) with disclosed coverage; must not silently report Statistics 1615 as the calculated metric.

Comparison gates: no weakening. Incomplete org/category/returning stays blocked.

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
6. Migrate tests: grain counts, `-R` linkage, quarantine, coverage, hash stability, promotion pin, gate retention.
7. Keep `1.1.0` NDJSON path marked rehearsal/drill until explicitly retired.

**Likely files (later tickets):** `src/reveal-day-2026/types.ts`, `validate.ts`, `intake-adapter.ts`, `build-publication.ts`, `normalize.ts`, `claim-actuality.ts`, `src/lib/registry-application-payload*.ts`, `registry-data.ts` / Explore consumers, fixtures/tests, docs cross-links.

**Not in those tickets:** organization inference, category inference, promotion to production, UI redesign beyond honest field absence.

---

## Decision status

**READY_FOR_IMPLEMENTATION** for schema/grain design.

No remaining owner decision is required to begin schema typing and offline CSV normalization design work under Option A. Product may later choose to **delay promotion** until WDO appears in the ordinary export; that is an operations timing choice, not a schema blocker.
