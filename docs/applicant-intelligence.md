# Applicant intelligence profiles (APPLICANT-INTEL-1)

## Purpose

A first-class Applicant research surface that answers:

> Who is this legal Applicant, what did it apply for, what broader Organization does it belong to, where is it in contention, what public RSP posture is known, what identity evidence supports the mapping, and what has changed?

Route: `/applicant?name=<encoded-legal-name>`

## Applicant vs Organization

| Concept | Meaning |
| --- | --- |
| **Applicant** | Exact ICANN-published legal applying entity (profile title) |
| **Organization** | Optional evidence-backed broader identity (Confirmed / Candidate / Ambiguous / Not yet resolved) |

They are never collapsed. Examples:

- Applicant `Salesforce, Inc.` → Organization `Salesforce`
- Applicant `Hair Apparent, LLC` → Organization `Identity Digital`
- Applicant `Amazon Registry Services, Inc.` → Not yet resolved (profile remains useful)

Unresolved is a mapping state, not missing data. The profile does not show an empty Organization field as though values failed to load.

## Routing / deep-link contract

- Canonical pattern: `/applicant?name=<encodeURIComponent(legalName)>`
- Stable identity: exact represented Applicant legal name (not array index, not fragile slug)
- Safe for punctuation, commas, LLC/Inc suffixes, and Unicode
- Deterministic, shareable, deep-linkable across Explore, Competitive Landscape, Contention, and Change Intelligence

Unknown names render a clear not-found state.

## Profile derivations (reuse — no parallel calculations)

| Concern | Source |
| --- | --- |
| Applicant identity / portfolio | Represented Applications (`RegistryApplicationsDocumentV2`) |
| Participant intelligence | `buildParticipantIntelligence` |
| Organization overlay | Steward Organization sidecar via `loadParticipantOverlays` |
| Brand counts | Application designation flags on participant rows |
| Contention memberships / counterparts | Official initial contention overlay + participant focal counterparts |
| RSP public posture | `buildRspOpportunityIntelligence` / evaluated Main-RSP artifact |
| Returning / cross-round | Confirmed returning overlay only |
| Change Intelligence | Link to `/changes` (no fabricated history) |
| Identity evidence | Applicant Website / parent / control fields on Organization overlay |
| Provenance | Existing Data & methodology / drawer patterns |

## At-a-glance counts

- Applications
- Brand applications (`N of total`)
- Applications in official initial contention
- Unique contention sets
- Distinct counterpart Applicants
- Public Main-RSP posture
- When confirmed returning: 2012 / 2026 Organization applications (Organization-level, not Applicant legal continuity)

Do not show cross-round metrics for unmatched Applicants. Do not imply unmatched = new.

## Brand context

Brand designation is shown inside the Applicant portfolio. Applied-for strings remain Applications under the legal Applicant — never separate Organizations (e.g. `.slack` / `.tableau` under Salesforce, Inc.).

## Contention semantics

A contention set groups Applications ICANN has identified as competing with one another. Application count and distinct Applicant count are separate: one Applicant may have multiple Applications in the same set.

These are official **initial** memberships — not final resolution.

Profile sections list sets involving the Applicant with Application count, distinct Applicants, this Applicant’s Application IDs, GoDaddy involvement, member Applications, and CTA to `/contention?set=<id>`.

## RSP limitation

Shows accepted public Main-RSP posture only.

Always disclose: **Selected RSP is not established by the public Applicant data.**

Do not imply opportunity, vacancy, sales probability, or “needs an RSP.”

## Cross-round limitation

Returning / 2012-vs-2026 context appears only for confirmed accepted cross-round Organization identity. Label as Organization-level history when it is not Applicant legal-name continuity.

## Organization context & siblings

When Confirmed, show Organization name, sibling represented Applicant legal entities mapped to the same Organization, Organization Application and contention totals, and a CTA to Competitive Landscape filtered context. Do not call siblings subsidiaries unless source evidence establishes that.

## Change Intelligence

Healthy empty state: no material public Application or contention changes recorded since monitoring began. Do not invent events.

## Entry points

Applicant profile links from:

- Explore Applicant name / Applicant profile action
- Competitive Landscape Applicant rows
- Contention member and counterpart Applicant names
- Change Intelligence Applicant context (when present)

## Actions

Surface functional Explore / Competitive Landscape / Contention / Changes links. Do not add nonfunctional Compare/Watch/Brief buttons when Applicant entity type is unsupported.
