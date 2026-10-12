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

## Next dependencies

1. **ORG-RES-2026-1** — evidence-backed 2026 Organization resolution (layer present; confirmed-only product still gated — see `docs/2026-organization-resolution.md`)  
2. **CROSS-ROUND-ID-1** — defensible 2012↔2026 participant identity  
3. Then CONTENTION-INTEL-1 / Compare–Briefing rework as eligibility permits  

Production Reveal Day closeout (infrastructure): `docs/2026-reveal-day-production-closeout.md`.
