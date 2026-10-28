# Historical Organization lineage

Version: **`historical-organization-lineage/1.0.0`**

Evidence-backed predecessor/successor relations between **distinct** Organization identities across time.

## Layering (required)

1. **2012 source Applicant** — immutable Reveal Day CSV legal name (e.g. `NeuStar, Inc.`).
2. **2012 Organization** — steward-promoted via `organization-promotions.json` (e.g. `organization:promoted:neustar`).
3. **Historical lineage** — optional steward-approved relation (e.g. NeuStar registry business → GoDaddy Registry).
4. **2026 Organization** — existing canonical resolved Organization (e.g. `organization:resolved-2026:godaddy-registry-services`).

Lineage **enriches** intelligence. It does **not** rewrite historical Applicants, invent SAME_ORGANIZATION returning identity, imply selected RSP relationship, or merge unrelated Applicants such as Go Daddy East, LLC.

## Relationship types

| Type | Meaning |
| --- | --- |
| `SAME_ENTITY_RENAME` | Rename with continuous legal/analytical identity |
| `BUSINESS_LINE_SUCCESSION` | Operating line succeeded (e.g. registry ops acquired) without claiming wholesale rename |
| `ACQUISITION` | Acquisition continuity claim (narrow scope required) |
| `MERGER` | Merger continuity |
| `OTHER_EVIDENCE_BACKED_SUCCESSION` | Other steward-supported succession |

Cross-round **returning** identity remains governed by `cross-round-organization-identity` (`SAME_ORGANIZATION` / `RENAMED_ENTITY` / `CONTINUOUS_PARENT_IDENTITY` only). GoDaddy ↔ Uniregistry `ACQUIRED_AFTER_2012` rejection is unchanged.

## Stewardship

CONFIRMED lineage requires steward/operator approval plus acceptable evidence. Similarity of names alone is never enough.

## UI

Approved lineages for a current Organization appear on `/organization?key=…` under **Historical registry lineage**.
