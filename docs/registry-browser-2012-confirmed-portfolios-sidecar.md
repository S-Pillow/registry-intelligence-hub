# Registry browser sidecar — confirmed organization portfolios

**Contract:** `registry-browser-2012-confirmed-portfolios/1.0.0`  
**Scope:** Steward-confirmed promoted organization portfolios for 2012 historical Explore (D2.4).  
**Not** part of `registry-browser-2012-applications/1.0.0`.

## Purpose

Ship read-only confirmed portfolio index separately from the 1,930-application browser payload. Join member application rows at runtime from the base payload using pinned `memberApplicationIds`.

## Pinned slice counts

| Field | Value |
| --- | ---: |
| Confirmed portfolios | 16 |
| Confirmed mapped applications | 466 |

## Required pins

- `baseApplicationPayloadCorpusContentHash` — must match loaded application payload (`b92c640a…` on baseline)
- `organizationPromotionRegistryVersion` — `organization-promotion-registry/1.0.0`
- `organizationPromotionMethodVersion` — `organization-promotion/1.0.0`
- `sourcePromotionRegistryContentHash` — SHA-256 of canonical `organization-promotions.json`
- `confirmedPortfolioCount` / `confirmedMappedApplicationCount` — must match pinned constants

## Fail-closed loading

The sidecar loader refuses to activate when:

- Application payload is missing or corpus hash mismatches the sidecar pin
- Portfolio or mapped-application counts differ from pinned expectations
- Any member application id is absent from the base payload

## Generation

```bash
npm run historical-2012 -- build-confirmed-portfolios-sidecar
```

Default artifact: `src/data/fixtures/registry-2012-confirmed-organizations.payload.json`

## Runtime env

- `REGISTRY_HUB_2012_CONFIRMED_PORTFOLIOS_PATH` — file path to sidecar JSON
- `REGISTRY_HUB_2012_CONFIRMED_PORTFOLIOS_JSON` — inline JSON (wins over path)

Both the application payload env **and** the sidecar env must be configured for Explore **Confirmed portfolios** browse.

## Portfolio entry shape

Each `portfolios[]` row includes `organizationKey`, `canonicalOrganizationName`, steward promotion metadata (`confidence`, `reviewState`, `evidence`, `promotionOpIds`), and `memberApplicationIds` (CONFIRMED only).
