# RSP opportunity intelligence (RSP-INTEL-1)

Public-signal RSP research enrichment on Competitive Landscape. Does not infer selected RSP or commercial availability.

## Applicant vs Registry Operator

- **Applicant** — ICANN-source legal entity that submitted an application.
- **Applicant / prospective Registry Operator** — the Applicant is pursuing the applied-for TLD. An application alone does not make the entity Registry Operator.
- If the application proceeds and the Applicant enters the applicable Registry Agreement, that entity becomes **Registry Operator** for the TLD.

## Registry Operator vs RSP

- **Registry Service Provider (RSP)** supplies backend registry technical services.
- Distinct from being the Applicant. A company may participate in both roles.
- Example: Registry Services, LLC / GoDaddy Registry is a 2026 Applicant and also has public evaluated Main-RSP evidence.

## Official evaluated-RSP source

- ICANN: *List of Evaluated MAIN, DNS, DNSSEC, PROXY, and IDN Support Level Applications*
- URL: https://newgtldprogram-2026-documents.icann.org/rsp-documents/rsp-applications.html
- Tracked normalized artifact: `src/data/icann-evaluated-rsp/evaluated-main-rsp-v1.json`
- Refresh: `node scripts/acquire-icann-evaluated-rsp.mjs` (or `npm run acquire-evaluated-rsp`)
- **No runtime fetch on page load.**

## Capability-state semantics

Only **“Successfully cleared RSP evaluation”** counts as cleared (`SUCCESSFULLY_CLEARED`).

Blank, pending, technical screening cleared / testing in progress, and other incomplete statuses are **not** cleared.

## Source freshness

The Competitive Landscape RSP section shows publisher + source last-updated from the tracked artifact (not a hardcoded permanent date).

## GoDaddy public RSP posture

Derived from the official list (not product constants):

- Legal name: Registry Services, LLC
- DBA: GoDaddy Registry
- Main / DNS / DNSSEC cleared when present on the source
- Proxy blank/not cleared when absent
- IDN support level from source

## Selected RSP — non-public limitation

The 2026 Applicant Guidebook selected-RSP question is not publicly posted. Public RIH data does **not** establish which RSP an Applicant selected, whether one was selected yet, or commercial availability.

RIH must not claim: available opportunity, unassigned RSP, no RSP selected, needs an RSP, available/open/competitor customer.

## Public RSP posture vs research priority

**Public RSP posture** = factual classification from official evaluated-RSP matching.

**Research priority** = GoDaddy-oriented analytical ordering of the external Applicant universe (no public Main-RSP capability match first, then Application portfolio size, then contested Applications, then name).

**Commercial availability** = unknown. Ranking is not opportunity likelihood, sales probability, or deal score.

| Public RSP posture | Meaning |
| --- | --- |
| GoDaddy own Applicant portfolio | Registry Services, LLC — excluded from external research universe |
| No public Main-RSP capability found | No public evaluated Main-RSP match under current evidence rules (**≠** “no RSP selected” / available customer) |
| Public Main-RSP capability found | Exact legal name or unambiguous official DBA match to Main-cleared RSP |
| Main-RSP capability via confirmed organization | Deterministic link via steward-CONFIRMED Organization only |
| Identity review needed | Reserved for material match uncertainty |

Self-RSP-capable Applicants remain visible; they may self-provide, use an affiliate, or choose another provider.

## Matching rules

Allowed automatic paths only:

1. `EXACT_LEGAL_NAME`
2. `EXACT_OFFICIAL_DBA` (unambiguous)
3. `CONFIRMED_ORGANIZATION` (never Candidate / Ambiguous)

No fuzzy matching, string similarity as fact, ownership inference, or new Organization-resolution decisions.

## Organization mapping labels

| Underlying | Label |
| --- | --- |
| CONFIRMED | Confirmed organization / `Confirmed · {name}` |
| CANDIDATE | Candidate match |
| AMBIGUOUS | Identity ambiguous |
| UNRESOLVED | Not yet resolved |

“Not yet resolved” does not imply that no broader organization exists — Applicant statistics remain valid.

## Non-goals

- Selected-RSP inference from DNS, hosting, WHOIS, 2012 provider, geography, contention, etc.
- Opaque opportunity scores / sales probabilities
- Scraping application PDFs for RSP fields
- Runtime database or mutable production state
- Category/sector filters
- Deployment in this ticket
