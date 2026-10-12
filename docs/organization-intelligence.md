# Organization intelligence profiles (ORG-INTEL-1)

## Purpose

First-class research for steward-**Confirmed** 2026 Organizations:

> What broader Organization is this, which Applicant legal entities map to it, what Applications and contention exposure result, what evidence supports the mapping, and what cross-round / RSP / change context is accepted?

Complements Applicant Profiles. Does not replace them.

Route: `/organization?key=<canonical-organization-key>`

## Eligibility

Organization Profiles exist **only** for steward-CONFIRMED Organizations.

Candidate, Ambiguous, and Unresolved Applicants keep Applicant Profiles only. Unknown or non-Confirmed keys render a clear not-found state.

## Applicant vs Organization

| Concept | Meaning |
| --- | --- |
| **Applicant** | Exact ICANN-published legal applying entity |
| **Organization** | Evidence-backed broader entity that may group one or more Applicants |

Never collapse these. Portfolio aggregation always retains legal Applicant attribution on each Application.

## Canonical routing

- Pattern: `/organization?key=<encodeURIComponent(organizationKey)>`
- Stable identity: steward snapshot `organizationKey` (not display name, not array index)
- Examples: `identity-digital`, `salesforce`, `namecheap`, `hist-2012-microsoft`

## Derivations (reuse — no parallel calculations)

| Concern | Source |
| --- | --- |
| Confirmed Organizations | Organization-resolution snapshot |
| Applicant membership | Confirmed Applicant→Organization mappings + participant intelligence |
| Portfolio / Brand / contention | Represented Applications + official contention overlay |
| Counterparts | Non-member Applicants in shared official sets |
| Identity evidence | Overlay identity context (summary + inspect-by-Applicant) |
| RSP | Existing Applicant RSP postures among mapped Applicants only |
| Returning | Confirmed cross-round participation overlay |
| Changes | Link to Change Intelligence (no fabricated events) |

## Portfolio wording

Preferred: “RIH maps N represented Applications across M Applicant legal entities to {Organization}.”

Do not say the Organization “submitted” Applications unless clearly framed as aggregation.

## Contention aggregation

Distinguish:

- Application contention **memberships**
- Unique official contention **sets**
- Applicant legal entities represented in those sets

These are not interchangeable.

## RSP limitation

No new Organization-level RSP inference model. Show counts of accepted public postures among mapped Applicants only. Selected RSP is not established by public Applicant data. Preserve exact-legal-name / DBA / confirmed-organization matching rules (`via confirmed Organization` may remain 0).

## Cross-round limitation

Show 2012/2026 Organization portfolio context only for accepted confirmed returning Organizations (currently Microsoft and Google). Organization continuity ≠ identical Applicant legal-entity wording.

## Reciprocal navigation

- Applicant Profile Confirmed Organization → Organization Profile
- Organization Profile Applicant entity → Applicant Profile
- Competitive Landscape / Contention Confirmed badges link when canonical key is known

## Change Intelligence

Healthy empty state is acceptable. Do not rewrite monitoring history or invent Organization-change events.
