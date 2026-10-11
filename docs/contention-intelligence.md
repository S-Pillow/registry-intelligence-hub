# Contention intelligence (CONT-INTEL-1)

## Purpose

Business-facing workflow for official 2026 **initial** contention:

- where contention is concentrated;
- which sets include Registry Services, LLC (GoDaddy Applicant) Applications;
- who the non-GoDaddy counterpart Applicants are;
- set crowding / structure;
- public Main-RSP posture and Organization mapping overlays;
- drilldown into Explore, Competitive Landscape, and Changes.

Route: `/contention`.

## Source semantics

Uses the accepted **official initial contention** membership overlay already joined into the browser application payload (`officialContention` / contention sidecar).

This is **not**:

- exact-string grouping invented by RIH;
- inferred or final contention;
- a prediction of auction/outcome.

Counts must agree with Change Intelligence’s official contention membership universe.

## Counts

| Metric | Meaning |
| --- | --- |
| Official initial contention sets | Distinct official set IDs |
| Official contention memberships | Application×set membership rows |
| GoDaddy contention memberships | Memberships where Applicant is Registry Services, LLC |
| Unique GoDaddy sets | Distinct sets containing ≥1 Registry Services, LLC Application |
| Counterpart Applicants | Distinct non-GoDaddy Applicant legal names in those GoDaddy sets |
| Counterpart memberships | Non-GoDaddy Application memberships in GoDaddy sets |

Application membership count and distinct Applicant count are separate.

## GoDaddy exposure

**GoDaddy exposure** = official initial contention sets that contain one or more Registry Services, LLC Applications.

It does **not** mean financial, legal, or Registry Operator exposure. Registry Services, LLC remains an Applicant legal entity for these 2026 records.

## Counterparts

Set-centric counterpart context for GoDaddy sets. Applicant-centric shared-set rankings remain on Competitive Landscape; this page does not replace that table.

## RSP context

Reuses accepted public Main-RSP posture labels only. Selected RSP remains nonpublic. “No public Main-RSP capability found” may be noted as relevant for RSP research — not as a sales lead or vacancy.

## Organization overlay

Organization mapping is optional enrichment. Unresolved Applicants remain valid contention participants.

Visible labels:

- Confirmed · {Organization}
- Candidate match
- Identity ambiguous
- Not yet resolved

“Not yet resolved” is not evidence that no broader organization exists.

## Initial, not final

UI disclosure: these are ICANN’s current initial contention memberships and may change as the program progresses. Do not call membership removal “resolved” unless the source explicitly supports that.

## Change Intelligence

Contention change events link to `/contention?set=<official-set-id>` for set drilldown. Monitoring history semantics are unchanged.

## Relationship to Competitive Landscape

| Surface | Grain |
| --- | --- |
| Competitive Landscape | Applicant-centric portfolios + shared-set counterpart table |
| Contention | Set-centric landscape + GoDaddy exposure + member drilldown |
