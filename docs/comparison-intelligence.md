# Comparison intelligence (COMPARE-INTEL-2)

## Purpose

Upgrade Compare into an analyst surface for current-round **Applicant** and **Confirmed Organization** intelligence:

> How do these Applicants or Organizations differ in portfolio size, Brand posture, contention exposure, public RSP posture, and confirmed cross-round history?

Route: `/compare?type=applicant|organization&ids=<encoded-keys>`

## Entity grain

| Grain | Meaning | Identity key |
| --- | --- | --- |
| **Applicant** | Exact ICANN-published legal applying entity | Represented Applicant legal name |
| **Organization** | RIH evidence-backed grouping of one or more Applicants | Canonical `organizationKey` |

Organization-level aggregates must never be displayed as though the Organization were the formal ICANN Applicant. Every Compare surface labels the grain:

- Applicant comparison
- Organization comparison

## Mixed-grain decision

**Homogeneous only.** The Compare tray and URL model allow either Applicants or Organizations, not both in the same selection.

If a user tries to mix grains, Compare explains that metrics would be misleading and asks them to clear the tray or finish the current comparison. Unlike grains are not placed in the same metric column.

## Applicant comparison

Dimensions (where available; otherwise **Not available**):

- Identity: legal name, country/region, Confirmed Organization mapping state, Applicant Website
- Portfolio: Application count, Brand count, Brand share (`N of M`), applied-strings preview
- Contention: Applications in official initial contention, unique sets, distinct counterpart Applicants
- RSP: public Main-RSP posture label only
- Historical: confirmed Organization returning context only when accepted
- Evidence / confidence: mapping state; returning context wording

Unresolved Applicants remain fully comparable at Applicant grain. Organization fields stay **Not resolved** (or Candidate/Ambiguous) without inventing Organizations.

## Organization comparison

Only steward-**CONFIRMED** Organizations. Candidate/Ambiguous keys are rejected.

Dimensions:

- Identity: canonical name, mapped Applicant entity count, Applicant preview
- Portfolio: 2026 Applications across mapped Applicants, Brand, Brand share, strings preview
- Contention: Application memberships, unique official sets, Applicant entities represented in those sets, distinct external counterparts
- RSP: distribution of public Main-RSP postures among mapped Applicants — **no Organization-level selected-RSP inference**
- Historical: confirmed 2012 / 2026 / absolute delta when accepted; otherwise unavailable (not `0`)
- Evidence: mapping count and evidence-type labels

## Metric definitions (short)

| Metric | Grain | Definition |
| --- | --- | --- |
| Applications | Applicant | Represented Applications for that legal name |
| 2026 Applications | Organization | Sum of Applications across Confirmed-mapped Applicants |
| Brand Applications | both | Applications with Brand designation |
| Contention memberships | Organization | Sum of official initial memberships across mapped Applicants |
| Unique contention sets | both | Distinct official set ids touched |
| Counterpart Applicants | both | Distinct other Applicants sharing those sets |

Memberships, sets, and Applicants are **not** interchangeable.

## RSP limitation

Labels reuse accepted public posture language only, e.g.:

- Public Main-RSP capability found
- No public Main-RSP capability found

Selected RSP is **not** established by public Applicant data. Do not imply commercial availability, closed opportunity, or that GoDaddy can win.

## Historical limitation

Only Microsoft (`hist-2012-microsoft`) and Google (`hist-2012-google-charleston-road`) currently receive confirmed Organization-level cross-round Application metrics.

Other Organizations show **No confirmed cross-round Organization relationship** — never `2012 = 0` merely because identity is unconfirmed.

**Unmatched ≠ new.**

## URL state

- `type=applicant` or `type=organization`
- `ids=` encodeURIComponent(key) joined with `|` (safe for commas in legal names)
- Deterministic keys only — never array indices
- Shareable; stale/unknown keys surface warnings without fabricating entities

Example:

`/compare?type=organization&ids=identity-digital%7Cnamecheap`

## Tray

Session-scoped tray (`rih-compare-intel-2-tray/v1`):

- entity name + type (Applicant / Organization)
- remove / clear
- Open Compare when ≥ 2 like entities
- max 4
- mixed-grain blocked with explanation

## Profile drill-down

Compare columns link to:

- `/applicant?name=…`
- `/organization?key=…`
- Contention via existing contention hrefs
- Cross-round structural page for round-wide context

## Entry points

- Applicant Profile → Add to Compare
- Organization Profile → Add to Compare (Confirmed only)
- Competitive Landscape participant rows → Applicant Compare; Confirmed Organization Compare when mapped
- `/compare` landing when empty

## basePath-safe navigation

All internal navigation uses Next.js `Link` / app-relative paths (`/compare`, `/applicant`, `/organization`, `/contention`). Production remains under `/tools/registry-intelligence-hub/`. No raw ForgeForward-root escape anchors.

## Reuse

Derivation reuses:

- `buildApplicantIntelligenceProfile`
- `buildOrganizationIntelligenceProfile`
- existing RSP / contention / returning overlays

No new Organization resolution. No new returning matches. No selected-RSP inference.
