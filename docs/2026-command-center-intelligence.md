# Command Center intelligence-first IA (CC-IA-REBASE-1)

**Role:** Command Center is an evidence-backed **intelligence layer** for the 2026 round — not an APS browser clone.

**Drilldown:** Search / Explore remain evidence surfaces. Command Center links into them; it does not recreate listing/filter tables. Applicant competitive intelligence lives on **Competitive Landscape** (`/competitive-landscape`) — see `docs/participant-competitive-intelligence.md`.

## Active 2.x hierarchy

Operational intelligence order (COMMAND-CENTER-HIERARCHY-1 + COMMAND-CENTER-PULSE-1):

1. **Round posture** — official Applications 1615, Applicants 481, official initial contention 263 / 891 (first substantive block)
2. **Intelligence Pulse** — deterministic evidence-backed interpretation layer (see below); after Round posture, before Attention
3. **What deserves attention** — compact deterministic strip only: GoDaddy contention footprint (66 unique official initial sets), public change-monitoring status, coverage exception (1614 / 1615 + administrative-check disclosure). No LLM narrative, risk scores, or commercial recommendations.
4. **Recent changes / monitoring** — compact status row when the latest check has zero material changes; fuller card when changes exist. CTA → `/changes`.
5. **What changed since 2012** — only READY_WITH_LIMITATION comparisons (Applications, IDN), with CTA **Explore 2012 vs 2026** → `/cross-round` (see `docs/cross-round-structural-intelligence.md`). Raw structural deltas use **neutral** styling (not green/red “good/bad” semantics).
6. **Competitive structure** — official initial contention depth (sets / memberships / crowded-set distribution); not duplicated as a standalone top Contention summary card
7. **Round composition** — compact designation / relationship orientation (not sectors/categories)
8. **Coverage** — secondary PARTIAL 1614/1615 panel + Data & methodology (`/data-health`) link
9. **Investigation actions** — one primary CTA (**Open Competitive Landscape**); secondary text links for Explore applications, Search records, Explore contention

Do not place a large standalone Contention summary card above round posture.

## Intelligence Pulse (COMMAND-CENTER-PULSE-1)

Intelligence Pulse is a **deterministic, evidence-backed interpretation layer** — not AI-generated prose, not an LLM feature, not a recommendation engine, and not an external-content system.

**Placement:** immediately after Round posture; immediately before What deserves attention. Cognitive sequence: what is happening → what it means → what deserves investigation.

**Behavior (production):**

- Eligibility-driven ordered insights (not randomized)
- With current fully eligible production data: **5** messages
- **20-second** automatic rotation with wrap
- Explicit **Pause / Resume**
- Auto-suspend on hover, keyboard focus-within, and hidden document tab; resume starts a fresh 20-second interval
- `prefers-reduced-motion: reduce` supported (no vertical entry translation)
- Automatic screen-reader announcements disabled (`aria-live="off"` while auto-rotating)
- Zero eligible insights → Pulse omitted
- Single eligible insight → no unnecessary rotation

### Current ordered insight IDs

Eligibility-driven; not a permanently fixed set:

1. `contention-concentration`
2. `structural-change-2012-2026`
3. `coverage-disclosure`
4. `official-contention-scale`
5. `round-composition-brand`

### Representative current facts (production-accepted)

| Insight | Facts |
| --- | --- |
| Contention concentration | GoDaddy Registry Services appears in **66** of **263** official initial contention sets; largest set **13** applications |
| Structural change | Applications **1930 → 1615** (**down 16%**); IDN **116 → 21** (**down 82%**) |
| Coverage | Represented **1614** / official **1615**; **1** administrative-check Application outside the normal list/export |
| Official contention scale | **891** joined memberships across **263** official initial contention sets |
| Round composition | **333** Brand / **21** IDN / **16** Community applications (official aggregates) |

### Semantic safety

- Wording templates are source-controlled; only deterministic facts/calculations vary
- Structural **decline** wording emits only when **both** Applications and IDN comparisons are actual declines (`active < baseline`); if either increases or equals baseline, that insight is **omitted**
- Decline percent uses directional `(baseline − active) / baseline` — **not** absolute difference
- Coverage “exception is explicit” wording emits only when `knownExcludedCount > 0`
- Blocked/unavailable facts are omitted — never shown as zero or converted into fallback prose

### Data / evidence model

Pulse 1 consumes existing **`CommandCenterIntelligenceV2`** plus **`godaddyUniqueContentionSets`**. It does **not** create a second source of truth.

No new API, backend, database, publication, scheduler, network generation service, AI generation, or external source.

Implementation: `src/lib/command-center-insights.ts`, `src/components/registry/command-center-intelligence-pulse.tsx`.

### Production acceptance (2026-10-27)

| Field | Value |
| --- | --- |
| Production source | `a1124b71093333fc8492299885871d0bd0345aca` |
| Feature commit | `8ec2890ddb8b62e0f760a7e1d556ced603bcaa99` |
| Semantic hardening | `a1124b71093333fc8492299885871d0bd0345aca` |
| Backup | `/root/backups/rih-command-center-pulse-1-20261027T213455Z/` |
| PM2 app | `registry-intelligence-hub` |
| Post-deploy PID | `2558642` |
| Listener | `127.0.0.1:43123` |
| Deployment | **PASS** |
| Rollback | not required |

Accepted production smoke: required routes HTTP 200; desktop/mobile Pulse placement and controls; initial `01 / 05`; first insight 66 / 263 / 13; Pause / Resume; 20-second rotation; second insight 16% / 82%; full five-message rotation; layout stability; reduced-motion; Reveal Day 1615 / 481 / 263 / 891 unchanged; Registry Market 1319 / 1113 / 206 unchanged; MISSING ≠ zero unchanged.

### Registry Market preservation

Pulse deployment did **not** change Registry Market publication.

| Artifact | Value |
| --- | --- |
| `current.json` SHA-256 | `6f27bd0b3a8ee2327934f120e5b302b06e80ec67104e64ec670cd23f9b7096e9` |
| Publication | `ff7816b8a59823aeced2d76430b977c898ff23963b7434df71e0fd4b398f1c4d` |
| `index.json` SHA-256 | `18bce0df1d75b99105980f175f9390956b8e9006f2abd891966d1341552c4d22` |
| MRR scheduler | **NOT INSTALLED** |

## Eligible now

| Item | Status |
| --- | --- |
| Official Applications / Applicants | READY |
| Official initial contention sets / memberships | READY (contention actuality + overlay) |
| Confirmed Organization profiles / concentration / contention co-membership | READY_WITH_LIMITATION — confirmed subset only; coverage disclosed; not a round-wide Organization census |
| Applications 2012→2026 | READY_WITH_LIMITATION |
| IDN 2012→2026 | READY_WITH_LIMITATION |
| Brand / Community / Geographic (self-identified) / Variants | 2026 orientation |
| Replacement relationships | relationship grain (observed) |

## Blocked (omitted — not shown as zero)

- Complete unique applied strings / exact-string competition  
- Round-wide complete Organization count / complete portfolio concentration remain blocked; confirmed-subset Organization profiles and concentration are live with explicit coverage limitations  
- Round-wide returning / new / expanded / contracted classification  
- Category / sector taxonomy  
- Cross-round Community, Geographic, official contention-set deltas  
- Applicant concentration presented as Organization intelligence  

Unresolved Applicants remain Applicants. They must **not** be converted into “Unknown Organization” or other fabricated Organization entities.

## Current expansion direction

Command Center hierarchy is live and is the operational intelligence landing surface (posture → Intelligence Pulse → attention → monitoring → structural change → contention depth → composition → coverage → investigation actions).

**Architecture:** Application intelligence → Applicant intelligence → confirmed Organization overlay → cross-round Organization overlay. Organization resolution **enriches** Applicant intelligence; it is not a prerequisite for Applicant intelligence.

Organization posture (accepted baseline — see `docs/2026-organization-resolution.md`, `docs/organization-concentration.md`, `docs/organization-contention-pairs.md`, `docs/intelligence-priority-2.md`):

| Metric | Value |
| --- | ---: |
| Confirmed Applicant mappings | **161** |
| Confirmed Organizations | **104** |
| Unresolved Applicant mappings | **315** |
| Confirmed Applications | **1,129** |
| Confirmed Brand Applications | **160** |
| Confirmed contention memberships | **724** |
| Official contention-set coverage (≥1 Confirmed Org) | **256 / 263** |

Applicant intelligence is live independently. Confirmed Organization Profiles, confirmed-subset Organization concentration, and Organization-aware contention intelligence are live where steward-confirmed evidence supports them — always with **confirmed subset ≠ complete round** disclosure. Round-wide complete Organization count and round-wide complete portfolio concentration remain blocked. Confirmed cross-round Organization identity overlays exist for accepted mappings (including Microsoft and Google) and remain evidence-gated rather than a broad returning/new/expanded/contracted census (`Unmatched ≠ new`).

Contention intelligence, Compare, cross-round structural intelligence, historical cohorts (HIST-COHORT-1 / 2A), and scheduled Change Intelligence are live. Historical cohort expansion can proceed incrementally without treating Organization resolution as a prerequisite.

Next planned historical lens: **2012 regional Applicant structure**. IDN Applicant participation remains a later historical cohort option.

Production Reveal Day closeout (infrastructure): `docs/2026-reveal-day-production-closeout.md`.
