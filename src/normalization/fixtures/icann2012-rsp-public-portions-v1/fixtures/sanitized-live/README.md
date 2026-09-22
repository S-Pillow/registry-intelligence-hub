# Sanitized live mapping checkpoints (RESTRICTED_RAW_SOURCE)

Immutable HTML captured during the first authorized P0.3C mapping-live run (`mapping-20260922-vps-01`).

- **Fixture source commit (P0.3D HTML):** `b18124c2159118d85ccc6daa8d12ef11100b7daf` when merged from `registry-intelligence-hub`
- **Do not edit** sanitized HTML to make the parser pass — fix parser/pagination/safety code instead.
- **SHA pins:** `mapping-20260922-vps-01/sanitized-live-provenance.json` (must match `sanitized-live-fixture-constants.ts`)
- **Fail closed:** `REGISTRY_HUB_RSP_REQUIRE_SANITIZED_FIXTURE=1` requires manifest + pinned HTML on disk

Expected layout:

```
mapping-20260922-vps-01/
  sanitized-live-provenance.json
  page-0001.html   # pin SANITIZED_LIVE_PAGE_0001_CONTENT_SHA256
  page-0002.html   # ICANN Error page regression (pin in manifest when present)
```

P0.3E parser regressions require `page-0001.html` bytes matching the provenance pin when present.
