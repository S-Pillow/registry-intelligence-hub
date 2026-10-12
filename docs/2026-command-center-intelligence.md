# Command Center intelligence-first IA (CC-IA-REBASE-1)

**Role:** Command Center is an evidence-backed **intelligence layer** for the 2026 round — not an APS browser clone.

**Drilldown:** Search / Explore remain evidence surfaces. Command Center links into them; it does not recreate listing/filter tables. Applicant competitive intelligence lives on **Competitive Landscape** (`/competitive-landscape`) — see `docs/participant-competitive-intelligence.md`.

## Active 2.x hierarchy

Operational intelligence order (COMMAND-CENTER-HIERARCHY-1):

1. **Round posture** — official Applications 1615, Applicants 481, official initial contention 263 / 891 (first substantive block)  
2. **What deserves attention** — compact deterministic strip only: GoDaddy contention footprint (66 unique official initial sets), public change-monitoring status, coverage exception (1614 / 1615 + administrative-check disclosure). No LLM narrative, risk scores, or commercial recommendations.  
3. **Recent changes / monitoring** — compact status row when the latest check has zero material changes; fuller card when changes exist. CTA → `/changes`.  
4. **What changed since 2012** — only READY_WITH_LIMITATION comparisons (Applications, IDN), with CTA **Explore 2012 vs 2026** → `/cross-round` (see `docs/cross-round-structural-intelligence.md`). Raw structural deltas use **neutral** styling (not green/red “good/bad” semantics).  
5. **Competitive structure** — official initial contention depth (sets / memberships / crowded-set distribution); not duplicated as a standalone top Contention summary card  
6. **Round composition** — compact designation / relationship orientation (not sectors/categories)  
7. **Coverage** — secondary PARTIAL 1614/1615 panel + Data & methodology (`/data-health`) link  
8. **Investigation actions** — one primary CTA (**Open Competitive Landscape**); secondary text links for Explore applications, Search records, Explore contention  

Do not place a large standalone Contention summary card above round posture. 

## Eligible now

| Item | Status |
| --- | --- |
| Official Applications / Applicants | READY |
| Official initial contention sets / memberships | READY (contention actuality + overlay) |
| Applications 2012→2026 | READY_WITH_LIMITATION |
| IDN 2012→2026 | READY_WITH_LIMITATION |
| Brand / Community / Geographic (self-identified) / Variants | 2026 orientation |
| Replacement relationships | relationship grain (observed) |

## Blocked (omitted — not shown as zero)

- Complete unique applied strings / exact-string competition  
- Resolved Organizations / portfolios / concentration  
- Returning / new / expanded / contracted  
- Category / sector taxonomy  
- Cross-round Community, Geographic, official contention-set deltas  
- Applicant concentration presented as Organization intelligence  

## Current expansion direction

Command Center hierarchy is live and is the operational intelligence landing surface (posture → attention → monitoring → structural change → contention depth → composition → coverage → investigation actions).

Organization resolution and Organization / Applicant intelligence are already active where evidence supports them (partial: 145 Confirmed Applicant mappings / 89 Confirmed Organizations / 2 Candidate / 2 Ambiguous / 331 Unresolved — see `docs/2026-organization-resolution.md`). Confirmed cross-round Organization identity overlays are available for accepted mappings (including Microsoft and Google) and remain evidence-gated rather than broadly complete.

Contention intelligence, Compare, cross-round structural intelligence, historical cohorts (HIST-COHORT-1 / 2A), and scheduled Change Intelligence are live. Historical cohort expansion can proceed incrementally without treating Organization resolution as a prerequisite.

Next planned historical lens: **2012 regional Applicant structure**. IDN Applicant participation remains a later historical cohort option.

Production Reveal Day closeout (infrastructure): `docs/2026-reveal-day-production-closeout.md`.
