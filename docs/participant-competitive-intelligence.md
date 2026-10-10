# Participant competitive intelligence (PARTICIPANT-INTEL-1)

Product surface: **Competitive Landscape** (`/competitive-landscape`)

## Analytical grain

**Primary grain:** observed Applicant legal name (ICANN-source).

| Population | Count |
| --- | --- |
| Official Applications | 1615 |
| Official Applicants | 481 |
| Observed Applications available for analysis | 1614 |
| Observed Applicant legal names | 480 |
| Official initial contention sets / memberships | 263 / 891 |

Known excluded administrative-check record (`WDO2627T-T45217`) is coverage metadata only — never an ordinary participant row.

Applicant legal name is a legitimate analytical grain. Organization resolution is **optional enrichment**, not a prerequisite for participation in the landscape.

## Model

```
Application
→ Applicant legal name
→ optional resolved Organization (CONFIRMED only as fact)
→ optional confirmed cross-round returning identity
```

Runtime view-model: `src/lib/participant-intelligence.ts`  
Server overlays (existing snapshots / passes): `src/lib/participant-intelligence-server.ts`

No new ceremonial sidecars, promotion gates, or source mutations.

## GoDaddy competitive position

Focal published Applicant: **Registry Services, LLC**

Derived (not hardcoded): Application rank, contention-exposure rank, contested Applications, contention rate, official sets touched, designation composition, confirmed Organization overlay when present.

## Contention counterparts

Other Applicant legal names appearing in the **same official initial contention sets** as Registry Services, LLC Applications.

This is an official-set counterpart list. It does **not** claim corporate competitive relationships where Organization resolution is absent.

## Cross-round overlay

Only steward-confirmed returning Organizations may badge on Applicant rows (currently Microsoft; Charleston Road / Google).

- GoDaddy ↔ Uniregistry remains REJECTED / `ACQUIRED_AFTER_2012` — not returning.
- EchoStar / Dish remains AMBIGUOUS — not returning/new.
- Unmatched ≠ NEW.

## Non-goals

- Treating Applicant as Organization
- Inferring contention from exact-string grouping
- Category / sector taxonomy
- Complete Organization rankings from the confirmed subset
- New participant inference
- Source publication or claim-actuality mutation
- Broad site redesign

## Navigation

Command Center retains intelligence-first IA and exposes a CTA to Competitive Landscape. Hub nav includes **Competitive Landscape**. Drilldown reuses Explore (`q` / `ids`).
