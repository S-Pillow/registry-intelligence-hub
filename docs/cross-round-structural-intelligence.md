# Cross-round structural intelligence (CROSS-ROUND-STRUCT-1)

Route: **`/cross-round`**  
Title: **2012 vs 2026**  
Subtitle: Structural comparison across ICANN application rounds

## Governing principle

Use the broadest factual layer whose claims remain truthful at current evidence maturity.  
If definitions differ materially: **BLOCKED / NOT COMPARABLE** — never a forced chart.

Unmatched Applicant or Organization identity is **not** labeled new / new entrant / first-time participant.

## Compatibility matrix (authority)

| Dimension | Status | Notes |
| --- | --- | --- |
| Applications | `DIRECTLY_COMPARABLE` | Official 1930 → 1615 (−315) |
| IDN Applications | `DIRECTLY_COMPARABLE` | Official 116 → 21 (−95) |
| Applicant legal entities | `BLOCKED` | 2012 distinct legal names vs 2026 official/represented grains not proven equivalent |
| Regional distribution | `BLOCKED` | No accepted region-normalization; grains differ |
| Community | `BLOCKED` | Shared label ≠ shared methodology |
| Geographic | `BLOCKED` | 2026 self-identified ≠ 2012 Geographic treatment |
| Unique applied strings | `BLOCKED` | 2026 coverage gap (1614/1615) blocks complete-round unique-string delta |
| Exact-string repeats | `BLOCKED` | Coverage + method not unlocked for cross-round headline |
| Contention | `BLOCKED` | 2012 preliminary ≠ 2026 official initial program stage |
| Organization count | `BLOCKED` | Confirmed subsets only; incomplete both rounds |
| Multi-Application concentration | `BLOCKED` | Identity completeness insufficient |
| Brand | `BLOCKED` (2026 context only) | No accepted 2012 Brand equivalent — show 333 as round context, not a delta |

Source of truth in code: `src/lib/cross-round-structural-intelligence.ts` (`CROSS_ROUND_COMPATIBILITY_MATRIX`).

## Metric definitions

### Applications (directly comparable)

- **2012:** `APPROVED_2012_BASELINE.applications` = 1930  
- **2026:** Browser document `officialApplications` = 1615  
- **Delta:** −315  
- **Not used as denominator:** represented 1614 Application rows

### IDN Applications (directly comparable)

- **2012:** 116  
- **2026:** `APPROVED_2026_ORIENTATION_AGGREGATES.idnApplications` = 21  
- **Delta:** −95  

Percentage change is not shown unless a future deterministic policy explicitly authorizes it.

## Official vs represented denominators

| Grain | Applications | Applicants |
| --- | --- | --- |
| Official | 1615 | 481 |
| Represented / observed | 1614 | 480 distinct legal names on projected rows |

WDO administrative-check Application is coverage metadata outside the normal list/export. Calculations must not silently swap official and represented denominators.

## Returning Organizations (confirmed sample)

Steward-confirmed Organization continuity only (CROSS-ROUND-ID-1 / RETURNING-NEW-1):

| Organization | Key | 2012 | 2026 | Δ |
| --- | --- | --- | --- | --- |
| Microsoft | `hist-2012-microsoft` | 11 | 2 | −9 |
| Google | `hist-2012-google-charleston-road` | 101 | 39 | −62 |
| **Sample total** | — | **112** | **41** | **−71** |

Label: **Confirmed returning Organization sample** — not all returning Organizations, not market share, not a whole-round denominator.

Organization continuity ≠ identical Applicant legal-entity wording across rounds.

## Blocked comparison rationale (product copy)

Visible section: **What RIH does not compare yet**

Examples:

- **Contention** — 2012 preliminary and 2026 initial contention states are not treated as an equivalent program-stage measure.  
- **Unique applied strings** — 2026 unique-string completeness is constrained by the WDO coverage gap.  
- **Geographic** — self-identified 2026 Geographic must not be silently equated with historical Geographic.  
- **Organization count** — confirmed subsets only; unmatched ≠ new.

## Drill-down behavior

- Command Center → **Explore 2012 vs 2026** (`/cross-round`) from “What changed since 2012”  
- `/cross-round` → Microsoft / Google Organization Profiles  
- Returning Organization Profiles → `/cross-round`  
- 2026 Applications / IDN → Explore when appropriate  

Does not load the full historical Explore corpus client-side for these metrics.

## Provenance

Each comparison exposes 2012 source, 2026 source, limitation/status, and coverage notes.  
Normal UI does not expose hashes/schema IDs. Technical detail: Data & methodology.

## Related docs

- `docs/2026-command-center-intelligence.md` — Command Center IA  
- `docs/2026-metric-eligibility-rebaseline.md` — eligibility catalog  
- `docs/cross-round-organization-identity.md` — confirmed Organization pairs  
- `docs/returning-new-participation-intelligence.md` — returning sample semantics  
- `docs/organization-intelligence.md` — Organization Profiles  
