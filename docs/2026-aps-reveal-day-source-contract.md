# 2026 APS Reveal Day source contract

**Status:** verified live Reveal Day contract (post-Reveal observation).  
**Observed:** 8 October 2026 (UTC session).  
**RIH base:** `a4a506da2a97c5bff722620ca91aeecc8b7a330a` (`feat(history): add 2012 structural intelligence`).  
**Scope:** documentation / source authority only. No parser, no ingestion, no publication bundle, no promotion.

This document replaces the pre-Reveal inspection checklist. Historical announcement-era unknowns that are now observed are marked **SUPERSEDED**. Production intake is **not** NDJSON.

Product posture (APS-GAP-1, controlling): APS is the authoritative source system for raw 2026 application publication. RIH differentiation is organization resolution, cross-round intelligence, portfolio/contention concentration, milestone change history, and evidence-backed interpretation. Claim-actuality / hash / promotion gates remain controlling. This contract does not resolve organizations or invent categories.

---

## CONFIRMED

Official surfaces and product facts stated by ICANN on APS itself:

- Public publication system name: **Application Publication and Statistics (APS)**.
- APS canonical host: `https://newgtldprogram-aps.icann.org/`.
- APS is the 2026 Round public publication surface; separate from TAMS; draws public-facing data from TAMS (`/about`).
- APS launches on Reveal Day and **is not updated again until String Confirmation Day**. After String Confirmation Day it is updated regularly. It is not real-time (`/about`, `/help`).
- Reveal Day Applications list publishes applied-for strings (including replacement-string records), applicant name, location, region, status, and expandable public fields (TLD variants, TLD type, processing stage, application type, labels).
- Application detail pages expose public portions / summary PDF download capability as the program progresses.
- Reveal Day contention membership is published as a separate official CSV on the Program Site (linked from APS Applications and Help). The APS **Contention sets** nav item remains disabled until after String Evaluation.
- Challenges, temporary delegation, and confidential application portions are **not** published to APS (`/help`).
- Organization resolution, portfolios, RSP relationships, and sector taxonomy are **not** APS products and are **not** established by this contract.

---

## OBSERVED

### Live APS pages

| Surface | URL | Observation notes |
| --- | --- | --- |
| Applications | `https://newgtldprogram-aps.icann.org/applications` | Search/filter UI; **Download CSV** button; SSR table sample; note-1 WDO case; link to Reveal Day contention CSV |
| Statistics | `https://newgtldprogram-aps.icann.org/statistics` | High-level stats; “Last published on: 7 October 2026 at 15:41 UTC”; several sections “No data available yet” |
| About | `https://newgtldprogram-aps.icann.org/about` | Freeze until String Confirmation Day; APS role |
| Help | `https://newgtldprogram-aps.icann.org/help` | Update schedule; which stats appear when; replacement-row counting; contention timing |
| App config | `https://newgtldprogram-aps.icann.org/api/config` | JSON: `restBackendUrl` = `https://newgtldprogram-aps.icann.org/aps` |
| WDO detail (partial) | `https://newgtldprogram-aps.icann.org/applications/WDO2627T-T45217/summary` | HTML detail page for admin-check case (REST summary endpoint 404) |

### Application CSV (APS export)

| Field | Value |
| --- | --- |
| Official UI affordance | Applications page **Download CSV** |
| Export endpoint (public POST used by APS UI) | `https://newgtldprogram-aps.icann.org/aps/applications/export/csv` |
| Config discovery | `GET https://newgtldprogram-aps.icann.org/api/config` → `restBackendUrl` |
| Method | `POST` `application/json` body with `searchAndFilter`, `pagination`, `sort` (unfiltered export used for this observation) |
| Redirect chain | none (direct HTTP 200) |
| Final URL | same as export endpoint |
| HTTP status | 200 |
| Content-Type | `text/csv;charset=UTF-8` |
| Content-Disposition filename | `applications.csv` |
| Client download name pattern (UI) | `gtld-applications-<ISO-timestamp>.csv` |
| Media type | CSV (`text/csv`) |
| Encoding | UTF-8 **with BOM** |
| Line endings | CRLF |
| Delimiter / quoting | comma-separated; RFC-style quoting; `TRUE`/`FALSE` for flag columns |
| Byte size (this capture) | `676524` |
| SHA-256 (this capture) | `a3e2bdba5d3950e87f173e3f576413d9600a6651c99b6946c35bcfd0b9d3553b` |
| Retrieval timestamps (UTC) | `2026-10-08T04:11:53Z` (first); re-fetch same hash `2026-10-08T04:12:12Z` session |
| Structural preamble | Row 1: disclaimer about `Label: In Contention` (not authoritative until String Evaluation). Row 2: empty. Row 3: header. |
| Data row count (excluding preamble + header) | **2783** |
| Record grain | **Applications-tab application record** (not Statistics “application”) |

**Exact header row (34 columns, as published):**

1. `Priority`
2. `Primary String`
3. `Primary String Unicode Label`
4. `TLD Variants`
5. `TLD Type: Brand`
6. `TLD Type: Community`
7. `TLD Type: Geo (Self-Designated)`
8. `TLD Type: Geo (String Review Confirmed)`
9. `TLD Type: IDN`
10. `Application ID`
11. `Applicant Name`
12. `Application Type`
13. `Application Status`
14. `Application Processing Stage`
15. `Label: GAC Early Warning`
16. `Label: GAC Advice`
17. `Label: High Risk String`
18. `Label: Objection`
19. `Label: Safeguard`
20. `Label: In Contention`
21. `Label: Clarifying Questions`
22. `Label: Change Request`
23. `Label: Open Comment Period`
24. `Label: Comments`
25. `Label: RVC`
26. `Label: Applicant Support`
27. `Label: Variant Only (Existing TLD)`
28. `Label: Variant Included`
29. `Label: CoC Exemption`
30. `Label: Reserved Name`
31. `Label: CPE`
32. `Label: Singular/Plural`
33. `Location`
34. `Region`

**Identifier / replacement behavior (observed):**

- Application IDs look like `AA2634T-T39423`.
- Replacement-string records append **`-R`** to the application ID (Help: “Replacement String applications are indicated with an -R after the original application ID”).
- This capture: **1169** IDs end with `-R`; all have `Application Type` = `Replacement String`.
- Non-replacement rows in CSV: **1614** (all `Application Status` = `Active`).
- `Application Type` values observed: `New gTLD` (1605), `Replacement String` (1169), `Existing gTLD with Variants` (6), `New gTLD with Variants` (3).
- Status values observed in CSV: `Active` (2056), `Deactivated` (727). Deactivated rows are entirely replacement-string records in this capture.
- `Priority` empty for all rows in this capture.
- `Label: In Contention` is `FALSE` for **all** 2783 rows; file preamble states this field is **not** reliable until String Evaluation and points to separately published contention sets.
- `WDO2627T-T45217` is **absent** from the CSV.

**Fields present in APS UI / Help but absent or non-authoritative in this CSV:**

- Official contention membership (absent; use contention CSV).
- Public-portion document bytes / summary PDF bytes (not in CSV; detail/PDF endpoints).
- Machine-stable “resolved organization” broader than Applicant Name (not published; Applicant Name is a legal/applicant label only).
- Sector / market category taxonomy (not published).
- `returning` / cross-round identity (not published).

### Contention CSV (Reveal Day)

| Field | Value |
| --- | --- |
| Canonical public URL (APS-linked) | `https://newgtldprogram.icann.org/en/application-rounds/round2/reveal-day-contention-sets.csv` |
| Redirect | `301` → `https://newgtldprogram.icann.org/sites/default/files/documents/reveal-day-contention-sets.csv` |
| Final URL | `https://newgtldprogram.icann.org/sites/default/files/documents/reveal-day-contention-sets.csv` |
| HTTP status (final) | 200 |
| Content-Type | `text/csv` |
| Content-Length | `46481` |
| Last-Modified | `Wed, 07 Oct 2026 17:51:59 GMT` |
| ETag | `"b591-65d43c59e9ad7"` |
| Filename | `reveal-day-contention-sets.csv` |
| Encoding | UTF-8 **with BOM** |
| Line endings | LF (CSV Unicode text; no CRLF dominant) |
| Byte size | `46481` |
| SHA-256 | `86f2ebd3764d1f3ea21d5d844cff004e271a443a3431e8ac440da7f72c67e2bf` |
| Retrieval timestamp (UTC) | `2026-10-08T04:11:29Z` (re-fetch same hash in-session) |
| Exact headers | `#`,`Application ID`,`Org Name`,`Applied-for string(s)` |
| Data row count | **891** |
| Distinct contention-set ids (`#`) | **263** |
| Record grain | **one row per contention-set member application** (set id repeated per member) |
| Set sizes | min 2, max 13; no singletons in this file |
| Member Application IDs ending `-R` | **0** |
| Overlap with application CSV IDs | **891 / 891** present in application CSV |
| WDO | not present |

**Semantic guard (retained):** RIH `exact-applied-string-grouping/1.0.0` is **not** equivalent to this official membership file. Do not auto-replace exact-string grouping with APS contention data.

### Statistics API (supporting observation)

`GET https://newgtldprogram-aps.icann.org/aps/applications/stats` (JSON) observed:

- `totalNumOfApplicants`: **481**
- `totalNumOfApplications`: **1615**
- Applicants by region: AF 7, AP 156, EUR 111, LAC 9, NA 198
- Applications by status: Active **1615** (other statuses 0)
- Unique strings / variants / TLD type / stage / application-type arrays empty or `-1` (not yet available)
- `lastPublishedAt`: `2026-10-07T15:41:26.522Z`

### Official Reveal Day announcement (supporting)

ICANN Reveal Day press material (7 October 2026) reports, among other figures:

- 1,615 applications
- 333 Brand; 16 Community; 15 self-identified Geographic
- 21 IDN; 9 variant applications
- 51 Applicant Support Program applications
- Applications by region: AF 16, AP 218, EUR 506, LAC 11, NA 864

These announcement figures are a **different publication channel** from APS Statistics and from CSV row counts. See grain reconciliation.

---

## STATISTICS / GRAIN RECONCILIATION

Do **not** force different grains to agree numerically.

| Claim | Grain | Value | Canonical source |
| --- | --- | --- | --- |
| Reveal Day applications (program) | Statistics application (primary+replacement count as one) | **1615** | APS Statistics / stats JSON |
| Application CSV rows | Applications-tab records | **2783** | Application CSV export |
| Non-replacement CSV rows | Applications-tab records with `Application Type` ≠ `Replacement String` | **1614** | Application CSV (derived count) |
| Applicants | Distinct applicants (APS definition) | **481** | APS Statistics |
| Distinct `Applicant Name` in non-replacement CSV rows | Name-string distinctness in CSV | **480** | Application CSV (derived) |
| Applicants by region | APS applicant-region statistic | AF 7, AP 156, EUR 111, LAC 9, NA 198 | APS Statistics |
| Applications by region (announcement) | Press application-region | AF 16, AP 218, EUR 506, LAC 11, NA 864 | Reveal Day press |
| Applications by region (non-replacement CSV) | CSV row region | AF 16, AP 217, EUR 506, LAC 11, NA 864 | Application CSV (derived) |
| Brand / Community / Geo (self) / IDN / ASP (announcement) | Press application designation counts | 333 / 16 / 15 / 21 / 51 | Reveal Day press |
| Same flags on non-replacement CSV rows | CSV `TLD Type:*` / `Label: Applicant Support` = TRUE | 333 / 16 / 15 / 21 / 51 | Application CSV (derived) |
| Variant applications (announcement) | Press | **9** | Reveal Day press |
| Variant application types in CSV | `Existing gTLD with Variants` + `New gTLD with Variants` (non-replacement) | 6 + 3 = **9** | Application CSV (derived) |
| Pre-Reveal paid proceeding | Announced program count | **1616** | Pre-Reveal ICANN announcement (historical) |
| Contention members / sets | Official Reveal Day membership CSV | 891 members / 263 sets | Contention CSV |

**Replacement counting (Help, CONFIRMED):** Applications with a designated replacement string appear as **two Application-tab records** but count as **one** application on Statistics. After String Confirmation Day, non-selected strings become `Deactivated`.

---

## WDO CASE

| Item | Record |
| --- | --- |
| Application ID | `WDO2627T-T45217` |
| Primary string | `wdo` |
| Applicant Name | World Data Organization |
| Applicant Location / Region | CN / AP |
| Application Type | New gTLD |
| Status | Undergoing administrative check |
| Processing Stage | Submitted |
| Visible on | Applications page footnote (note-1); HTML summary page `.../applications/WDO2627T-T45217/summary` (“related information is not currently available”) |
| Not visible on | Normal Applications list rows; application CSV export; Reveal Day contention CSV; REST `.../aps/applications/WDO2627T-T45217/summary` (404 at observation time) |
| Does this explain CSV 1614 vs Statistics 1615? | **Strongly consistent:** 1614 non-replacement CSV rows + WDO = 1615; applicant names 480 + WDO = 481; AP applicants 155 + WDO = 156; AP applications 217 + WDO = 218 (press). |
| Does this conclusively explain announced **1616** vs Reveal Day **1615**? | **OPEN** — official evidence does not state that WDO (or any single named case) is the sole cause of the pre-Reveal 1616 → Reveal Day 1615 change. |

---

## NOT YET AVAILABLE

From APS Help / Statistics at observation time:

- Total Unique Strings; Total Variants
- Applications by TLD Type (Statistics charts)
- Applications by Processing Stage (Statistics charts)
- Applications by Application Type (Statistics charts)
- Variants Across Application Type
- APS Contention Sets **page** (nav disabled; after String Evaluation)
- Contention set statistics (applications in contention / total sets) — after String Evaluation
- Objections & Appeals page and related statistics — after Community Input / decisions
- Application Comment Forum — after String Confirmation Day
- APS Website User Guide PDF may exist as a linked asset in client bundles; Help still labels guide “coming soon” in places — treat guide completeness as non-blocking for CSV contracts
- Authoritative `Label: In Contention` values (CSV preamble: not until String Evaluation)

---

## FUTURE MILESTONE

| Milestone | Expected APS behavior (per Help/About) |
| --- | --- |
| Reveal Day (current) | Apps list + CSV export; subset of stats; Reveal Day contention CSV on Program Site; freeze until String Confirmation |
| String Confirmation Day | Site updates for replacement outcomes; additional statistics (unique strings, variants, TLD type, processing stage, application type, variants across type); deactivated non-selected strings; selected replacements change Application Type away from `Replacement String` |
| After String Evaluation | APS Contention Sets page goes live; contention statistics; `Label: In Contention` becomes meaningful per CSV preamble |
| Community Input / later | Objections & appeals list and stats as decisions issue; regular APS updates along applicant journey |

---

## OPEN / UNRESOLVED

1. **Pre-Reveal 1616 vs Reveal Day 1615** — keep **OPEN**; do not treat WDO as a proven sole explanation.
2. **Publication schema mapping** — existing `registry-2026-publication/1.1.0` / intake wire cannot honestly carry APS CSV without inventing required fields or collapsing grains (**Decision Request** below). Do not implement a parser until resolved.
3. **Whether Statistics “Active 1615” includes WDO** — consistent with totals, but APS does not publish a machine join key proving WDO’s inclusion in the stats counter; treat as **observed consistency**, not a signed ledger line.
4. **Geo (String Review Confirmed)** — column present; all `FALSE` in this capture (expected pre–string review).
5. **No static GET URL** for the applications CSV bytes — only the public POST export used by the APS UI (plus optional filtered exports). Capture tooling must record request body + response headers/lineage, not invent a file URL.
6. **Organization / category / returning** — not provided by APS; remain gated RIH work. Applicant Name is not resolved organization.

---

## SUPERSEDED (pre-Reveal contract)

The following pre-Reveal statements are **retired** as production assumptions:

- “APS public URL / media type / downloadable artifact / field names not confirmed.”
- “No adapter case selected because media type unknown.”
- Implication that production intake might be NDJSON compatible with `registry-2026-intake-wire/1.0.0`.
- Treating announced **1,616** as the working observed publication denominator.

NDJSON remains an **offline drill / rehearsal wire only**, not the APS production artifact.

---

## UPDATE SEMANTICS

| Topic | Contract |
| --- | --- |
| Reveal Day | APS published; Applications + partial Statistics live; contention CSV on Program Site |
| Freeze | No APS updates until String Confirmation Day (`/about`) |
| String Confirmation Day | Replacement outcomes + additional statistics; deactivated non-selected strings |
| Later APS updates | Regular updates after String Confirmation as applications progress (not real-time) |
| Future contention page | After String Evaluation |
| Future objections/appeals | Community Input begins String Confirmation Day; APS objections/appeals publication as decisions issue |
| Application summary / public portions | Detail pages + PDF export path exist; content richness increases over journey |
| CSV export volatility | Application export is generated (`Cache-Control: no-cache`); re-capture before promote. Contention CSV is a static Program Site file with long cache headers — pin by SHA-256 |

---

## SOURCE AUTHORITY MATRIX

| Claim / data family | Canonical source | Fallback / supporting | Grain | Update behavior |
| --- | --- | --- | --- | --- |
| Application-tab rows (IDs, strings, applicant, flags, status, type) | APS application CSV export | APS Applications UI / detail pages | CSV row / Applications-tab record | Frozen until String Confirmation; then updates |
| Application public detail / PDF | APS application detail endpoints | — | per Application ID | Journey-progressive |
| Official application count (1615) | APS Statistics | Reveal Day press | Statistics application | Frozen until String Confirmation |
| Official applicant count (481) | APS Statistics | — | applicant | Frozen until String Confirmation |
| Applicants by region | APS Statistics | — | applicant × region | Frozen until String Confirmation |
| Applications by region (press) | Reveal Day announcement | CSV non-replacement region + WDO | application × region | announcement snapshot |
| Designation counts (Brand/Community/Geo/IDN/variants/ASP) | Reveal Day announcement **or** derived non-replacement CSV flags (must state which) | — | Statistics-like application grain when derived from non-replacement rows + WDO policy | announcement vs CSV must be labeled |
| Reveal Day contention membership | Contention CSV (Program Site) | — | member row; set id `#` | Updated on String Confirmation Day per Help |
| Later contention state | Future APS Contention Sets page/stats | — | APS contention entities | After String Evaluation |
| Status / stage updates | APS Applications + CSV + Statistics | — | record vs stats grains differ | After String Confirmation / journey |
| Exact-string competition (RIH) | RIH calculated method | never APS contention CSV | exact `Primary String` groups | RIH-only |
| Resolved organization / portfolio | RIH steward evidence (future) | never APS Applicant Name alone | org ≠ applicant | gated |

---

## ADAPTER DECISION

### Selected cases

| Artifact | Adapter case | Rationale |
| --- | --- | --- |
| Applications | **B — structured CSV** | Public APS export returns `text/csv` with stable headers; not NDJSON wire |
| Contention | **E — supplemental official artifact** (second structured CSV) | Separate Program Site CSV; APS preamble forbids using application-CSV contention label as membership |

Multi-artifact publication is therefore **Case E** at the bundle level: application CSV is canonical for application-tab rows; contention CSV is canonical for Reveal Day membership; Statistics JSON/HTML is canonical for official counts.

### Mapping to `registry-2026-publication/1.1.0`

| Question | Answer |
| --- | --- |
| Can application CSV alone construct the existing `registry-2026-publication/1.1.0` snapshot **honestly**? | **No.** |
| Directly present vs required publication/wire fields | Present: application id, primary string, unicode label (partial), applicant name, country (`Location`), region, IDN flag, application type (as APS type). |
| Required today but **not** in APS CSV | `organization` (broader than applicant), `category` (sector), `returning`, and a single-row `replacement` string field that matches APS dual-row `-R` grain. `contentionSet` must stay null from this file. |
| Unavailable / must be null or omitted | Official contention membership; resolved org; sector category; returning; authoritative in-contention label |
| Existing publication schema sufficient? | **Not without inventing values or silently changing grains** |
| Schema revision required? | **Yes — Decision Request (do not design here)** |
| Must contention remain separate? | **Yes** |
| Can `build-publication` remain local/offline? | **Yes** (read immutable local bytes). Today it only accepts `application/x-ndjson` — a future CSV parser registration is required; that is implementation work, not this contract. |
| Claim-actuality / promotion machinery reusable? | **Yes** — keep fail-closed hash pin and promote gates. Do not weaken. |

### Decision Request (STOP — no schema design in this ticket)

Resolve before **APS-INGEST-CSV-1**:

1. **Canonical row grain for publication snapshots**  
   - Applications-tab records (2783, including `-R` / deactivated replacements), or  
   - Statistics-grain applications (1615, requiring an explicit WDO inclusion policy), or  
   - a versioned dual-grain model.
2. **Replacement representation**  
   - Keep APS dual rows, or  
   - collapse to one row with a `replacement` string field (lossy vs APS).
3. **Required wire fields absent from APS** (`organization`, `category`, `returning`)  
   - schema revision to optional/absent, or  
   - explicit documented placeholders that are **not** claimable as real intelligence (and never as steward org / sector taxonomy).
4. **Where Brand/Community/Geo/IDN/status/stage live** if designation and journey analytics are in scope for the publication snapshot vs side evidence.
5. **Official count channels** — which snapshot field corresponds to Statistics 1615 vs CSV 2783 vs non-replacement 1614+WDO.

Until this Decision Request is answered, do **not** implement a production CSV parser or promote any APS-derived snapshot.

---

## Capture checklist (for the next implementation ticket)

When capturing for offline `build-publication` (after schema decision):

1. Record APS config URL + `restBackendUrl`.
2. POST unfiltered (or explicitly documented filter) export; store raw bytes immutable.
3. Persist request JSON, response headers, HTTP status, retrieved-at UTC, SHA-256, byte length, redirect chain (none today).
4. Separately capture contention CSV final URL bytes + headers + SHA-256.
5. Optionally capture Statistics JSON for count reconciliation evidence (not as application-row source).
6. Document WDO as an explicit reconciliation/outlier record until it appears in the Applications list/CSV.
7. Never treat `Label: In Contention` as membership.
8. Never treat Applicant Name as resolved organization.

---

## Semantic guards (retained)

- RIH exact applied-string grouping ≠ official APS contention membership ≠ later contention processes.
- Applicant Name ≠ resolved organization.
- Community / Geographic / Brand / IDN flags are **designation / TLD-type evidence**, not a market sector taxonomy.
- Application publication does not imply organization intelligence.
- `build-publication` does not promote; this contract does not promote.
