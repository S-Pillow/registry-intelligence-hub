# 2026 Reveal Day contention membership sidecar (APS-CONTENTION-CSV-1)

**Status:** IMPLEMENTED offline (NOT PROMOTED).  
**Schema:** `registry-2026-contention-membership/1.0.0`  
**Pinned Application schema:** `registry-2026-publication/2.0.0`  
**Governing decisions:** `docs/2026-aps-reveal-day-source-contract.md`, `docs/2026-aps-schema-grain-decision.md` (Case E).

Official ICANN Reveal Day contention CSV → immutable local membership sidecar. Separate from Application publication content and from RIH `exact-applied-string-grouping/1.0.0`.

---

## Source artifact

| Item | Value |
| --- | --- |
| Canonical URL | `https://newgtldprogram.icann.org/en/application-rounds/round2/reveal-day-contention-sets.csv` |
| Redirect | 301 → `.../sites/default/files/documents/reveal-day-contention-sets.csv` |
| Media type | `text/csv` (UTF-8 BOM) |
| Headers | `#`, `Application ID`, `Org Name`, `Applied-for string(s)` |
| Record grain | one row per contention-set **member** |
| Reveal Day capture (verified) | 46481 bytes; SHA-256 `86f2ebd3764d1f3ea21d5d844cff004e271a443a3431e8ac440da7f72c67e2bf` |

Later ICANN contention state may differ. This sidecar records Reveal Day publication facts only.

---

## Offline build

```bash
npm run reveal-2026 -- build-contention-membership \
  --input .data/reveal-2026/aps-capture/reveal-day-contention-sets.csv \
  --application-publication .data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json \
  --out .data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json \
  --review-out .data/reveal-2026/publications/aps-contention-1.0.0.review.json \
  --bundle-out .data/reveal-2026/publications/aps-reveal-day-evidence-bundle.json \
  --snapshot-id snap-aps-2026-contention-reveal-day-v1 \
  --artifact-id aps-2026-reveal-day-contention \
  --capture-id capture-reveal-day-contention-2026-10-08 \
  --source-url https://newgtldprogram.icann.org/en/application-rounds/round2/reveal-day-contention-sets.csv \
  --final-url https://newgtldprogram.icann.org/sites/default/files/documents/reveal-day-contention-sets.csv \
  --source-name "ICANN Reveal Day contention sets CSV" \
  --source-version 1 \
  --retrieved-at 2026-10-08T05:38:20Z \
  --published-at 2026-10-07T18:00:00Z \
  --expect-source-hash 86f2ebd3764d1f3ea21d5d844cff004e271a443a3431e8ac440da7f72c67e2bf \
  --expect-application-graph-hash 09e75b1c83baa2a7466033de991332f396b108dc3d8c0775d3c17d99ec6b45d2 \
  --recorded-http-status 200
```

Reveal Day verification expectations (against captured evidence):

| Fact | Value |
| --- | ---: |
| Membership rows | 891 |
| Official sets | 263 |
| Joined members | 891 |
| Unjoined | 0 |
| Replacement `-R` IDs | 0 |
| Set sizes | 2–13 |
| Applications in multiple sets | 0 (observed) |
| WDO in contention CSV | no |
| Promotion | NOT PROMOTED |

---

## Schema 1.0.0

- `ContentionMembershipSnapshot` — schemaVersion, snapshotId, lineage, raw SHA-256, `applicationPublicationPin`, `contentionSets[]`, quality, bundleManifest
- `ContentionSet` — `officialContentionSetId` = exact source `#` (not an internal `ICS-*` id)
- `ContentionMember` — `applicationId`, `publishedOrgName`, `appliedForStringsAsPublished`, `sourceRowIndex`

### `Org Name` semantics

CSV `Org Name` → `publishedOrgName` (source text only).  
It is **not** RIH resolved Organization and must not enter organization-resolution machinery.

### Application publication pin

Sidecar validates and records:

- Application schema `registry-2026-publication/2.0.0`
- `snapshotId`
- `applicationGraphContentSha256`
- observed coverage counts / completeness

Wrong pin → fail closed. Changing the Application pin requires revalidation; the sidecar content hash includes the pin.

### Bundle relationship (no Application rewrite)

The immutable Application publication artifact is **not** rewritten to embed the sidecar hash (`supplementalArtifactPins.contentionMembershipPin` remains `null` on that artifact).

A separate evidence bundle (`registry-2026-reveal-day-evidence-bundle/1.0.0`) links:

Application publication graph hash ↔ Contention sidecar content hash

---

## Hash boundary

Sidecar content hash includes:

- `snapshotId`
- `applicationPublicationPin`
- normalized `contentionSets` (official ids, members, publishedOrgName, applied-for strings)

Excludes: retrieval timestamp, local filesystem paths.

Raw source SHA-256 is preserved separately.

---

## Official vs calculated

| Class | Source |
| --- | --- |
| Official contention membership | ICANN Reveal Day contention CSV |
| Calculated exact-string competition | RIH `exact-applied-string-grouping/1.0.0` |

Do not infer one from the other. Official 263 sets / 891 members are Reveal Day contention-publication facts only.

Join success against 1614 observed Applications does **not** change Application coverage from PARTIAL 1614/1615 to COMPLETE.

---

## Boundaries

| In scope | Out of scope |
| --- | --- |
| Offline sidecar + evidence bundle | Browser / Command Center / Explore |
| Pin to Application 2.0.0 | Promotion / claim-actuality |
| Fail-closed join | Organization / category inference |
| | Deployment / mutating Application publication |

---

## Implementation map

| Piece | Location |
| --- | --- |
| Types | `src/reveal-day-2026/contention-membership-types.ts` |
| Parser | `src/reveal-day-2026/aps-contention-csv.ts` |
| Builder | `src/reveal-day-2026/build-contention-membership.ts` |
| Validator | `src/reveal-day-2026/validate-contention-membership.ts` |
| CLI | `npm run reveal-2026 -- build-contention-membership` |
| Tests | `src/reveal-day-2026/aps-contention-csv.test.ts` |
| Live capture (gitignored) | `.data/reveal-2026/aps-capture/reveal-day-contention-sets.csv` |
