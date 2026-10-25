# Confirmed Organization competitive concentration (ORG-CONCENTRATION-1)

Deterministic Confirmed-subset Organization concentration for Application portfolios and official initial contention. Not a round-wide Organization census.

## Scope

- **In:** Confirmed Organizations only; Application portfolio ranks/shares; contention membership + set-touch ranks/shares; crowded official-set Organization structure; GoDaddy-relative counterpart co-membership; coverage disclosure.
- **Out:** Round-wide complete Organization rankings; Candidate/Ambiguous/Unresolved as Organizations; selected-RSP inference; market-performance / opportunity scoring; new Organization research.

## Denominators (confirmed subset)

Primary shares use:

| Denominator | Meaning |
| --- | --- |
| Confirmed Applications | Applications whose Applicant maps to a Confirmed Organization |
| Confirmed contention memberships | Official memberships attributable to Confirmed Organizations |

Optional footprint uses represented Application count / official contention totals. Set-touch % is independent across Organizations and does **not** sum to 100%.

**Confirmed subset ≠ complete round.** Unresolved Applicants remain source Applicants and are never labeled “Unknown Organization.”

## Surfaces

| Surface | Role |
| --- | --- |
| `/competitive-landscape` | **Primary** — coverage, top-N portfolio + contention tables, GoDaddy confirmed-subset ranks |
| `/contention` | Crowded official sets + GoDaddy counterpart Organizations |
| `/organization?key=…` | Compact rank/share context for the profiled Confirmed Organization |
| Command Center home | Unchanged (no concentration block) |

## Derivation

- Module: `src/lib/organization-concentration.ts` (`buildOrganizationConcentration`)
- Server load: `src/lib/organization-concentration-server.ts` (`loadOrganizationConcentrationModel`)
- Inputs: Active browser Application document V2 (with official contention overlay) + steward Organization resolution snapshot
- Fail-closed when Application publication pin on the Organization snapshot mismatches the active document graph hash

## Language safety

Avoid presenting confirmed-subset shares as round-wide market figures, dominance, win/auction probability, sales opportunity, selected RSP, or available-customer claims.

## Related

- `docs/2026-organization-resolution.md` — Confirmed-subset readiness / coverage honesty
- `docs/intelligence-priority-2.md` — unit framing
