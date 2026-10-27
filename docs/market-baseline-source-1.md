# Public registry-market baseline source contract (MARKET-BASELINE-SOURCE-1)

Read-only discovery. **No product implementation.** Establishes whether RIH can defensibly add a public, reproducible **TLD / Registrar / Reporting Period** market layer from authoritative ICANN sources, starting with Monthly Registry Reports (MRR).

Base: `88ff99e` (ORG-CONTENTION-PAIRS-1 CLOSED/LIVE). Closed units are not reopened.

---

## 1. Authoritative source verdict

| Source | Role | Verdict |
| --- | --- | --- |
| **ICANN Monthly Registry Reports (MRR)** | Primary lifecycle market grain | **READY for a bounded acquisition unit** |
| **ICANN Domain Name Marketplace Indicators (DNMI)** | Annual ecosystem context | **CONTEXT-ONLY** (not TLD×month product facts) |
| **ICANN Domain Metrica (Community API / MoSAPI)** | Abuse/security | **BLOCKED for product persistence** pending auth + licensing review (no credentials used here) |
| Opaque commercial market-share sites | — | **Rejected** as canonical facts |

---

## 2. MRR contract (Frontier A)

### Canonical location

- Index: [https://www.icann.org/resources/pages/registry-reports](https://www.icann.org/resources/pages/registry-reports) (alias [https://www.icann.org/tlds/monthly-reports/](https://www.icann.org/tlds/monthly-reports/))
- Per-TLD HTML pages under `/resources/pages/<label>-YYYY-MM-DD-en` (~**1480** dated TLD pages observed 2026-10-26)
- FAQ: [Registry Monthly Reporting FAQs (31 Mar 2022)](https://www.icann.org/en/system/files/files/registry-monthly-reporting-faqs-31mar22-en.pdf)
- Contractual schema: Base Registry Agreement **Specification 3** ([21 Jan 2024 PDF](https://itp.cdn.icann.org/en/files/registry-agreements/base-registry-agreement-21-01-2024-en.pdf))

### Discovery mechanism (deterministic)

1. Fetch registry-reports index → collect per-TLD page URLs.
2. Fetch each TLD page → extract CSV hrefs.
3. Stable file path pattern observed in production HTML:

```text
https://www.icann.org/sites/default/files/mrr/<tld>/<tld>-{transactions|activity}-<YYYYMM>-en.csv
```

Examples validated by download:

- `/sites/default/files/mrr/com/com-transactions-202605-en.csv`
- `/sites/default/files/mrr/xyz/xyz-activity-202605-en.csv`

Contractual file naming in Spec 3: `gTLD-transactions-yyyymm.csv` / `gTLD-activity-yyyymm.csv` (A-label for IDN). Public CDN paths append `-en` and nest under `/mrr/<tld>/`.

### Report types (public)

| Type | Spec 3 name | Public on icann.org |
| --- | --- | --- |
| Transactions | Per-Registrar Transactions Report | Yes (CSV) |
| Activity | Registry Functions Activity Report | Yes (CSV) |
| Operator (legacy some TLDs) | e.g. `.com` Operator PDF historically | Not Spec 3 primary; out of first slice |

### Withhold / confidentiality

ICANN index + Spec 3 + FAQ: reports are withheld until **three months after the end of the month** to which the report relates. Spec 3: ICANN uses reasonable commercial efforts to preserve confidentiality until that point; published files are then public CSVs (no login).

Observed (2026-10-26): `.com` / `.download` listings expose through **202606** (June 2026) — consistent with ~3-month lag from end of June.

### History

| TLD sample | Earliest transactions month on page | Latest | Approx. depth |
| --- | --- | --- | --- |
| `.com` | 200901 | 202606 | ~210 months |
| `.download` | 201503 | 202606 | ~136 months |

Depth varies by TLD launch / page start. Not every TLD has full history from 2009.

### URL / path stability

- Path pattern is stable across sampled TLDs/months.
- Per-TLD **HTML page slugs** are stable long-lived resource pages.
- Discovery should not hard-code only CDN paths; always re-resolve from the TLD page in case of relocation.

### Revision behavior

**Not documented as immutable.** FAQ discusses reporting errors and corrections at submission time; public revision-after-publication policy is not explicitly guaranteed.

**Recommended policy:** treat `(sourceURL, rawSha256)` as identity. Same URL + changed hash → **new source revision event**; preserve prior raw bytes. Do not silently overwrite.

### Licensing / reuse

- Files are publicly downloadable without authentication from icann.org.
- Site subject to ICANN [Terms of Service](https://www.icann.org/en/data-protection/terms-of-service) / privacy policy.
- Discovery did **not** find a Creative Commons dataset license attached to MRR CSVs themselves.
- **Carryforward for implementation:** record ToS note on each snapshot; legal review before redistribution of raw corpora outside internal RIH archives. Internal research archival + derived aggregates for RIH product use is the intended first scope.

### Machine readable

Yes — RFC 4180 CSV per Spec 3.

### Result

**PASS — reproducible public contract for MRR transactions (+ activity).**

---

## 3. Transactions report schema (Spec 3 §1 + samples)

### Grain

**One row per sponsoring registrar per TLD per calendar month**, plus a **`Totals` aggregate row**.

Primary key for RIH:

```text
(tldAsciiLabel, reportingPeriodYYYYMM, ianaRegistrarId)
```

Exclude `Totals` from registrar-grain facts; use `Totals` for TLD-month aggregates / reconciliation.

### Fields (Spec 3; confirmed in samples)

| Field | Meaning (Spec 3) |
| --- | --- |
| `registrar-name` | Registrar corporate name as registered with IANA |
| `iana-id` | Sponsoring registrar IANA ID; **9998/9999** when registry operator acts as registrar (Spec 5 registration types); pre-delegation test IDs **9995/9996** called out in RA §2.4 |
| `total-domains` | Total domains under sponsorship (month-end state) |
| `total-nameservers` | Name servers associated with registered domains |
| `net-adds-1-yr` … `net-adds-10-yr` | Domains successfully registered for N-year initial term, **not deleted in add grace**; counted in the month the **add grace period ends** |
| `net-renews-1-yr` … `net-renews-10-yr` | Successful renewals (auto or command) for N-year renewal period, not deleted in renew/auto-renew grace; counted when grace ends |
| `transfer-gaining-*` / `transfer-losing-*` / `transfer-disputed-*` | Transfer outcomes / disputes |
| `deleted-domains-grace` / `deleted-domains-nograce` | Deletes inside / outside add grace |
| `restored-domains` / `restored-noreport` | Restores |
| `agp-exemption-*` | AGP exemption counters |
| `attempted-adds` | Attempted adds |

Spec 3: monthly reports reflect registry state **at end of month (UTC)**.

### Aggregate / special rows (samples)

- **`Totals`**: present; for `.download` 202605, sum of registrar `total-domains` **equals** Totals (`8749`).
- Special IANA IDs observed: `9997` (e.g. “ICANN SLA”), `9998`, `9999`, and placeholder-like rows (e.g. `iana-id=1` “Server” with 0 domains on `.godaddy`).
- **Exclude** non-accredited special rows from “registrar breadth” unless explicitly classified.

### Schema drift (important)

| Profile | Columns | Notes |
| --- | --- | --- |
| Spec 3 / new-gTLD samples (`.download`, `.xyz`, `.godaddy`) | **39** | Ends at `attempted-adds` |
| `.com` sample | **41** | Extra: `consolidate-transaction-days`, `consolidate-transactions` |
| Activity `.xyz` | **40** | Extra: `ramp-up-registrars`, `pre-ramp-up-registrars` |
| Activity `.com`/`.download` | **38** | No ramp-up columns |

Parser must be **profile-aware**, not a single rigid header.

### Reconciliation checks (supported)

- `sum(total-domains where registrar-name ≠ Totals) == Totals.total-domains` (when Totals present)
- Duplicate `iana-id` within file → fail closed
- Negative counts → fail closed
- Filename TLD / YYYYMM vs path / manifest mismatch → fail closed
- Missing required Spec 3 columns for chosen profile → fail closed
- Do **not** invent cross-file invariants beyond Spec 3 / FAQ

---

## 4. Activity report schema (Spec 3 §2)

Grain: **one row per TLD per month** (registry operational totals).

Observed field families: `operational-registrars`, WHOIS/RDAP query counts, DNS UDP/TCP query counts, SRS/EPP domain/host/contact operation counts (`srs-dom-create`, `srs-dom-renew`, …), `rdap-queries`, optional ramp-up columns for some TLDs.

### Business usefulness for RIH

Useful later for **registry operational load / EPP volume** context. **Not** the primary registration-base / registrar-distribution grain.

### Recommendation

**Defer Activity** from the first acquisition slice. Keep as optional second report type after Transactions normalize.

---

## 5. First market metrics (from Transactions)

| Metric | Derivation | Status |
| --- | --- | --- |
| **Domain base (month-end)** | Prefer `Totals.total-domains`; else sum registrar `total-domains` excluding specials | **READY** — Spec term is **`total-domains`**, not “DUM” |
| **Monthly net-adds** | Σ `net-adds-1-yr`…`net-adds-10-yr` over Totals (or registrars) | **READY** — ICANN term **`net-adds-*`**, not raw “creates” |
| **Monthly net-renews (count)** | Σ `net-renews-*-yr` | **READY** as **count** |
| **Renewal rate** | Needs defined denominator of names eligible to renew | **BLOCKED from MRR alone** |
| **Deletes** | `deleted-domains-grace` + `deleted-domains-nograce` | **READY** (counts) |
| **Transfers** | gaining/losing successful fields | **READY** (counts) |
| **Net change (base)** | `total-domains(t) − total-domains(t−1)` | **READY** with consecutive months |
| **MoM / YoY growth** | From domain base series | **READY** where history exists |
| **Registrar breadth** | count distinct `iana-id` with `total-domains > 0`, excluding specials/Totals | **READY** |
| **Top registrar share** | max(`total-domains`)/Totals | **READY** |
| **Top-5 registrar share** | sum top 5 / Totals | **READY** |
| **Registrar concentration** | descriptive shares / optional HHI later | **READY** as descriptive; **do not** call it “customer concentration” |
| **Attempted adds** | field present | optional; secondary |

### Domain base / “DUM”

- Canonical Spec field: **`total-domains`** (“total domains under sponsorship”).
- Month-end semantics (Spec 3).
- Prefer **Totals** row; summing registrar rows is correct when Totals absent/broken **after** excluding special IDs.
- Do **not** casually label as DUM in product copy unless defining `total-domains` as the RIH proxy and disclosing Spec terminology.

### Creates / adds

- Use **`net-adds-*`** (grace-adjusted successful registrations by term).
- Do **not** equate to Activity `srs-dom-create` (request counts) or “net adds” as `adds − deletes` unless separately defined as a derived series.

### Renewals

- **Count:** Σ `net-renews-*` — READY.
- **Rate:** BLOCKED without an ICANN-defined eligible-to-renew denominator. DNMI **RC 2.4** (“Domain name renewal to new registration ratio by gTLD category”) is a **category-annual** indicator — context only, not per-TLD month rate from MRR.

---

## 6. Sample validation (read-only, `/tmp/rih-market-baseline-source-1/`)

| TLD | Role | Months | Files |
| --- | --- | --- | --- |
| `.com` | Large established | 202401, 202605 | tx + activity |
| `.xyz` | Large new gTLD | 202401, 202605 | tx + activity |
| `.download` | Portfolio new gTLD | 202401, 202605 | tx + activity |
| `.godaddy` | Small brand gTLD | 202401, 202605 | tx + activity |

**16 MRR CSVs downloaded; SHA-256 captured in research manifest (not committed).**

DNMI samples (CDN): `RC_2-1.csv`, `RC_2-2.csv`, `RC_2-4.csv` from `https://opendata.cdn.icann.org/dnmi/...`.

Issues noted:

- Schema profile drift (39 vs 41 tx columns; activity ramp-up columns).
- Special IANA IDs / zero-domain placeholder rows.
- No bulk corpus committed to Git.

---

## 7. GoDaddy registrar identity (≠ Registry Services)

Public IANA registrar IDs (from [IANA registrar-ids](https://www.iana.org/assignments/registrar-ids/registrar-ids.txt), 2026-10-26):

| IANA ID | Name |
| --- | --- |
| **146** | GoDaddy.com, LLC |
| **440** | Wild West Domains, LLC |
| **1659** | GoDaddy Online Services Cayman Islands Ltd. |
| **3786** | GoDaddy Corporate Domains, LLC |

In `.com` transactions 202605, IANA **146** alone sponsors ~49.1M `total-domains`.

**.godaddy TLD** MRR rows use **9998/9999** (“GoDaddy East, LLC”) — registry-as-registrar specials for the **brand TLD**, not the retail registrar channel.

**Hard rule:** do **not** merge GoDaddy **registrar** IANA IDs into Confirmed Organization `godaddy-registry-services` or infer private Registry Services customer relationships from MRR.

---

## 8. MRR TLD universe recommendation

| Option | Assessment |
| --- | --- |
| A. All public MRR TLDs | Feasible long-term (~1480 pages × months × 2 types) but heavy for first unit |
| B. Only new gTLDs | Misses legacy baselines (`.com`/`.net`/`.org`) needed for market context |
| C. Only RIH-connected TLDs | Too narrow before delegation join is proven |
| **D. Staged** | **Recommended** |

**Stage D (first acquisition):**

1. Discover full TLD page index.
2. Acquire **Transactions only**, **latest public month**, for **all** listed TLDs (size/schema probe).
3. Persist **24-month** Transactions history for:
   - top **N=100** by `total-domains` from the probe;
   - a fixed control set (at least `.com`, `.net`, `.org`, `.xyz`, `.online`, `.shop`, `.top`, `.site`);
   - every ASCII TLD label that **safely** matches a 2026 applied string **and** has independent IANA Root Zone delegation evidence.
4. Expand history / Activity later.

---

## 9. Entity & join contracts

### TLD entity (round-neutral)

Proposed identity:

- `tldAsciiLabel` (A-label for IDN)
- optional `tldUnicodeLabel` (U-label)
- `delegationStatus` + evidence URL/hash from **IANA Root Zone Database** ([https://www.iana.org/domains/root/db](https://www.iana.org/domains/root/db))
- MRR provenance (first/last report period observed)
- **Not** “applied string == live TLD” without delegation evidence

### Application → TLD

| State | Rule |
| --- | --- |
| **CANDIDATE** | Normalize Application applied string → candidate ASCII/A-label |
| **SAFE** | Candidate label **and** IANA root-zone delegation evidence for that label |
| **BLOCKED** | Infer live TLD solely from APS / contention / Organization graphs |

### Registry Operator

- Authoritative public sources to evaluate in a **future** unit: ICANN Registry Agreements listings, IANA Root Zone DB sponsoring organization fields.
- **BLOCKED now:** reuse Confirmed Organization resolution as Registry Operator.
- Operator portfolio rollups: **BLOCKED** until operator identity contract exists.

### Registrar

- Stable key: **`iana-id`** (numeric), with `registrar-name` as display/provenance.
- Historical renames/acquisitions: expect name drift; identity remains IANA ID with effective dating if IANA changes assignment.
- **BLOCKED:** map registrars into Applicant Organization graph without a separate steward design.

### Reporting period

- Metric period key: **`YYYY-MM`** (report month, UTC month-end semantics).
- Separate timestamps: `publishedOrAvailableAt` (if discoverable), `retrievedAt`, and withhold eligibility date (`monthEnd + 3 months`).

---

## 10. Provenance / acquisition design (not implemented)

### Snapshot metadata (minimum)

`sourceUrl`, `tldAsciiLabel`, `reportType` (`transactions`|`activity`), `reportingPeriod`, `retrievedAt`, `availableAt?`, `rawSha256`, `parserVersion`, `schemaProfileVersion`, `licenseTermsNote`, `revisionOfRawSha256?`

### Flow (conceptual)

`discover → download → hash → validate schema profile → normalize → reconcile → publish immutable monthly snapshot → derive metrics`

- CLI boundary: future `npm run market-mrr` / `tsx` tool under a non-production path.
- Storage proposal: `.data/market-baseline/mrr/...` (gitignored), **not** APS/reveal trees.
- Partial failure: per-TLD/month fail closed; continue siblings; manifest records errors.
- **No scheduler** in first unit.

### Immutability

Preserve raw CSV bytes forever for each hash. Normalization is pure over raw + parser version.

---

## 11. DNMI

| Item | Finding |
| --- | --- |
| Location | [https://www.icann.org/opendata/dnmi](https://www.icann.org/opendata/dnmi) + CDN `https://opendata.cdn.icann.org/dnmi/...` |
| Cadence | **Annual** active indicators (V1.1); archived V1.0 retained |
| Grain | Category / segment (New gTLDs, Legacy, Brand, …) — **not** Application/Organization/TLD×Registrar×month |
| Machine readable | CSV, no login on new Open Data pages (ODP login path being retired) |
| Useful metrics | RC 2.x domain counts / net change / CAGR; RC 2.4 renewal-to-new **ratio by category**; MS/T trust/compliance |
| Schema guide | [PDF](https://www.icann.org/en/system/files/files/domain-name-marketplace-indicators-schema-taxonomy-12oct23-en.pdf) |
| Recommendation | **CONTEXT-ONLY** companion; do not drive TLD product charts from DNMI alone |

---

## 12. Domain Metrica

| Item | Finding |
| --- | --- |
| What | Abuse/security measurements (DAAR successor); zone_size / portfolio_size + phishing/malware/botnet counts |
| Community API | Auth via ICANN account → Bearer token; endpoints for TLD / IANA registrar / domain ([docs](https://www.icann.org/octo-ssr/metrica/community-api-en)) |
| MoSAPI | Contracted-party interface ([spec PDF](https://www.icann.org/en/system/files/files/mosapi-specification-28may25-en.pdf)) |
| Auth | **Required** (free ICANN account) — **not exercised** in this unit |
| Rate limits | HTTP 429; daily quota resets midnight UTC (exact numeric quota not fully published on Community API page) |
| Licensing / persistence | Unclear for normalized product warehouses |
| Recommendation | **BLOCKED** for RIH product persistence pending access + reuse review. Discovery-only. Abuse metrics are a **later** security layer, not the first market baseline. |

---

## 13. Pricing / promotions

**NOT READY.** No authoritative reproducible public contract for registry wholesale pricing/promotions found. Scraping marketing pages is rejected as canonical market data.

---

## 14. Grain matrix

| Grain | Natural metrics |
| --- | --- |
| Application / Applicant / Confirmed Organization | Existing RIH APS/org intel — **unchanged** |
| **TLD × Reporting Period** | `total-domains`, net-adds, net-renews counts, deletes, MoM/YoY |
| **TLD × Registrar × Reporting Period** | shares, breadth, concentration descriptors |
| Registry Operator × Period | **Blocked** until operator identity |
| RSP | Unrelated to MRR registrar sponsorship |
| Registrar | Across-TLD rollups only after explicit design |

---

## 15. Join safety

| Join | Class |
| --- | --- |
| Application → TLD | **CANDIDATE** label; **SAFE** only with IANA delegation |
| TLD → Registry Operator | **CANDIDATE** (needs RA/IANA contract) |
| Registry Operator → Confirmed Organization | **BLOCKED** (separate steward layer) |
| TLD → Registrar | **SAFE** via MRR `iana-id` rows |
| Registrar → Confirmed Organization | **BLOCKED** |
| RSP → TLD | **BLOCKED** from MRR |
| Application → Registrar | **BLOCKED** |

---

## 16. Business questions

| Question | Status |
| --- | --- |
| Fastest-growing TLD (MoM/YoY on `total-domains`) | **READY FROM MRR** |
| Largest domain bases | **READY FROM MRR** |
| Registrar breadth / concentration / distribution trend | **READY FROM MRR** |
| Registrar share leaders per TLD | **READY FROM MRR** |
| Renewal **activity counts** | **READY FROM MRR** |
| Renewal **rates** | **REQUIRES ADDITIONAL SOURCE** / methodology |
| Historical comparisons vs 2012 RIH cohorts | **REQUIRES ADDITIONAL SOURCE** (different grain) |
| Registry Operator portfolio rollup | **BLOCKED** |

---

## 17. Product fit (architecture only)

- Natural future home: **Market / Registry Lifecycle** surface and/or **TLD profile**; Compact teaser possible later on Competitive Landscape.
- **No new route in this unit.**
- **Command Center home: no change.**
- Do not force market metrics into Application/Organization cards.

---

## 18. Next authorization unit

### `RIH-MARKET-BASELINE-MRR-1` — recommended

| Field | Value |
| --- | --- |
| Type | Acquisition + normalize + tests (**no UI**) |
| Source | ICANN MRR **Transactions** only |
| Universe | Staged D (probe all TLDs latest month; 24 months for top 100 + controls + delegated RIH-overlapping labels) |
| Outputs | Immutable raw archive + normalized `TLD×month` and `TLD×Registrar×month` tables + coverage manifest |
| UI | **No** |
| Size | M |
| Semantic risk | Medium (schema profiles, special IANA IDs, terminology discipline) |

### Defer

- Activity reports bulk ingest  
- DNMI as product time series  
- Domain Metrica  
- Pricing  
- Operator identity / portfolio  
- Registrar↔Organization mapping  
- Renewal **rates**  
- HHI as primary concentration UX  

---

## 19. Safety checklist (this discovery)

| Gate | Result |
| --- | --- |
| Production / runtime / scheduler mutations | 0 |
| Organization / APS / pairs / Change / RSP / cross-round changes | 0 |
| Private GoDaddy channel data | 0 |
| Credentialed API calls | 0 |
| Opaque commercial facts | 0 |
| Bulk MRR committed to Git | 0 |

---

## 20. Research artifact pointers (ephemeral)

Local research only (not production, not Git):

- `/tmp/rih-market-baseline-source-1/mrr/...`
- `/tmp/rih-market-baseline-source-1/dnmi/...`
- `/tmp/rih-market-baseline-source-1/notes/sample-manifest.json`

## 21. Implementation / acceptance status

| Unit | Status | Commit |
| --- | --- | --- |
| MARKET-BASELINE-SOURCE-1 | **MERGED / ACCEPTED / CLOSED** | `abe5d5d1fb3dfa686ac37e99046073167f89fb9a` |
| MARKET-BASELINE-MRR-1 | **MERGED / ACCEPTED / CLOSED** | `e50e6d5b89c86cb1504fccfe578060b3260cef4a` |
| MARKET-BASELINE-MRR-1A | **MERGED / ACCEPTED / CLOSED** | `071d3bdecf790fb7a428bc27fd8296aa96618a5f` |

Final `main` tip of the accepted sequence: `071d3bdecf790fb7a428bc27fd8296aa96618a5f`.
Acquisition tooling docs: [`market-baseline-mrr.md`](./market-baseline-mrr.md).
Product publication contract: [`market-baseline-publication.md`](./market-baseline-publication.md).
No production deployment performed as part of MARKET-BASELINE closure.
