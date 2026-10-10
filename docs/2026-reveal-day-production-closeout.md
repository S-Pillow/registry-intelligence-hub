# 2026 Reveal Day production closeout (RIH-REVEAL-DAY-CLOSEOUT-1)

**Status:** CLOSED / ACCEPTED — infrastructure, ingestion, publication, and production promotion program.  
**Does not close:** the broader RIH product roadmap.

This document is the **canonical operator/developer handoff** for what is live after the 2026-10-08 production promotion. Prefer it over ticket-scoped docs when answering “what is current?”

Related contracts (historical / mechanical; still valid as contracts):

- Source: `docs/2026-aps-reveal-day-source-contract.md`
- Browser 2.x: `docs/2026-browser-publication-2x-payload.md`
- Promotion contract: `docs/2026-publication-2x-promotion-contract.md`
- Activation mechanics: `docs/2026-publication-2x-activation.md`
- Metric eligibility: `docs/2026-metric-eligibility-rebaseline.md`

---

## Live production event

| Item | Value |
| --- | --- |
| Host | `srv766238` |
| Deployed source commit | `e66c57945826e22e390c666053a637ef500e4447` |
| GitHub checkpoint | `checkpoint/rih-activation-2x-1-e66c579` |
| Phase A UTC | `2026-10-08T11:07:12Z` |
| Phase B UTC start | `2026-10-08T11:15:11Z` |
| Phase B UTC completion | `2026-10-08T11:18:22Z` |
| Phase B final verdict | **PASS** |
| Rollback required | no |

### Phase A install (artifacts only)

- Pre-install production commit: `2b961ba`
- Deployed: `e66c57945826e22e390c666053a637ef500e4447`
- Backup: `/root/backups/rih-phase-a-pre-install-20261008T110211Z`
- Immutable Reveal Day artifacts installed under `/root/registry_hub/.data/reveal-2026/`
- Application actuality remained `NOT_PUBLISHED`; contention absent/`NOT_PUBLISHED`
- Active browser remained rehearsal/pre-Reveal
- Application + contention promotion dry-runs: **PROMOTABLE**
- No user-visible real 2026 activation

### Phase B promotion

- Backup: `/root/backups/rih-phase-b-pre-promotion-20261008T111540Z`
- Application promotion: **PASS** → `REAL_SOURCE_READY`
- Contention promotion: **PASS** → `REAL_SOURCE_READY`
- Production smoke: Application then contention — both accepted

---

## What is currently live

| Layer | State |
| --- | --- |
| Deployed source | `e66c57945826e22e390c666053a637ef500e4447` |
| Application actuality | `REAL_SOURCE_READY` |
| Contention actuality | `REAL_SOURCE_READY` |
| Active browser | `registry-browser-applications/2.0.0` (`promoted-2026-v2`) |
| Rehearsal fallback under REAL | **NO** (fail-closed if payload missing/mismatched) |

### Application publication

| Field | Value |
| --- | --- |
| Schema | `registry-2026-publication/2.0.0` |
| Snapshot | `snap-aps-2026-applications-reveal-day-v1` |
| Path | `/root/registry_hub/.data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json` |
| Artifact SHA-256 | `d925a23465d26c2437ddac1f8d8aa09ca227622a22c36d1c24d65e793132623f` |
| Raw APS Application CSV SHA-256 | `a3e2bdba5d3950e87f173e3f576413d9600a6651c99b6946c35bcfd0b9d3553b` |
| Normalized Application semantic graph hash | `09e75b1c83baa2a7466033de991332f396b108dc3d8c0775d3c17d99ec6b45d2` |
| Source rows | 2783 |
| Normalized observed Applications | **1614** |
| Replacement relationships | 1169 |
| Official Applications | **1615** |
| Official Applicants | **481** |
| Observed Applicant legal names | 480 |
| Coverage | **PARTIAL 1614/1615** |
| Known excluded | `WDO2627T-T45217` (`wdo` / World Data Organization / Undergoing administrative check) |

**WDO** is coverage metadata only — **not** a fabricated normalized Application row.  
The pre-Reveal **1616 vs Reveal Day 1615** difference remains **OPEN**; WDO does not prove the reason for that difference.

### Browser 2.x

| Field | Value |
| --- | --- |
| Schema | `registry-browser-applications/2.0.0` |
| Path | `/root/registry_hub/.data/reveal-2026/browser/applications-browser-v2.json` |
| Artifact SHA-256 | `a7b0bdb88cbf734cec6a3db5032b656ce6c6acd161fc8e1cb69514ef54d9027e` |
| Records | 1614 |
| Official Applications (separate) | 1615 |
| Official Applicants (separate) | 481 |
| Coverage | PARTIAL |
| Active source | `promoted-2026-v2` |

Browser 2.x does **not** fabricate: `organization`, `category`, `returning`, `confidence`.  
Search / Explore consume source-backed 2.x fields only.

### Contention sidecar

| Field | Value |
| --- | --- |
| Schema | `registry-2026-contention-membership/1.0.0` |
| Snapshot | `snap-aps-2026-contention-reveal-day-v1` |
| Path | `/root/registry_hub/.data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json` |
| Artifact SHA-256 | `53daf974cb161fe6ae9d150cd7f4e1a10605e9b740154dd6ee47e7d34e1a8adc` |
| Raw source SHA-256 | `86f2ebd3764d1f3ea21d5d844cff004e271a443a3431e8ac440da7f72c67e2bf` |
| Normalized semantic hash | `480b378bab0b4d643e86d9b967f91777dcab147566747df577b469cb209825e7` |
| Application graph pin | `09e75b1c83baa2a7466033de991332f396b108dc3d8c0775d3c17d99ec6b45d2` |
| Official initial contention sets | **263** |
| Official initial memberships | **891** |
| All memberships joined to observed Applications | yes |

Distinctions:

- Official contention membership comes from the ICANN Reveal Day contention CSV — **not** RIH exact-string grouping.
- Source `Org Name` is **not** RIH resolved Organization.
- Contention is independently activatable and fail-closed.
- Contention failure does **not** invalidate a healthy Application publication.

### Evidence / manifest (provenance only)

| Item | Path | SHA-256 |
| --- | --- | --- |
| Evidence bundle | `/root/registry_hub/.data/reveal-2026/publications/aps-reveal-day-evidence-bundle.json` | `c44695c70ec78eba58f707cf6477a5a77e873307a51499cfba4706c8b5b5d7dc` |
| Promotion manifest | `/root/registry_hub/.data/reveal-2026/ops/rih-reveal-2026-promotion-manifest-e66c579.json` | `d3a5e69bd1c51e095cb43759b985cef9b8d7c8e9b0889f8638e2366dfc780d2e` |
| Promotion-package archive | (ops package) `rih-reveal-2026-promotion-package-e66c579.tar.gz` | `c45f09b12949eea45488d713777dde960a3e773ac2f0222d40f69dadb0e42344` |

These are provenance / rollback references, not mutable product configuration.

---

## Actuality semantics

Application actuality is binary: `NOT_PUBLISHED` | `REAL_SOURCE_READY`.

**`REAL_SOURCE_READY` means:** the authoritative source publication identity passed promotion and pin validation and is approved as the active publication.

**`REAL_SOURCE_READY` does not mean:**

- complete Application row coverage (1614 ≠ 1615);
- every metric is complete or eligible;
- organizations are resolved;
- category/sector taxonomy exists;
- returning/new identity exists;
- exact-string grouping is official contention.

Metric eligibility remains independently governed by `metric-eligibility-catalog/2.0.0`.

Contention actuality is independent: `NOT_PUBLISHED` | `REAL_SOURCE_READY` for the official contention sidecar.

---

## Live metric eligibility (summary)

### Ready / allowed

| Metric / fact | Value / note |
| --- | --- |
| Official Applications | 1615 (official aggregate) |
| Official Applicants | 481 (official aggregate) |
| IDN | 21 (approved aggregate/orientation) |
| Brand | 333 (2026 orientation) |
| Community | 16 (2026 orientation only) |
| Geographic | 15 self-identified (2026 orientation only) |
| Variant applications | 9 (orientation) |
| Replacement relationships | 1169 (relationship grain) |
| Official initial contention sets | 263 |
| Official initial contention memberships | 891 |

### Partial / limited

| Item | Note |
| --- | --- |
| Observed Application records | 1614 |
| Observed Applicant legal names | 480 |
| Row-derived Application analyses | Partial where the missing Application can affect completeness |
| Member-based contention analyses | Valid for the official 891-member contention universe |
| Portfolio-share denominators | Partial when based on observed Application rows |

### Blocked / not yet real

- Complete unique applied strings
- Complete exact-string competition
- Resolved 2026 Organizations
- Organization portfolio concentration
- Returning / new participation
- Expanded / contracted participation
- Market category / sector taxonomy
- Cross-round Organization identity
- Any metric that would require treating **1614 as the full 1615** round

---

## Cross-round posture (unchanged by this promotion)

| Posture | Items |
| --- | --- |
| READY_WITH_LIMITATION | Applications: 2012 **1930** vs 2026 official **1615**; IDN: 2012 **116** vs 2026 official **21** |
| BLOCKED_COVERAGE | Unique strings; exact-string competition; complete Applicant legal-name concentration |
| BLOCKED_SEMANTICS | Community; Geographic; region/geography where grains differ |
| BLOCKED_METHOD / SEMANTICS | Official contention comparison with 2012 unresolved 234/232 issue |
| BLOCKED_SOURCE / METHOD | Resolved Organization portfolios; returning/new; expanded/contracted participation |

Reveal Day promotion did **not** solve these.

---

## Production UI acceptance (Phase B smoke)

| Surface | Accepted state |
| --- | --- |
| Command Center | Healthy; 2.x orientation-safe; unique strings blocked; no fabricated Organization/category/returning panels |
| Search | 2.x source-backed fields; Application ID / Applied String / Applicant work; no Organization/Category/Returning/Confidence facets |
| Explore | Real 2.x records; source-backed fields only |
| Coverage disclosure | Official 1615 / RIH normalized 1614 / PARTIAL / known-excluded WDO |
| Data Health | Application `REAL_SOURCE_READY`; Browser 2.0.0; Publication 2.0.0; exact snapshot/hash; 1615/1614 coverage; contention overlay available; no active-source resolution error |
| Compare | Safe/gated |
| Saved | Safe/gated for unsupported 2.x workflows |
| Briefings | Safe/gated for unsupported 2.x workflows |

---

## Runtime / operator notes

| Role | Path |
| --- | --- |
| Application payload | `/root/registry_hub/.data/reveal-2026/browser/applications-browser-v2.json` |
| Application actuality | `/root/registry_hub/.data/reveal-2026/claim-actuality-state.json` |
| Contention actuality | `/root/registry_hub/.data/reveal-2026/contention-actuality-state.json` |
| Contention publication | `/root/registry_hub/.data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json` |

**Operational caution:** Phase A established that setting actuality **PATH** environment overrides to **nonexistent** files hard-fails the app. Do **not** configure `REGISTRY_HUB_CLAIM_ACTUALITY_STATE_PATH` or `REGISTRY_HUB_CONTENTION_ACTUALITY_STATE_PATH` to missing files. Default runtime paths are valid and were used successfully for production promotion.

Do not publish secret environment values in docs or reports.

Promotion history (Application): `.data/reveal-2026/promotion-history.jsonl` (written by `promote-actuality`).

---

## Rollback

### Application

1. Return Application actuality to `NOT_PUBLISHED` (remove or rewrite claim state via accepted tooling/state procedure — do not hand-edit pins to “fix” validation).
2. Verify active resolver returns rehearsal/pre-Reveal.
3. Only then unset/repoint Browser 2.x payload configuration if required.
4. Verify production health.

**Never** remove the required Browser payload while Application actuality is `REAL_SOURCE_READY` — REAL + missing/mismatched payload is intentionally **fail-closed**.

### Contention only

1. Return contention actuality to `NOT_PUBLISHED` / inactive independently.
2. Verify contention overlay unavailable.
3. Keep Application `REAL_SOURCE_READY`.
4. Verify Browser 2.x / Search / Explore remain healthy.

Do **not** roll back a healthy Application solely because contention fails.

### Immutable evidence

Do not delete or edit installed Reveal Day source/publication evidence during rollback.

### Backup anchors

| Phase | Path |
| --- | --- |
| A (pre-install) | `/root/backups/rih-phase-a-pre-install-20261008T110211Z` |
| B (pre-promotion) | `/root/backups/rih-phase-b-pre-promotion-20261008T111540Z` |

---

## Program closeout decision

The Reveal Day **source / ingestion / publication / promotion** program is **CLOSED / ACCEPTED** as of the successful **2026-10-08** production promotion.

**Complete for:**

- APS Application source contract
- Application CSV ingestion
- Schema/grain 2.0
- Official aggregate vs coverage separation
- Official Reveal Day contention ingestion
- Semantic contention hashing
- Metric eligibility rebaseline
- 2.x promotion contract
- Honest 2.x browser projection
- Safe 2.x activation path
- Promotion packaging
- Phase A deployment
- Phase B production promotion
- Production smoke verification

**Not complete:** the RIH product roadmap (intelligence, org resolution, cross-round identity, etc.).

---

## Next product sequence

1. **CC-IA-REBASE-1** — Intelligence-first Command Center.
2. **ORG-RES-2026-1** — Evidence-backed 2026 Organization resolution (`docs/2026-organization-resolution.md`; confirmed product metrics still gated).
3. **CROSS-ROUND-ID-1** — Defensible 2012↔2026 participant identity.
4. **CONTENTION-INTEL-1** — Organization-/applicant-aware contention concentration once identity evidence supports it.
5. **Compare / Briefing rework** — only after differentiated cross-round intelligence becomes eligible.

Search / Explore remain evidence / drilldown surfaces. Do **not** re-center product work on raw APS record browsing.

---

## What must NOT be inferred as complete

- Full 1615 observed Application rows
- Resolved Organizations / portfolios
- Returning/new or expanded/contracted participation
- Category/sector market intelligence
- Complete unique-string or exact-string competition metrics
- Cross-round Organization identity
- Closure of pre-Reveal 1616 vs Reveal Day 1615 open question
- Closure of the broader RIH product roadmap
